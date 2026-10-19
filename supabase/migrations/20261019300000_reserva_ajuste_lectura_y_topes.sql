-- =============================================================================
-- Revisión de seguridad de la sesión 026 · docs/05 §9.26
--  1. Reserva del ajuste: un ajuste a la vez por documento, y los que cobran
--     cuentan contra el cupo mientras corren (RN-17, RF-77). Sin esto, N ajustes
--     simultáneos llamaban todos a la IA y solo uno se guardaba.
--  2. Topes en la base (RNF-24): el contenido, el título, los pendientes y los
--     textos del proyecto que entran al contexto. El endpoint no era la única
--     vía de escritura: la RLS deja actualizar directo.
--  3. El consultor lee y edita solo por funciones del servidor que registran la
--     lectura en la misma llamada (RF-79): sin política de lectura directa, una
--     consulta por PostgREST con su sesión ya no se salta la traza.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2. Topes
-- ---------------------------------------------------------------------------

alter table public.documentos_generados
  add constraint documentos_generados_contenido_tope check (contenido is null or length(contenido) <= 200000),
  add constraint documentos_generados_titulo_tope check (titulo is null or length(titulo) <= 300),
  add constraint documentos_generados_pendientes_tope check (cardinality(pendientes) <= 1000);

-- Los mismos máximos que valida guardar_proyecto en la aplicación (sesión 018).
alter table public.proyectos
  add constraint proyectos_nombre_tope check (length(nombre) <= 200),
  add constraint proyectos_ubicacion_tope check (ubicacion is null or length(ubicacion) <= 300),
  add constraint proyectos_textos_tope check (
    coalesce(length(descripcion), 0) <= 5000 and coalesce(length(problema), 0) <= 5000
    and coalesce(length(objetivo_general), 0) <= 5000 and coalesce(length(poblacion_beneficiaria), 0) <= 5000
    and coalesce(length(actividades), 0) <= 5000 and coalesce(length(resultados_esperados), 0) <= 5000
    and coalesce(length(experiencia_empresa), 0) <= 5000
  ),
  add constraint proyectos_objetivos_tope check (
    objetivos_especificos is null
    or (cardinality(objetivos_especificos) <= 30 and length(array_to_string(objetivos_especificos, '')) <= 15000)
  );

-- Los pendientes los calcula la base a partir de los marcadores (RF-57).
create or replace function privado.pendientes_de(p_contenido text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct trim(m[1])), '{}')
  from regexp_matches(coalesce(p_contenido, ''), '\[COMPLETAR:\s*([^\]]+)\]', 'g') as m;
$$;

-- ---------------------------------------------------------------------------
-- 1. Reserva del ajuste
-- ---------------------------------------------------------------------------

alter table public.documentos_generados
  add column ajuste_en_curso_at timestamptz,
  add column ajuste_cobra boolean not null default false;

-- Reservas vivas de una empresa: generaciones en curso y ajustes que cobran.
create or replace function privado.reservas_de(p_usuario uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.documentos_generados d
     where d.usuario_id = p_usuario and d.estado = 'generando')
    + (select count(*) from public.documentos_generados d
       where d.usuario_id = p_usuario and d.ajuste_cobra and d.ajuste_en_curso_at > now() - interval '5 minutes')
  )::int;
$$;

revoke all on function privado.reservas_de(uuid) from public, anon, authenticated;
revoke all on function privado.pendientes_de(text) from public, anon;

create or replace function public.iniciar_generacion(p_usuario uuid, p_proyecto uuid, p_convocatoria uuid)
returns table (
  documento_id uuid,
  version int,
  plantilla_id uuid,
  plantilla text,
  modelo text,
  precio_entrada_usd_mtok numeric,
  precio_salida_usd_mtok numeric,
  tope_caracteres_tdr int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sus uuid;
  v_pl public.plantillas_generacion%rowtype;
  v_version int;
  v_postulacion uuid;
  v_doc uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa genera documentos' using hint = 'no_es_empresa';
  end if;
  if not exists (select 1 from public.proyectos pr where pr.id = p_proyecto and pr.usuario_id = p_usuario) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;
  if not exists (select 1 from public.convocatorias c where c.id = p_convocatoria) then
    raise exception 'La convocatoria no existe' using hint = 'convocatoria_no_existe';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  with viejas as (
    delete from public.documentos_generados d
    where d.usuario_id = p_usuario and d.estado = 'generando' and d.creado_at < now() - interval '5 minutes'
    returning d.plantilla_id
  )
  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, plantilla_id)
  select p_usuario, p_usuario, 'generacion', false, 'La generación no terminó: se liberó la reserva', v.plantilla_id
  from viejas v;

  -- Cuentan las generaciones en curso y los ajustes que cobran (§9.26).
  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) <= 0 then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  select max(d.version) into v_version
  from public.documentos_generados d
  where d.proyecto_id = p_proyecto and d.convocatoria_id = p_convocatoria;

  select po.id into v_postulacion
  from public.postulaciones po
  where po.usuario_id = p_usuario and po.proyecto_id = p_proyecto and po.convocatoria_id = p_convocatoria
    and po.estado <> 'cerrada'
  order by po.creada_at desc
  limit 1;

  insert into public.documentos_generados
    (usuario_id, proyecto_id, convocatoria_id, postulacion_id, estado, version, plantilla_id)
  values
    (p_usuario, p_proyecto, p_convocatoria, v_postulacion, 'generando', coalesce(v_version, 0) + 1, v_pl.id)
  returning id into v_doc;

  return query select v_doc, coalesce(v_version, 0) + 1, v_pl.id, v_pl.contenido, v_pl.modelo,
    v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok, v_pl.tope_caracteres_tdr;
end;
$$;

-- Prepara Y reserva: bloquea el documento, rechaza un segundo ajuste en curso y,
-- si cobra, cuenta como reserva contra el cupo del dueño hasta terminar.
create or replace function public.preparar_ajuste(p_usuario uuid, p_documento uuid)
returns table (
  ajustes_usados int,
  cobra boolean,
  es_dueno boolean,
  plantilla text,
  modelo text,
  precio_entrada_usd_mtok numeric,
  precio_salida_usd_mtok numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_generados%rowtype;
  v_sus uuid;
  v_pl public.plantillas_generacion%rowtype;
  v_cobra boolean;
begin
  if not privado.accede_documento(p_usuario, p_documento) then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.ajuste_en_curso_at > now() - interval '5 minutes' then
    raise exception 'Ya hay un ajuste en curso sobre este documento' using hint = 'ajuste_en_curso';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'La empresa dueña no tiene suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  v_cobra := v_doc.ajustes_usados >= 3;
  if v_cobra then
    perform 1 from public.suscripciones s where s.id = v_sus for update;
    if privado.creditos_disponibles(v_sus) - privado.reservas_de(v_doc.usuario_id) <= 0 then
      raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
    end if;
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  update public.documentos_generados set ajuste_en_curso_at = now(), ajuste_cobra = v_cobra where id = p_documento;

  return query select v_doc.ajustes_usados, v_cobra, v_doc.usuario_id = p_usuario,
    v_pl.contenido, v_pl.modelo, v_pl.precio_entrada_usd_mtok, v_pl.precio_salida_usd_mtok;
end;
$$;

create or replace function public.completar_ajuste(
  p_usuario uuid,
  p_documento uuid,
  p_ajustes_previos int,
  p_contenido text,
  p_pendientes text[],
  p_tokens_entrada int,
  p_tokens_salida int,
  p_costo numeric,
  p_modelo text,
  p_duracion_ms int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos_generados%rowtype;
  v_sus uuid;
  v_cobra boolean;
begin
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.id is null or not privado.accede_documento(p_usuario, p_documento) then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
  if v_doc.ajuste_en_curso_at is null then
    raise exception 'El ajuste no estaba reservado' using hint = 'ajuste_no_reservado';
  end if;
  if v_doc.ajustes_usados <> p_ajustes_previos then
    raise exception 'Otro ajuste se aplicó mientras tanto' using hint = 'ajuste_concurrente';
  end if;

  v_cobra := v_doc.ajustes_usados >= 3;
  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'La empresa dueña no tiene suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  if v_cobra then
    perform 1 from public.suscripciones s where s.id = v_sus for update;
    perform privado.descontar_credito(v_sus);
  end if;

  update public.documentos_generados
  set contenido = p_contenido,
      pendientes = privado.pendientes_de(p_contenido),
      ajustes_usados = ajustes_usados + 1,
      estado = 'editado',
      ultima_edicion_por = p_usuario,
      ajuste_en_curso_at = null,
      ajuste_cobra = false
  where id = p_documento;

  insert into public.consumos_ia
    (usuario_id, empresa_id, documento_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_id, duracion_ms, credito_descontado)
  values
    (p_usuario, v_doc.usuario_id, p_documento, 'ajuste', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, (select pg.id from public.plantillas_generacion pg where pg.activa limit 1), p_duracion_ms, v_cobra);
end;
$$;

-- Un ajuste fallido libera su reserva.
create or replace function public.registrar_consumo_fallido(
  p_usuario uuid,
  p_documento uuid,
  p_tipo text,
  p_mensaje text,
  p_tokens_entrada int,
  p_tokens_salida int,
  p_costo numeric,
  p_modelo text,
  p_duracion_ms int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo = 'ajuste' then
    update public.documentos_generados set ajuste_en_curso_at = null, ajuste_cobra = false where id = p_documento;
  end if;
  insert into public.consumos_ia
    (usuario_id, empresa_id, documento_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, mensaje_error, modelo, plantilla_id, duracion_ms)
  values
    (p_usuario, (select d.usuario_id from public.documentos_generados d where d.id = p_documento), p_documento,
     p_tipo, p_tokens_entrada, p_tokens_salida, p_costo, false, left(p_mensaje, 500), p_modelo,
     (select pg.id from public.plantillas_generacion pg where pg.activa limit 1), p_duracion_ms);
end;
$$;

-- El cliente no toca la reserva; y los pendientes los recalcula la base (RF-57).
create or replace function privado.guardar_columnas_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not privado.es_cliente() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.usuario_id is distinct from old.usuario_id
     or new.proyecto_id is distinct from old.proyecto_id
     or new.convocatoria_id is distinct from old.convocatoria_id
     or new.postulacion_id is distinct from old.postulacion_id
     or new.estado is distinct from old.estado
     or new.version is distinct from old.version
     or new.documento_padre_id is distinct from old.documento_padre_id
     or new.plantilla_id is distinct from old.plantilla_id
     or new.ajustes_usados is distinct from old.ajustes_usados
     or new.compartido_con_consultor_id is distinct from old.compartido_con_consultor_id
     or new.ajuste_en_curso_at is distinct from old.ajuste_en_curso_at
     or new.ajuste_cobra is distinct from old.ajuste_cobra
     or new.creado_at is distinct from old.creado_at then
    raise exception 'Solo puedes editar el título, el contenido y los pendientes del documento'
      using errcode = '42501';
  end if;

  if new.titulo is distinct from old.titulo and old.usuario_id <> auth.uid() then
    raise exception 'Solo la empresa dueña puede cambiar el título del documento'
      using errcode = '42501';
  end if;

  new.pendientes := privado.pendientes_de(new.contenido);
  new.ultima_edicion_por := auth.uid();
  if old.estado = 'generado' then
    new.estado := 'editado';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. El consultor, solo por el servidor (RF-79)
-- ---------------------------------------------------------------------------

drop policy "documentos_generados: el consultor autorizado lee (RN-27)" on public.documentos_generados;
drop policy "documentos_generados: el consultor autorizado edita (RN-27)" on public.documentos_generados;

-- Lee un documento como el usuario dado. Si es el consultor autorizado, la
-- lectura queda registrada en la misma llamada.
create or replace function public.leer_documento(p_usuario uuid, p_documento uuid)
returns setof public.documentos_generados
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.accede_documento(p_usuario, p_documento) then
    return;
  end if;
  insert into public.documento_lecturas (documento_id, consultor_id)
  select d.id, p_usuario from public.documentos_generados d
  where d.id = p_documento and d.usuario_id <> p_usuario;
  return query select * from public.documentos_generados d where d.id = p_documento;
end;
$$;

-- La lista del consultor: los autorizados con encargo en curso, sin contenido.
create or replace function public.documentos_del_consultor(p_usuario uuid)
returns table (
  id uuid, proyecto_id uuid, convocatoria_id uuid, titulo text, estado text, version int,
  pendientes text[], actualizado_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.proyecto_id, d.convocatoria_id, d.titulo, d.estado, d.version, d.pendientes, d.actualizado_at
  from public.documentos_generados d
  where d.compartido_con_consultor_id = p_usuario and d.usuario_id <> p_usuario
    and privado.accede_documento(p_usuario, d.id)
  order by d.actualizado_at desc;
$$;

-- Edición del consultor autorizado (RF-58, RN-22): solo el contenido.
create or replace function public.editar_documento_consultor(p_usuario uuid, p_documento uuid, p_contenido text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.documentos_generados d
  set contenido = p_contenido,
      pendientes = privado.pendientes_de(p_contenido),
      ultima_edicion_por = p_usuario,
      estado = case when d.estado = 'generado' then 'editado' else d.estado end
  where d.id = p_documento and d.usuario_id <> p_usuario and privado.accede_documento(p_usuario, p_documento);
  if not found then
    raise exception 'El documento no existe' using hint = 'documento_no_existe';
  end if;
end;
$$;

drop function public.registrar_lectura_documento(uuid, uuid);

revoke all on function public.leer_documento(uuid, uuid) from public, anon, authenticated;
revoke all on function public.documentos_del_consultor(uuid) from public, anon, authenticated;
revoke all on function public.editar_documento_consultor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.leer_documento(uuid, uuid) to service_role;
grant execute on function public.documentos_del_consultor(uuid) to service_role;
grant execute on function public.editar_documento_consultor(uuid, uuid, text) to service_role;
