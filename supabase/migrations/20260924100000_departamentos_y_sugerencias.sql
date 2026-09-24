-- Departamentos, cobertura y sugerencias (RN-34, RF-05, RF-09, RF-12, RF-14,
-- RF-15, RF-16, CU-10 · docs/05 §9.6 y §9.18 · sesión 019, Sprint 3 paso 2).
--
-- La ubicación deja de ser texto libre para compararse: una convocatoria es de
-- cobertura nacional o cubre uno o más departamentos, y un proyecto se ejecuta
-- en uno. Los textos `convocatorias.ubicacion_cobertura` y `proyectos.ubicacion`
-- se conservan como detalle. Decisión del Product Owner en la sesión 019.

-- ---------------------------------------------------------------------------
-- DEPARTAMENTOS · lista fija (código DANE). Solo cambia por migración.
-- ---------------------------------------------------------------------------
create table public.departamentos (
  codigo  text primary key check (codigo ~ '^[0-9]{2}$'),
  nombre  text not null unique
);

alter table public.departamentos enable row level security;

create policy "departamentos: lectura con sesión"
  on public.departamentos for select to authenticated
  using (true);

insert into public.departamentos (codigo, nombre) values
  ('05', 'Antioquia'), ('08', 'Atlántico'), ('11', 'Bogotá D.C.'), ('13', 'Bolívar'),
  ('15', 'Boyacá'), ('17', 'Caldas'), ('18', 'Caquetá'), ('19', 'Cauca'),
  ('20', 'Cesar'), ('23', 'Córdoba'), ('25', 'Cundinamarca'), ('27', 'Chocó'),
  ('41', 'Huila'), ('44', 'La Guajira'), ('47', 'Magdalena'), ('50', 'Meta'),
  ('52', 'Nariño'), ('54', 'Norte de Santander'), ('63', 'Quindío'), ('66', 'Risaralda'),
  ('68', 'Santander'), ('70', 'Sucre'), ('73', 'Tolima'), ('76', 'Valle del Cauca'),
  ('81', 'Arauca'), ('85', 'Casanare'), ('86', 'Putumayo'),
  ('88', 'Archipiélago de San Andrés, Providencia y Santa Catalina'),
  ('91', 'Amazonas'), ('94', 'Guainía'), ('95', 'Guaviare'), ('97', 'Vaupés'), ('99', 'Vichada');

-- ---------------------------------------------------------------------------
-- Cobertura de la convocatoria y departamento del proyecto
-- ---------------------------------------------------------------------------
alter table public.convocatorias
  add column cobertura_nacional boolean not null default false;

create table public.convocatoria_departamento (
  convocatoria_id      uuid not null references public.convocatorias (id) on delete cascade,
  departamento_codigo  text not null references public.departamentos (codigo),
  primary key (convocatoria_id, departamento_codigo)
);

create index convocatoria_departamento_departamento_idx
  on public.convocatoria_departamento (departamento_codigo);

alter table public.convocatoria_departamento enable row level security;

-- Las mismas reglas que convocatoria_categoria: visible con su convocatoria.
create policy "convocatoria_departamento: visible con su convocatoria"
  on public.convocatoria_departamento for select to authenticated
  using (exists (select 1 from public.convocatorias c where c.id = convocatoria_id));

create policy "convocatoria_departamento: el administrador crea"
  on public.convocatoria_departamento for insert to authenticated
  with check ((select privado.es_admin()));

create policy "convocatoria_departamento: el administrador elimina"
  on public.convocatoria_departamento for delete to authenticated
  using ((select privado.es_admin()));

alter table public.proyectos
  add column departamento_codigo text references public.departamentos (codigo);

-- ---------------------------------------------------------------------------
-- Datos existentes: se deduce lo que el texto diga sin ambigüedad.
-- ---------------------------------------------------------------------------
-- Clave de búsqueda de cada departamento dentro de un texto normalizado. Cauca
-- y Santander se buscan quitando antes "valle del cauca" y "norte de
-- santander", que los contienen.
create temp table claves_departamento as
select d.codigo,
       case d.codigo when '11' then 'bogota' when '88' then 'san andres'
                     else privado.nombre_normalizado(d.nombre) end as clave
from public.departamentos d;

create function pg_temp.departamentos_en(p_texto text) returns text[]
language sql as $$
  select coalesce(array_agg(k.codigo order by k.codigo), '{}')
  from claves_departamento k
  where replace(replace(privado.nombre_normalizado(coalesce(p_texto, '')),
                        'valle del cauca', '#'), 'norte de santander', '#')
        ~ ('\m' || k.clave || '\M')
     or (k.codigo in ('76', '54')
         and privado.nombre_normalizado(coalesce(p_texto, '')) ~ ('\m' || k.clave || '\M'));
$$;

update public.convocatorias
   set cobertura_nacional = true
 where privado.nombre_normalizado(coalesce(ubicacion_cobertura, '')) like '%nacional%';

insert into public.convocatoria_departamento (convocatoria_id, departamento_codigo)
select c.id, d.codigo
  from public.convocatorias c
  cross join lateral unnest(pg_temp.departamentos_en(c.ubicacion_cobertura)) as d(codigo)
 where not c.cobertura_nacional;

update public.proyectos p
   set departamento_codigo = (pg_temp.departamentos_en(p.ubicacion))[1]
 where cardinality(pg_temp.departamentos_en(p.ubicacion)) = 1;

drop function pg_temp.departamentos_en(text);
drop table claves_departamento;

-- ---------------------------------------------------------------------------
-- RN-01 · La ficha publicable exige cobertura en lugar del texto.
-- ---------------------------------------------------------------------------
create or replace function privado.ficha_publicable(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.convocatorias c
     where c.id = p_id
       and coalesce(btrim(c.nombre), '')              <> ''
       and coalesce(btrim(c.entidad_convocante), '')  <> ''
       and (c.cobertura_nacional
            or exists (select 1 from public.convocatoria_departamento cd where cd.convocatoria_id = p_id))
       and coalesce(btrim(c.descripcion), '')         <> ''
       and coalesce(btrim(c.url_postulacion), '')     <> ''
       and c.fecha_cierre is not null
       and (select count(*) from public.convocatoria_categoria cc where cc.convocatoria_id = p_id) >= 1
       and (select count(*) from public.documentos_convocatoria d where d.convocatoria_id = p_id) >= 1
       and (select count(*) from public.requisitos_convocatoria r where r.convocatoria_id = p_id) >= 2
  );
$$;

-- ---------------------------------------------------------------------------
-- guardar_convocatoria (§9.13): mismo cuerpo de 20260922950000 más la
-- cobertura. Con cobertura nacional, los departamentos se borran.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_convocatoria(
  p_id          uuid,
  p_datos       jsonb,
  p_categorias  uuid[],
  p_requisitos  jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actual      public.convocatorias%rowtype;
  v_fuente      uuid;
  v_req         jsonb;
  v_req_id      uuid;
  v_orden       int := 0;
  v_conservados uuid[] := '{}';
  v_nacional    boolean := coalesce((p_datos ->> 'cobertura_nacional')::boolean, false);
  v_deptos      text[];
begin
  if not (select privado.es_admin()) then
    raise exception 'Solo un administrador con MFA guarda convocatorias' using hint = 'no_es_admin';
  end if;

  select * into v_actual from public.convocatorias where id = p_id for update;
  if not found then
    raise exception 'La convocatoria no existe' using hint = 'no_existe';
  end if;

  -- La comprobacion de RN-01 va al final, sobre lo que quede escrito.

  -- Fuente: activa, o la que ya tenía (CU-02).
  v_fuente := nullif(p_datos ->> 'fuente_id', '')::uuid;
  if v_fuente is not null
     and v_fuente is distinct from v_actual.fuente_id
     and not exists (select 1 from public.fuentes f where f.id = v_fuente and f.activa) then
    raise exception 'La fuente no existe o está inactiva' using hint = 'fuente_invalida';
  end if;

  update public.convocatorias set
    fuente_id           = v_fuente,
    nombre              = p_datos ->> 'nombre',
    entidad_convocante  = p_datos ->> 'entidad_convocante',
    descripcion         = nullif(p_datos ->> 'descripcion', ''),
    monto_min           = nullif(p_datos ->> 'monto_min', '')::numeric,
    monto_max           = nullif(p_datos ->> 'monto_max', '')::numeric,
    ubicacion_cobertura = nullif(p_datos ->> 'ubicacion_cobertura', ''),
    cobertura_nacional  = v_nacional,
    fecha_apertura      = nullif(p_datos ->> 'fecha_apertura', '')::date,
    fecha_cierre        = (p_datos ->> 'fecha_cierre')::date,
    url_postulacion     = nullif(p_datos ->> 'url_postulacion', '')
  where id = p_id;

  -- Categorías (RF-06): activas, o ya asignadas a esta convocatoria.
  if exists (
    select 1 from unnest(coalesce(p_categorias, '{}')) as c(id)
    where not exists (select 1 from public.categorias k where k.id = c.id and k.activa)
      and not exists (select 1 from public.convocatoria_categoria cc
                      where cc.convocatoria_id = p_id and cc.categoria_id = c.id)
  ) then
    raise exception 'Hay una categoría inexistente o inactiva' using hint = 'categoria_invalida';
  end if;

  delete from public.convocatoria_categoria
  where convocatoria_id = p_id and categoria_id <> all (coalesce(p_categorias, '{}'));

  insert into public.convocatoria_categoria (convocatoria_id, categoria_id)
  select distinct p_id, c.id from unnest(coalesce(p_categorias, '{}')) as c(id)
  on conflict do nothing;

  -- Cobertura (RN-34): nacional, o los departamentos recibidos.
  v_deptos := case when v_nacional then '{}'::text[] else coalesce(
    (select array_agg(distinct d) from jsonb_array_elements_text(coalesce(p_datos -> 'departamentos', '[]'::jsonb)) d),
    '{}') end;

  if exists (select 1 from unnest(v_deptos) d(codigo)
             where not exists (select 1 from public.departamentos x where x.codigo = d.codigo)) then
    raise exception 'Hay un departamento que no existe' using hint = 'departamento_invalido';
  end if;

  delete from public.convocatoria_departamento
  where convocatoria_id = p_id and departamento_codigo <> all (v_deptos);

  insert into public.convocatoria_departamento (convocatoria_id, departamento_codigo)
  select p_id, d from unnest(v_deptos) d
  on conflict do nothing;

  -- Requisitos (RF-08): el orden es la posición en la lista.
  for v_req in select * from jsonb_array_elements(coalesce(p_requisitos, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    v_req_id := nullif(v_req ->> 'id', '')::uuid;

    if v_req_id is not null then
      update public.requisitos_convocatoria set
        descripcion = v_req ->> 'descripcion',
        tipo        = v_req ->> 'tipo',
        obligatorio = coalesce((v_req ->> 'obligatorio')::boolean, true),
        orden       = v_orden
      where id = v_req_id and convocatoria_id = p_id;
      if not found then
        raise exception 'El requisito % no pertenece a esta convocatoria', v_req_id using hint = 'requisito_ajeno';
      end if;
    else
      insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden)
      values (p_id, v_req ->> 'descripcion', v_req ->> 'tipo',
              coalesce((v_req ->> 'obligatorio')::boolean, true), v_orden)
      returning id into v_req_id;
    end if;

    v_conservados := v_conservados || v_req_id;
  end loop;

  -- Los checklists ya copiados no cambian (RN-04: requisito_id on delete set null).
  delete from public.requisitos_convocatoria
  where convocatoria_id = p_id and id <> all (v_conservados);

  -- RN-01 · una convocatoria ya publicada no puede quedar incompleta.
  if v_actual.estado = 'publicada' and not (select privado.ficha_publicable(p_id)) then
    raise exception 'Una convocatoria publicada no puede quedar incompleta' using hint = 'publicada_incompleta';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- guardar_proyecto (§9.17): mismo cuerpo de 20260923500000 más el departamento.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_proyecto(
  p_id          uuid,
  p_datos       jsonb,
  p_categorias  uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid := p_id;
  v_depto text := nullif(p_datos ->> 'departamento_codigo', '');
begin
  if exists (
    select 1 from unnest(coalesce(p_categorias, '{}')) as c(id)
    where not exists (select 1 from public.categorias k where k.id = c.id and k.activa)
      and (v_id is null or not exists (select 1 from public.proyecto_categoria pc
                                       where pc.proyecto_id = v_id and pc.categoria_id = c.id))
  ) then
    raise exception 'Hay una categoría inexistente o inactiva' using hint = 'categoria_invalida';
  end if;

  if v_depto is not null and not exists (select 1 from public.departamentos d where d.codigo = v_depto) then
    raise exception 'El departamento no existe' using hint = 'departamento_invalido';
  end if;

  if v_id is null then
    insert into public.proyectos (
      nombre, descripcion, monto_buscado, departamento_codigo, ubicacion, problema, objetivo_general,
      objetivos_especificos, poblacion_beneficiaria, actividades, resultados_esperados,
      duracion_meses, presupuesto_estimado, experiencia_empresa)
    values (
      p_datos ->> 'nombre',
      nullif(p_datos ->> 'descripcion', ''),
      nullif(p_datos ->> 'monto_buscado', '')::numeric,
      v_depto,
      nullif(p_datos ->> 'ubicacion', ''),
      nullif(p_datos ->> 'problema', ''),
      nullif(p_datos ->> 'objetivo_general', ''),
      (select array_agg(o) from jsonb_array_elements_text(coalesce(p_datos -> 'objetivos_especificos', '[]')) o),
      nullif(p_datos ->> 'poblacion_beneficiaria', ''),
      nullif(p_datos ->> 'actividades', ''),
      nullif(p_datos ->> 'resultados_esperados', ''),
      nullif(p_datos ->> 'duracion_meses', '')::integer,
      nullif(p_datos ->> 'presupuesto_estimado', '')::numeric,
      nullif(p_datos ->> 'experiencia_empresa', ''))
    returning id into v_id;
  else
    update public.proyectos set
      nombre                 = p_datos ->> 'nombre',
      descripcion            = nullif(p_datos ->> 'descripcion', ''),
      monto_buscado          = nullif(p_datos ->> 'monto_buscado', '')::numeric,
      departamento_codigo    = v_depto,
      ubicacion              = nullif(p_datos ->> 'ubicacion', ''),
      problema               = nullif(p_datos ->> 'problema', ''),
      objetivo_general       = nullif(p_datos ->> 'objetivo_general', ''),
      objetivos_especificos  = (select array_agg(o) from jsonb_array_elements_text(coalesce(p_datos -> 'objetivos_especificos', '[]')) o),
      poblacion_beneficiaria = nullif(p_datos ->> 'poblacion_beneficiaria', ''),
      actividades            = nullif(p_datos ->> 'actividades', ''),
      resultados_esperados   = nullif(p_datos ->> 'resultados_esperados', ''),
      duracion_meses         = nullif(p_datos ->> 'duracion_meses', '')::integer,
      presupuesto_estimado   = nullif(p_datos ->> 'presupuesto_estimado', '')::numeric,
      experiencia_empresa    = nullif(p_datos ->> 'experiencia_empresa', '')
    where id = v_id;
    if not found then
      raise exception 'El proyecto no existe' using hint = 'no_existe';
    end if;
  end if;

  delete from public.proyecto_categoria
   where proyecto_id = v_id and categoria_id <> all (coalesce(p_categorias, '{}'));
  insert into public.proyecto_categoria (proyecto_id, categoria_id)
  select distinct v_id, c.id from unnest(coalesce(p_categorias, '{}')) as c(id)
  on conflict do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RF-15, RF-16, CU-10 · Sugerencias con porcentaje (docs/05 §9.6). Cruce
-- determinístico de atributos, sin IA (RN-05). Devuelve todas las vigentes,
-- también las de 0 coincidencias: el endpoint las usa para CU-10 2a.
-- ---------------------------------------------------------------------------
create or replace function public.sugerencias_proyecto(p_proyecto uuid)
returns table (
  convocatoria_id  uuid,
  tipo_proyecto    boolean,
  sector           boolean,
  tipo_entidad     boolean,
  monto            boolean,
  ubicacion        boolean,
  coincidencias    integer,
  porcentaje       integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_monto  numeric;
  v_depto  text;
begin
  -- CU-10, precondición: suscripción vigente o trial (RNF-20).
  if not (select privado.tiene_suscripcion_vigente((select auth.uid()))) then
    raise exception 'Hace falta una suscripción vigente para ver sugerencias' using hint = 'sin_suscripcion';
  end if;

  -- La RLS decide si el proyecto es de la sesión: uno ajeno no existe.
  select p.monto_buscado, p.departamento_codigo into v_monto, v_depto
    from public.proyectos p where p.id = p_proyecto;
  if not found then
    raise exception 'El proyecto no existe' using hint = 'no_existe';
  end if;

  return query
  with vigentes as (
    select c.id, c.monto_min, c.monto_max, c.cobertura_nacional, c.fecha_cierre
      from public.convocatorias c
     where c.estado = 'publicada'
       and c.fecha_cierre >= privado.hoy_colombia()
  ),
  por_tipo as (
    select cc.convocatoria_id as id,
           bool_or(k.tipo = 'tipo_proyecto') as tp,
           bool_or(k.tipo = 'sector')        as se,
           bool_or(k.tipo = 'tipo_entidad')  as te
      from public.convocatoria_categoria cc
      join public.proyecto_categoria pc on pc.categoria_id = cc.categoria_id and pc.proyecto_id = p_proyecto
      join public.categorias k on k.id = cc.categoria_id
     where cc.convocatoria_id in (select v.id from vigentes v)
     group by cc.convocatoria_id
  ),
  evaluadas as (
    select v.id, v.fecha_cierre,
           coalesce(t.tp, false) as tp,
           coalesce(t.se, false) as se,
           coalesce(t.te, false) as te,
           (v_monto is not null
             and (v.monto_min is null or v_monto >= v.monto_min)
             and (v.monto_max is null or v_monto <= v.monto_max)) as mo,
           (v.cobertura_nacional
             or (v_depto is not null and exists (
                   select 1 from public.convocatoria_departamento cd
                    where cd.convocatoria_id = v.id and cd.departamento_codigo = v_depto))) as ub
      from vigentes v
      left join por_tipo t on t.id = v.id
  )
  select e.id, e.tp, e.se, e.te, e.mo, e.ub, n.total,
         round(n.total * 100.0 / 5)::integer
    from evaluadas e
    cross join lateral (select e.tp::int + e.se::int + e.te::int + e.mo::int + e.ub::int as total) n
   order by n.total desc, e.fecha_cierre asc, e.id;
end;
$$;

revoke all on function public.sugerencias_proyecto(uuid) from public, anon;
grant execute on function public.sugerencias_proyecto(uuid) to authenticated;
