-- =============================================================================
-- Compartir el documento con el consultor y traza de lectura (sesión 026)
-- docs/05-modelo-de-datos.md §9.26 · RF-71, RF-76, RF-79, RN-22, RN-27, RNF-11
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DOCUMENTO_LECTURAS (tabla 32, RF-79)
-- ---------------------------------------------------------------------------

create table public.documento_lecturas (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.documentos_generados (id) on delete cascade,
  consultor_id  uuid not null references public.perfiles (id) on delete cascade,
  leido_at      timestamptz not null default now()
);

create index documento_lecturas_documento_idx on public.documento_lecturas (documento_id, leido_at);

alter table public.documento_lecturas enable row level security;

create policy "documento_lecturas: la empresa dueña lee"
  on public.documento_lecturas for select to authenticated
  using (exists (
    select 1 from public.documentos_generados d
    where d.id = documento_lecturas.documento_id and d.usuario_id = (select auth.uid())
  ));

create policy "documento_lecturas: el administrador lee"
  on public.documento_lecturas for select to authenticated
  using ((select privado.es_admin()));

-- Sin escritura desde el cliente: la registra el servidor al servir el documento.

-- ---------------------------------------------------------------------------
-- 2. Compartir y revocar (RF-71)
-- ---------------------------------------------------------------------------

create or replace function public.compartir_documento(p_usuario uuid, p_documento uuid, p_consultor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_generados%rowtype;
begin
  select * into v_doc from public.documentos_generados d
  where d.id = p_documento and d.usuario_id = p_usuario and d.estado in ('generado', 'editado', 'exportado')
  for update;
  if v_doc.id is null then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  -- RN-22: la aceptación del encargo no da acceso por sí sola, pero sin encargo
  -- en curso sobre el proyecto tampoco se puede autorizar.
  if not exists (
    select 1 from public.encargos e
    where e.proyecto_id = v_doc.proyecto_id and e.consultor_id = p_consultor and e.estado = 'en_curso'
  ) then
    raise exception 'El consultor no tiene un encargo en curso sobre este proyecto' using hint = 'sin_encargo_en_curso';
  end if;

  update public.documentos_generados set compartido_con_consultor_id = p_consultor where id = p_documento;
end;
$$;

create or replace function public.revocar_documento(p_usuario uuid, p_documento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.documentos_generados d
  set compartido_con_consultor_id = null
  where d.id = p_documento and d.usuario_id = p_usuario and d.estado in ('generado', 'editado', 'exportado');
  if not found then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Registrar la lectura (RF-79): solo la del consultor autorizado
-- ---------------------------------------------------------------------------

create or replace function public.registrar_lectura_documento(p_usuario uuid, p_documento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.documento_lecturas (documento_id, consultor_id)
  select d.id, p_usuario
  from public.documentos_generados d
  where d.id = p_documento
    and d.usuario_id <> p_usuario
    and privado.accede_documento(p_usuario, p_documento);
end;
$$;

revoke all on function public.compartir_documento(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revocar_documento(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_lectura_documento(uuid, uuid) from public, anon, authenticated;
grant execute on function public.compartir_documento(uuid, uuid, uuid) to service_role;
grant execute on function public.revocar_documento(uuid, uuid) to service_role;
grant execute on function public.registrar_lectura_documento(uuid, uuid) to service_role;
