-- =============================================================================
-- Invitaciones de administrador por aceptación explícita del servidor
-- docs/05-modelo-de-datos.md §9.12 (rediseñado en la sesión 008) · RN-06,
-- RN-32, RF-86, RF-87
--
-- La migración 20260916140000 reconocía la invitación dentro del trigger de
-- registro leyendo app_metadata, pero Auth inserta el usuario sin app_metadata
-- y lo añade después: el trigger nunca la veía. Ahora el trigger vuelve a no
-- saber nada de invitaciones y el servidor convierte la cuenta con
-- aceptar_invitacion_admin(), que solo puede ejecutar service_role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Registro: sin rama de invitación (igual que en 20260916130000)
-- ---------------------------------------------------------------------------

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

    if v_plan is null then
      raise exception 'No hay un plan trial activo: no se puede registrar la empresa';
    end if;

    insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
    values (new.id, v_plan, 'trial', 'trial', current_date, current_date + v_dias);
  else
    insert into public.consultor_perfiles (id, nombre_profesional)
    values (new.id, nullif(trim(v_meta ->> 'nombre'), ''));
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Regla única de administrador con privilegios (§9.12)
-- ---------------------------------------------------------------------------

create or replace function privado.admin_vigente(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_usuario
      and p.rol = 'administrador'
      and p.admin_revocado_at is null
      -- Una invitación que venció sin activarse no da privilegios.
      and not exists (
        select 1 from public.invitaciones_admin i
        where i.usuario_id = p.id and i.estado = 'pendiente' and i.expira_at <= now()
      )
  );
$$;

revoke all on function privado.admin_vigente(uuid) from public, anon;
grant execute on function privado.admin_vigente(uuid) to authenticated, service_role;

create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and privado.admin_vigente(auth.uid());
$$;

-- Rol de la sesión para proxy.ts y obtenerSesion(): nulo si es un
-- administrador sin vigencia (revocado o con invitación vencida).
create or replace function public.rol_efectivo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when p.rol = 'administrador' and not privado.admin_vigente(p.id) then null
           else p.rol
         end
  from public.perfiles p
  where p.id = auth.uid();
$$;

revoke all on function public.rol_efectivo() from public, anon;
grant execute on function public.rol_efectivo() to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones solo para el servidor (service_role)
-- ---------------------------------------------------------------------------

-- RN-32: un correo con cuenta no recibe invitación.
create or replace function public.correo_tiene_cuenta(p_correo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_correo)));
$$;

revoke all on function public.correo_tiene_cuenta(text) from public, anon, authenticated;
grant execute on function public.correo_tiene_cuenta(text) to service_role;

-- Convierte en administrador la cuenta recién creada para una invitación.
create or replace function public.aceptar_invitacion_admin(p_invitacion uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invitaciones_admin%rowtype;
  v_correo  text;
  v_creado  timestamptz;
begin
  select * into v_inv from public.invitaciones_admin where id = p_invitacion for update;
  if not found or v_inv.estado <> 'pendiente' or v_inv.expira_at <= now() then
    raise exception 'La invitación no existe, no está pendiente o venció' using errcode = 'P0001';
  end if;
  if v_inv.usuario_id is not null then
    raise exception 'La invitación ya tiene una cuenta vinculada' using errcode = 'P0001';
  end if;

  select lower(u.email), u.created_at into v_correo, v_creado from auth.users u where u.id = p_usuario;
  if not found or v_correo is distinct from v_inv.correo then
    raise exception 'La cuenta no corresponde al correo invitado' using errcode = 'P0001';
  end if;
  -- La cuenta debe haberse creado para esta invitación, no ser una previa
  -- (RN-32). Margen de 2 minutos por la diferencia de reloj entre Auth y la base.
  if v_creado < v_inv.creada_at - interval '2 minutes' then
    raise exception 'La cuenta es anterior a la invitación' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles p where p.id = p_usuario and p.rol = 'administrador') then
    raise exception 'La cuenta ya es de administrador' using errcode = 'P0001';
  end if;

  update public.perfiles
  set rol = 'administrador', nombre = coalesce(nombre, v_inv.nombre), nombre_empresa = null
  where id = p_usuario;
  delete from public.suscripciones where usuario_id = p_usuario;
  delete from public.consultor_perfiles where id = p_usuario;
  update public.invitaciones_admin set usuario_id = p_usuario where id = p_invitacion;
end;
$$;

revoke all on function public.aceptar_invitacion_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.aceptar_invitacion_admin(uuid, uuid) to service_role;
