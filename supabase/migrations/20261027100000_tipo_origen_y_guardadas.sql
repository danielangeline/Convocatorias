-- Sesión 031 · RF-102 (tipo y origen de la convocatoria) y RF-103 (convocatorias
-- guardadas por la empresa). docs/05 §9.33 y §9.34.

-- ---------------------------------------------------------------------------
-- RF-102 · Tipo (fondos o beneficio tributario) y origen (público, privado o
-- cooperación internacional). Con valor por defecto para no romper RN-01 en
-- las que ya existen; el administrador los elige al cargar.
-- ---------------------------------------------------------------------------
alter table public.convocatorias
  add column tipo_convocatoria text not null default 'fondo'
    constraint convocatorias_tipo_valido check (tipo_convocatoria in ('fondo', 'beneficio_tributario')),
  add column origen text not null default 'publico'
    constraint convocatorias_origen_valido check (origen in ('publico', 'privado', 'cooperacion'));

create index convocatorias_tipo_origen_idx on public.convocatorias (tipo_convocatoria, origen);

-- guardar_convocatoria (§9.13): mismo cuerpo de 20260924100000 más tipo y origen.
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
    url_postulacion     = nullif(p_datos ->> 'url_postulacion', ''),
    -- RF-102: tipo y origen; si no llegan, se conservan los que tenía.
    tipo_convocatoria   = coalesce(nullif(p_datos ->> 'tipo_convocatoria', ''), v_actual.tipo_convocatoria),
    origen              = coalesce(nullif(p_datos ->> 'origen', ''), v_actual.origen)
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
-- RF-103 · Convocatorias guardadas (tabla 36). Solo la empresa dueña lee,
-- guarda y quita las suyas (RN-30); solo puede guardar una convocatoria que
-- la RLS ya le deja ver (RN-33).
-- ---------------------------------------------------------------------------
create table public.convocatorias_guardadas (
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  convocatoria_id uuid not null references public.convocatorias (id) on delete cascade,
  creado_at       timestamptz not null default now(),
  primary key (usuario_id, convocatoria_id)
);

create index convocatorias_guardadas_convocatoria_idx on public.convocatorias_guardadas (convocatoria_id);

alter table public.convocatorias_guardadas enable row level security;

create policy "guardadas: el dueño lee"
  on public.convocatorias_guardadas for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "guardadas: la empresa guarda las que ve"
  on public.convocatorias_guardadas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and (select privado.rol_actual()) = 'empresa'
    and exists (select 1 from public.convocatorias c where c.id = convocatoria_id)
  );

create policy "guardadas: el dueño quita"
  on public.convocatorias_guardadas for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.convocatorias_guardadas from anon;
grant select, insert, delete on public.convocatorias_guardadas to authenticated;

-- ---------------------------------------------------------------------------
-- Clasificación de las convocatorias ya cargadas (sesión 029), según la
-- entidad que convoca en su fuente oficial. Todas son de fondos: ninguna es un
-- beneficio tributario. Las que no están aquí quedan como público (valor por
-- defecto) y el administrador las corrige desde el editor.
-- ---------------------------------------------------------------------------
update public.convocatorias set origen = 'privado'
where entidad_convocante in ('BloombergNEF', 'eMerge Americas', 'Michigan Innovation Alliance (MIIA) y SAE', 'South Summit');

update public.convocatorias set origen = 'cooperacion'
where entidad_convocante in ('UNICEF Venture Fund', 'EU-LAC Digital Accelerator (financiado por la Unión Europea)');
