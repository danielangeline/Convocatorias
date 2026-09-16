-- =============================================================================
-- Consultores, encargos y calificaciones
-- docs/05-modelo-de-datos.md §9.9b, §9.10, §9.11 · RN-08, RN-09, RN-12, RN-15,
-- RN-25, RNF-03, RNF-16, RNF-17, RF-68..70, RF-80
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CONSULTOR_PERFILES
-- ---------------------------------------------------------------------------

create table public.consultor_perfiles (
  id                          uuid primary key references public.perfiles (id) on delete cascade,
  nombre_profesional          text,
  descripcion                 text,
  foto_path                   text,
  -- Contacto: sin lectura directa para anon ni authenticated (§9.11 punto 4).
  cv_path                     text,
  sitio_web                   text check (sitio_web is null or sitio_web ~* '^https?://[^\s/]+\.[^\s]+$'),
  estado_perfil               text not null default 'incompleto'
                              check (estado_perfil in ('incompleto', 'en_revision', 'aprobado',
                                                       'rechazado', 'suspendido')),
  motivo_rechazo              text,
  es_equipo_interno           boolean not null default false,
  revisado_por                uuid references public.perfiles (id),
  revisado_at                 timestamptz,
  rating_promedio             numeric(3, 2) not null default 0,
  total_encargos_completados  int not null default 0,
  creado_at                   timestamptz not null default now(),
  actualizado_at              timestamptz not null default now(),
  -- RN-13: todo rechazo lleva motivo.
  constraint consultor_perfiles_rechazo_con_motivo
    check (estado_perfil <> 'rechazado' or nullif(trim(motivo_rechazo), '') is not null)
);

create index consultor_perfiles_estado_idx on public.consultor_perfiles (estado_perfil);

create trigger consultor_perfiles_actualizado_at
  before update on public.consultor_perfiles
  for each row execute function privado.fijar_actualizado_at();

-- El consultor edita su presentación; la revisión, el equipo interno y las
-- métricas son del administrador o de los triggers (§9.11 punto 2).
create or replace function privado.guardar_columnas_consultor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not privado.es_cliente() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado_perfil := 'incompleto';
    new.motivo_rechazo := null;
    new.es_equipo_interno := false;
    new.revisado_por := null;
    new.revisado_at := null;
    new.rating_promedio := 0;
    new.total_encargos_completados := 0;
  elsif new.id is distinct from old.id
     or new.estado_perfil is distinct from old.estado_perfil
     or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.es_equipo_interno is distinct from old.es_equipo_interno
     or new.revisado_por is distinct from old.revisado_por
     or new.revisado_at is distinct from old.revisado_at
     or new.rating_promedio is distinct from old.rating_promedio
     or new.total_encargos_completados is distinct from old.total_encargos_completados then
    raise exception 'No puedes modificar el estado de revisión ni las métricas de tu perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger consultor_perfiles_guardar_columnas
  before insert or update on public.consultor_perfiles
  for each row execute function privado.guardar_columnas_consultor();

alter table public.consultor_perfiles enable row level security;

create policy "consultor_perfiles: lectura pública de los aprobados"
  on public.consultor_perfiles for select to anon, authenticated
  using (estado_perfil = 'aprobado');

create policy "consultor_perfiles: el consultor lee el suyo"
  on public.consultor_perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "consultor_perfiles: el administrador lee todos"
  on public.consultor_perfiles for select to authenticated
  using ((select privado.es_admin()));

create policy "consultor_perfiles: el consultor crea el suyo"
  on public.consultor_perfiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and (select privado.rol_actual()) = 'consultor'
  );

create policy "consultor_perfiles: el consultor edita el suyo"
  on public.consultor_perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "consultor_perfiles: el administrador revisa"
  on public.consultor_perfiles for update to authenticated
  using ((select privado.es_admin()))
  with check ((select privado.es_admin()));

-- Permisos por columna (§9.11 punto 4): sitio_web y cv_path no se leen
-- directamente; motivo_rechazo y revisado_por no son públicos.
revoke select on public.consultor_perfiles from anon, authenticated;
grant select (id, nombre_profesional, descripcion, foto_path, estado_perfil, es_equipo_interno,
              rating_promedio, total_encargos_completados, creado_at, actualizado_at)
  on public.consultor_perfiles to anon, authenticated;
grant select (motivo_rechazo, revisado_por, revisado_at)
  on public.consultor_perfiles to authenticated;

-- ---------------------------------------------------------------------------
-- CONSULTOR_ESPECIALIDADES y CONSULTOR_PORTAFOLIO — públicos con el perfil
-- ---------------------------------------------------------------------------

create table public.consultor_especialidades (
  consultor_id  uuid not null references public.consultor_perfiles (id) on delete cascade,
  categoria_id  uuid not null references public.categorias (id),
  primary key (consultor_id, categoria_id)
);

create index consultor_especialidades_categoria_idx on public.consultor_especialidades (categoria_id);

alter table public.consultor_especialidades enable row level security;

create policy "consultor_especialidades: visibles con su perfil"
  on public.consultor_especialidades for select to anon, authenticated
  using (exists (select 1 from public.consultor_perfiles cp where cp.id = consultor_id));

create policy "consultor_especialidades: el consultor agrega las suyas"
  on public.consultor_especialidades for insert to authenticated
  with check (consultor_id = (select auth.uid()));

create policy "consultor_especialidades: el consultor quita las suyas"
  on public.consultor_especialidades for delete to authenticated
  using (consultor_id = (select auth.uid()));

create table public.consultor_portafolio (
  id                uuid primary key default gen_random_uuid(),
  consultor_id      uuid not null references public.consultor_perfiles (id) on delete cascade,
  nombre_proyecto   text not null,
  entidad           text,
  anio              int check (anio is null or anio between 1950 and 2100),
  descripcion       text,
  resultado         text,
  orden             int not null default 0
);

create index consultor_portafolio_consultor_idx on public.consultor_portafolio (consultor_id, orden);

alter table public.consultor_portafolio enable row level security;

create policy "consultor_portafolio: visible con su perfil"
  on public.consultor_portafolio for select to anon, authenticated
  using (exists (select 1 from public.consultor_perfiles cp where cp.id = consultor_id));

create policy "consultor_portafolio: el consultor agrega"
  on public.consultor_portafolio for insert to authenticated
  with check (consultor_id = (select auth.uid()));

create policy "consultor_portafolio: el consultor edita"
  on public.consultor_portafolio for update to authenticated
  using (consultor_id = (select auth.uid()))
  with check (consultor_id = (select auth.uid()));

create policy "consultor_portafolio: el consultor elimina"
  on public.consultor_portafolio for delete to authenticated
  using (consultor_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- ENCARGOS
-- ---------------------------------------------------------------------------

create table public.encargos (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyectos (id),
  -- Propietarios (RN-30)
  empresa_id          uuid not null references public.perfiles (id),
  consultor_id        uuid references public.consultor_perfiles (id),  -- null = espera asignación
  titulo_tarea        text not null,
  descripcion_tarea   text,
  via                 text not null check (via in ('directorio', 'asignacion_interna')),
  estado              text not null
                      check (estado in ('esperando_asignacion', 'pendiente', 'en_curso', 'rechazado',
                                        'completado', 'calificado', 'cancelado')),
  -- Contexto de la solicitud (§9.9b, RF-68/69)
  tipo_ayuda          text not null check (tipo_ayuda in ('convocatoria_especifica', 'buscar_convocatoria')),
  convocatoria_id     uuid references public.convocatorias (id),
  postulacion_id      uuid references public.postulaciones (id) on delete set null,
  motivo_cancelacion  text,
  asignado_por        uuid references public.perfiles (id),
  creada_at           timestamptz not null default now(),
  aceptado_at         timestamptz,
  completado_at       timestamptz,
  constraint encargos_convocatoria_segun_tipo
    check (convocatoria_id is null or tipo_ayuda = 'convocatoria_especifica'),
  constraint encargos_motivo_solo_si_cancelado
    check (motivo_cancelacion is null or estado = 'cancelado'),
  constraint encargos_consultor_segun_estado
    check ((estado = 'esperando_asignacion') = (consultor_id is null)
           or (estado = 'cancelado' and consultor_id is null))
);

create index encargos_empresa_idx on public.encargos (empresa_id);
create index encargos_consultor_idx on public.encargos (consultor_id, estado);
create index encargos_proyecto_idx on public.encargos (proyecto_id);
create index encargos_convocatoria_idx on public.encargos (convocatoria_id);

alter table public.encargos enable row level security;

create policy "encargos: la empresa lee los suyos"
  on public.encargos for select to authenticated
  using (empresa_id = (select auth.uid()));

create policy "encargos: el consultor lee los suyos"
  on public.encargos for select to authenticated
  using (consultor_id = (select auth.uid()));

create policy "encargos: el administrador lee todos"
  on public.encargos for select to authenticated
  using ((select privado.es_admin()));

-- Sin políticas de escritura: crear, responder, asignar, completar y cancelar
-- pasan por la API con service_role (§9.11 punto 1).

-- ---------------------------------------------------------------------------
-- Funciones sobre encargos (security definer: no pasan por la política de
-- encargos y evitan recursión desde las políticas de otras tablas)
-- ---------------------------------------------------------------------------

-- RF-80: solicitud activa de la pareja (empresa, consultor).
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
      and e.estado in ('pendiente', 'en_curso')
  );
$$;

-- RN-25: el consultor ve el proyecto de un encargo propio mientras esté vivo.
create or replace function privado.consultor_ve_proyecto(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.proyecto_id = p_proyecto
      and e.consultor_id = auth.uid()
      and e.estado in ('pendiente', 'en_curso', 'esperando_asignacion')
  );
$$;

-- RN-25: y la convocatoria asociada si la ayuda es para una convocatoria específica.
create or replace function privado.consultor_ve_convocatoria(p_convocatoria uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.convocatoria_id = p_convocatoria
      and e.tipo_ayuda = 'convocatoria_especifica'
      and e.consultor_id = auth.uid()
      and e.estado in ('pendiente', 'en_curso', 'esperando_asignacion')
  );
$$;

create or replace function privado.es_parte_encargo(p_encargo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.id = p_encargo
      and auth.uid() in (e.empresa_id, e.consultor_id)
  );
$$;

-- Perfil de un consultor con el que la empresa de la sesión tiene o tuvo un
-- encargo: lo sigue viendo aunque el consultor quede suspendido (RN-15).
create or replace function privado.empresa_tiene_encargo_con(p_consultor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.empresa_id = auth.uid() and e.consultor_id = p_consultor
  );
$$;

revoke all on function privado.solicitud_activa(uuid, uuid) from public, anon;
revoke all on function privado.consultor_ve_proyecto(uuid) from public, anon;
revoke all on function privado.consultor_ve_convocatoria(uuid) from public, anon;
revoke all on function privado.es_parte_encargo(uuid) from public, anon;
revoke all on function privado.empresa_tiene_encargo_con(uuid) from public, anon;
grant execute on function privado.solicitud_activa(uuid, uuid) to authenticated;
grant execute on function privado.consultor_ve_proyecto(uuid) to authenticated;
grant execute on function privado.consultor_ve_convocatoria(uuid) to authenticated;
grant execute on function privado.es_parte_encargo(uuid) to authenticated;
grant execute on function privado.empresa_tiene_encargo_con(uuid) to authenticated;

create policy "proyectos: el consultor ve el de su encargo vigente"
  on public.proyectos for select to authenticated
  using ((select privado.consultor_ve_proyecto(id)));

create policy "proyecto_categoria: el consultor ve las del proyecto de su encargo"
  on public.proyecto_categoria for select to authenticated
  using ((select privado.consultor_ve_proyecto(proyecto_id)));

create policy "convocatorias: el consultor ve la de su encargo vigente"
  on public.convocatorias for select to authenticated
  using ((select privado.consultor_ve_convocatoria(id)));

create policy "convocatorias: la empresa ve las de sus encargos"
  on public.convocatorias for select to authenticated
  using (exists (
    select 1 from public.encargos e
    where e.convocatoria_id = convocatorias.id and e.empresa_id = (select auth.uid())
  ));

create policy "consultor_perfiles: la empresa ve a los consultores de sus encargos"
  on public.consultor_perfiles for select to authenticated
  using ((select privado.empresa_tiene_encargo_con(id)));

-- ---------------------------------------------------------------------------
-- CONSULTOR_REDES — por pareja empresa-consultor (RN-12, RF-80)
-- ---------------------------------------------------------------------------

create table public.consultor_redes (
  id            uuid primary key default gen_random_uuid(),
  consultor_id  uuid not null references public.consultor_perfiles (id) on delete cascade,
  tipo          text not null check (tipo in ('linkedin', 'instagram', 'facebook', 'otra')),
  url           text not null check (url ~* '^https?://[^\s/]+\.[^\s]+$')
);

create index consultor_redes_consultor_idx on public.consultor_redes (consultor_id);

alter table public.consultor_redes enable row level security;

create policy "consultor_redes: el consultor lee las suyas"
  on public.consultor_redes for select to authenticated
  using (consultor_id = (select auth.uid()));

create policy "consultor_redes: el administrador lee todas"
  on public.consultor_redes for select to authenticated
  using ((select privado.es_admin()));

create policy "consultor_redes: la empresa con solicitud activa las ve"
  on public.consultor_redes for select to authenticated
  using ((select privado.solicitud_activa((select auth.uid()), consultor_id)));

create policy "consultor_redes: el consultor agrega"
  on public.consultor_redes for insert to authenticated
  with check (consultor_id = (select auth.uid()));

create policy "consultor_redes: el consultor edita"
  on public.consultor_redes for update to authenticated
  using (consultor_id = (select auth.uid()))
  with check (consultor_id = (select auth.uid()));

create policy "consultor_redes: el consultor elimina"
  on public.consultor_redes for delete to authenticated
  using (consultor_id = (select auth.uid()));

-- Sitio web y hoja de vida (§9.11 punto 4). Devuelve cero filas si quien
-- consulta no es el consultor, un administrador ni la empresa con solicitud
-- activa: no distingue "no autorizado" de "no existe".
create or replace function public.contacto_consultor(p_consultor uuid)
returns table (sitio_web text, cv_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.sitio_web, cp.cv_path
  from public.consultor_perfiles cp
  where cp.id = p_consultor
    and (
      cp.id = auth.uid()
      or privado.es_admin()
      or privado.solicitud_activa(auth.uid(), cp.id)
    );
$$;

revoke all on function public.contacto_consultor(uuid) from public, anon;
grant execute on function public.contacto_consultor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ENCARGO_AVANCES
-- ---------------------------------------------------------------------------

create table public.encargo_avances (
  id          uuid primary key default gen_random_uuid(),
  encargo_id  uuid not null references public.encargos (id) on delete cascade,
  nota        text not null,
  autor_id    uuid references public.perfiles (id) on delete set null,
  fecha       timestamptz not null default now()
);

create index encargo_avances_encargo_idx on public.encargo_avances (encargo_id, fecha);

alter table public.encargo_avances enable row level security;

create policy "encargo_avances: las partes del encargo leen"
  on public.encargo_avances for select to authenticated
  using ((select privado.es_parte_encargo(encargo_id)));

create policy "encargo_avances: el administrador lee todos"
  on public.encargo_avances for select to authenticated
  using ((select privado.es_admin()));

-- ---------------------------------------------------------------------------
-- CALIFICACIONES — una por encargo, inmutable (RN-09, RNF-17)
-- ---------------------------------------------------------------------------

create table public.calificaciones (
  id            uuid primary key default gen_random_uuid(),
  encargo_id    uuid not null unique references public.encargos (id),
  consultor_id  uuid not null references public.consultor_perfiles (id),
  empresa_id    uuid not null default auth.uid() references public.perfiles (id),
  estrellas     int not null check (estrellas between 1 and 5),
  comentario    text,
  creada_at     timestamptz not null default now()
);

create index calificaciones_consultor_idx on public.calificaciones (consultor_id);

alter table public.calificaciones enable row level security;

create policy "calificaciones: lectura pública"
  on public.calificaciones for select to anon, authenticated
  using (true);

-- Solo la empresa del encargo, sobre un encargo completado y con su consultor.
-- La unicidad de encargo_id impide la segunda calificación.
create policy "calificaciones: la empresa califica su encargo completado"
  on public.calificaciones for insert to authenticated
  with check (
    empresa_id = (select auth.uid())
    and exists (
      select 1 from public.encargos e
      where e.id = encargo_id
        and e.empresa_id = (select auth.uid())
        and e.consultor_id = calificaciones.consultor_id
        and e.estado = 'completado'
    )
  );

-- Sin update ni delete para nadie a través de la API: inmutable.

-- Métricas del consultor (§8.4 "triggers para el rating").
create or replace function privado.refrescar_metricas_consultor(p_consultor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.consultor_perfiles cp
  set rating_promedio = coalesce(
        (select round(avg(c.estrellas)::numeric, 2) from public.calificaciones c
         where c.consultor_id = p_consultor), 0),
      total_encargos_completados =
        (select count(*) from public.encargos e
         where e.consultor_id = p_consultor and e.estado in ('completado', 'calificado'))
  where cp.id = p_consultor;
$$;

revoke all on function privado.refrescar_metricas_consultor(uuid) from public, anon, authenticated;

create or replace function privado.al_calificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.encargos set estado = 'calificado' where id = new.encargo_id;
  perform privado.refrescar_metricas_consultor(new.consultor_id);
  return new;
end;
$$;

create trigger calificaciones_al_calificar
  after insert on public.calificaciones
  for each row execute function privado.al_calificar();

create or replace function privado.al_cambiar_estado_encargo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consultor_id is not null then
    perform privado.refrescar_metricas_consultor(new.consultor_id);
  end if;
  return new;
end;
$$;

create trigger encargos_al_cambiar_estado
  after update of estado on public.encargos
  for each row
  when (old.estado is distinct from new.estado)
  execute function privado.al_cambiar_estado_encargo();
