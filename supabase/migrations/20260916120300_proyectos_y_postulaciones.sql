-- =============================================================================
-- Proyectos y postulaciones
-- docs/05-modelo-de-datos.md §9.2, §9.10, §9.11 · RN-03, RN-04, RN-30, RNF-03, RF-17, RF-19, RF-78
--
-- La lectura de un proyecto por el consultor de un encargo (RN-25) se agrega
-- en la migración de consultores y encargos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PROYECTOS
-- ---------------------------------------------------------------------------

create table public.proyectos (
  id                      uuid primary key default gen_random_uuid(),
  -- Propietario (RN-30). Lo fija la sesión, nunca el formulario.
  usuario_id              uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre                  text not null,
  descripcion             text,
  monto_buscado           numeric check (monto_buscado is null or monto_buscado >= 0),
  ubicacion               text,
  -- Contenido para la generación con IA (RF-45)
  problema                text,
  objetivo_general        text,
  objetivos_especificos   text[],
  poblacion_beneficiaria  text,
  actividades             text,
  resultados_esperados    text,
  duracion_meses          int check (duracion_meses is null or duracion_meses > 0),
  presupuesto_estimado    numeric check (presupuesto_estimado is null or presupuesto_estimado >= 0),
  experiencia_empresa     text,
  completitud             int not null default 0 check (completitud between 0 and 100),
  creado_at               timestamptz not null default now(),
  actualizado_at          timestamptz not null default now()
);

create index proyectos_usuario_idx on public.proyectos (usuario_id);

create trigger proyectos_actualizado_at
  before update on public.proyectos
  for each row execute function privado.fijar_actualizado_at();

create or replace function privado.guardar_propietario_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() and new.usuario_id is distinct from old.usuario_id then
    raise exception 'No puedes cambiar el propietario del proyecto' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proyectos_guardar_propietario
  before update on public.proyectos
  for each row execute function privado.guardar_propietario_proyecto();

alter table public.proyectos enable row level security;

create policy "proyectos: el dueño lee"
  on public.proyectos for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "proyectos: el administrador lee para soporte"
  on public.proyectos for select to authenticated
  using ((select privado.es_admin()));

-- Solo una empresa registra proyectos: el consultor no tiene (RN-28).
create policy "proyectos: la empresa crea los suyos"
  on public.proyectos for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (select privado.rol_actual()) = 'empresa'
  );

create policy "proyectos: el dueño edita"
  on public.proyectos for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "proyectos: el dueño elimina"
  on public.proyectos for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- Dueño del proyecto, sin pasar por la política de proyectos (evita recursión
-- desde las políticas de las tablas hijas).
create or replace function privado.es_dueno_proyecto(p_proyecto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proyectos p
    where p.id = p_proyecto and p.usuario_id = auth.uid()
  );
$$;

revoke all on function privado.es_dueno_proyecto(uuid) from public, anon;
grant execute on function privado.es_dueno_proyecto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PROYECTO_CATEGORIA — misma regla que proyectos (§9.10)
-- ---------------------------------------------------------------------------

create table public.proyecto_categoria (
  proyecto_id   uuid not null references public.proyectos (id) on delete cascade,
  categoria_id  uuid not null references public.categorias (id),
  primary key (proyecto_id, categoria_id)
);

create index proyecto_categoria_categoria_idx on public.proyecto_categoria (categoria_id);

alter table public.proyecto_categoria enable row level security;

create policy "proyecto_categoria: el dueño del proyecto lee"
  on public.proyecto_categoria for select to authenticated
  using ((select privado.es_dueno_proyecto(proyecto_id)));

create policy "proyecto_categoria: el administrador lee para soporte"
  on public.proyecto_categoria for select to authenticated
  using ((select privado.es_admin()));

create policy "proyecto_categoria: el dueño del proyecto agrega"
  on public.proyecto_categoria for insert to authenticated
  with check ((select privado.es_dueno_proyecto(proyecto_id)));

create policy "proyecto_categoria: el dueño del proyecto quita"
  on public.proyecto_categoria for delete to authenticated
  using ((select privado.es_dueno_proyecto(proyecto_id)));

-- ---------------------------------------------------------------------------
-- POSTULACIONES
-- ---------------------------------------------------------------------------

create table public.postulaciones (
  id                uuid primary key default gen_random_uuid(),
  -- Propietario (RN-30)
  usuario_id        uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  convocatoria_id   uuid not null references public.convocatorias (id),
  proyecto_id       uuid references public.proyectos (id) on delete set null,
  estado            text not null default 'en_preparacion'
                    check (estado in ('en_preparacion', 'presentada', 'en_evaluacion',
                                      'aprobada', 'rechazada', 'cerrada')),
  creada_at         timestamptz not null default now(),
  actualizada_at    timestamptz not null default now()
);

create index postulaciones_usuario_idx on public.postulaciones (usuario_id);
create index postulaciones_convocatoria_idx on public.postulaciones (convocatoria_id);
create index postulaciones_proyecto_idx on public.postulaciones (proyecto_id);

create or replace function privado.fijar_actualizada_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizada_at := now();
  return new;
end;
$$;

create trigger postulaciones_actualizada_at
  before update on public.postulaciones
  for each row execute function privado.fijar_actualizada_at();

create or replace function privado.guardar_columnas_postulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente()
     and (new.usuario_id is distinct from old.usuario_id
          or new.convocatoria_id is distinct from old.convocatoria_id) then
    raise exception 'No puedes cambiar el propietario ni la convocatoria de una postulación'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger postulaciones_guardar_columnas
  before update on public.postulaciones
  for each row execute function privado.guardar_columnas_postulacion();

alter table public.postulaciones enable row level security;

create policy "postulaciones: la empresa dueña lee"
  on public.postulaciones for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "postulaciones: el administrador lee para soporte"
  on public.postulaciones for select to authenticated
  using ((select privado.es_admin()));

-- RF-17 (requiere suscripción) y RF-78 / RN-03 (convocatoria publicada y
-- vigente), verificados en la base además de en la API (RNF-20).
create policy "postulaciones: la empresa inicia las suyas"
  on public.postulaciones for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (select privado.rol_actual()) = 'empresa'
    and (select privado.tiene_suscripcion_vigente((select auth.uid())))
    and exists (
      select 1 from public.convocatorias c
      where c.id = convocatoria_id
        and c.estado = 'publicada'
        and c.fecha_cierre >= current_date
    )
    and (proyecto_id is null or (select privado.es_dueno_proyecto(proyecto_id)))
  );

create policy "postulaciones: la empresa dueña edita"
  on public.postulaciones for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and (proyecto_id is null or (select privado.es_dueno_proyecto(proyecto_id)))
  );

-- Sin delete: la postulación y su historial son registro auditado (RNF-20).

create or replace function privado.es_dueno_postulacion(p_postulacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.postulaciones p
    where p.id = p_postulacion and p.usuario_id = auth.uid()
  );
$$;

revoke all on function privado.es_dueno_postulacion(uuid) from public, anon;
grant execute on function privado.es_dueno_postulacion(uuid) to authenticated;

-- La empresa sigue viendo la convocatoria de sus postulaciones aunque se
-- cierre o despublique; si no, su historial quedaría sin nombre.
create policy "convocatorias: la empresa ve las de sus postulaciones"
  on public.convocatorias for select to authenticated
  using (exists (
    select 1 from public.postulaciones p
    where p.convocatoria_id = convocatorias.id and p.usuario_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- POSTULACION_CHECKLIST — copia de los requisitos al postular (RN-04)
-- ---------------------------------------------------------------------------

create table public.postulacion_checklist (
  id              uuid primary key default gen_random_uuid(),
  postulacion_id  uuid not null references public.postulaciones (id) on delete cascade,
  requisito_id    uuid references public.requisitos_convocatoria (id) on delete set null,
  -- Copia del requisito: editarlo después no altera la postulación (RN-04).
  descripcion     text not null,
  obligatorio     boolean not null,
  orden           int not null default 0,
  completado      boolean not null default false,
  completado_at   timestamptz
);

create index postulacion_checklist_postulacion_idx on public.postulacion_checklist (postulacion_id, orden);

-- La empresa solo marca o desmarca: el texto del ítem es la copia del requisito.
create or replace function privado.guardar_columnas_checklist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente()
     and (new.postulacion_id is distinct from old.postulacion_id
          or new.requisito_id is distinct from old.requisito_id
          or new.descripcion is distinct from old.descripcion
          or new.obligatorio is distinct from old.obligatorio
          or new.orden is distinct from old.orden) then
    raise exception 'Solo puedes marcar o desmarcar los ítems del checklist' using errcode = '42501';
  end if;
  new.completado_at := case when new.completado then coalesce(old.completado_at, now()) end;
  return new;
end;
$$;

create trigger postulacion_checklist_guardar_columnas
  before update on public.postulacion_checklist
  for each row execute function privado.guardar_columnas_checklist();

alter table public.postulacion_checklist enable row level security;

create policy "postulacion_checklist: la empresa dueña lee"
  on public.postulacion_checklist for select to authenticated
  using ((select privado.es_dueno_postulacion(postulacion_id)));

create policy "postulacion_checklist: el administrador lee para soporte"
  on public.postulacion_checklist for select to authenticated
  using ((select privado.es_admin()));

create policy "postulacion_checklist: la empresa dueña marca"
  on public.postulacion_checklist for update to authenticated
  using ((select privado.es_dueno_postulacion(postulacion_id)))
  with check ((select privado.es_dueno_postulacion(postulacion_id)));

-- Genera el checklist al iniciar la postulación (RF-17, RN-04).
create or replace function privado.copiar_requisitos_a_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.postulacion_checklist (postulacion_id, requisito_id, descripcion, obligatorio, orden)
  select new.id, r.id, r.descripcion, r.obligatorio, r.orden
  from public.requisitos_convocatoria r
  where r.convocatoria_id = new.convocatoria_id;
  return new;
end;
$$;

create trigger postulaciones_copiar_checklist
  after insert on public.postulaciones
  for each row execute function privado.copiar_requisitos_a_checklist();

-- ---------------------------------------------------------------------------
-- POSTULACION_HISTORIAL — lo escribe solo el trigger (RF-19, RNF-20)
-- ---------------------------------------------------------------------------

create table public.postulacion_historial (
  id                uuid primary key default gen_random_uuid(),
  postulacion_id    uuid not null references public.postulaciones (id) on delete cascade,
  estado_anterior   text,
  estado_nuevo      text not null,
  cambiado_por      uuid references public.perfiles (id) on delete set null,
  fecha             timestamptz not null default now()
);

create index postulacion_historial_postulacion_idx on public.postulacion_historial (postulacion_id, fecha);

alter table public.postulacion_historial enable row level security;

create policy "postulacion_historial: la empresa dueña lee"
  on public.postulacion_historial for select to authenticated
  using ((select privado.es_dueno_postulacion(postulacion_id)));

create policy "postulacion_historial: el administrador lee para soporte"
  on public.postulacion_historial for select to authenticated
  using ((select privado.es_admin()));

create or replace function privado.registrar_historial_postulacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.postulacion_historial (postulacion_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, null, new.estado, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.postulacion_historial (postulacion_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger postulaciones_registrar_historial
  after insert or update of estado on public.postulaciones
  for each row execute function privado.registrar_historial_postulacion();
