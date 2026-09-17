-- Storage: los 3 buckets y los adjuntos de convocatoria.
-- RF-07 (CU-03), RNF-16 (URLs firmadas de 15 min), RNF-18 (tipos y tamaño),
-- RN-33 (los adjuntos solo los ve una cuenta de empresa). docs/05 §9.14.
--
-- Los tres buckets son privados: ningún archivo se sirve por una URL
-- permanente. El límite de tamaño y la lista de tipos se declaran aquí, en el
-- bucket, para que una subida directa que los incumpla la rechace Storage
-- aunque nadie la revise antes (RNF-18).

-- ---------------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documentos-convocatorias', 'documentos-convocatorias', false, 20971520, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]),
  ('fotos-consultores', 'fotos-consultores', false, 5242880, array['image/jpeg', 'image/png']),
  ('hojas-de-vida', 'hojas-de-vida', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Políticas sobre storage.objects — una por bucket y operación (RNF-25)
-- ---------------------------------------------------------------------------
-- La tabla pertenece a supabase_storage_admin, pero el rol que corre las
-- migraciones puede crear políticas sobre ella sin cambiar de rol: `set role
-- supabase_storage_admin` le está negado (42501).

drop policy if exists "convocatorias: el admin lee sus adjuntos" on storage.objects;
create policy "convocatorias: el admin lee sus adjuntos"
  on storage.objects for select to authenticated
  using (bucket_id = 'documentos-convocatorias' and (select privado.es_admin()));

drop policy if exists "convocatorias: el admin sube adjuntos" on storage.objects;
create policy "convocatorias: el admin sube adjuntos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-convocatorias' and (select privado.es_admin()));

drop policy if exists "convocatorias: el admin reemplaza adjuntos" on storage.objects;
create policy "convocatorias: el admin reemplaza adjuntos"
  on storage.objects for update to authenticated
  using (bucket_id = 'documentos-convocatorias' and (select privado.es_admin()))
  with check (bucket_id = 'documentos-convocatorias' and (select privado.es_admin()));

drop policy if exists "convocatorias: el admin borra adjuntos" on storage.objects;
create policy "convocatorias: el admin borra adjuntos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-convocatorias' and (select privado.es_admin()));

-- Foto y hoja de vida: el primer segmento de la ruta es el perfil del dueño.
-- Quien más las ve lo hace por URL firmada emitida por el servidor (RNF-16).

drop policy if exists "consultor: lee su foto" on storage.objects;
create policy "consultor: lee su foto"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos-consultores' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: guarda su foto" on storage.objects;
create policy "consultor: guarda su foto"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-consultores' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: reemplaza su foto" on storage.objects;
create policy "consultor: reemplaza su foto"
  on storage.objects for update to authenticated
  using (bucket_id = 'fotos-consultores' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fotos-consultores' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: borra su foto" on storage.objects;
create policy "consultor: borra su foto"
  on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-consultores' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: lee su hoja de vida" on storage.objects;
create policy "consultor: lee su hoja de vida"
  on storage.objects for select to authenticated
  using (bucket_id = 'hojas-de-vida' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: guarda su hoja de vida" on storage.objects;
create policy "consultor: guarda su hoja de vida"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hojas-de-vida' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: reemplaza su hoja de vida" on storage.objects;
create policy "consultor: reemplaza su hoja de vida"
  on storage.objects for update to authenticated
  using (bucket_id = 'hojas-de-vida' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'hojas-de-vida' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "consultor: borra su hoja de vida" on storage.objects;
create policy "consultor: borra su hoja de vida"
  on storage.objects for delete to authenticated
  using (bucket_id = 'hojas-de-vida' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 3. documentos_convocatoria: metadatos reales y renombrar
-- ---------------------------------------------------------------------------

alter table public.documentos_convocatoria
  add column if not exists tipo_mime      text not null default '',
  add column if not exists tamano_bytes   bigint,
  add column if not exists actualizado_at timestamptz not null default now();

-- Dos filas no pueden apuntar al mismo objeto.
create unique index if not exists documentos_convocatoria_path_idx
  on public.documentos_convocatoria (storage_path);

alter table public.documentos_convocatoria
  drop constraint if exists documentos_convocatoria_nombre_check;
alter table public.documentos_convocatoria
  add constraint documentos_convocatoria_nombre_check
  check (length(btrim(nombre)) between 1 and 200);

-- CU-03 1a · Renombrar. El trigger deja claro que un update cambia el rótulo,
-- nunca el archivo: para reemplazarlo se quita el adjunto y se sube otro.
drop policy if exists "documentos_convocatoria: el administrador renombra" on public.documentos_convocatoria;
create policy "documentos_convocatoria: el administrador renombra"
  on public.documentos_convocatoria for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

create or replace function privado.documento_convocatoria_solo_rotulo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.convocatoria_id is distinct from old.convocatoria_id
     or new.storage_path is distinct from old.storage_path
     or new.tamano_bytes is distinct from old.tamano_bytes
     or new.tipo_mime    is distinct from old.tipo_mime then
    raise exception 'Un adjunto solo puede renombrarse o cambiar de tipo; el archivo no se reemplaza'
      using hint = 'adjunto_inmutable';
  end if;
  new.actualizado_at := now();
  return new;
end;
$$;

drop trigger if exists documento_convocatoria_solo_rotulo on public.documentos_convocatoria;
create trigger documento_convocatoria_solo_rotulo
  before update on public.documentos_convocatoria
  for each row execute function privado.documento_convocatoria_solo_rotulo();
