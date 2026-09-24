-- =============================================================================
-- Directorio de consultores y perfil público
-- docs/05 §9.22 · Sprint 4 paso 1c (sesión 022)
-- RF-26, RF-27, RF-80, CU-20, CU-21, RN-12, RNF-16
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Solicitud activa = encargo aceptado (decisión del Product Owner)
-- ---------------------------------------------------------------------------
-- Hasta hoy contaba también `pendiente`. La usan contacto_consultor() y la
-- política de lectura de consultor_redes: el cambio cubre sitio web, hoja de
-- vida y redes a la vez.
create or replace function privado.solicitud_activa(p_empresa uuid, p_consultor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.empresa_id = p_empresa
      and e.consultor_id = p_consultor
      and e.estado = 'en_curso'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Foto y hoja de vida para la empresa (RNF-16)
-- ---------------------------------------------------------------------------

-- La foto vigente de un perfil aprobado, y solo esa: una foto anterior que
-- quedara en el bucket, o la de un suspendido, no se firma.
create or replace function privado.foto_visible_para_empresa(p_objeto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.rol_actual() = 'empresa'
     and exists (
       select 1 from public.consultor_perfiles cp
       where cp.foto_path = p_objeto and cp.estado_perfil = 'aprobado'
     );
$$;

-- La hoja de vida vigente de un consultor con el que la empresa de la sesión
-- tiene un encargo aceptado (RF-80).
create or replace function privado.cv_visible_para_empresa(p_objeto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consultor_perfiles cp
    where cp.cv_path = p_objeto
      and privado.solicitud_activa(auth.uid(), cp.id)
  );
$$;

revoke all on function privado.foto_visible_para_empresa(text) from public, anon;
revoke all on function privado.cv_visible_para_empresa(text) from public, anon;
grant execute on function privado.foto_visible_para_empresa(text) to authenticated;
grant execute on function privado.cv_visible_para_empresa(text) to authenticated;

drop policy if exists "consultor: la empresa ve la foto de los aprobados" on storage.objects;
create policy "consultor: la empresa ve la foto de los aprobados"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos-consultores' and (select privado.foto_visible_para_empresa(name)));

drop policy if exists "consultor: la empresa ve la hoja de vida con encargo aceptado" on storage.objects;
create policy "consultor: la empresa ve la hoja de vida con encargo aceptado"
  on storage.objects for select to authenticated
  using (bucket_id = 'hojas-de-vida' and (select privado.cv_visible_para_empresa(name)));
