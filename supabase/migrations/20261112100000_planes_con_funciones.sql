-- Sesión 042 · Planes con funciones: Gratis, Esencial y Pro (docs/05 §9.38).
-- RN-11, RN-16, RN-41, RF-36, RF-37, RF-39, RF-40, RF-82, RF-120 · RNF-20.
--
-- Decisión del Product Owner: el Trial de 7 días desaparece. Toda empresa nueva
-- entra al plan Gratis, sin vencimiento. Las funciones de cada plan son datos
-- de `planes` (incluye_*), las verifica la base (`privado.plan_incluye`) y al
-- vencer un plan de pago la empresa baja a Gratis sin borrar nada.

-- ---------------------------------------------------------------------------
-- PLANES: es_trial → es_gratuito, sin dias_trial, con banderas de funciones
-- ---------------------------------------------------------------------------
alter table public.planes drop constraint planes_dias_solo_en_trial;
alter table public.planes drop constraint planes_dias_trial_check;
alter table public.planes drop constraint planes_dias_trial_tope;
alter table public.planes drop constraint planes_trial_de_empresa_gratis;
drop index public.planes_un_solo_trial;

alter table public.planes rename column es_trial to es_gratuito;
alter table public.planes drop column dias_trial;

alter table public.planes
  add column incluye_proyecto_ia   boolean not null default false,
  add column incluye_sugerencias   boolean not null default false,
  add column incluye_documento_ia  boolean not null default false,
  add column incluye_postulaciones boolean not null default false,
  add column incluye_consultores   boolean not null default false;

alter table public.planes
  add constraint planes_gratuito_de_empresa_gratis
    check (not es_gratuito or (rol = 'empresa' and precio_mensual = 0 and precio_anual = 0));
-- RN-41: las funciones son de los planes de empresa; el de consultor no cambia.
alter table public.planes
  add constraint planes_funciones_solo_de_empresa
    check (rol = 'empresa' or not (incluye_proyecto_ia or incluye_sugerencias or incluye_documento_ia
                                   or incluye_postulaciones or incluye_consultores));
create unique index planes_un_solo_gratuito on public.planes (es_gratuito) where es_gratuito;

comment on column public.planes.es_gratuito is
  'RN-11 (sesión 042): el plan Gratis, de empresa, sin vencimiento. Como máximo uno.';
comment on column public.planes.incluye_proyecto_ia is 'RN-41: crear proyecto con IA (CU-43) y editar apartado con IA (CU-47).';
comment on column public.planes.incluye_sugerencias is 'RN-41: sugerencias por compatibilidad (CU-10, RF-106).';
comment on column public.planes.incluye_documento_ia is 'RN-41: generar documento base con IA y ajustes (CU-33, CU-34).';
comment on column public.planes.incluye_postulaciones is 'RN-41: postulaciones, checklist y seguimiento (CU-11..13).';
comment on column public.planes.incluye_consultores is 'RN-41: directorio, encargos, calificar y compartir documentos (CU-19..24).';

-- El Trial pasa a ser Gratis: sin créditos y sin funciones de pago.
update public.planes
   set nombre = 'Gratis', creditos_ia_mensuales = 0, activo = true
 where es_gratuito;

update public.planes
   set incluye_proyecto_ia = true, incluye_sugerencias = true, incluye_documento_ia = true,
       incluye_postulaciones = true, incluye_consultores = false
 where rol = 'empresa' and not es_gratuito and nombre = 'Empresa Esencial';

update public.planes
   set incluye_proyecto_ia = true, incluye_sugerencias = true, incluye_documento_ia = true,
       incluye_postulaciones = true, incluye_consultores = true
 where rol = 'empresa' and not es_gratuito and nombre = 'Empresa Pro';

-- ---------------------------------------------------------------------------
-- SUSCRIPCIONES: estado y modalidad `gratis`, sin vencimiento
-- ---------------------------------------------------------------------------
alter table public.suscripciones drop constraint suscripciones_estado_check;
alter table public.suscripciones drop constraint suscripciones_modalidad_check;
alter table public.suscripciones drop constraint suscripciones_rango_fechas;
drop index public.suscripciones_un_trial_por_cuenta;
alter table public.suscripciones alter column fecha_vencimiento drop not null;

-- Las suscripciones trial (al cierre de la sesión 041: 4, todas vencidas) pasan
-- a Gratis. Los créditos de paquete se conservan.
alter table public.suscripciones disable trigger suscripciones_validar_plan;
update public.suscripciones
   set modalidad = 'gratis',
       estado = 'gratis',
       fecha_inicio = privado.hoy_colombia(),
       fecha_vencimiento = null,
       creditos_usados_periodo = 0,
       periodo_creditos_inicio = privado.hoy_colombia()
 where modalidad = 'trial';
alter table public.suscripciones enable trigger suscripciones_validar_plan;

alter table public.suscripciones
  add constraint suscripciones_estado_check
    check (estado in ('gratis', 'activa', 'en_gracia', 'vencida', 'suspendida')),
  add constraint suscripciones_modalidad_check
    check (modalidad in ('gratis', 'mensual', 'anual')),
  add constraint suscripciones_vencimiento_segun_modalidad
    check ((modalidad = 'gratis') = (fecha_vencimiento is null)),
  add constraint suscripciones_rango_fechas
    check (fecha_vencimiento is null or fecha_inicio <= fecha_vencimiento);
create unique index suscripciones_una_gratis_por_cuenta on public.suscripciones (usuario_id) where modalidad = 'gratis';

-- ---------------------------------------------------------------------------
-- FUNCIONES NUEVAS: plan efectivo y funciones incluidas (RN-41)
-- ---------------------------------------------------------------------------
create or replace function privado.plan_efectivo(p_usuario uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_id
       from public.suscripciones s
      where s.usuario_id = p_usuario
        and (s.estado = 'gratis'
             or (s.estado in ('activa', 'en_gracia') and s.fecha_vencimiento + 5 >= privado.hoy_colombia()))
      order by (s.estado = 'gratis'), s.fecha_vencimiento desc nulls last
      limit 1),
    -- Vencida que el job no alcanzó a mover, suspendida o sin fila: la empresa
    -- queda en Gratis (RN-16). Otros roles no tienen plan efectivo.
    (select p.id from public.planes p
      where p.es_gratuito
        and exists (select 1 from public.perfiles pf where pf.id = p_usuario and pf.rol = 'empresa')
      limit 1)
  );
$$;

create or replace function privado.plan_incluye(p_usuario uuid, p_funcion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case p_funcion
             when 'proyecto_ia'   then p.incluye_proyecto_ia
             when 'sugerencias'   then p.incluye_sugerencias
             when 'documento_ia'  then p.incluye_documento_ia
             when 'postulaciones' then p.incluye_postulaciones
             when 'consultores'   then p.incluye_consultores
           end
      from public.planes p
     where p.id = privado.plan_efectivo(p_usuario)
  ), false);
$$;

-- Para las políticas RLS: la sesión, sin poder preguntar por otra cuenta.
create or replace function privado.sesion_incluye(p_funcion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.plan_incluye(auth.uid(), p_funcion);
$$;

revoke all on function privado.plan_efectivo(uuid) from public, anon, authenticated;
revoke all on function privado.plan_incluye(uuid, text) from public, anon, authenticated;
revoke all on function privado.sesion_incluye(text) from public, anon;
grant execute on function privado.sesion_incluye(text) to authenticated;

-- RF-120: lo que la pantalla necesita para pintar los bloqueos, con la misma regla.
create or replace function public.mi_plan_efectivo()
returns table (plan_id uuid, nombre text, es_gratuito boolean,
               incluye_proyecto_ia boolean, incluye_sugerencias boolean, incluye_documento_ia boolean,
               incluye_postulaciones boolean, incluye_consultores boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre, p.es_gratuito, p.incluye_proyecto_ia, p.incluye_sugerencias,
         p.incluye_documento_ia, p.incluye_postulaciones, p.incluye_consultores
    from public.planes p
   where p.id = privado.plan_efectivo(auth.uid());
$$;
revoke all on function public.mi_plan_efectivo() from public, anon;
grant execute on function public.mi_plan_efectivo() to authenticated;

-- ---------------------------------------------------------------------------
-- FUNCIONES QUE CAMBIAN POR EL RETIRO DEL TRIAL
-- ---------------------------------------------------------------------------
create or replace function privado.tiene_suscripcion_vigente(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.suscripciones s
    where s.usuario_id = p_usuario
      and (s.estado = 'gratis'
           or (s.estado in ('activa', 'en_gracia') and s.fecha_vencimiento + 5 >= privado.hoy_colombia()))
  );
$$;

create or replace function privado.validar_plan_de_suscripcion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_gratuito boolean;
begin
  select p.es_gratuito into v_gratuito from public.planes p where p.id = new.plan_id;
  if (new.modalidad = 'gratis') is distinct from v_gratuito then
    raise exception 'La modalidad gratis exige el plan gratuito, y el plan gratuito solo admite la modalidad gratis'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function privado.crear_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- RN-06: solo `consultor` produce consultor; cualquier otro valor, empresa.
  v_rol      text := case when v_meta ->> 'rol' = 'consultor' then 'consultor' else 'empresa' end;
  v_plan     uuid;
begin
  insert into public.perfiles (id, nombre, rol, nombre_empresa, telefono, consentimiento_datos_at)
  values (
    new.id,
    nullif(trim(v_meta ->> 'nombre'), ''),
    v_rol,
    case when v_rol = 'empresa' then nullif(trim(v_meta ->> 'nombre_empresa'), '') end,
    nullif(trim(v_meta ->> 'telefono'), ''),
    case when v_meta ->> 'consentimiento_datos' = 'true' then now() end
  );

  if v_rol = 'empresa' then
    select p.id into v_plan
    from public.planes p
    where p.es_gratuito and p.activo;

    if v_plan is null then
      raise exception 'No hay un plan gratuito activo: no se puede registrar la empresa';
    end if;

    -- Sesión 042 (RN-11): la empresa entra a Gratis, sin vencimiento.
    insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
    values (new.id, v_plan, 'gratis', 'gratis', privado.hoy_colombia(), null);
  else
    insert into public.consultor_perfiles (id, nombre_profesional)
    values (new.id, nullif(trim(v_meta ->> 'nombre'), ''));
  end if;

  return new;
end;
$$;

create or replace function privado.reiniciar_creditos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := privado.hoy_colombia();
  v_reiniciadas integer;
begin
  update public.suscripciones
     set creditos_usados_periodo = 0,
         periodo_creditos_inicio = (
           periodo_creditos_inicio
           + make_interval(months => (
               (extract(year from age(v_hoy, periodo_creditos_inicio)) * 12
                + extract(month from age(v_hoy, periodo_creditos_inicio)))::int
             ))
         )::date
   where estado in ('activa', 'gratis')
     and periodo_creditos_inicio + interval '1 month' <= v_hoy;
  get diagnostics v_reiniciadas = row_count;
  return v_reiniciadas;
end;
$$;

-- RF-39, RN-16 (sesión 042): al terminar la gracia, la empresa baja a Gratis.
drop function privado.vencer_suscripciones();
create function privado.vencer_suscripciones()
returns table (en_gracia integer, a_gratis integer, vencidas integer, encargos_cancelados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := privado.hoy_colombia();
  v_gratis_plan uuid;
  v_gracia integer;
  v_a_gratis integer;
  v_vencidas integer;
  v_cancelados integer;
  v_consultores uuid[];
begin
  select p.id into v_gratis_plan from public.planes p where p.es_gratuito limit 1;

  update public.suscripciones s
     set estado = 'en_gracia'
   where s.estado = 'activa'
     and s.fecha_vencimiento < v_hoy;
  get diagnostics v_gracia = row_count;

  -- Empresas: a Gratis, sin borrar nada; los créditos de paquete se conservan.
  update public.suscripciones s
     set plan_id = v_gratis_plan,
         modalidad = 'gratis',
         estado = 'gratis',
         fecha_inicio = v_hoy,
         fecha_vencimiento = null,
         creditos_usados_periodo = 0,
         periodo_creditos_inicio = v_hoy
    from public.perfiles p
   where p.id = s.usuario_id
     and p.rol = 'empresa'
     and v_gratis_plan is not null
     and s.estado in ('activa', 'en_gracia')
     and s.fecha_vencimiento + 5 < v_hoy;
  get diagnostics v_a_gratis = row_count;

  -- Consultores: vencida, como antes (RN-10, RN-29).
  with vencen as (
    update public.suscripciones s
       set estado = 'vencida'
     where s.estado in ('activa', 'en_gracia')
       and s.fecha_vencimiento + 5 < v_hoy
    returning s.usuario_id
  )
  select count(*)::integer,
         coalesce(array_agg(v.usuario_id) filter (where p.rol = 'consultor'), '{}')
    into v_vencidas, v_consultores
  from vencen v
  join public.perfiles p on p.id = v.usuario_id;

  update public.encargos e
     set estado = 'cancelado',
         motivo_cancelacion = 'Suscripción del consultor vencida'
   where e.consultor_id = any (v_consultores)
     and e.estado in ('en_curso', 'pendiente');
  get diagnostics v_cancelados = row_count;

  return query select v_gracia, v_a_gratis, v_vencidas, v_cancelados;
end;
$$;
revoke all on function privado.vencer_suscripciones() from public, anon, authenticated;

-- CU-31 pasos 1 y 6 (sesión 042): las funciones del plan, sin p_dias_trial.
drop function public.guardar_plan(uuid, text, text, numeric, numeric, int, boolean, int);
create function public.guardar_plan(
  p_id uuid, p_nombre text, p_rol text, p_precio_mensual numeric, p_precio_anual numeric,
  p_creditos int, p_activo boolean,
  p_incluye_proyecto_ia boolean default null, p_incluye_sugerencias boolean default null,
  p_incluye_documento_ia boolean default null, p_incluye_postulaciones boolean default null,
  p_incluye_consultores boolean default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.planes%rowtype;
  v_id uuid;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  if p_rol is null or p_rol not in ('empresa', 'consultor') then
    raise exception 'Rol inválido' using errcode = '23514';
  end if;
  -- RN-41: las funciones son de los planes de empresa; el de consultor no las lleva.
  -- Una bandera nula conserva la del plan al editar y es falsa al crear.
  if p_rol = 'consultor' and (coalesce(p_incluye_proyecto_ia, false) or coalesce(p_incluye_sugerencias, false)
                              or coalesce(p_incluye_documento_ia, false) or coalesce(p_incluye_postulaciones, false)
                              or coalesce(p_incluye_consultores, false)) then
    raise exception 'Las funciones son de los planes de empresa' using hint = 'funciones_de_empresa';
  end if;

  if exists (
    select 1 from public.planes p
    where p.rol = p_rol and lower(trim(p.nombre)) = lower(trim(p_nombre))
      and p.id is distinct from p_id
  ) then
    raise exception 'Ya hay un plan con ese nombre para ese rol' using hint = 'nombre_repetido';
  end if;

  if p_id is null then
    insert into public.planes (nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, activo,
                               incluye_proyecto_ia, incluye_sugerencias, incluye_documento_ia,
                               incluye_postulaciones, incluye_consultores)
    values (trim(p_nombre), p_rol, p_precio_mensual, p_precio_anual, p_creditos, coalesce(p_activo, true),
            coalesce(p_incluye_proyecto_ia, false), coalesce(p_incluye_sugerencias, false),
            coalesce(p_incluye_documento_ia, false), coalesce(p_incluye_postulaciones, false),
            coalesce(p_incluye_consultores, false))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_plan from public.planes where id = p_id for update;
  if not found then
    raise exception 'El plan no existe' using hint = 'plan_no_existe';
  end if;

  if v_plan.es_gratuito then
    -- Sin plan gratuito activo, de empresa y gratis no hay registro de empresas (crear_cuenta).
    if p_rol <> 'empresa' or p_precio_mensual <> 0 or p_precio_anual <> 0 or not coalesce(p_activo, true) then
      raise exception 'El plan Gratis sigue siendo de empresa, gratis y activo' using hint = 'gratuito_fijo';
    end if;
  elsif p_rol <> v_plan.rol and exists (select 1 from public.suscripciones s where s.plan_id = p_id) then
    raise exception 'El plan tiene suscripciones: no cambia de rol' using hint = 'plan_en_uso';
  end if;

  update public.planes
     set nombre = trim(p_nombre),
         rol = p_rol,
         precio_mensual = p_precio_mensual,
         precio_anual = p_precio_anual,
         creditos_ia_mensuales = p_creditos,
         activo = coalesce(p_activo, true),
         incluye_proyecto_ia = coalesce(p_incluye_proyecto_ia, v_plan.incluye_proyecto_ia),
         incluye_sugerencias = coalesce(p_incluye_sugerencias, v_plan.incluye_sugerencias),
         incluye_documento_ia = coalesce(p_incluye_documento_ia, v_plan.incluye_documento_ia),
         incluye_postulaciones = coalesce(p_incluye_postulaciones, v_plan.incluye_postulaciones),
         incluye_consultores = coalesce(p_incluye_consultores, v_plan.incluye_consultores)
   where id = p_id;
  return p_id;
end;
$$;
revoke all on function public.guardar_plan(uuid, text, text, numeric, numeric, int, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.guardar_plan(uuid, text, text, numeric, numeric, int, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

drop function public.tablero_suscripciones();
create function public.tablero_suscripciones()
returns table (gratis bigint, activas bigint, en_gracia bigint, vencidas bigint, suspendidas bigint,
               generaciones_exitosas bigint, generaciones_fallidas bigint, ajustes bigint,
               creditos_descontados bigint, costo_usd numeric)
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
  select (select count(*) from public.suscripciones where estado = 'gratis'),
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
revoke all on function public.tablero_suscripciones() from public, anon;
grant execute on function public.tablero_suscripciones() to authenticated;

-- ---------------------------------------------------------------------------
-- FUNCIONES QUE EJERCEN UNA FUNCIÓN DEL PLAN (RN-41, RF-40)
-- Cuerpos tomados de su definición vigente; solo cambia la verificación.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activar_suscripcion(p_usuario uuid, p_plan uuid, p_modalidad text, p_monto numeric, p_fecha_pago date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_hoy date := privado.hoy_colombia();
  v_rol text;
  v_plan public.planes%rowtype;
  v_sus public.suscripciones%rowtype;
  v_periodo interval;
  v_id uuid;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;

  select p.rol into v_rol from public.perfiles p where p.id = p_usuario;
  if v_rol is null or v_rol not in ('empresa', 'consultor') then
    raise exception 'La cuenta no existe o no es de empresa ni de consultor' using hint = 'cuenta_invalida';
  end if;

  select * into v_plan from public.planes where id = p_plan;
  if not found or not v_plan.activo or v_plan.es_gratuito or v_plan.rol <> v_rol then
    raise exception 'El plan no está activo o no es del rol de la cuenta' using hint = 'plan_invalido';
  end if;

  -- CU-28: el consultor nunca paga antes de ser aprobado.
  if v_rol = 'consultor' and not exists (
    select 1 from public.consultor_perfiles c where c.id = p_usuario and c.estado_perfil = 'aprobado'
  ) then
    raise exception 'El perfil del consultor no está aprobado' using hint = 'consultor_no_aprobado';
  end if;

  if p_modalidad is null or p_modalidad not in ('mensual', 'anual') then
    raise exception 'Modalidad inválida' using hint = 'dato_invalido';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 1000000000 then
    raise exception 'El monto debe ser mayor que cero' using hint = 'dato_invalido';
  end if;
  if p_fecha_pago is null or p_fecha_pago > v_hoy then
    raise exception 'La fecha del pago no puede ser futura' using hint = 'dato_invalido';
  end if;

  v_periodo := case p_modalidad when 'anual' then interval '12 months' else interval '1 month' end;

  -- Una suscripción por cuenta (docs/05 §9.28): se bloquea para que dos
  -- activaciones simultáneas no se pisen.
  select * into v_sus from public.suscripciones s
   where s.usuario_id = p_usuario
   order by s.fecha_vencimiento desc
   limit 1
   for update;

  if found and v_sus.estado = 'activa' and v_sus.plan_id = p_plan
     and v_sus.modalidad = p_modalidad and v_sus.fecha_vencimiento >= v_hoy then
    -- Renovación anticipada: solo corre el vencimiento; el cupo sigue su ciclo.
    update public.suscripciones
       set fecha_vencimiento = ((v_sus.fecha_vencimiento + 1) + v_periodo)::date - 1,
           activada_por = auth.uid()
     where id = v_sus.id;
    v_id := v_sus.id;
  elsif found then
    update public.suscripciones
       set plan_id = p_plan,
           modalidad = p_modalidad,
           estado = 'activa',
           fecha_inicio = v_hoy,
           fecha_vencimiento = (v_hoy + v_periodo)::date - 1,
           creditos_usados_periodo = 0,
           periodo_creditos_inicio = v_hoy,
           activada_por = auth.uid()
     where id = v_sus.id;
    v_id := v_sus.id;
  else
    insert into public.suscripciones
      (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento, periodo_creditos_inicio, activada_por)
    values
      (p_usuario, p_plan, p_modalidad, 'activa', v_hoy, (v_hoy + v_periodo)::date - 1, v_hoy, auth.uid())
    returning id into v_id;
  end if;

  insert into public.pagos_suscripcion (suscripcion_id, monto, fecha_pago, medio, registrado_por, concepto, plan_id, modalidad)
  values (v_id, p_monto, p_fecha_pago, 'manual', auth.uid(), 'suscripcion', p_plan, p_modalidad);

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.suspender_suscripcion(p_suscripcion uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sus public.suscripciones%rowtype;
  v_rol text;
  v_cancelados integer := 0;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;

  select * into v_sus from public.suscripciones where id = p_suscripcion for update;
  if not found then
    raise exception 'La suscripción no existe' using hint = 'suscripcion_no_existe';
  end if;
  if v_sus.estado not in ('gratis', 'activa', 'en_gracia') then
    raise exception 'Solo se suspende una suscripción con acceso' using hint = 'estado_invalido';
  end if;

  update public.suscripciones set estado = 'suspendida' where id = p_suscripcion;

  -- RN-29, como el job al vencer (CU-32 paso 5): el trigger de §9.3 revoca
  -- las autorizaciones de documento de los que estaban en curso (RF-76).
  select p.rol into v_rol from public.perfiles p where p.id = v_sus.usuario_id;
  if v_rol = 'consultor' then
    update public.encargos e
       set estado = 'cancelado',
           motivo_cancelacion = 'Suscripción del consultor suspendida'
     where e.consultor_id = v_sus.usuario_id
       and e.estado in ('en_curso', 'pendiente');
    get diagnostics v_cancelados = row_count;
  end if;
  return v_cancelados;
end;
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_estructuracion(p_usuario uuid)
 RETURNS TABLE(reserva_id uuid, instrucciones text, modelo text, precio_entrada_usd_mtok numeric, precio_salida_usd_mtok numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sus uuid;
  v_pl public.plantillas_proyecto%rowtype;
  v_reserva uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa crea proyectos' using hint = 'no_es_empresa';
  end if;

  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(p_usuario, 'proyecto_ia') then
    raise exception 'El plan no incluye el proyecto con IA' using hint = 'funcion_no_incluida';
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
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_transcripcion(p_usuario uuid)
 RETURNS TABLE(consumo_id uuid, modelo text, precio_usd_min numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sus uuid;
  v_hoy int;
  v_pl public.plantillas_generacion%rowtype;
  v_consumo uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa dicta proyectos' using hint = 'no_es_empresa';
  end if;

  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(p_usuario, 'proyecto_ia') then
    raise exception 'El plan no incluye el proyecto con IA' using hint = 'funcion_no_incluida';
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
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_edicion_apartado(p_usuario uuid, p_proyecto uuid)
 RETURNS TABLE(reserva_id uuid, modelo text, precio_entrada_usd_mtok numeric, precio_salida_usd_mtok numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(p_usuario, 'proyecto_ia') then
    raise exception 'El plan no incluye el proyecto con IA' using hint = 'funcion_no_incluida';
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
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_generacion(p_usuario uuid, p_proyecto uuid, p_convocatoria uuid)
 RETURNS TABLE(documento_id uuid, version integer, plantilla_id uuid, plantilla text, modelo text, precio_entrada_usd_mtok numeric, precio_salida_usd_mtok numeric, tope_caracteres_tdr integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(p_usuario, 'documento_ia') then
    raise exception 'El plan no incluye el documento con IA' using hint = 'funcion_no_incluida';
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
$function$;

CREATE OR REPLACE FUNCTION public.preparar_ajuste(p_usuario uuid, p_documento uuid)
 RETURNS TABLE(ajustes_usados integer, cobra boolean, es_dueno boolean, plantilla text, modelo text, precio_entrada_usd_mtok numeric, precio_salida_usd_mtok numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- RN-28: cuenta el plan de la empresa dueña, también si pide el consultor.
  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(v_doc.usuario_id, 'documento_ia') then
    raise exception 'El plan no incluye los ajustes con IA' using hint = 'funcion_no_incluida';
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
$function$;

CREATE OR REPLACE FUNCTION public.sugerencias_proyecto(p_proyecto uuid)
 RETURNS TABLE(convocatoria_id uuid, tipo_proyecto boolean, sector boolean, tipo_entidad boolean, monto boolean, ubicacion boolean, coincidencias integer, porcentaje integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- CU-10, precondición: un plan que incluya las sugerencias (RN-41, RNF-20).
  if not privado.plan_incluye(auth.uid(), 'sugerencias') then
    raise exception 'El plan no incluye las sugerencias' using hint = 'funcion_no_incluida';
  end if;
  -- Antes lo decidía la RLS: solo el dueño ve su proyecto (RN-30).
  if not exists (select 1 from public.proyectos p where p.id = p_proyecto and p.usuario_id = auth.uid()) then
    raise exception 'El proyecto no existe' using hint = 'no_existe';
  end if;
  return query select * from privado.calcular_sugerencias(p_proyecto);
end;
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_postulacion(p_convocatoria uuid, p_proyecto uuid)
 RETURNS TABLE(id uuid, creada boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_id uuid;
  v_creada boolean := false;
begin
  if (select privado.rol_actual()) is distinct from 'empresa' then
    raise exception 'Solo una empresa inicia postulaciones' using errcode = '42501', hint = 'no_es_empresa';
  end if;

  -- CU-11 1b, RF-17: un plan que incluya las postulaciones (RN-41, RNF-20).
  if not (select privado.sesion_incluye('postulaciones')) then
    raise exception 'El plan no incluye las postulaciones' using hint = 'funcion_no_incluida';
  end if;

  -- Lo que la sesión no ve no existe para ella (RN-33, RN-30).
  if not exists (select 1 from public.convocatorias c where c.id = p_convocatoria) then
    raise exception 'La convocatoria no existe' using hint = 'convocatoria_no_existe';
  end if;
  if p_proyecto is not null and not exists (select 1 from public.proyectos p where p.id = p_proyecto) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;

  -- Dos clics seguidos no crean dos: se serializan por par.
  perform pg_advisory_xact_lock(hashtextextended(
    'postulacion:' || auth.uid()::text || ':' || p_convocatoria::text || ':' || coalesce(p_proyecto::text, '-'), 0));

  -- CU-11 1c, RN-35: la en curso del par, si existe.
  select p.id into v_id
    from public.postulaciones p
   where p.usuario_id = auth.uid()
     and p.convocatoria_id = p_convocatoria
     and p.proyecto_id is not distinct from p_proyecto
     and p.estado <> 'cerrada'
   order by p.creada_at
   limit 1;

  if v_id is null then
    insert into public.postulaciones (convocatoria_id, proyecto_id)
    values (p_convocatoria, p_proyecto)
    returning postulaciones.id into v_id;
    v_creada := true;
  end if;

  -- CU-22 paso 7, RN-25: el encargo en curso del par queda con su checklist.
  perform privado.vincular_postulacion_a_encargos(v_id);

  return query select v_id, v_creada;
end;
$function$;

CREATE OR REPLACE FUNCTION public.solicitar_encargo(p_proyecto uuid, p_consultor uuid, p_titulo text, p_descripcion text, p_tipo_ayuda text, p_convocatoria uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_titulo text := nullif(trim(p_titulo), '');
  v_descripcion text := nullif(trim(p_descripcion), '');
  v_convocatoria uuid;
  v_postulacion uuid;
  v_id uuid;
begin
  if privado.rol_actual() is distinct from 'empresa' then
    raise exception 'Solo una empresa solicita consultores' using errcode = '42501', hint = 'no_es_empresa';
  end if;
  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(v_uid, 'consultores') then
    raise exception 'El plan no incluye los consultores' using hint = 'funcion_no_incluida';
  end if;
  if not exists (select 1 from public.proyectos p where p.id = p_proyecto and p.usuario_id = v_uid) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;
  if v_titulo is null then
    raise exception 'La tarea lleva título' using hint = 'titulo_vacio';
  end if;
  if p_tipo_ayuda is null or p_tipo_ayuda not in ('convocatoria_especifica', 'buscar_convocatoria') then
    raise exception 'Tipo de ayuda no válido' using hint = 'tipo_ayuda_invalido';
  end if;

  if p_tipo_ayuda = 'convocatoria_especifica' then
    if p_convocatoria is null then
      raise exception 'Falta la convocatoria' using hint = 'falta_convocatoria';
    end if;
    if not exists (
      select 1 from public.convocatorias c
      where c.id = p_convocatoria
        and c.estado = 'publicada'
        and c.fecha_cierre >= privado.hoy_colombia()
    ) then
      raise exception 'La convocatoria no está publicada y vigente' using hint = 'convocatoria_no_vigente';
    end if;
    v_convocatoria := p_convocatoria;
    -- CU-19 2a: la postulación en curso del par se vincula sola.
    select po.id into v_postulacion
    from public.postulaciones po
    where po.usuario_id = v_uid
      and po.proyecto_id = p_proyecto
      and po.convocatoria_id = p_convocatoria
      and po.estado <> 'cerrada'
    limit 1;
  end if;

  if p_consultor is not null and not exists (
    select 1 from public.consultor_perfiles cp
    where cp.id = p_consultor and cp.estado_perfil = 'aprobado' and not cp.es_equipo_interno
  ) then
    raise exception 'El consultor no está disponible' using hint = 'consultor_no_disponible';
  end if;

  begin
    insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, descripcion_tarea,
                                 via, estado, tipo_ayuda, convocatoria_id, postulacion_id)
    values (p_proyecto, v_uid, p_consultor, v_titulo, v_descripcion,
            case when p_consultor is null then 'asignacion_interna' else 'directorio' end,
            case when p_consultor is null then 'esperando_asignacion' else 'pendiente' end,
            p_tipo_ayuda, v_convocatoria, v_postulacion)
    returning id into v_id;
  exception when unique_violation then
    if p_consultor is null then
      raise exception 'Ya hay una solicitud al equipo para este proyecto' using hint = 'ya_solicitado_equipo';
    end if;
    raise exception 'Ya hay una solicitud abierta con este consultor para este proyecto' using hint = 'ya_solicitado';
  end;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calificar_encargo(p_id uuid, p_estrellas integer, p_comentario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_estado text;
  v_consultor uuid;
  v_comentario text := nullif(trim(p_comentario), '');
begin
  select e.estado, e.consultor_id into v_estado, v_consultor from public.encargos e
  where e.id = p_id and e.empresa_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(auth.uid(), 'consultores') then
    raise exception 'El plan no incluye los consultores' using hint = 'funcion_no_incluida';
  end if;
  if v_estado = 'calificado' then
    raise exception 'El encargo ya tiene calificación' using hint = 'ya_calificado';
  end if;
  if v_estado <> 'completado' then
    raise exception 'Solo se califica un encargo completado' using hint = 'estado_no_permite';
  end if;
  if p_estrellas is null or p_estrellas not between 1 and 5 then
    raise exception 'Las estrellas van de 1 a 5' using hint = 'estrellas_invalidas';
  end if;
  if char_length(v_comentario) > 1000 then
    raise exception 'El comentario es demasiado largo' using hint = 'comentario_largo';
  end if;
  -- El trigger al_calificar pasa el encargo a calificado y recalcula el rating.
  insert into public.calificaciones (encargo_id, consultor_id, empresa_id, estrellas, comentario)
  values (p_id, v_consultor, auth.uid(), p_estrellas, v_comentario);
end;
$function$;

CREATE OR REPLACE FUNCTION public.elegir_propuesta(p_propuesta uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_encargo uuid;
  v_convocatoria uuid;
  v_empresa uuid;
  v_proyecto uuid;
  v_estado_encargo text;
  v_estado text;
  v_postulacion uuid;
begin
  select pr.encargo_id into v_encargo
    from public.encargo_propuestas pr
    join public.encargos e on e.id = pr.encargo_id
   where pr.id = p_propuesta and e.empresa_id = auth.uid();
  if not found then
    raise exception 'La propuesta no existe' using hint = 'no_existe';
  end if;
  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(auth.uid(), 'consultores') then
    raise exception 'El plan no incluye los consultores' using hint = 'funcion_no_incluida';
  end if;

  select e.estado, e.empresa_id, e.proyecto_id into v_estado_encargo, v_empresa, v_proyecto
    from public.encargos e where e.id = v_encargo for update;
  select pr.estado, pr.convocatoria_id into v_estado, v_convocatoria
    from public.encargo_propuestas pr where pr.id = p_propuesta for update;

  if v_estado_encargo <> 'en_curso' then
    raise exception 'El encargo ya no está en curso' using hint = 'estado_no_permite';
  end if;
  if exists (select 1 from public.encargo_propuestas pr where pr.encargo_id = v_encargo and pr.estado = 'elegida') then
    raise exception 'Ya elegiste una convocatoria para este encargo' using hint = 'ya_elegida';
  end if;
  if v_estado <> 'propuesta' then
    raise exception 'La propuesta ya fue resuelta' using hint = 'estado_no_permite';
  end if;
  -- RF-78: sigue publicada y vigente.
  if not exists (select 1 from public.convocatorias c
                 where c.id = v_convocatoria and c.estado = 'publicada'
                   and c.fecha_cierre >= privado.hoy_colombia()) then
    raise exception 'La convocatoria ya no está publicada y vigente' using hint = 'convocatoria_no_vigente';
  end if;

  update public.encargo_propuestas set estado = 'elegida', resuelta_at = now() where id = p_propuesta;
  update public.encargo_propuestas set estado = 'descartada', resuelta_at = now()
   where encargo_id = v_encargo and estado = 'propuesta';

  select po.id into v_postulacion
    from public.postulaciones po
   where po.usuario_id = v_empresa
     and po.proyecto_id = v_proyecto
     and po.convocatoria_id = v_convocatoria
     and po.estado <> 'cerrada'
   order by po.creada_at
   limit 1;

  update public.encargos
     set convocatoria_id = v_convocatoria,
         postulacion_id = coalesce(postulacion_id, v_postulacion)
   where id = v_encargo;
  return v_convocatoria;
end;
$function$;

CREATE OR REPLACE FUNCTION public.compartir_documento(p_usuario uuid, p_documento uuid, p_consultor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_doc public.documentos_generados%rowtype;
begin
  select * into v_doc from public.documentos_generados d
  where d.id = p_documento and d.usuario_id = p_usuario and d.estado in ('generado', 'editado', 'exportado')
  for update;
  if v_doc.id is null then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  -- RN-41 (sesión 042): el plan efectivo incluye la función.
  if not privado.plan_incluye(p_usuario, 'consultores') then
    raise exception 'El plan no incluye los consultores' using hint = 'funcion_no_incluida';
  end if;
  -- RN-22: la aceptación del encargo no da acceso por sí sola, pero sin encargo
  -- en curso sobre el proyecto tampoco se puede autorizar.
  if not exists (
    select 1 from public.encargos e
    where e.proyecto_id = v_doc.proyecto_id and e.consultor_id = p_consultor and e.estado = 'en_curso'
  ) then
    raise exception 'El consultor no tiene un encargo en curso sobre este proyecto' using hint = 'sin_encargo_en_curso';
  end if;

  update public.documentos_generados set compartido_con_consultor_id = p_consultor where id = p_documento;
end;
$function$;

-- ---------------------------------------------------------------------------
-- RLS (RNF-20): las mismas funciones también en las políticas
-- ---------------------------------------------------------------------------
drop policy "postulaciones: la empresa inicia las suyas" on public.postulaciones;
create policy "postulaciones: la empresa inicia las suyas" on public.postulaciones
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and estado = 'en_preparacion'
    and (select privado.rol_actual()) = 'empresa'
    and (select privado.sesion_incluye('postulaciones'))
    and exists (
      select 1 from public.convocatorias c
       where c.id = postulaciones.convocatoria_id
         and c.estado = 'publicada'
         and c.fecha_cierre >= (select privado.hoy_colombia())
    )
    and (proyecto_id is null or (select privado.es_dueno_proyecto(postulaciones.proyecto_id)))
  );

-- Sin la función, la postulación se lee y se descarga, pero no avanza (RN-41).
drop policy "postulaciones: la empresa dueña edita" on public.postulaciones;
create policy "postulaciones: la empresa dueña edita" on public.postulaciones
  for update to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.sesion_incluye('postulaciones')))
  with check (
    usuario_id = (select auth.uid())
    and (select privado.sesion_incluye('postulaciones'))
    and (proyecto_id is null or (select privado.es_dueno_proyecto(postulaciones.proyecto_id)))
  );

drop policy "postulacion_checklist: la empresa dueña marca" on public.postulacion_checklist;
create policy "postulacion_checklist: la empresa dueña marca" on public.postulacion_checklist
  for update to authenticated
  using ((select privado.es_dueno_postulacion(postulacion_checklist.postulacion_id))
         and (select privado.sesion_incluye('postulaciones')))
  with check ((select privado.es_dueno_postulacion(postulacion_checklist.postulacion_id))
              and (select privado.sesion_incluye('postulaciones')));

drop policy "calificaciones: la empresa califica su encargo completado" on public.calificaciones;
create policy "calificaciones: la empresa califica su encargo completado" on public.calificaciones
  for insert to authenticated
  with check (
    empresa_id = (select auth.uid())
    and (select privado.sesion_incluye('consultores'))
    and exists (
      select 1 from public.encargos e
       where e.id = calificaciones.encargo_id
         and e.empresa_id = (select auth.uid())
         and e.consultor_id = calificaciones.consultor_id
         and e.estado = 'completado'
    )
  );

-- ---------------------------------------------------------------------------
-- PORTADA (RF-82, sesión 042): las tarifas de la IA, como los planes activos,
-- son de lectura pública para explicar el crédito sin sesión.
-- ---------------------------------------------------------------------------
create policy "tarifas_ia: lectura pública" on public.tarifas_ia
  for select to anon
  using (true);
