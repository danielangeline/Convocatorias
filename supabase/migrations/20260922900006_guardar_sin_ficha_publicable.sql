-- guardar_convocatoria vuelve a la comprobación de la sesión 011 (sesión 015).
--
-- Llamar a privado.ficha_publicable desde guardar_convocatoria hacía que un
-- PATCH sobre una convocatoria publicada se quedara ~20 s y muriera con
-- ECONNRESET. No se encontró la causa: se descartaron bloqueos en Postgres, el
-- adjunto en sí, las llamadas a Storage, security invoker frente a definer y la
-- forma del cuerpo de la función. El detalle está en ESTADO.md y en la bitácora
-- de la sesión 015.
--
-- Publicar SÍ conserva la lista completa de RN-01 (ubicación, descripción,
-- categoría, adjunto y dos requisitos): es la puerta que decidió el Product
-- Owner. Lo que queda abierto es que, editando una convocatoria YA publicada,
-- se le puede quitar la ubicación, la descripción, la categoría o el adjunto;
-- el enlace y los requisitos sí siguen protegidos, como antes de hoy.
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

  -- RN-01 (parcial): una publicada no queda sin enlace oficial ni sin requisitos.
  if v_actual.estado = 'publicada'
     and (nullif(p_datos ->> 'url_postulacion', '') is null
          or jsonb_array_length(coalesce(p_requisitos, '[]'::jsonb)) = 0) then
    raise exception 'Una convocatoria publicada necesita enlace oficial y requisitos' using hint = 'publicada_incompleta';
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

end;
$$;

revoke all on function public.guardar_convocatoria(uuid, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.guardar_convocatoria(uuid, jsonb, uuid[], jsonb) to authenticated;
