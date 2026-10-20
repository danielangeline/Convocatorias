-- =============================================================================
-- Versiones de la plantilla de generación (CU-37 · RF-63 · RNF-11, RNF-28)
-- docs/05-modelo-de-datos.md §9.27 · Sprint 5 · sesión 027
--
-- Una versión es inmutable: editar es crear la siguiente. Crear y activar van
-- por funciones que exigen administrador con aal2; el cliente ya no inserta ni
-- actualiza la tabla directamente.
-- =============================================================================

alter table public.plantillas_generacion
  add column activada_por uuid references public.perfiles (id),
  add column activada_at  timestamptz,
  add constraint plantillas_generacion_contenido_largo check (length(contenido) between 200 and 50000),
  add constraint plantillas_generacion_modelo_formato check (modelo ~ '^[a-z0-9._-]{1,60}$'),
  add constraint plantillas_generacion_precios_tope check (precio_entrada_usd_mtok <= 1000 and precio_salida_usd_mtok <= 1000);

-- ---------------------------------------------------------------------------
-- Inmutabilidad (también para service_role)
-- ---------------------------------------------------------------------------

create or replace function privado.plantilla_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.nombre is distinct from old.nombre
     or new.version is distinct from old.version
     or new.contenido is distinct from old.contenido
     or new.modelo is distinct from old.modelo
     or new.precio_entrada_usd_mtok is distinct from old.precio_entrada_usd_mtok
     or new.precio_salida_usd_mtok is distinct from old.precio_salida_usd_mtok
     or new.tope_caracteres_tdr is distinct from old.tope_caracteres_tdr
     or new.creada_por is distinct from old.creada_por
     or new.creado_at is distinct from old.creado_at then
    raise exception 'Una versión de la plantilla no se modifica: crea la siguiente' using hint = 'plantilla_inmutable';
  end if;
  return new;
end;
$$;

create trigger plantillas_generacion_inmutable
  before update on public.plantillas_generacion
  for each row execute function privado.plantilla_inmutable();

-- Una versión con la que ya se generó no se borra (la FK de documentos ya lo
-- impide); sin política de borrado, el cliente no borra ninguna.

-- ---------------------------------------------------------------------------
-- Políticas: el administrador solo lee desde el cliente
-- ---------------------------------------------------------------------------

drop policy "plantillas_generacion: el administrador crea" on public.plantillas_generacion;
drop policy "plantillas_generacion: el administrador activa o desactiva" on public.plantillas_generacion;

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

create or replace function public.crear_version_plantilla(
  p_contenido text,
  p_modelo text,
  p_precio_entrada numeric,
  p_precio_salida numeric,
  p_tope int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre constant text := 'Documento base de postulación';
  v_id uuid;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  -- Dos administradores a la vez no toman el mismo número.
  lock table public.plantillas_generacion in share row exclusive mode;
  insert into public.plantillas_generacion
    (nombre, version, contenido, activa, creada_por, modelo, precio_entrada_usd_mtok, precio_salida_usd_mtok, tope_caracteres_tdr)
  values
    (v_nombre,
     coalesce((select max(version) from public.plantillas_generacion where nombre = v_nombre), 0) + 1,
     p_contenido, false, auth.uid(), p_modelo, p_precio_entrada, p_precio_salida, p_tope)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.activar_plantilla(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  perform 1 from public.plantillas_generacion where id = p_id for update;
  if not found then
    raise exception 'La versión no existe' using hint = 'plantilla_no_existe';
  end if;
  update public.plantillas_generacion set activa = false where activa and id <> p_id;
  update public.plantillas_generacion
     set activa = true, activada_por = auth.uid(), activada_at = now()
   where id = p_id;
end;
$$;

create or replace function public.estadisticas_plantillas()
returns table (
  plantilla_id uuid,
  documentos bigint,
  generaciones_exitosas bigint,
  generaciones_fallidas bigint,
  tokens_entrada_promedio numeric,
  tokens_salida_promedio numeric,
  costo_promedio_usd numeric,
  pendientes_promedio numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  return query
  select p.id,
         (select count(*) from public.documentos_generados d where d.plantilla_id = p.id and d.estado <> 'generando'),
         count(c.id) filter (where c.exito),
         count(c.id) filter (where not c.exito),
         round(avg(c.tokens_entrada) filter (where c.exito), 0),
         round(avg(c.tokens_salida) filter (where c.exito), 0),
         round(avg(c.costo_estimado) filter (where c.exito), 6),
         (select round(avg(coalesce(array_length(d.pendientes, 1), 0)), 1)
            from public.documentos_generados d where d.plantilla_id = p.id and d.estado <> 'generando')
    from public.plantillas_generacion p
    left join public.consumos_ia c on c.plantilla_id = p.id and c.tipo = 'generacion'
   group by p.id;
end;
$$;

revoke all on function public.crear_version_plantilla(text, text, numeric, numeric, int) from public, anon;
revoke all on function public.activar_plantilla(uuid) from public, anon;
revoke all on function public.estadisticas_plantillas() from public, anon;
grant execute on function public.crear_version_plantilla(text, text, numeric, numeric, int) to authenticated;
grant execute on function public.activar_plantilla(uuid) to authenticated;
grant execute on function public.estadisticas_plantillas() to authenticated;
