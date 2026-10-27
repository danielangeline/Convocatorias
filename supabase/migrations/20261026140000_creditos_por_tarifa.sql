-- =============================================================================
-- Créditos por tarifa (sesión 030, decisión del Product Owner)
-- docs/05-modelo-de-datos.md §9.32 · RN-17, RN-18, RF-48, RF-50, RF-51, RF-100,
-- RF-36, RN-28, RNF-20
--
-- Hasta ahora cada uso cobraba 1 crédito. Desde aquí cada uso cobra su tarifa
-- (documento 100, proyecto con IA 50, ajuste desde el cuarto 10), que es un
-- dato administrable. Los saldos y paquetes existentes se multiplican por 100
-- para que nadie pierda lo que ya tenía, y los planes quedan en Trial 125,
-- Esencial 350 y Pro 800 (decisión del Product Owner).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tarifas (RF-100)
-- ---------------------------------------------------------------------------

create table public.tarifas_ia (
  accion          text primary key check (accion in ('generacion', 'estructuracion', 'ajuste')),
  creditos        int not null check (creditos between 1 and 100000),
  actualizado_por uuid references public.perfiles (id) on delete set null,
  actualizado_at  timestamptz not null default now()
);

insert into public.tarifas_ia (accion, creditos) values
  ('generacion', 100),
  ('estructuracion', 50),
  ('ajuste', 10);

-- RN-24: las tarifas son públicas para quien tiene sesión (la pantalla muestra
-- el costo de cada acción); nadie escribe directo: solo guardar_tarifa().
alter table public.tarifas_ia enable row level security;

create policy "tarifas_ia: quien tiene sesión las lee"
  on public.tarifas_ia for select to authenticated
  using (true);

create or replace function privado.tarifa(p_accion text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select t.creditos from public.tarifas_ia t where t.accion = p_accion;
$$;

revoke all on function privado.tarifa(text) from public, anon, authenticated;

create or replace function public.guardar_tarifa(p_accion text, p_creditos int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  if p_creditos is null or p_creditos < 1 or p_creditos > 100000 then
    raise exception 'La tarifa va de 1 a 100.000 créditos' using hint = 'dato_invalido';
  end if;
  update public.tarifas_ia
     set creditos = p_creditos, actualizado_por = auth.uid(), actualizado_at = now()
   where accion = p_accion;
  if not found then
    raise exception 'La acción no existe' using hint = 'tarifa_no_existe';
  end if;
end;
$$;

revoke all on function public.guardar_tarifa(text, int) from public, anon;
grant execute on function public.guardar_tarifa(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Topes y conversión de saldos (×100)
-- ---------------------------------------------------------------------------

alter table public.planes drop constraint planes_creditos_tope;
alter table public.planes add constraint planes_creditos_tope check (creditos_ia_mensuales <= 1000000);

alter table public.pagos_suscripcion drop constraint pagos_suscripcion_creditos_check;
alter table public.pagos_suscripcion add constraint pagos_suscripcion_creditos_check
  check (creditos is null or creditos between 1 and 100000);

alter table public.consumos_ia
  add column creditos int not null default 0 check (creditos >= 0),
  add constraint consumos_ia_creditos_solo_si_descontado check (credito_descontado or creditos = 0);

update public.consumos_ia set creditos = 100 where credito_descontado;
update public.suscripciones set creditos_usados_periodo = creditos_usados_periodo * 100, creditos_extra = creditos_extra * 100;
update public.pagos_suscripcion set creditos = creditos * 100 where creditos is not null;

update public.planes set creditos_ia_mensuales = 125 where rol = 'empresa' and dias_trial is not null;
update public.planes set creditos_ia_mensuales = 350 where rol = 'empresa' and nombre = 'Empresa Esencial';
update public.planes set creditos_ia_mensuales = 800 where rol = 'empresa' and nombre = 'Empresa Pro';

-- ---------------------------------------------------------------------------
-- 3. Descontar una cantidad: primero el plan, después los paquetes (RN-18)
-- ---------------------------------------------------------------------------

create or replace function privado.descontar_creditos(p_suscripcion uuid, p_cantidad int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incluidos int;
  v_usados int;
  v_extra int;
  v_del_plan int;
begin
  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'Tarifa inválida' using hint = 'sin_tarifa';
  end if;
  select coalesce(p.creditos_ia_mensuales, 0), s.creditos_usados_periodo, s.creditos_extra
    into v_incluidos, v_usados, v_extra
  from public.suscripciones s
  left join public.planes p on p.id = s.plan_id
  where s.id = p_suscripcion;

  v_del_plan := least(p_cantidad, greatest(v_incluidos - v_usados, 0));
  if p_cantidad - v_del_plan > v_extra then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;
  update public.suscripciones
     set creditos_usados_periodo = creditos_usados_periodo + v_del_plan,
         creditos_extra = creditos_extra - (p_cantidad - v_del_plan)
   where id = p_suscripcion;
end;
$$;

revoke all on function privado.descontar_creditos(uuid, int) from public, anon, authenticated;

-- Reservas vivas en créditos: cada uso en curso cuenta su tarifa (§9.26, §9.29).
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
    + (select count(*) from public.reservas_estructuracion r
       where r.usuario_id = p_usuario and r.creada_at > now() - interval '5 minutes') * coalesce(privado.tarifa('estructuracion'), 0)
  )::int;
$$;

revoke all on function privado.reservas_de(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Los usos cobran su tarifa
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_generacion(p_usuario uuid, p_proyecto uuid, p_convocatoria uuid)
returns table (
  documento_id uuid,
  version int,
  plantilla_id uuid,
  plantilla text,
  modelo text,
  precio_entrada_usd_mtok numeric,
  precio_salida_usd_mtok numeric,
  tope_caracteres_tdr int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sus uuid;
  v_pl public.plantillas_generacion%rowtype;
  v_version int;
  v_postulacion uuid;
  v_doc uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa genera documentos' using hint = 'no_es_empresa';
  end if;
  if not exists (select 1 from public.proyectos pr where pr.id = p_proyecto and pr.usuario_id = p_usuario) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;
  if not exists (select 1 from public.convocatorias c where c.id = p_convocatoria) then
    raise exception 'La convocatoria no existe' using hint = 'convocatoria_no_existe';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  with viejas as (
    delete from public.documentos_generados d
    where d.usuario_id = p_usuario and d.estado = 'generando' and d.creado_at < now() - interval '5 minutes'
    returning d.plantilla_id
  )
  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, plantilla_id)
  select p_usuario, p_usuario, 'generacion', false, 'La generación no terminó: se liberó la reserva', v.plantilla_id
  from viejas v;

  -- Cuentan las generaciones en curso y los ajustes que cobran (§9.26).
  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) < privado.tarifa('generacion') then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  select max(d.version) into v_version
  from public.documentos_generados d
  where d.proyecto_id = p_proyecto and d.convocatoria_id = p_convocatoria;

  select po.id into v_postulacion
  from public.postulaciones po
  where po.usuario_id = p_usuario and po.proyecto_id = p_proyecto and po.convocatoria_id = p_convocatoria
    and po.estado <> 'cerrada'
  order by po.creada_at desc
  limit 1;

  insert into public.documentos_generados
    (usuario_id, proyecto_id, convocatoria_id, postulacion_id, estado, version, plantilla_id)
  values
    (p_usuario, p_proyecto, p_convocatoria, v_postulacion, 'generando', coalesce(v_version, 0) + 1, v_pl.id)
  returning id into v_doc;

  return query select v_doc, coalesce(v_version, 0) + 1, v_pl.id, v_pl.contenido, v_pl.modelo,
    v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok, v_pl.tope_caracteres_tdr;
end;
$$;

create or replace function public.completar_generacion(
  p_documento uuid,
  p_titulo text,
  p_contenido text,
  p_pendientes text[],
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
  v_doc public.documentos_generados%rowtype;
  v_sus uuid;
begin
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.id is null or v_doc.estado <> 'generando' then
    raise exception 'La generación ya no está en curso' using hint = 'generacion_no_encontrada';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;
  perform privado.descontar_creditos(v_sus, privado.tarifa('generacion'));

  update public.documentos_generados
  set titulo = p_titulo,
      contenido = p_contenido,
      pendientes = coalesce(p_pendientes, '{}'),
      estado = 'generado',
      documento_padre_id = (
        select d.id from public.documentos_generados d
        where d.proyecto_id = v_doc.proyecto_id and d.convocatoria_id = v_doc.convocatoria_id
          and d.estado <> 'generando' and d.version < v_doc.version
        order by d.version desc
        limit 1
      )
  where id = p_documento;

  insert into public.consumos_ia
    (usuario_id, empresa_id, documento_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_id, duracion_ms, credito_descontado, creditos)
  values
    (v_doc.usuario_id, v_doc.usuario_id, p_documento, 'generacion', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, v_doc.plantilla_id, p_duracion_ms, true, privado.tarifa('generacion'));
end;
$$;

create or replace function public.preparar_ajuste(p_usuario uuid, p_documento uuid)
returns table (
  ajustes_usados int,
  cobra boolean,
  es_dueno boolean,
  plantilla text,
  modelo text,
  precio_entrada_usd_mtok numeric,
  precio_salida_usd_mtok numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_generados%rowtype;
  v_sus uuid;
  v_pl public.plantillas_generacion%rowtype;
  v_cobra boolean;
begin
  if not privado.accede_documento(p_usuario, p_documento) then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.ajuste_en_curso_at > now() - interval '5 minutes' then
    raise exception 'Ya hay un ajuste en curso sobre este documento' using hint = 'ajuste_en_curso';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'La empresa dueña no tiene suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  v_cobra := v_doc.ajustes_usados >= 3;
  if v_cobra then
    perform 1 from public.suscripciones s where s.id = v_sus for update;
    if privado.creditos_disponibles(v_sus) - privado.reservas_de(v_doc.usuario_id) < privado.tarifa('ajuste') then
      raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
    end if;
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  update public.documentos_generados set ajuste_en_curso_at = now(), ajuste_cobra = v_cobra where id = p_documento;

  return query select v_doc.ajustes_usados, v_cobra, v_doc.usuario_id = p_usuario,
    v_pl.contenido, v_pl.modelo, v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok;
end;
$$;

create or replace function public.completar_ajuste(
  p_usuario uuid,
  p_documento uuid,
  p_ajustes_previos int,
  p_contenido text,
  p_pendientes text[],
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
  v_doc public.documentos_generados%rowtype;
  v_sus uuid;
  v_cobra boolean;
begin
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.id is null or not privado.accede_documento(p_usuario, p_documento) then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  if v_doc.ajuste_en_curso_at is null then
    raise exception 'El ajuste no estaba reservado' using hint = 'ajuste_no_reservado';
  end if;
  if v_doc.ajustes_usados <> p_ajustes_previos then
    raise exception 'Otro ajuste se aplicó mientras tanto' using hint = 'ajuste_concurrente';
  end if;

  v_cobra := v_doc.ajustes_usados >= 3;
  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'La empresa dueña no tiene suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  if v_cobra then
    perform 1 from public.suscripciones s where s.id = v_sus for update;
    perform privado.descontar_creditos(v_sus, privado.tarifa('ajuste'));
  end if;

  update public.documentos_generados
  set contenido = p_contenido,
      pendientes = privado.pendientes_de(p_contenido),
      ajustes_usados = ajustes_usados + 1,
      estado = 'editado',
      ultima_edicion_por = p_usuario,
      ajuste_en_curso_at = null,
      ajuste_cobra = false
  where id = p_documento;

  insert into public.consumos_ia
    (usuario_id, empresa_id, documento_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_id, duracion_ms, credito_descontado, creditos)
  values
    (p_usuario, v_doc.usuario_id, p_documento, 'ajuste', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, (select pg.id from public.plantillas_generacion pg where pg.activa limit 1), p_duracion_ms, v_cobra,
     case when v_cobra then privado.tarifa('ajuste') else 0 end);
end;
$$;

create or replace function public.iniciar_estructuracion(p_usuario uuid)
returns table (
  reserva_id uuid,
  instrucciones text,
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
    returning r.plantilla_proyecto_id
  )
  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, plantilla_proyecto_id)
  select p_usuario, p_usuario, 'estructuracion', false, 'La estructuración no terminó: se liberó la reserva', v.plantilla_proyecto_id
  from viejas v;

  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) < privado.tarifa('estructuracion') then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  select * into v_pl from public.plantillas_proyecto pp where pp.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de creación de proyectos activa' using hint = 'sin_plantilla';
  end if;

  insert into public.reservas_estructuracion (usuario_id, plantilla_proyecto_id)
  values (p_usuario, v_pl.id)
  returning id into v_reserva;

  return query select v_reserva, v_pl.contenido, v_pl.modelo, v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok;
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
  perform privado.descontar_creditos(v_sus, privado.tarifa('estructuracion'));

  insert into public.consumos_ia
    (usuario_id, empresa_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_proyecto_id, duracion_ms, credito_descontado, creditos)
  values
    (v_res.usuario_id, v_res.usuario_id, 'estructuracion', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, v_res.plantilla_proyecto_id, p_duracion_ms, true, privado.tarifa('estructuracion'));
end;
$$;

create or replace function public.iniciar_transcripcion(p_usuario uuid)
returns table (
  consumo_id uuid,
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
  v_consumo uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa dicta proyectos' using hint = 'no_es_empresa';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  -- Serializa las peticiones de la misma empresa: el conteo y la reserva van juntos.
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) < privado.tarifa('estructuracion') then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  -- Una a la vez: la que sigue en curso (sin duración) de hace menos de 2 minutos.
  if exists (
    select 1 from public.consumos_ia c
    where c.usuario_id = p_usuario and c.tipo = 'transcripcion' and c.duracion_ms is null
      and c.fecha > now() - interval '2 minutes'
  ) then
    raise exception 'Ya hay una transcripción en curso' using hint = 'transcripcion_en_curso';
  end if;

  -- Cuentan todas las del día, también las en curso y las fallidas.
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

  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, modelo, plantilla_id)
  values (p_usuario, p_usuario, 'transcripcion', false, 'Transcripción en curso', v_pl.modelo_transcripcion, v_pl.id)
  returning id into v_consumo;

  return query select v_consumo, v_pl.modelo_transcripcion, v_pl.precio_transcripcion_usd_min;
end;
$$;

create or replace function public.otorgar_creditos_extra(
  p_suscripcion uuid,
  p_cantidad int,
  p_monto numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;

  select p.rol into v_rol
    from public.suscripciones s
    join public.perfiles p on p.id = s.usuario_id
   where s.id = p_suscripcion
   for update of s;
  if v_rol is null then
    raise exception 'La suscripción no existe' using hint = 'suscripcion_no_existe';
  end if;
  -- RN-28: el consultor no tiene cupo propio de IA.
  if v_rol <> 'empresa' then
    raise exception 'Los créditos de IA solo se otorgan a empresas' using hint = 'consultor_sin_creditos';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100000 then
    raise exception 'La cantidad va de 1 a 100.000 créditos' using hint = 'dato_invalido';
  end if;
  if p_monto is null or p_monto < 0 or p_monto > 1000000000 then
    raise exception 'Monto inválido' using hint = 'dato_invalido';
  end if;

  update public.suscripciones set creditos_extra = creditos_extra + p_cantidad where id = p_suscripcion;

  insert into public.pagos_suscripcion (suscripcion_id, monto, fecha_pago, medio, registrado_por, concepto, creditos)
  values (p_suscripcion, p_monto, privado.hoy_colombia(), 'manual', auth.uid(), 'paquete', p_cantidad);
end;
$$;

create or replace function public.tablero_suscripciones()
returns table (
  trial bigint,
  activas bigint,
  en_gracia bigint,
  vencidas bigint,
  suspendidas bigint,
  generaciones_exitosas bigint,
  generaciones_fallidas bigint,
  ajustes bigint,
  creditos_descontados bigint,
  costo_usd numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := (date_trunc('month', privado.hoy_colombia()::timestamp)) at time zone 'America/Bogota';
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  return query
  select (select count(*) from public.suscripciones where estado = 'trial'),
         (select count(*) from public.suscripciones where estado = 'activa'),
         (select count(*) from public.suscripciones where estado = 'en_gracia'),
         (select count(*) from public.suscripciones where estado = 'vencida'),
         (select count(*) from public.suscripciones where estado = 'suspendida'),
         count(*) filter (where c.tipo = 'generacion' and c.exito),
         count(*) filter (where c.tipo = 'generacion' and not c.exito),
         count(*) filter (where c.tipo = 'ajuste' and c.exito),
         coalesce(sum(c.creditos), 0)::bigint,
         coalesce(round(sum(c.costo_estimado), 4), 0)
    from public.consumos_ia c
   where c.fecha >= v_desde;
end;
$$;

drop function privado.descontar_credito(uuid);
