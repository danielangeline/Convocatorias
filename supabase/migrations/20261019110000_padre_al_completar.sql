-- =============================================================================
-- RF-61 · El padre de una regeneración se fija al completarla (sesión 026)
-- docs/05 §9.26. Al reservar, la versión anterior puede seguir en `generando`;
-- el padre es la última versión terminada en el momento de guardar.
-- =============================================================================

create or replace function public.completar_generacion(
  p_documento uuid,
  p_titulo text,
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
begin
  select * into v_doc from public.documentos_generados d where d.id = p_documento for update;
  if v_doc.id is null or v_doc.estado <> 'generando' then
    raise exception 'La generación ya no está en curso' using hint = 'generacion_no_encontrada';
  end if;

  v_sus := privado.suscripcion_de_cobro(v_doc.usuario_id);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  perform 1 from public.suscripciones s where s.id = v_sus for update;
  perform privado.descontar_credito(v_sus);

  update public.documentos_generados
  set titulo = p_titulo,
      contenido = p_contenido,
      pendientes = coalesce(p_pendientes, '{}'),
      estado = 'generado',
      documento_padre_id = (
        select d.id from public.documentos_generados d
        where d.proyecto_id = v_doc.proyecto_id and d.convocatoria_id = v_doc.convocatoria_id
          and d.estado <> 'generando' and d.version < v_doc.version
        order by d.version desc
        limit 1
      )
  where id = p_documento;

  insert into public.consumos_ia
    (usuario_id, empresa_id, documento_id, tipo, tokens_entrada, tokens_salida, costo_estimado,
     exito, modelo, plantilla_id, duracion_ms, credito_descontado)
  values
    (v_doc.usuario_id, v_doc.usuario_id, p_documento, 'generacion', p_tokens_entrada, p_tokens_salida, p_costo,
     true, p_modelo, v_doc.plantilla_id, p_duracion_ms, true);
end;
$$;
