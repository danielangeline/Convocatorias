-- =============================================================================
-- Planes, suscripciones y paquetes administrables
-- (CU-28..31 · RF-36, RF-38, RF-41, RF-42, RF-51, RF-82 · RN-11, RN-18, RN-28,
--  RN-29 · RNF-20, RNF-28)
-- docs/05-modelo-de-datos.md §9.28 · Sprint 5 · sesión 028
--
-- Hasta aquí el administrador podía insertar y actualizar planes, suscripciones
-- y pagos columna por columna desde el cliente, sin regla de negocio en medio.
-- Se retiran esas políticas y toda escritura pasa por funciones que exigen
-- administrador con aal2. También: planes semilla de docs/07 §10.2 y el job 3
-- con la fecha de Colombia.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Topes y columnas
-- ---------------------------------------------------------------------------

alter table public.planes
  add constraint planes_nombre_largo check (length(trim(nombre)) between 1 and 80),
  add constraint planes_precios_tope check (precio_mensual <= 100000000 and precio_anual <= 100000000),
  add constraint planes_creditos_tope check (creditos_ia_mensuales <= 1000),
  add constraint planes_dias_trial_tope check (dias_trial is null or dias_trial <= 60);

create unique index planes_nombre_por_rol on public.planes (rol, lower(trim(nombre)));

alter table public.pagos_suscripcion
  add column concepto  text not null default 'suscripcion' check (concepto in ('suscripcion', 'paquete')),
  add column plan_id   uuid references public.planes (id),
  add column modalidad text check (modalidad is null or modalidad in ('mensual', 'anual')),
  add column creditos  int check (creditos is null or creditos between 1 and 100),
  drop constraint pagos_suscripcion_monto_check,
  add constraint pagos_suscripcion_monto_check check (monto >= 0 and monto <= 1000000000),
  add constraint pagos_suscripcion_concepto_coherente check (
    (concepto = 'suscripcion' and creditos is null)
    or (concepto = 'paquete' and creditos is not null and plan_id is null and modalidad is null)
  );

-- ---------------------------------------------------------------------------
-- 2. Planes semilla (docs/07 §10.2, a validar con los pilotos)
-- ---------------------------------------------------------------------------

insert into public.planes (nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales)
select v.nombre, v.rol, v.mensual, v.anual, v.creditos
from (values
  ('Empresa Esencial', 'empresa',    89000,  890000, 10),
  ('Empresa Pro',      'empresa',   189000, 1890000, 30),
  ('Consultor',        'consultor',  69000,  690000,  0)
) as v (nombre, rol, mensual, anual, creditos)
where not exists (
  select 1 from public.planes p where p.rol = v.rol and lower(trim(p.nombre)) = lower(v.nombre)
);

-- ---------------------------------------------------------------------------
-- 3. Políticas: el administrador solo lee desde el cliente
-- ---------------------------------------------------------------------------

drop policy "planes: el administrador crea" on public.planes;
drop policy "planes: el administrador edita" on public.planes;
drop policy "suscripciones: el administrador crea" on public.suscripciones;
drop policy "suscripciones: el administrador edita" on public.suscripciones;
drop policy "pagos_suscripcion: el administrador registra" on public.pagos_suscripcion;

-- ---------------------------------------------------------------------------
-- 4. Funciones del panel
-- ---------------------------------------------------------------------------

create or replace function public.guardar_plan(
  p_id uuid,
  p_nombre text,
  p_rol text,
  p_precio_mensual numeric,
  p_precio_anual numeric,
  p_creditos int,
  p_activo boolean,
  p_dias_trial int default null
)
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

  if exists (
    select 1 from public.planes p
    where p.rol = p_rol and lower(trim(p.nombre)) = lower(trim(p_nombre))
      and p.id is distinct from p_id
  ) then
    raise exception 'Ya hay un plan con ese nombre para ese rol' using hint = 'nombre_repetido';
  end if;

  if p_id is null then
    insert into public.planes (nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, activo)
    values (trim(p_nombre), p_rol, p_precio_mensual, p_precio_anual, p_creditos, coalesce(p_activo, true))
    returning id into v_id;
    return v_id;
  end if;

  select * into v_plan from public.planes where id = p_id for update;
  if not found then
    raise exception 'El plan no existe' using hint = 'plan_no_existe';
  end if;

  if v_plan.es_trial then
    -- Sin trial activo, de empresa y gratis no hay registro de empresas (crear_cuenta).
    if p_rol <> 'empresa' or p_precio_mensual <> 0 or p_precio_anual <> 0 or not coalesce(p_activo, true) then
      raise exception 'El plan de prueba sigue siendo de empresa, gratis y activo' using hint = 'trial_fijo';
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
         dias_trial = case when v_plan.es_trial then coalesce(p_dias_trial, v_plan.dias_trial) else null end
   where id = p_id;
  return p_id;
end;
$$;

create or replace function public.activar_suscripcion(
  p_usuario uuid,
  p_plan uuid,
  p_modalidad text,
  p_monto numeric,
  p_fecha_pago date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  if not found or not v_plan.activo or v_plan.es_trial or v_plan.rol <> v_rol then
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
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100 then
    raise exception 'La cantidad va de 1 a 100 créditos' using hint = 'dato_invalido';
  end if;
  if p_monto is null or p_monto < 0 or p_monto > 1000000000 then
    raise exception 'Monto inválido' using hint = 'dato_invalido';
  end if;

  update public.suscripciones set creditos_extra = creditos_extra + p_cantidad where id = p_suscripcion;

  insert into public.pagos_suscripcion (suscripcion_id, monto, fecha_pago, medio, registrado_por, concepto, creditos)
  values (p_suscripcion, p_monto, privado.hoy_colombia(), 'manual', auth.uid(), 'paquete', p_cantidad);
end;
$$;

create or replace function public.suspender_suscripcion(p_suscripcion uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_sus.estado not in ('trial', 'activa', 'en_gracia') then
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
$$;

create or replace function public.cuentas_suscripcion_admin()
returns table (
  usuario_id uuid,
  rol text,
  nombre text,
  correo text,
  suscripcion_id uuid,
  plan_id uuid,
  plan_nombre text,
  modalidad text,
  estado text,
  fecha_inicio date,
  fecha_vencimiento date,
  creditos_incluidos int,
  creditos_usados int,
  creditos_extra int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  return query
  select pf.id,
         pf.rol,
         coalesce(nullif(trim(case when pf.rol = 'empresa' then pf.nombre_empresa else c.nombre_profesional end), ''), pf.nombre),
         u.email::text,
         s.id, s.plan_id, pl.nombre, s.modalidad, s.estado, s.fecha_inicio, s.fecha_vencimiento,
         pl.creditos_ia_mensuales, s.creditos_usados_periodo, s.creditos_extra
    from public.perfiles pf
    join auth.users u on u.id = pf.id
    left join public.consultor_perfiles c on c.id = pf.id
    left join lateral (
      select * from public.suscripciones x where x.usuario_id = pf.id order by x.fecha_vencimiento desc limit 1
    ) s on true
    left join public.planes pl on pl.id = s.plan_id
   where pf.rol = 'empresa'
      or (pf.rol = 'consultor' and (c.estado_perfil = 'aprobado' or s.id is not null))
   order by pf.creado_at desc;
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
         count(*) filter (where c.credito_descontado),
         coalesce(round(sum(c.costo_estimado), 4), 0)
    from public.consumos_ia c
   where c.fecha >= v_desde;
end;
$$;

revoke all on function public.guardar_plan(uuid, text, text, numeric, numeric, int, boolean, int) from public, anon;
revoke all on function public.activar_suscripcion(uuid, uuid, text, numeric, date) from public, anon;
revoke all on function public.otorgar_creditos_extra(uuid, int, numeric) from public, anon;
revoke all on function public.suspender_suscripcion(uuid) from public, anon;
revoke all on function public.cuentas_suscripcion_admin() from public, anon;
revoke all on function public.tablero_suscripciones() from public, anon;
grant execute on function public.guardar_plan(uuid, text, text, numeric, numeric, int, boolean, int) to authenticated;
grant execute on function public.activar_suscripcion(uuid, uuid, text, numeric, date) to authenticated;
grant execute on function public.otorgar_creditos_extra(uuid, int, numeric) to authenticated;
grant execute on function public.suspender_suscripcion(uuid) to authenticated;
grant execute on function public.cuentas_suscripcion_admin() to authenticated;
grant execute on function public.tablero_suscripciones() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Job 3 con la fecha de Colombia (RN-18)
-- ---------------------------------------------------------------------------

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
   where estado in ('activa', 'trial')
     and periodo_creditos_inicio + interval '1 month' <= v_hoy;
  get diagnostics v_reiniciadas = row_count;
  return v_reiniciadas;
end;
$$;

revoke all on function privado.reiniciar_creditos() from public, anon, authenticated;
grant execute on function privado.reiniciar_creditos() to service_role;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'reiniciar-creditos-ia'),
  command := 'select privado.reiniciar_creditos();'
);
