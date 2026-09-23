-- Restaura guardar_convocatoria tras la bisección de la sesión 015 (la
-- migración 20260922900002 la dejó sin la comprobación final a propósito).
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
begin
  if not (select privado.es_admin()) then
    raise exception 'Solo un administrador con MFA guarda convocatorias' using hint = 'no_es_admin';
  end if;

  select * into v_actual from public.convocatorias where id = p_id for update;
  if not found then
    raise exception 'La convocatoria no existe' using hint = 'no_existe';
  end if;

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
    fecha_apertura      = nullif(p_datos ->> 'fecha_apertura', '')::date,
    fecha_cierre        = (p_datos ->> 'fecha_cierre')::date,
    url_postulacion     = nullif(p_datos ->> 'url_postulacion', '')
  where id = p_id;

  -- Categorías: se reemplazan por las recibidas, admitiendo solo las activas o
  -- las que ya tenía (una desactivada después sigue asignada hasta que se quite).
  if exists (
    select 1 from unnest(coalesce(p_categorias, '{}'::uuid[])) nueva
     where not exists (
       select 1 from public.categorias c where c.id = nueva and c.activa
     )
       and not exists (
         select 1 from public.convocatoria_categoria cc
          where cc.convocatoria_id = p_id and cc.categoria_id = nueva
       )
  ) then
    raise exception 'Hay una categoría inexistente o inactiva' using hint = 'categoria_invalida';
  end if;

  delete from public.convocatoria_categoria cc
   where cc.convocatoria_id = p_id
     and cc.categoria_id <> all (coalesce(p_categorias, '{}'::uuid[]));

  insert into public.convocatoria_categoria (convocatoria_id, categoria_id)
  select distinct p_id, nueva from unnest(coalesce(p_categorias, '{}'::uuid[])) nueva
  on conflict do nothing;

  -- Requisitos: se sincronizan por id. El orden es la posición en la lista.
  for v_req in select * from jsonb_array_elements(coalesce(p_requisitos, '[]'::jsonb))
  loop
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

  -- Borrar un requisito no altera los checklists ya copiados (RN-04).
  delete from public.requisitos_convocatoria r
   where r.convocatoria_id = p_id and r.id <> all (v_conservados);

  -- RN-01 · una convocatoria ya publicada no puede quedarse a medias. Se
  -- comprueba al final, sobre lo que quedó escrito, con la misma función que
  -- usa publicar: así las dos reglas no pueden divergir.
  if v_actual.estado = 'publicada' and not (select privado.ficha_publicable(p_id)) then
    raise exception 'Una convocatoria publicada no puede quedar incompleta' using hint = 'publicada_incompleta';
  end if;
end;
$$;

revoke all on function public.guardar_convocatoria(uuid, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.guardar_convocatoria(uuid, jsonb, uuid[], jsonb) to authenticated;
