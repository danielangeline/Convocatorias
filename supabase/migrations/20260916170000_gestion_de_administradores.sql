-- =============================================================================
-- Gestión de administradores por el Propietario: invitar, cancelar y revocar
-- docs/05-modelo-de-datos.md §9.12 (sesión 009) · CU-41, CU-42 · RN-06, RN-31,
-- RN-32, RF-86, RF-87
--
-- Las reglas de cada acción viven aquí y solo las ejecuta service_role. El
-- endpoint hace lo que no es SQL: enviar el correo y borrar o bloquear la
-- cuenta en Auth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cancelar borra la cuenta sin activar: la invitación no debe impedirlo.
-- ---------------------------------------------------------------------------

alter table public.invitaciones_admin
  drop constraint invitaciones_admin_usuario_id_fkey,
  add constraint invitaciones_admin_usuario_id_fkey
    foreign key (usuario_id) references public.perfiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Vigencia: una invitación cancelada o vencida tampoco da privilegios, aunque
-- la cuenta todavía no se haya borrado.
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
      and not exists (
        select 1 from public.invitaciones_admin i
        where i.usuario_id = p.id
          and (i.estado in ('cancelada', 'vencida') or (i.estado = 'pendiente' and i.expira_at <= now()))
      )
  );
$$;

create or replace function privado.propietario_vigente(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.admin_vigente(p_usuario)
     and exists (select 1 from public.perfiles p where p.id = p_usuario and p.es_propietario);
$$;

revoke all on function privado.propietario_vigente(uuid) from public, anon;
grant execute on function privado.propietario_vigente(uuid) to authenticated, service_role;

-- Para proxy.ts: rutas solo del Propietario (RF-86). Incluye aal2.
create or replace function public.soy_propietario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and privado.propietario_vigente(auth.uid());
$$;

revoke all on function public.soy_propietario() from public, anon;
grant execute on function public.soy_propietario() to authenticated;

-- ---------------------------------------------------------------------------
-- Invitar (paso 1)
-- ---------------------------------------------------------------------------

create or replace function public.crear_invitacion_admin(p_propietario uuid, p_correo text, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(trim(p_correo));
  v_id     uuid;
begin
  if not privado.propietario_vigente(p_propietario) then
    raise exception 'Solo el Propietario invita administradores' using errcode = 'P0001', hint = 'no_es_propietario';
  end if;
  if v_correo is null or v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo no válido' using errcode = 'P0001', hint = 'correo_invalido';
  end if;
  if exists (select 1 from public.invitaciones_admin i where i.correo = v_correo and i.estado = 'pendiente') then
    raise exception 'Ya hay una invitación pendiente para ese correo' using errcode = 'P0001', hint = 'invitacion_pendiente';
  end if;
  -- RN-32: cuenta dedicada.
  if public.correo_tiene_cuenta(v_correo) then
    raise exception 'Ese correo ya tiene una cuenta' using errcode = 'P0001', hint = 'correo_con_cuenta';
  end if;

  insert into public.invitaciones_admin (correo, nombre, invitado_por)
  values (v_correo, nullif(trim(p_nombre), ''), p_propietario)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.crear_invitacion_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.crear_invitacion_admin(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Cancelar: devuelve la cuenta que el servidor debe borrar en Auth
-- ---------------------------------------------------------------------------

create or replace function public.cancelar_invitacion_admin(p_propietario uuid, p_invitacion uuid)
returns table (usuario_id uuid, correo text, estado text, ya_resuelta boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_inv public.invitaciones_admin%rowtype;
begin
  if not privado.propietario_vigente(p_propietario) then
    raise exception 'Solo el Propietario cancela invitaciones' using errcode = 'P0001', hint = 'no_es_propietario';
  end if;

  select * into v_inv from public.invitaciones_admin i where i.id = p_invitacion for update;
  if not found then
    raise exception 'La invitación no existe' using errcode = 'P0001', hint = 'invitacion_no_existe';
  end if;

  if v_inv.estado = 'pendiente' then
    update public.invitaciones_admin i
    set estado = case when i.expira_at <= now() then 'vencida' else 'cancelada' end,
        resuelta_at = now()
    where i.id = p_invitacion
    returning i.* into v_inv;
    return query select v_inv.usuario_id, v_inv.correo, v_inv.estado, false;
  elsif v_inv.estado in ('cancelada', 'vencida') and v_inv.usuario_id is not null then
    -- Reintento: la cuenta quedó sin borrar la vez anterior.
    return query select v_inv.usuario_id, v_inv.correo, v_inv.estado, true;
  else
    raise exception 'La invitación ya no se puede cancelar' using errcode = 'P0001', hint = 'invitacion_no_cancelable';
  end if;
end;
$$;

revoke all on function public.cancelar_invitacion_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancelar_invitacion_admin(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Revocar (RF-87): marca, y cierra sus sesiones en Auth
-- ---------------------------------------------------------------------------

create or replace function public.revocar_admin(p_propietario uuid, p_admin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles%rowtype;
begin
  if not privado.propietario_vigente(p_propietario) then
    raise exception 'Solo el Propietario revoca administradores' using errcode = 'P0001', hint = 'no_es_propietario';
  end if;
  if p_admin = p_propietario then
    raise exception 'No puedes revocar tu propio acceso' using errcode = 'P0001', hint = 'revocarse_a_si_mismo';
  end if;

  select * into v_perfil from public.perfiles p where p.id = p_admin for update;
  if not found or v_perfil.rol <> 'administrador' or v_perfil.es_propietario or v_perfil.admin_revocado_at is not null then
    raise exception 'Esa cuenta no es un administrador revocable' using errcode = 'P0001', hint = 'no_revocable';
  end if;
  if exists (select 1 from public.invitaciones_admin i where i.usuario_id = p_admin and i.estado = 'pendiente') then
    raise exception 'La cuenta no ha activado su invitación: cancélala' using errcode = 'P0001', hint = 'usar_cancelar';
  end if;

  update public.perfiles
  set admin_revocado_at = now(), admin_revocado_por = p_propietario
  where id = p_admin;

  -- Los refresh tokens caen en cascada con la sesión.
  delete from auth.sessions s where s.user_id = p_admin;
end;
$$;

revoke all on function public.revocar_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revocar_admin(uuid, uuid) to service_role;
