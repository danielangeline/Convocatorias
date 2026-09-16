-- =============================================================================
-- Registro de cuentas y plan trial
-- docs/05-modelo-de-datos.md §9.2 y §9.11 punto 9 · RF-01, RF-37, RN-06, RN-11,
-- CU-14 · sesión 004
--
-- · El trial es un plan más (`es_trial`), con su duración en `dias_trial`: el
--   cupo del trial se calcula igual que el de cualquier plan y el administrador
--   puede cambiar créditos o días sin migración.
-- · La cuenta la crea la base: un trigger sobre auth.users crea el perfil y,
--   según el rol, la suscripción trial o el perfil de consultor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PLANES: plan trial
-- ---------------------------------------------------------------------------

alter table public.planes
  add column es_trial   boolean not null default false,
  add column dias_trial int check (dias_trial is null or dias_trial > 0),
  add constraint planes_dias_solo_en_trial check (es_trial = (dias_trial is not null)),
  -- RN-11: el trial es de empresa y gratis.
  add constraint planes_trial_de_empresa_gratis
    check (not es_trial or (rol = 'empresa' and precio_mensual = 0 and precio_anual = 0));

create unique index planes_un_solo_trial on public.planes (es_trial) where es_trial;

-- RF-37 (mod. v6, sesión 004): 7 días con 3 créditos.
insert into public.planes (nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, es_trial, dias_trial)
values ('Trial', 'empresa', 0, 0, 3, true, 7);

-- ---------------------------------------------------------------------------
-- SUSCRIPCIONES: el trial también referencia un plan
-- ---------------------------------------------------------------------------

alter table public.suscripciones
  drop constraint suscripciones_plan_fuera_de_trial,
  alter column plan_id set not null;

-- La modalidad trial va con el plan trial, y solo con él.
create or replace function privado.validar_plan_de_suscripcion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_es_trial boolean;
begin
  select p.es_trial into v_es_trial from public.planes p where p.id = new.plan_id;
  if (new.modalidad = 'trial') is distinct from v_es_trial then
    raise exception 'La modalidad trial exige el plan trial, y el plan trial solo admite la modalidad trial'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger suscripciones_validar_plan
  before insert or update of plan_id, modalidad on public.suscripciones
  for each row execute function privado.validar_plan_de_suscripcion();

-- ---------------------------------------------------------------------------
-- REGISTRO: perfil + trial o perfil de consultor
-- ---------------------------------------------------------------------------

-- Corre con los privilegios de su dueño porque quien inserta en auth.users es
-- el servicio de Auth, no el usuario. Ninguna tabla gana política de insert.
create or replace function privado.crear_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- RN-06: solo `consultor` produce consultor; cualquier otro valor, incluido
  -- `administrador`, produce empresa. El administrador se asigna a mano.
  v_rol      text := case when v_meta ->> 'rol' = 'consultor' then 'consultor' else 'empresa' end;
  v_plan     uuid;
  v_dias     int;
begin
  insert into public.perfiles (id, nombre, rol, nombre_empresa, telefono)
  values (
    new.id,
    nullif(trim(v_meta ->> 'nombre'), ''),
    v_rol,
    case when v_rol = 'empresa' then nullif(trim(v_meta ->> 'nombre_empresa'), '') end,
    nullif(trim(v_meta ->> 'telefono'), '')
  );

  if v_rol = 'empresa' then
    select p.id, p.dias_trial into v_plan, v_dias
    from public.planes p
    where p.es_trial and p.activo;

    -- Sin plan trial no se crea una empresa a medias: el registro falla.
    if v_plan is null then
      raise exception 'No hay un plan trial activo: no se puede registrar la empresa';
    end if;

    insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
    values (new.id, v_plan, 'trial', 'trial', current_date, current_date + v_dias);
  else
    -- CU-14: el consultor nace con perfil incompleto y sin suscripción (RN-11).
    insert into public.consultor_perfiles (id, nombre_profesional)
    values (new.id, nullif(trim(v_meta ->> 'nombre'), ''));
  end if;

  return new;
end;
$$;

revoke all on function privado.crear_cuenta() from public, anon, authenticated;
revoke all on function privado.validar_plan_de_suscripcion() from public, anon;

create trigger al_registrar_cuenta
  after insert on auth.users
  for each row execute function privado.crear_cuenta();
