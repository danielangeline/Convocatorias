-- RN-01, RF-09, CU-05, CU-03 1b · Una convocatoria publicada no puede quedar
-- incompleta al editarla (guardar_convocatoria, docs/05 §9.13) ni al quitarle
-- adjuntos (trigger de documentos_convocatoria, docs/05 §9.14). Sesión 016.
--
--   npx supabase db query --linked -f supabase/tests/guardar_publicada_completa.sql
--
-- No deja nada escrito: prepara una publicada completa, intenta cada edición
-- como el Propietario con aal2 y termina SIEMPRE con un error "RESULTADO …" que
-- revierte la transacción. Se lee ese mensaje: cada línea dice OK o FALLA.
-- Existe porque la suite HTTP (scripts/prueba-publicar-convocatoria.mjs) no
-- llega a estos casos en una red que pierde paquetes (docs/incidentes/).
do $$
declare
  v_admin uuid; v_fuente uuid; v_cat uuid; v_conv uuid; v_r1 uuid; v_r2 uuid;
  v_datos jsonb; v_reqs jsonb; v_res text := ''; v_doc1 uuid; v_doc2 uuid;
  v_caso record;
begin
  select id into v_admin from public.perfiles where es_propietario;
  insert into public.fuentes (nombre, activa) values ('Fuente verificacion s016 ' || gen_random_uuid(), true) returning id into v_fuente;
  insert into public.categorias (tipo, nombre, activa) values ('sector', 'Sector verificacion s016 ' || gen_random_uuid(), true) returning id into v_cat;
  insert into public.convocatorias (fuente_id, nombre, entidad_convocante, descripcion, ubicacion_cobertura, fecha_cierre, url_postulacion, estado)
    values (v_fuente, 'Conv s016', 'Entidad', 'Objeto', 'Nacional', current_date + 30, 'https://entidad.gov.co/x', 'publicada') returning id into v_conv;
  insert into public.convocatoria_categoria values (v_conv, v_cat);
  insert into public.documentos_convocatoria (convocatoria_id, tipo_doc, nombre, storage_path) values (v_conv, 'TDR', 'TDR', v_conv || '/verificacion.pdf') returning id into v_doc1;
  insert into public.documentos_convocatoria (convocatoria_id, tipo_doc, nombre, storage_path) values (v_conv, 'anexo', 'Anexo', v_conv || '/verificacion-2.pdf') returning id into v_doc2;
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden) values (v_conv, 'Camara', 'documento', true, 1) returning id into v_r1;
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden) values (v_conv, 'Pyme', 'condicion', false, 2) returning id into v_r2;

  v_datos := jsonb_build_object('fuente_id', v_fuente, 'nombre', 'Conv s016', 'entidad_convocante', 'Entidad', 'descripcion', 'Objeto',
    'monto_min', '', 'monto_max', '', 'ubicacion_cobertura', 'Nacional', 'fecha_apertura', '', 'fecha_cierre', (current_date + 30)::text,
    'url_postulacion', 'https://entidad.gov.co/x');
  v_reqs := jsonb_build_array(jsonb_build_object('id', v_r1, 'descripcion', 'Camara', 'tipo', 'documento', 'obligatorio', true),
                              jsonb_build_object('id', v_r2, 'descripcion', 'Pyme', 'tipo', 'condicion', 'obligatorio', false));

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  for v_caso in
    select * from (values
      ('edicion valida (cambia el nombre)', v_datos || '{"nombre":"Conv s016 editada"}', array[v_cat], v_reqs, 'ok'),
      ('quitar ubicacion',   v_datos || '{"ubicacion_cobertura":""}', array[v_cat], v_reqs, 'publicada_incompleta'),
      ('quitar descripcion', v_datos || '{"descripcion":""}',         array[v_cat], v_reqs, 'publicada_incompleta'),
      ('quitar categoria',   v_datos, '{}'::uuid[], v_reqs, 'publicada_incompleta'),
      ('dejar un requisito', v_datos, array[v_cat], jsonb_build_array(v_reqs -> 0), 'publicada_incompleta'),
      ('dejar sin requisitos', v_datos, array[v_cat], '[]'::jsonb, 'publicada_incompleta')
    ) as t(caso, datos, cats, reqs, esperado)
  loop
    declare v_obtenido text;
    begin
      begin
        execute 'set local role authenticated';
        perform public.guardar_convocatoria(v_conv, v_caso.datos, v_caso.cats, v_caso.reqs);
        v_obtenido := 'ok';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_obtenido = pg_exception_hint;
        if v_obtenido = '' then v_obtenido := sqlerrm; end if;
      end;
      v_res := v_res || format(E'\n%s %s -> %s', case when v_obtenido = v_caso.esperado then 'OK   ' else 'FALLA' end, v_caso.caso, v_obtenido);
    end;
  end loop;
  -- CU-03 1b: se quita un adjunto mientras quede otro; el último, no.
  for v_caso in select * from (values ('quitar uno de dos adjuntos', v_doc2, 'ok'), ('quitar el ultimo adjunto', v_doc1, 'publicada_incompleta')) as t(caso, doc, esperado) loop
    declare v_obtenido text;
    begin
      begin
        execute 'set local role authenticated';
        delete from public.documentos_convocatoria where id = v_caso.doc;
        v_obtenido := case when found then 'ok' else 'no borro nada (RLS)' end;
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_obtenido = pg_exception_hint;
        if v_obtenido = '' then v_obtenido := sqlerrm; end if;
      end;
      v_res := v_res || format(E'\n%s %s -> %s', case when v_obtenido = v_caso.esperado then 'OK   ' else 'FALLA' end, v_caso.caso, v_obtenido);
    end;
  end loop;
  v_res := v_res || format(E'\nestado final: %s, requisitos %s, ubicacion %s',
    (select estado from public.convocatorias where id = v_conv),
    (select count(*) from public.requisitos_convocatoria where convocatoria_id = v_conv),
    (select ubicacion_cobertura from public.convocatorias where id = v_conv))
    || format(', adjuntos %s', (select count(*) from public.documentos_convocatoria where convocatoria_id = v_conv));
  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
