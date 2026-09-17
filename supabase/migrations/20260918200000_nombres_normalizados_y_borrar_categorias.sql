-- =============================================================================
-- Nombres repetidos y borrado de categorías (sesión 014)
-- docs/05-modelo-de-datos.md §9.16 · RF-04, RF-06, RN-07
--
-- Dos hallazgos del Product Owner probando el panel:
--   · `Transformación digital` y `Transformacion digital` entraban como
--     categorías distintas, porque la unicidad comparaba letra por letra;
--   · no había forma de quitar la sobrante.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nombre normalizado
-- ---------------------------------------------------------------------------

create extension if not exists unaccent with schema extensions;

-- El diccionario se fija explícitamente: sin eso `unaccent` depende del
-- search_path y no puede declararse immutable, que es lo que exige un índice.
create or replace function privado.nombre_normalizado(p_nombre text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, btrim(p_nombre)));
$$;

revoke all on function privado.nombre_normalizado(text) from public, anon;
grant execute on function privado.nombre_normalizado(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Fusionar los duplicados que ya existan
-- ---------------------------------------------------------------------------
-- Nada se pierde: lo que apuntaba a la copia pasa a la fila más antigua.

-- Categorías: de cada grupo gana la **mejor escrita** —la que no coincide con su
-- propia forma normalizada, es decir, la que conserva tildes o mayúsculas— y,
-- a igualdad, la de menor id. Así `Transformación digital` le gana a
-- `Transformacion digital` en vez de quedar a suerte del uuid.
with grupos as (
  select id,
         first_value(id) over (
           partition by tipo, privado.nombre_normalizado(nombre)
           order by (nombre = privado.nombre_normalizado(nombre)), id
         ) as se_queda
  from public.categorias
)
update public.convocatoria_categoria cc
   set categoria_id = g.se_queda
  from grupos g
 where cc.categoria_id = g.id
   and g.id <> g.se_queda
   and not exists (
     select 1 from public.convocatoria_categoria otra
      where otra.convocatoria_id = cc.convocatoria_id
        and otra.categoria_id = g.se_queda
   );

-- La convocatoria que tenía las dos se queda con una sola fila.
delete from public.convocatoria_categoria cc
 using (
   select id,
          first_value(id) over (
            partition by tipo, privado.nombre_normalizado(nombre)
            order by (nombre = privado.nombre_normalizado(nombre)), id
          ) as se_queda
     from public.categorias
 ) g
 where cc.categoria_id = g.id and g.id <> g.se_queda;

delete from public.categorias c
 using (
   select id,
          first_value(id) over (
            partition by tipo, privado.nombre_normalizado(nombre)
            order by (nombre = privado.nombre_normalizado(nombre)), id
          ) as se_queda
     from public.categorias
 ) g
 where c.id = g.id and g.id <> g.se_queda;

-- Fuentes: gana la más antigua; sus convocatorias se reasignan.
update public.convocatorias c
   set fuente_id = g.se_queda
  from (
    select id,
           first_value(id) over (
             partition by privado.nombre_normalizado(nombre)
             order by creado_at, id
           ) as se_queda
      from public.fuentes
  ) g
 where c.fuente_id = g.id and g.id <> g.se_queda;

delete from public.fuentes f
 using (
   select id,
          first_value(id) over (
            partition by privado.nombre_normalizado(nombre)
            order by creado_at, id
          ) as se_queda
     from public.fuentes
 ) g
 where f.id = g.id and g.id <> g.se_queda;

-- ---------------------------------------------------------------------------
-- 3. Unicidad por nombre normalizado
-- ---------------------------------------------------------------------------
-- El nombre se guarda tal como se escribió; esto solo decide si dos chocan.

create unique index if not exists categorias_tipo_nombre_norm_idx
  on public.categorias (tipo, privado.nombre_normalizado(nombre));

-- `fuentes` no tenía ninguna: se podían crear dos idénticas.
create unique index if not exists fuentes_nombre_norm_idx
  on public.fuentes (privado.nombre_normalizado(nombre));

-- ---------------------------------------------------------------------------
-- 4. Borrar una categoría que nadie usa (RN-07)
-- ---------------------------------------------------------------------------
-- Fuentes y convocatorias siguen sin borrarse: guardan historia. Una categoría
-- que ninguna convocatoria usa no guarda nada, así que se borra. La regla vive
-- aquí, no en la pantalla: si ya clasifica algo, la política no encuentra la
-- fila y el borrado afecta a 0 filas.

drop policy if exists "categorias: el administrador borra las no usadas" on public.categorias;
create policy "categorias: el administrador borra las no usadas"
  on public.categorias for delete to authenticated
  using (
    (select privado.es_admin())
    and not exists (
      select 1 from public.convocatoria_categoria cc where cc.categoria_id = id
    )
  );
