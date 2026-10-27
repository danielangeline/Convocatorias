-- Sesión 031 · RF-109, CU-47 · Editar un apartado del proyecto con IA
-- (decisión del Product Owner: 10 créditos, la IA propone y la empresa acepta).
-- docs/05 §9.35.
--
-- Mismo régimen que crear el proyecto con IA (§9.29): reserva mientras corre,
-- cobro solo si la propuesta llega válida, fallo sin cobro (RN-17). Reutiliza
-- `reservas_estructuracion` con una columna `accion`, para que `reservas_de`
-- cuente cada reserva por su tarifa.

-- 1. Tarifa administrable (RF-100)
alter table public.tarifas_ia drop constraint tarifas_ia_accion_check;
alter table public.tarifas_ia
  add constraint tarifas_ia_accion_check check (accion in ('generacion', 'estructuracion', 'ajuste', 'edicion_apartado'));
insert into public.tarifas_ia (accion, creditos) values ('edicion_apartado', 10)
on conflict (accion) do nothing;

-- 2. Tipo de consumo (RF-52)
alter table public.consumos_ia drop constraint consumos_ia_tipo_check;
alter table public.consumos_ia
  add constraint consumos_ia_tipo_check
  check (tipo in ('generacion', 'ajuste', 'estructuracion', 'transcripcion', 'edicion_apartado'));

-- 3. Reservas con su acción
alter table public.reservas_estructuracion
  add column accion text not null default 'estructuracion'
    constraint reservas_estructuracion_accion_check check (accion in ('estructuracion', 'edicion_apartado'));

create or replace function privado.reservas_de(p_usuario uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.documentos_generados d
     where d.usuario_id = p_usuario and d.estado = 'generando') * coalesce(privado.tarifa('generacion'), 0)
    + (select count(*) from public.documentos_generados d
       where d.usuario_id = p_usuario and d.ajuste_cobra and d.ajuste_en_curso_at > now() - interval '5 minutes') * coalesce(privado.tarifa('ajuste'), 0)
    + coalesce((select sum(coalesce(privado.tarifa(r.accion), 0)) from public.reservas_estructuracion r
                where r.usuario_id = p_usuario and r.creada_at > now() - interval '5 minutes'), 0)
  )::int;
$$;

revoke all on function privado.reservas_de(uuid) from public, anon, authenticated;

-- 4. Iniciar, completar y fallar la edición
create or replace function public.iniciar_edicion_apartado(p_usuario uuid, p_proyecto uuid)
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
  v_pl public.plantillas_proyecto%rowtype;
  v_reserva uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa edita proyectos' using hint = 'no_es_empresa';
  end if;
  -- RN-30: el proyecto es de quien pide.
  if not exists (select 1 from public.proyectos pr where pr.id = p_proyecto and pr.usuario_id = p_usuario) then
    raise exception 'El proyecto no existe' using hint = 'no_existe';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  -- Reservas huérfanas de esta acción: se liberan sin crédito.
  with viejas as (
    delete from public.reservas_estructuracion r
    where r.usuario_id = p_usuario and r.accion = 'edicion_apartado' and r.creada_at < now() - interval '5 minutes'
    returning r.plantilla_proyecto_id
  )
  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, plantilla_proyecto_id)
  select p_usuario, p_usuario, 'edicion_apartado', false, 'La edición no terminó: se liberó la reserva', v.plantilla_proyecto_id
  from viejas v;

  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) < privado.tarifa('edicion_apartado') then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  -- El modelo y su precio son los de la plantilla activa de proyectos (RF-99).
  select * into v_pl from public.plantillas_proyecto pp where pp.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de proyectos activa' using hint = 'sin_plantilla';
  end if;

  insert into public.reservas_estructuracion (usuario_id, plantilla_proyecto_id, accion)
  values (p_usuario, v_pl.id, 'edicion_apartado')
  returning id into v_reserva;

  return query select v_reserva, v_pl.modelo, v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok;
end;
$$;

create or replace function public.completar_edicion_apartado(
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
  delete from public.reservas_estructuracion r
  where r.id = p_reserva and r.accion = 'edicion_apartado'
  returning * into v_res;
  if v_res.id is null then
    raise exception 'La edición ya no está en curso' using hint = 'edicion_no_encontrada';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_res.usuario_id);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;
  perform privado.descontar_creditos(v_sus, privado.tarifa('edicion_apartado'));

  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_proyecto_id, duracion_ms, credito_descontado, creditos)
  values
    (v_res.usuario_id, v_res.usuario_id, 'edicion_apartado', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, v_res.plantilla_proyecto_id, p_duracion_ms, true, privado.tarifa('edicion_apartado'));
end;
$$;

create or replace function public.fallar_edicion_apartado(
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
  delete from public.reservas_estructuracion r
  where r.id = p_reserva and r.accion = 'edicion_apartado'
  returning * into v_res;
  if v_res.id is null then
    return;
  end if;

  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, mensaje_error, modelo, plantilla_proyecto_id, duracion_ms)
  values
    (v_res.usuario_id, v_res.usuario_id, 'edicion_apartado', p_tokens_entrada, p_tokens_salida, p_costo,
     false, left(p_mensaje, 500), p_modelo, v_res.plantilla_proyecto_id, p_duracion_ms);
end;
$$;

-- Solo el servidor, con la sesión ya verificada por el endpoint (RNF-20), como §9.29.
revoke all on function public.iniciar_edicion_apartado(uuid, uuid) from public, anon, authenticated;
revoke all on function public.completar_edicion_apartado(uuid, int, int, numeric, text, int) from public, anon, authenticated;
revoke all on function public.fallar_edicion_apartado(uuid, text, int, int, numeric, text, int) from public, anon, authenticated;
grant execute on function public.iniciar_edicion_apartado(uuid, uuid) to service_role;
grant execute on function public.completar_edicion_apartado(uuid, int, int, numeric, text, int) to service_role;
grant execute on function public.fallar_edicion_apartado(uuid, text, int, int, numeric, text, int) to service_role;
