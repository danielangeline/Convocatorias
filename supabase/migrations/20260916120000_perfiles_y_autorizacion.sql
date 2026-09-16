-- =============================================================================
-- Perfiles y funciones de autorización
-- docs/05-modelo-de-datos.md §9.9, §9.10, §9.11 · RNF-25, RNF-28, RN-06, RN-24
--
-- Convenciones de todo el esquema (§9.11):
--   · Toda tabla nace con RLS habilitado y su política en el mismo archivo.
--   · Lo que la política no concede a `authenticated` lo escribe solo el
--     servidor con service_role, que no está sujeto a RLS (RNF-26).
--   · Las funciones auxiliares viven en el esquema `privado`, que la API de
--     Supabase no expone.
-- =============================================================================

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- Utilidades genéricas
-- ---------------------------------------------------------------------------

create or replace function privado.fijar_actualizado_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

-- Verdadero cuando la sentencia la ejecuta un usuario final a través de la API
-- (anon o authenticated). El servidor (service_role) y pg_cron (postgres) no
-- quedan sujetos a las guardas de columnas.
create or replace function privado.es_cliente()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- ---------------------------------------------------------------------------
-- PERFILES (§9.9, §9.10)
-- ---------------------------------------------------------------------------

create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre          text,
  rol             text not null check (rol in ('empresa', 'consultor', 'administrador')),
  nombre_empresa  text,
  telefono        text,
  mfa_habilitado  boolean not null default false,
  creado_at       timestamptz not null default now(),
  actualizado_at  timestamptz not null default now()
);

create trigger perfiles_actualizado_at
  before update on public.perfiles
  for each row execute function privado.fijar_actualizado_at();

-- Rol del usuario de la sesión. security definer para no depender de la
-- política de `perfiles` (evita recursión cuando otras políticas la usan).
create or replace function privado.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.perfiles p where p.id = auth.uid();
$$;

-- Administrador = rol administrador + segundo factor verificado en esta sesión
-- (aal2). Sin MFA, un administrador no tiene ningún privilegio (RNF-28, RN-24).
create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(privado.rol_actual() = 'administrador', false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- El usuario puede editar su nombre y teléfono, nunca su rol ni su estado de
-- MFA: el rol lo asigna un administrador (RN-06) y el MFA lo confirma el
-- servidor tras verificar el factor (§9.11 punto 2).
create or replace function privado.guardar_columnas_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() then
    if new.id is distinct from old.id
       or new.rol is distinct from old.rol
       or new.mfa_habilitado is distinct from old.mfa_habilitado then
      raise exception 'No puedes modificar el rol ni la verificación en dos pasos de tu perfil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger perfiles_guardar_columnas
  before update on public.perfiles
  for each row execute function privado.guardar_columnas_perfil();

alter table public.perfiles enable row level security;

create policy "perfiles: cada usuario lee el suyo"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "perfiles: el administrador lee todos"
  on public.perfiles for select to authenticated
  using ((select privado.es_admin()));

create policy "perfiles: cada usuario edita el suyo"
  on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sin política de insert ni delete: el perfil lo crea el servidor al registrar
-- la cuenta (Sprint 1, paso 3) y se elimina en cascada con auth.users.

revoke all on function privado.rol_actual() from public, anon;
revoke all on function privado.es_admin() from public, anon;
grant execute on function privado.rol_actual() to authenticated;
grant execute on function privado.es_admin() to authenticated;
