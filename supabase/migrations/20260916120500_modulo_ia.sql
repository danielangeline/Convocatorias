-- =============================================================================
-- Módulo de IA: plantillas, documentos generados y consumos
-- docs/05-modelo-de-datos.md §9.3, §9.4, §9.5, §9.11 · RF-52, RF-57, RF-63, RF-71,
-- RF-72, RF-76, RN-17, RN-22, RN-27, RN-28, RNF-11, RNF-24
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PLANTILLAS_GENERACION (RF-63, CU-37)
-- ---------------------------------------------------------------------------

create table public.plantillas_generacion (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  version     int not null check (version > 0),
  contenido   text not null,
  activa      boolean not null default false,
  creada_por  uuid references public.perfiles (id),
  creado_at   timestamptz not null default now(),
  unique (nombre, version)
);

-- Solo una plantilla activa a la vez.
create unique index plantillas_generacion_una_activa on public.plantillas_generacion (activa)
  where activa;

alter table public.plantillas_generacion enable row level security;

-- El prompt es interno: solo el administrador lo lee desde el cliente; el
-- servicio de generación lo lee con service_role.
create policy "plantillas_generacion: el administrador lee"
  on public.plantillas_generacion for select to authenticated
  using ((select privado.es_admin()));

create policy "plantillas_generacion: el administrador crea"
  on public.plantillas_generacion for insert to authenticated
  with check ((select privado.es_admin()));

create policy "plantillas_generacion: el administrador activa o desactiva"
  on public.plantillas_generacion for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- DOCUMENTOS_GENERADOS
-- ---------------------------------------------------------------------------

create table public.documentos_generados (
  id                            uuid primary key default gen_random_uuid(),
  -- Propietario (RN-30): la empresa dueña del proyecto. De aquí sale el crédito (RN-28).
  usuario_id                    uuid not null references public.perfiles (id) on delete cascade,
  proyecto_id                   uuid not null references public.proyectos (id) on delete cascade,
  convocatoria_id               uuid not null references public.convocatorias (id),
  postulacion_id                uuid references public.postulaciones (id) on delete set null,
  titulo                        text,
  contenido                     text,
  pendientes                    text[] not null default '{}',
  estado                        text not null default 'generando'
                                check (estado in ('generando', 'generado', 'editado', 'exportado', 'error')),
  version                       int not null default 1 check (version > 0),
  documento_padre_id            uuid references public.documentos_generados (id) on delete set null,
  plantilla_id                  uuid references public.plantillas_generacion (id),
  ajustes_usados                int not null default 0 check (ajustes_usados >= 0),
  compartido_con_consultor_id   uuid references public.consultor_perfiles (id) on delete set null,
  ultima_edicion_por            uuid references public.perfiles (id) on delete set null,
  creado_at                     timestamptz not null default now(),
  actualizado_at                timestamptz not null default now()
);

-- §9.4
create index documentos_generados_usuario_idx on public.documentos_generados (usuario_id);
create index documentos_generados_proyecto_convocatoria_idx
  on public.documentos_generados (proyecto_id, convocatoria_id);
create index documentos_generados_compartido_idx
  on public.documentos_generados (compartido_con_consultor_id)
  where compartido_con_consultor_id is not null;

create trigger documentos_generados_actualizado_at
  before update on public.documentos_generados
  for each row execute function privado.fijar_actualizado_at();

-- RN-27: acceso derivado, evaluado en cada consulta. La autorización guardada
-- no basta: además debe existir un encargo en_curso del consultor sobre el
-- proyecto del documento.
create or replace function privado.consultor_accede_documento(p_consultor_autorizado uuid, p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_consultor_autorizado = auth.uid()
     and exists (
       select 1 from public.encargos e
       where e.proyecto_id = p_proyecto
         and e.consultor_id = auth.uid()
         and e.estado = 'en_curso'
     );
$$;

revoke all on function privado.consultor_accede_documento(uuid, uuid) from public, anon;
grant execute on function privado.consultor_accede_documento(uuid, uuid) to authenticated;

-- §9.11 punto 2: desde el cliente solo cambian titulo (dueño), contenido y
-- pendientes. El resto —estado, contador de ajustes, versión, plantilla,
-- autorización del consultor— lo escribe el servidor (RN-17, RF-71, RF-72).
create or replace function privado.guardar_columnas_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not privado.es_cliente() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.usuario_id is distinct from old.usuario_id
     or new.proyecto_id is distinct from old.proyecto_id
     or new.convocatoria_id is distinct from old.convocatoria_id
     or new.postulacion_id is distinct from old.postulacion_id
     or new.estado is distinct from old.estado
     or new.version is distinct from old.version
     or new.documento_padre_id is distinct from old.documento_padre_id
     or new.plantilla_id is distinct from old.plantilla_id
     or new.ajustes_usados is distinct from old.ajustes_usados
     or new.compartido_con_consultor_id is distinct from old.compartido_con_consultor_id
     or new.creado_at is distinct from old.creado_at then
    raise exception 'Solo puedes editar el título, el contenido y los pendientes del documento'
      using errcode = '42501';
  end if;

  if new.titulo is distinct from old.titulo and old.usuario_id <> auth.uid() then
    raise exception 'Solo la empresa dueña puede cambiar el título del documento'
      using errcode = '42501';
  end if;

  -- Auditoría de la última edición (RNF-11): la fija la base, no el cliente.
  new.ultima_edicion_por := auth.uid();
  if old.estado = 'generado' then
    new.estado := 'editado';
  end if;
  return new;
end;
$$;

create trigger documentos_generados_guardar_columnas
  before update on public.documentos_generados
  for each row execute function privado.guardar_columnas_documento();

alter table public.documentos_generados enable row level security;

create policy "documentos_generados: la empresa dueña lee"
  on public.documentos_generados for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "documentos_generados: el consultor autorizado lee (RN-27)"
  on public.documentos_generados for select to authenticated
  using ((select privado.consultor_accede_documento(compartido_con_consultor_id, proyecto_id)));

create policy "documentos_generados: el administrador lee para soporte"
  on public.documentos_generados for select to authenticated
  using ((select privado.es_admin()));

create policy "documentos_generados: la empresa dueña edita"
  on public.documentos_generados for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "documentos_generados: el consultor autorizado edita (RN-27)"
  on public.documentos_generados for update to authenticated
  using ((select privado.consultor_accede_documento(compartido_con_consultor_id, proyecto_id)))
  with check ((select privado.consultor_accede_documento(compartido_con_consultor_id, proyecto_id)));

-- Sin insert ni delete desde el cliente: generar consume crédito y lo hace el
-- servidor (RN-17, RNF-20).

create policy "convocatorias: la empresa ve las de sus documentos"
  on public.convocatorias for select to authenticated
  using (exists (
    select 1 from public.documentos_generados d
    where d.convocatoria_id = convocatorias.id and d.usuario_id = (select auth.uid())
  ));

-- RF-76 / §9.3: la autorización se limpia cuando el encargo deja de estar
-- en_curso. No es lo que protege el acceso (lo hace la política, derivada),
-- pero evita que un permiso viejo reviva si el consultor recibe otro encargo
-- sobre el mismo proyecto.
create or replace function privado.revocar_documentos_al_cerrar_encargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado = 'en_curso' and new.estado <> 'en_curso' and old.consultor_id is not null then
    update public.documentos_generados d
    set compartido_con_consultor_id = null
    where d.proyecto_id = old.proyecto_id
      and d.compartido_con_consultor_id = old.consultor_id;
  end if;
  return new;
end;
$$;

create trigger encargos_revocar_documentos
  after update of estado on public.encargos
  for each row
  when (old.estado is distinct from new.estado)
  execute function privado.revocar_documentos_al_cerrar_encargo();

-- ---------------------------------------------------------------------------
-- CONSUMOS_IA (RF-52, RNF-24)
-- ---------------------------------------------------------------------------

create table public.consumos_ia (
  id              uuid primary key default gen_random_uuid(),
  -- Quién originó el consumo; el crédito sale del dueño del documento (RN-28).
  usuario_id      uuid references public.perfiles (id) on delete set null,
  documento_id    uuid references public.documentos_generados (id) on delete set null,
  tipo            text not null check (tipo in ('generacion', 'ajuste')),
  tokens_entrada  int check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_salida   int check (tokens_salida is null or tokens_salida >= 0),
  costo_estimado  numeric check (costo_estimado is null or costo_estimado >= 0),
  exito           boolean not null,
  mensaje_error   text,
  fecha           timestamptz not null default now()
);

-- §9.4
create index consumos_ia_usuario_fecha_idx on public.consumos_ia (usuario_id, fecha);
create index consumos_ia_documento_idx on public.consumos_ia (documento_id);

alter table public.consumos_ia enable row level security;

create policy "consumos_ia: cada usuario lee los suyos"
  on public.consumos_ia for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "consumos_ia: el administrador lee todos"
  on public.consumos_ia for select to authenticated
  using ((select privado.es_admin()));

-- Escritura solo desde el servidor (§9.5).
