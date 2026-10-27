-- =============================================================================
-- Crear el proyecto con IA a partir de una explicación (sesión 030)
-- docs/05-modelo-de-datos.md §9.29 · CU-43 · RF-96, RF-97, RF-52, RN-17, RN-37,
-- RNF-20, RNF-22
--
-- La estructuración cobra un crédito como la generación: se reserva al iniciar
-- (cuenta contra el cupo mientras corre), se cobra al completar y se libera sin
-- cobro si falla. La transcripción del dictado no cobra, pero solo la hace una
-- empresa con suscripción y crédito, con un tope diario.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. El modelo de transcripción y su precio viven en la plantilla (RNF-22)
-- ---------------------------------------------------------------------------

alter table public.plantillas_generacion
  add column modelo_transcripcion text not null default 'gpt-4o-mini-transcribe'
    check (modelo_transcripcion ~ '^[a-z0-9._-]{1,60}$'),
  add column precio_transcripcion_usd_min numeric not null default 0.003
    check (precio_transcripcion_usd_min >= 0);

-- ---------------------------------------------------------------------------
-- 2. Tipos de consumo nuevos (RF-52)
-- ---------------------------------------------------------------------------

alter table public.consumos_ia drop constraint consumos_ia_tipo_check;
alter table public.consumos_ia
  add constraint consumos_ia_tipo_check
  check (tipo in ('generacion', 'ajuste', 'estructuracion', 'transcripcion'));

-- ---------------------------------------------------------------------------
-- 3. Reserva de la estructuración (RN-17)
-- ---------------------------------------------------------------------------

create table public.reservas_estructuracion (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  plantilla_id uuid references public.plantillas_generacion (id),
  creada_at    timestamptz not null default now()
);

create index reservas_estructuracion_usuario_idx on public.reservas_estructuracion (usuario_id, creada_at);

-- RN-24: con RLS y política explícita. La empresa lee las suyas; nadie escribe
-- desde el cliente: solo las funciones de abajo, con service_role.
alter table public.reservas_estructuracion enable row level security;

create policy "reservas_estructuracion: la empresa lee las suyas"
  on public.reservas_estructuracion for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Reservas vivas de una empresa: generaciones en curso, ajustes que cobran y
-- estructuraciones en curso (§9.26, §9.29).
create or replace function privado.reservas_de(p_usuario uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.documentos_generados d
     where d.usuario_id = p_usuario and d.estado = 'generando')
    + (select count(*) from public.documentos_generados d
       where d.usuario_id = p_usuario and d.ajuste_cobra and d.ajuste_en_curso_at > now() - interval '5 minutes')
    + (select count(*) from public.reservas_estructuracion r
       where r.usuario_id = p_usuario and r.creada_at > now() - interval '5 minutes')
  )::int;
$$;

revoke all on function privado.reservas_de(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Estructurar (CU-43, RF-96)
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_estructuracion(p_usuario uuid)
returns table (
  reserva_id uuid,
  modelo text,
  precio_entrada_usd_mtok numeric,
  precio_salida_usd_mtok numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sus uuid;
  v_pl public.plantillas_generacion%rowtype;
  v_reserva uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa crea proyectos' using hint = 'no_es_empresa';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  -- Reservas huérfanas: el servidor murió a mitad. Se liberan sin crédito.
  with viejas as (
    delete from public.reservas_estructuracion r
    where r.usuario_id = p_usuario and r.creada_at < now() - interval '5 minutes'
    returning r.plantilla_id
  )
  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, plantilla_id)
  select p_usuario, p_usuario, 'estructuracion', false, 'La estructuración no terminó: se liberó la reserva', v.plantilla_id
  from viejas v;

  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) <= 0 then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  insert into public.reservas_estructuracion (usuario_id, plantilla_id)
  values (p_usuario, v_pl.id)
  returning id into v_reserva;

  return query select v_reserva, v_pl.modelo, v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok;
end;
$$;

create or replace function public.completar_estructuracion(
  p_reserva uuid,
  p_tokens_entrada int,
  p_tokens_salida int,
  p_costo numeric,
  p_modelo text,
  p_duracion_ms int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.reservas_estructuracion%rowtype;
  v_sus uuid;
begin
  delete from public.reservas_estructuracion r where r.id = p_reserva returning * into v_res;
  if v_res.id is null then
    raise exception 'La estructuración ya no está en curso' using hint = 'estructuracion_no_encontrada';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_res.usuario_id);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;
  perform privado.descontar_credito(v_sus);

  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_id, duracion_ms, credito_descontado)
  values
    (v_res.usuario_id, v_res.usuario_id, 'estructuracion', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, v_res.plantilla_id, p_duracion_ms, true);
end;
$$;

create or replace function public.fallar_estructuracion(
  p_reserva uuid,
  p_mensaje text,
  p_tokens_entrada int,
  p_tokens_salida int,
  p_costo numeric,
  p_modelo text,
  p_duracion_ms int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.reservas_estructuracion%rowtype;
begin
  delete from public.reservas_estructuracion r where r.id = p_reserva returning * into v_res;
  if v_res.id is null then
    return;
  end if;

  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, mensaje_error, modelo, plantilla_id, duracion_ms)
  values
    (v_res.usuario_id, v_res.usuario_id, 'estructuracion', p_tokens_entrada, p_tokens_salida, p_costo,
     false, left(p_mensaje, 500), p_modelo, v_res.plantilla_id, p_duracion_ms);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Transcribir el dictado (RF-97): sin crédito, con tope diario
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_transcripcion(p_usuario uuid)
returns table (
  modelo text,
  precio_usd_min numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sus uuid;
  v_hoy int;
  v_pl public.plantillas_generacion%rowtype;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa dicta proyectos' using hint = 'no_es_empresa';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  -- El dictado solo sirve para estructurar, que sí cobra: sin crédito no se gasta audio.
  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) <= 0 then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  select count(*) into v_hoy
  from public.consumos_ia c
  where c.usuario_id = p_usuario and c.tipo = 'transcripcion'
    and c.fecha >= (privado.hoy_colombia()::timestamp at time zone 'America/Bogota');
  if v_hoy >= 30 then
    raise exception 'Tope diario de transcripciones' using hint = 'tope_transcripciones';
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  return query select v_pl.modelo_transcripcion, v_pl.precio_transcripcion_usd_min;
end;
$$;

create or replace function public.registrar_transcripcion(
  p_usuario uuid,
  p_exito boolean,
  p_mensaje text,
  p_costo numeric,
  p_modelo text,
  p_duracion_ms int
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, costo_estimado, exito, mensaje_error, modelo, plantilla_id, duracion_ms)
  values
    (p_usuario, p_usuario, 'transcripcion', p_costo, p_exito, left(p_mensaje, 500), p_modelo,
     (select pg.id from public.plantillas_generacion pg where pg.activa limit 1), p_duracion_ms);
$$;

revoke all on function public.iniciar_estructuracion(uuid) from public, anon, authenticated;
revoke all on function public.completar_estructuracion(uuid, int, int, numeric, text, int) from public, anon, authenticated;
revoke all on function public.fallar_estructuracion(uuid, text, int, int, numeric, text, int) from public, anon, authenticated;
revoke all on function public.iniciar_transcripcion(uuid) from public, anon, authenticated;
revoke all on function public.registrar_transcripcion(uuid, boolean, text, numeric, text, int) from public, anon, authenticated;

grant execute on function public.iniciar_estructuracion(uuid) to service_role;
grant execute on function public.completar_estructuracion(uuid, int, int, numeric, text, int) to service_role;
grant execute on function public.fallar_estructuracion(uuid, text, int, int, numeric, text, int) to service_role;
grant execute on function public.iniciar_transcripcion(uuid) to service_role;
grant execute on function public.registrar_transcripcion(uuid, boolean, text, numeric, text, int) to service_role;
