-- =============================================================================
-- Revisión, suspensión y reactivación de consultores
-- docs/05 §9.21 · Sprint 4 paso 1b (sesión 022)
-- RF-34, RF-35, CU-25, CU-27, RN-13, RN-29, RNF-16
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Motivo y fecha de la suspensión (CU-27, decisión del Product Owner)
-- ---------------------------------------------------------------------------

alter table public.consultor_perfiles
  add column motivo_suspension text,
  add column suspendido_at     timestamptz;

alter table public.consultor_perfiles
  add constraint consultor_perfiles_suspension_con_motivo
  check (
    case when estado_perfil = 'suspendido'
      then nullif(trim(motivo_suspension), '') is not null and suspendido_at is not null
      else motivo_suspension is null and suspendido_at is null
    end
  );

-- Sin permiso por columna para authenticated: la empresa que tuvo encargos
-- con el consultor ve su perfil suspendido (RN-15), pero no por qué. El
-- consultor y el administrador lo leen con suspension_consultor().
revoke select (motivo_suspension, suspendido_at) on public.consultor_perfiles from anon, authenticated;

create or replace function public.suspension_consultor(p_consultor uuid)
returns table (motivo_suspension text, suspendido_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.motivo_suspension, cp.suspendido_at
  from public.consultor_perfiles cp
  where cp.id = p_consultor
    and (cp.id = auth.uid() or privado.es_admin());
$$;

revoke all on function public.suspension_consultor(uuid) from public, anon;
grant execute on function public.suspension_consultor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Las columnas nuevas quedan protegidas (§9.11 punto 2)
-- ---------------------------------------------------------------------------

create or replace function privado.guardar_columnas_consultor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Para todos, también service_role: un archivo solo puede ser de la carpeta
  -- propia. Si no, un consultor apuntaría su hoja de vida a la de otro y la
  -- empresa con solicitud activa la descargaría (RN-12).
  if new.foto_path is not null and not starts_with(new.foto_path, new.id::text || '/') then
    raise exception 'La foto tiene que estar en la carpeta del propio consultor' using errcode = '42501';
  end if;
  if new.cv_path is not null and not starts_with(new.cv_path, new.id::text || '/') then
    raise exception 'La hoja de vida tiene que estar en la carpeta del propio consultor' using errcode = '42501';
  end if;

  if not privado.es_cliente() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado_perfil := 'incompleto';
    new.motivo_rechazo := null;
    new.motivo_suspension := null;
    new.suspendido_at := null;
    new.es_equipo_interno := false;
    new.revisado_por := null;
    new.revisado_at := null;
    new.rating_promedio := 0;
    new.total_encargos_completados := 0;
    return new;
  end if;

  -- También el administrador: revisar y suspender pasan por las funciones de
  -- abajo, que corren como su dueño (§9.21).
  if new.id is distinct from old.id
     or new.estado_perfil is distinct from old.estado_perfil
     or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.motivo_suspension is distinct from old.motivo_suspension
     or new.suspendido_at is distinct from old.suspendido_at
     or new.es_equipo_interno is distinct from old.es_equipo_interno
     or new.revisado_por is distinct from old.revisado_por
     or new.revisado_at is distinct from old.revisado_at
     or new.rating_promedio is distinct from old.rating_promedio
     or new.total_encargos_completados is distinct from old.total_encargos_completados then
    raise exception 'No puedes modificar el estado de revisión ni las métricas de tu perfil'
      using errcode = '42501';
  end if;

  -- CU-16 1a: lo que la revisión vio no se vacía después.
  if new.estado_perfil in ('en_revision', 'aprobado')
     and (new.foto_path is null or new.cv_path is null or nullif(trim(new.descripcion), '') is null) then
    raise exception 'Tu perfil está en revisión o aprobado: la foto, la descripción y la hoja de vida no pueden quedar vacías'
      using errcode = '23514', hint = 'minimos_incompletos';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Aprobar o rechazar (CU-25, RF-34, RN-13)
-- ---------------------------------------------------------------------------

create or replace function public.revisar_perfil_consultor(
  p_id      uuid,
  p_aprobar boolean,
  p_motivo  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con MFA revisa perfiles' using errcode = '42501', hint = 'no_es_admin';
  end if;

  select estado_perfil into v_estado from public.consultor_perfiles where id = p_id for update;
  if not found then
    raise exception 'El perfil no existe' using hint = 'no_existe';
  end if;
  -- CU-25 3a: otro administrador ya lo revisó.
  if v_estado <> 'en_revision' then
    raise exception 'El perfil ya no está en revisión' using hint = 'estado_no_permite';
  end if;
  if not p_aprobar and v_motivo is null then
    raise exception 'Todo rechazo lleva motivo' using hint = 'motivo_vacio';
  end if;

  -- Aprobar no crea suscripción hasta el Sprint 5 (RN-08 y RN-11 transitorios).
  update public.consultor_perfiles
  set estado_perfil  = case when p_aprobar then 'aprobado' else 'rechazado' end,
      motivo_rechazo = case when p_aprobar then null else v_motivo end,
      revisado_por   = auth.uid(),
      revisado_at    = now()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Suspender (CU-27, RF-35, RN-29)
-- ---------------------------------------------------------------------------

create or replace function public.suspender_consultor(p_id uuid, p_motivo text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_motivo text := nullif(trim(p_motivo), '');
  v_cancelados int;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con MFA suspende consultores' using errcode = '42501', hint = 'no_es_admin';
  end if;

  select estado_perfil into v_estado from public.consultor_perfiles where id = p_id for update;
  if not found then
    raise exception 'El perfil no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'aprobado' then
    raise exception 'Solo se suspende un perfil aprobado' using hint = 'estado_no_permite';
  end if;
  if v_motivo is null then
    raise exception 'La suspensión lleva motivo' using hint = 'motivo_vacio';
  end if;

  update public.consultor_perfiles
  set estado_perfil     = 'suspendido',
      motivo_suspension = v_motivo,
      suspendido_at     = now()
  where id = p_id;

  -- RN-29: en curso y pendientes (decisión del Product Owner, sesión 022). El
  -- trigger encargos_revocar_documentos quita las autorizaciones de los que
  -- estaban en curso (RF-76). El historial y las calificaciones no se tocan.
  update public.encargos
  set estado = 'cancelado',
      motivo_cancelacion = 'Consultor suspendido por el administrador'
  where consultor_id = p_id
    and estado in ('en_curso', 'pendiente');
  get diagnostics v_cancelados = row_count;

  return v_cancelados;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reactivar (CU-27 3a: no revive encargos)
-- ---------------------------------------------------------------------------

create or replace function public.reactivar_consultor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con MFA reactiva consultores' using errcode = '42501', hint = 'no_es_admin';
  end if;

  select estado_perfil into v_estado from public.consultor_perfiles where id = p_id for update;
  if not found then
    raise exception 'El perfil no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'suspendido' then
    raise exception 'Solo se reactiva un perfil suspendido' using hint = 'estado_no_permite';
  end if;

  update public.consultor_perfiles
  set estado_perfil     = 'aprobado',
      motivo_suspension = null,
      suspendido_at     = null
  where id = p_id;
end;
$$;

revoke all on function public.revisar_perfil_consultor(uuid, boolean, text) from public, anon;
revoke all on function public.suspender_consultor(uuid, text) from public, anon;
revoke all on function public.reactivar_consultor(uuid) from public, anon;
grant execute on function public.revisar_perfil_consultor(uuid, boolean, text) to authenticated;
grant execute on function public.suspender_consultor(uuid, text) to authenticated;
grant execute on function public.reactivar_consultor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. El administrador lee la foto y la hoja de vida (CU-25 paso 2, RNF-16)
-- ---------------------------------------------------------------------------

drop policy if exists "consultor: el admin lee las fotos" on storage.objects;
create policy "consultor: el admin lee las fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos-consultores' and (select privado.es_admin()));

drop policy if exists "consultor: el admin lee las hojas de vida" on storage.objects;
create policy "consultor: el admin lee las hojas de vida"
  on storage.objects for select to authenticated
  using (bucket_id = 'hojas-de-vida' and (select privado.es_admin()));
