-- Vencimiento de suscripciones con la fecha de Colombia (RF-39, RF-40, RN-16,
-- RN-29 · CU-32 · docs/05 §9.7 · sesión 023, Sprint 4 paso 4).
--
-- El job 2 existe desde el Sprint 0, pero con `current_date` (UTC): desde las
-- 7 p. m. de Colombia una suscripción que vencía ese día ya contaba como
-- vencida, y el trial de quien se registraba de noche empezaba al día
-- siguiente. Aquí:
--   · todo lo de suscripciones pasa a `privado.hoy_colombia()`;
--   · el job ejecuta `privado.vencer_suscripciones()`, que además cancela los
--     encargos del consultor que vence (RN-29, CU-32 paso 5);
--   · el trial conserva los 5 días de gracia (decisión del Product Owner).
-- El job 3 (créditos) sigue con current_date: se revisa en el Sprint 5.

-- ---------------------------------------------------------------------------
-- 1. Valores por defecto y trial al registrarse
-- ---------------------------------------------------------------------------
alter table public.suscripciones
  alter column fecha_inicio set default privado.hoy_colombia(),
  alter column periodo_creditos_inicio set default privado.hoy_colombia();

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
  v_dias     int;
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
    select p.id, p.dias_trial into v_plan, v_dias
    from public.planes p
    where p.es_trial and p.activo;

    if v_plan is null then
      raise exception 'No hay un plan trial activo: no se puede registrar la empresa';
    end if;

    -- Sesión 023: el trial empieza el día de Colombia en que se registra.
    insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
    values (new.id, v_plan, 'trial', 'trial', privado.hoy_colombia(), privado.hoy_colombia() + v_dias);
  else
    insert into public.consultor_perfiles (id, nombre_profesional)
    values (new.id, nullif(trim(v_meta ->> 'nombre'), ''));
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. RF-40: acceso con trial, activa o en los 5 días de gracia (RN-16), con la
--    fecha de Colombia. Compara la fecha para no depender de que el job corra.
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
      and s.estado in ('trial', 'activa', 'en_gracia')
      and s.fecha_vencimiento + 5 >= privado.hoy_colombia()
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. RF-39 · El job: gracia, vencimiento y, para el consultor que vence, sus
--    encargos en curso y pendientes cancelados (RN-29, CU-32 paso 5). El
--    trigger de §9.3 revoca las autorizaciones de documento de los que estaban
--    en curso (RF-76). Devuelve los tres conteos para el historial de pg_cron
--    y las pruebas.
-- ---------------------------------------------------------------------------
create or replace function privado.vencer_suscripciones()
returns table (en_gracia integer, vencidas integer, encargos_cancelados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := privado.hoy_colombia();
  v_gracia integer;
  v_vencidas integer;
  v_cancelados integer;
  v_consultores uuid[];
begin
  update public.suscripciones s
     set estado = 'en_gracia'
   where s.estado in ('trial', 'activa')
     and s.fecha_vencimiento < v_hoy;
  get diagnostics v_gracia = row_count;

  with vencen as (
    update public.suscripciones s
       set estado = 'vencida'
     where s.estado = 'en_gracia'
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

  return query select v_gracia, v_vencidas, v_cancelados;
end;
$$;

revoke all on function privado.vencer_suscripciones() from public, anon, authenticated;
grant execute on function privado.vencer_suscripciones() to service_role;

-- El job ejecuta la función: mismo horario (00:05 en Colombia), mismo código
-- que las pruebas.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'vencer-suscripciones'),
  command := 'select * from privado.vencer_suscripciones();'
);
