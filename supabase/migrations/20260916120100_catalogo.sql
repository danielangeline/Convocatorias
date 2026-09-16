-- =============================================================================
-- Catálogo: fuentes, categorías, convocatorias, requisitos y documentos
-- docs/05-modelo-de-datos.md §9.8b, §9.10 · RN-01, RN-02, RN-07, RNF-29
--
-- Lectura pública solo de lo publicado y vigente; escritura exclusiva del
-- administrador. Nada se elimina físicamente (RN-07): no hay política de delete.
-- La lectura de convocatorias cerradas vinculadas a un registro propio se
-- agrega en las migraciones de postulaciones, encargos y documentos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FUENTES
-- ---------------------------------------------------------------------------

create table public.fuentes (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  tipo_entidad            text,
  url                     text check (url is null or url ~* '^https?://[^\s/]+\.[^\s]+$'),
  notas_parametrizacion   text,
  activa                  boolean not null default true,
  creado_at               timestamptz not null default now(),
  actualizado_at          timestamptz not null default now()
);

create trigger fuentes_actualizado_at
  before update on public.fuentes
  for each row execute function privado.fijar_actualizado_at();

alter table public.fuentes enable row level security;

-- Las fuentes son configuración interna del administrador (notas de
-- parametrización): el portal público no las muestra.
create policy "fuentes: el administrador lee"
  on public.fuentes for select to authenticated
  using ((select privado.es_admin()));

create policy "fuentes: el administrador crea"
  on public.fuentes for insert to authenticated
  with check ((select privado.es_admin()));

create policy "fuentes: el administrador edita"
  on public.fuentes for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------------

create table public.categorias (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null check (tipo in ('tipo_proyecto', 'sector', 'tipo_entidad')),
  nombre    text not null,
  activa    boolean not null default true,
  unique (tipo, nombre)
);

alter table public.categorias enable row level security;

create policy "categorias: lectura pública de las activas"
  on public.categorias for select to anon, authenticated
  using (activa);

create policy "categorias: el administrador lee todas"
  on public.categorias for select to authenticated
  using ((select privado.es_admin()));

create policy "categorias: el administrador crea"
  on public.categorias for insert to authenticated
  with check ((select privado.es_admin()));

create policy "categorias: el administrador edita"
  on public.categorias for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- CONVOCATORIAS
-- ---------------------------------------------------------------------------

create table public.convocatorias (
  id                    uuid primary key default gen_random_uuid(),
  fuente_id             uuid references public.fuentes (id),
  nombre                text not null,
  entidad_convocante    text not null,
  descripcion           text,
  monto_min             numeric check (monto_min is null or monto_min >= 0),
  monto_max             numeric check (monto_max is null or monto_max >= 0),
  ubicacion_cobertura   text,
  fecha_apertura        date,
  fecha_cierre          date not null,
  estado                text not null default 'borrador'
                        check (estado in ('borrador', 'publicada', 'despublicada', 'cerrada')),
  -- Enlace oficial de postulación (RF-05, RF-73): http/https bien formada (RNF-29).
  url_postulacion       text check (url_postulacion is null or url_postulacion ~* '^https?://[^\s/]+\.[^\s]+$'),
  creado_por            uuid references public.perfiles (id),
  publicado_por         uuid references public.perfiles (id),
  publicada_at          timestamptz,
  creado_at             timestamptz not null default now(),
  actualizado_at        timestamptz not null default now(),
  constraint convocatorias_rango_montos
    check (monto_min is null or monto_max is null or monto_min <= monto_max),
  constraint convocatorias_rango_fechas
    check (fecha_apertura is null or fecha_apertura <= fecha_cierre),
  -- RN-01: no se publica sin enlace oficial.
  constraint convocatorias_publicada_con_enlace
    check (estado <> 'publicada' or url_postulacion is not null)
);

create index convocatorias_estado_cierre_idx on public.convocatorias (estado, fecha_cierre);
create index convocatorias_fuente_idx on public.convocatorias (fuente_id);

create trigger convocatorias_actualizado_at
  before update on public.convocatorias
  for each row execute function privado.fijar_actualizado_at();

alter table public.convocatorias enable row level security;

create policy "convocatorias: lectura pública de las publicadas y vigentes"
  on public.convocatorias for select to anon, authenticated
  using (estado = 'publicada' and fecha_cierre >= current_date);

create policy "convocatorias: el administrador lee todas"
  on public.convocatorias for select to authenticated
  using ((select privado.es_admin()));

create policy "convocatorias: el administrador crea"
  on public.convocatorias for insert to authenticated
  with check ((select privado.es_admin()));

create policy "convocatorias: el administrador edita"
  on public.convocatorias for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- Tablas hijas de la convocatoria: heredan su visibilidad.
-- `exists` sobre convocatorias aplica la política de convocatorias del que
-- consulta, así que una hija es visible si y solo si su convocatoria lo es.
-- ---------------------------------------------------------------------------

create table public.convocatoria_categoria (
  convocatoria_id   uuid not null references public.convocatorias (id) on delete cascade,
  categoria_id      uuid not null references public.categorias (id),
  primary key (convocatoria_id, categoria_id)
);

create index convocatoria_categoria_categoria_idx on public.convocatoria_categoria (categoria_id);

alter table public.convocatoria_categoria enable row level security;

create policy "convocatoria_categoria: visible con su convocatoria"
  on public.convocatoria_categoria for select to anon, authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

create policy "convocatoria_categoria: el administrador crea"
  on public.convocatoria_categoria for insert to authenticated
  with check ((select privado.es_admin()));

create policy "convocatoria_categoria: el administrador elimina"
  on public.convocatoria_categoria for delete to authenticated
  using ((select privado.es_admin()));

create table public.requisitos_convocatoria (
  id                uuid primary key default gen_random_uuid(),
  convocatoria_id   uuid not null references public.convocatorias (id) on delete cascade,
  descripcion       text not null,
  tipo              text not null check (tipo in ('documento', 'condicion')),
  obligatorio       boolean not null default true,
  orden             int not null default 0
);

create index requisitos_convocatoria_convocatoria_idx on public.requisitos_convocatoria (convocatoria_id, orden);

alter table public.requisitos_convocatoria enable row level security;

create policy "requisitos_convocatoria: visibles con su convocatoria"
  on public.requisitos_convocatoria for select to anon, authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

create policy "requisitos_convocatoria: el administrador crea"
  on public.requisitos_convocatoria for insert to authenticated
  with check ((select privado.es_admin()));

create policy "requisitos_convocatoria: el administrador edita"
  on public.requisitos_convocatoria for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- Un requisito sí puede retirarse: el checklist de las postulaciones ya
-- iniciadas guarda su propia copia (RN-04).
create policy "requisitos_convocatoria: el administrador elimina"
  on public.requisitos_convocatoria for delete to authenticated
  using ((select privado.es_admin()));

create table public.documentos_convocatoria (
  id                uuid primary key default gen_random_uuid(),
  convocatoria_id   uuid not null references public.convocatorias (id) on delete cascade,
  tipo_doc          text not null check (tipo_doc in ('TDR', 'terminos', 'anexo', 'formato')),
  nombre            text not null,
  storage_path      text not null,
  subido_por        uuid references public.perfiles (id),
  creado_at         timestamptz not null default now()
);

create index documentos_convocatoria_convocatoria_idx on public.documentos_convocatoria (convocatoria_id);

alter table public.documentos_convocatoria enable row level security;

create policy "documentos_convocatoria: visibles con su convocatoria"
  on public.documentos_convocatoria for select to anon, authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

create policy "documentos_convocatoria: el administrador crea"
  on public.documentos_convocatoria for insert to authenticated
  with check ((select privado.es_admin()));

create policy "documentos_convocatoria: el administrador elimina"
  on public.documentos_convocatoria for delete to authenticated
  using ((select privado.es_admin()));
