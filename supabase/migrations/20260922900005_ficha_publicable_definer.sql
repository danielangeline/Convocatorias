-- ficha_publicable pasa a security definer (sesión 015).
--
-- Como `security invoker` obligaba a evaluar las políticas RLS de las cuatro
-- tablas encadenadas dentro de la misma transacción que ya tenía la fila
-- bloqueada, y guardar una convocatoria con adjunto se quedaba ~20 s hasta que
-- la conexión moría. No es un control de acceso: devuelve un booleano sobre una
-- convocatoria cuyo id ya conoce quien llama, y las dos funciones que la usan
-- —guardar_convocatoria y publicar_convocatoria— comprueban antes
-- `privado.es_admin()`. Vive en el esquema privado y anon no puede ejecutarla.
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
       and coalesce(btrim(c.ubicacion_cobertura), '') <> ''
       and coalesce(btrim(c.descripcion), '')         <> ''
       and coalesce(btrim(c.url_postulacion), '')     <> ''
       and c.fecha_cierre is not null
       and (select count(*) from public.convocatoria_categoria cc where cc.convocatoria_id = p_id) >= 1
       and (select count(*) from public.documentos_convocatoria d where d.convocatoria_id = p_id) >= 1
       and (select count(*) from public.requisitos_convocatoria r where r.convocatoria_id = p_id) >= 2
  );
$$;

revoke all on function privado.ficha_publicable(uuid) from public, anon;
grant execute on function privado.ficha_publicable(uuid) to authenticated;
