-- Proyectos de la empresa (RF-14, RF-45, RF-46, RF-81, CU-09, RN-30 · docs/05
-- §9.17 · sesión 018, Sprint 3 paso 1).

-- RF-46 · La completitud la calcula la base: la aplicación no puede fijarla.
-- Misma regla que lib/proyectos.ts (calcularCompletitud): nueve campos de
-- contenido; un texto cuenta si no está en blanco, objetivos_especificos si
-- tiene alguno no vacío, duración y presupuesto si son mayores que cero.
create or replace function privado.calcular_completitud_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_completos integer := 0;
begin
  v_completos :=
      (case when coalesce(btrim(new.problema), '') <> '' then 1 else 0 end)
    + (case when coalesce(btrim(new.objetivo_general), '') <> '' then 1 else 0 end)
    + (case when exists (select 1 from unnest(coalesce(new.objetivos_especificos, '{}')) o where btrim(o) <> '') then 1 else 0 end)
    + (case when coalesce(btrim(new.poblacion_beneficiaria), '') <> '' then 1 else 0 end)
    + (case when coalesce(btrim(new.actividades), '') <> '' then 1 else 0 end)
    + (case when coalesce(btrim(new.resultados_esperados), '') <> '' then 1 else 0 end)
    + (case when coalesce(new.duracion_meses, 0) > 0 then 1 else 0 end)
    + (case when coalesce(new.presupuesto_estimado, 0) > 0 then 1 else 0 end)
    + (case when coalesce(btrim(new.experiencia_empresa), '') <> '' then 1 else 0 end);
  new.completitud := round(v_completos * 100.0 / 9);
  return new;
end;
$$;

drop trigger if exists proyectos_completitud on public.proyectos;
create trigger proyectos_completitud
  before insert or update on public.proyectos
  for each row execute function privado.calcular_completitud_proyecto();

-- Los que ya existan quedan con su valor correcto.
update public.proyectos set nombre = nombre;

-- RF-14, RF-45 · Datos y categorías en una sola transacción, con la sesión de la
-- empresa: la RLS decide qué proyecto es suyo.
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
  v_id uuid := p_id;
begin
  if exists (
    select 1 from unnest(coalesce(p_categorias, '{}')) as c(id)
    where not exists (select 1 from public.categorias k where k.id = c.id and k.activa)
      and (v_id is null or not exists (select 1 from public.proyecto_categoria pc
                                       where pc.proyecto_id = v_id and pc.categoria_id = c.id))
  ) then
    raise exception 'Hay una categoría inexistente o inactiva' using hint = 'categoria_invalida';
  end if;

  if v_id is null then
    insert into public.proyectos (
      nombre, descripcion, monto_buscado, ubicacion, problema, objetivo_general,
      objetivos_especificos, poblacion_beneficiaria, actividades, resultados_esperados,
      duracion_meses, presupuesto_estimado, experiencia_empresa)
    values (
      p_datos ->> 'nombre',
      nullif(p_datos ->> 'descripcion', ''),
      nullif(p_datos ->> 'monto_buscado', '')::numeric,
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

revoke all on function public.guardar_proyecto(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.guardar_proyecto(uuid, jsonb, uuid[]) to authenticated;
