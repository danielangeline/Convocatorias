-- =============================================================================
-- Propietario, administradores por invitación y catálogo solo para empresas
-- docs/05-modelo-de-datos.md §9.8, §9.10, §9.11, §9.12 · RN-06, RN-31, RN-32,
-- RN-33, RF-44, RF-85..87 · sesión 006
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PERFILES: Propietario y revocación (§9.12)
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column es_propietario     boolean not null default false,
  add column admin_revocado_at  timestamptz,
  add column admin_revocado_por uuid references public.perfiles (id),
  add constraint perfiles_propietario_es_admin check (not es_propietario or rol = 'administrador'),
  add constraint perfiles_propietario_no_revocable check (admin_revocado_at is null or not es_propietario);

-- RN-31: como máximo un Propietario.
create unique index perfiles_un_solo_propietario on public.perfiles (es_propietario) where es_propietario;

-- El usuario no toca su rol, su MFA, la marca de Propietario ni la revocación.
create or replace function privado.guardar_columnas_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() then
    if new.id is distinct from old.id
       or new.rol is distinct from old.rol
       or new.mfa_habilitado is distinct from old.mfa_habilitado
       or new.es_propietario is distinct from old.es_propietario
       or new.admin_revocado_at is distinct from old.admin_revocado_at
       or new.admin_revocado_por is distinct from old.admin_revocado_por then
      raise exception 'No puedes modificar el rol, la verificación en dos pasos ni el acceso administrativo de tu perfil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Administrador = rol + aal2 + acceso no revocado (§9.11 punto 3, RF-87).
-- Se lee el perfil directamente para que la revocación surta efecto en la
-- siguiente consulta, sin esperar a que caduque el JWT.
create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.perfiles p
       where p.id = auth.uid() and p.rol = 'administrador' and p.admin_revocado_at is null
     );
$$;

create or replace function privado.es_propietario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.es_admin()
     and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.es_propietario);
$$;

revoke all on function privado.es_propietario() from public, anon;
grant execute on function privado.es_propietario() to authenticated;

-- ---------------------------------------------------------------------------
-- INVITACIONES_ADMIN (§9.12)
-- ---------------------------------------------------------------------------

create table public.invitaciones_admin (
  id            uuid primary key default gen_random_uuid(),
  correo        text not null check (correo = lower(correo)),
  nombre        text,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'aceptada', 'cancelada', 'vencida')),
  invitado_por  uuid not null references public.perfiles (id),
  usuario_id    uuid references public.perfiles (id),
  creada_at     timestamptz not null default now(),
  expira_at     timestamptz not null default now() + interval '72 hours',
  resuelta_at   timestamptz,
  constraint invitaciones_admin_vencimiento check (expira_at > creada_at)
);

create unique index invitaciones_admin_una_pendiente_por_correo
  on public.invitaciones_admin (correo) where estado = 'pendiente';

alter table public.invitaciones_admin enable row level security;

create policy "invitaciones_admin: el propietario lee"
  on public.invitaciones_admin for select to authenticated
  using ((select privado.es_propietario()));

-- Sin política de escritura: la escriben el servidor (service_role) y el
-- trigger de registro (§9.11 punto 1).

-- ---------------------------------------------------------------------------
-- EVENTOS_SEGURIDAD: tipos de la gestión de administradores (RF-65)
-- ---------------------------------------------------------------------------

alter table public.eventos_seguridad drop constraint eventos_seguridad_tipo_check;
alter table public.eventos_seguridad add constraint eventos_seguridad_tipo_check
  check (tipo in ('login_fallido', 'acceso_denegado', 'limite_tasa', 'mfa_activado', 'mfa_fallido',
                  'admin_invitado', 'invitacion_cancelada', 'admin_revocado'));

-- ---------------------------------------------------------------------------
-- REGISTRO: la invitación se reconoce por app_metadata (§9.12)
-- ---------------------------------------------------------------------------

create or replace function privado.crear_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- app_metadata solo lo escribe quien tiene service_role: un registro público
  -- no puede fijarlo.
  v_inv_txt  text := coalesce(new.raw_app_meta_data, '{}'::jsonb) ->> 'invitacion_id';
  v_inv      public.invitaciones_admin%rowtype;
  v_rol      text := case when v_meta ->> 'rol' = 'consultor' then 'consultor' else 'empresa' end;
  v_plan     uuid;
  v_dias     int;
begin
  if v_inv_txt ~* '^[0-9a-f-]{36}$' then
    select * into v_inv
    from public.invitaciones_admin i
    where i.id = v_inv_txt::uuid
      and i.estado = 'pendiente'
      and i.expira_at > now()
      and i.correo = lower(new.email)
    for update;

    if found then
      -- RN-06, RN-32: cuenta dedicada de administrador, sin trial ni perfil de consultor.
      insert into public.perfiles (id, nombre, rol)
      values (new.id, v_inv.nombre, 'administrador');
      -- Queda pendiente hasta que la persona active su cuenta (CU-42).
      update public.invitaciones_admin set usuario_id = new.id where id = v_inv.id;
      return new;
    end if;
  end if;

  -- RN-06: solo `consultor` produce consultor; cualquier otro valor, empresa.
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
-- CATÁLOGO solo para empresas (RN-33)
-- ---------------------------------------------------------------------------

drop policy "convocatorias: lectura pública de las publicadas y vigentes" on public.convocatorias;

create policy "convocatorias: la empresa lee las publicadas y vigentes"
  on public.convocatorias for select to authenticated
  using (
    estado = 'publicada' and fecha_cierre >= current_date
    and (select privado.rol_actual()) = 'empresa'
  );

-- Las hijas heredan por `exists` sobre convocatorias; se retira `anon` de su
-- política para que no quede ninguna lectura del catálogo abierta al público.
drop policy "convocatoria_categoria: visible con su convocatoria" on public.convocatoria_categoria;
create policy "convocatoria_categoria: visible con su convocatoria"
  on public.convocatoria_categoria for select to authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

drop policy "requisitos_convocatoria: visibles con su convocatoria" on public.requisitos_convocatoria;
create policy "requisitos_convocatoria: visibles con su convocatoria"
  on public.requisitos_convocatoria for select to authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

drop policy "documentos_convocatoria: visibles con su convocatoria" on public.documentos_convocatoria;
create policy "documentos_convocatoria: visibles con su convocatoria"
  on public.documentos_convocatoria for select to authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

-- RF-44, §9.8: la única lectura del catálogo abierta al público son estas
-- cuatro cifras agregadas.
create or replace function public.indicadores_catalogo()
returns table (convocatorias_vigentes bigint, monto_disponible numeric, entidades bigint, consultores_aprobados bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*),
    coalesce(sum(coalesce(c.monto_max, c.monto_min)), 0),
    count(distinct c.entidad_convocante),
    (select count(*) from public.consultor_perfiles cp where cp.estado_perfil = 'aprobado')
  from public.convocatorias c
  where c.estado = 'publicada' and c.fecha_cierre >= current_date;
$$;

revoke all on function public.indicadores_catalogo() from public;
grant execute on function public.indicadores_catalogo() to anon, authenticated;
