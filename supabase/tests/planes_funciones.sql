-- RN-41, RN-16, RF-36, RF-40, RF-120 · Funciones por plan: Gratis, Esencial y
-- Pro (docs/05 §9.38). Sesión 042.
--
--   npx supabase db query --linked -f supabase/tests/planes_funciones.sql
--
-- Una empresa en cada plan intenta cada función: la base decide (RNF-20). Al
-- final, la de Pro vence y baja a Gratis: ve y descarga lo suyo, pero no lo
-- avanza. Termina SIEMPRE con un error "RESULTADO …" que revierte todo; cada
-- línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_hoy date := privado.hoy_colombia();
  v_g uuid := '00000000-0000-0000-0000-0000000042a1';   -- Gratis
  v_e uuid := '00000000-0000-0000-0000-0000000042a2';   -- Esencial
  v_p uuid := '00000000-0000-0000-0000-0000000042a3';   -- Pro (después baja a Gratis)
  v_c uuid := '00000000-0000-0000-0000-0000000042c1';   -- consultor aprobado
  v_ad uuid := '00000000-0000-0000-0000-0000000042ad';
  v_conv uuid := '00000000-0000-0000-0000-0000000042f1';
  v_pr uuid[] := array['00000000-0000-0000-0000-0000000042b1', '00000000-0000-0000-0000-0000000042b2',
                       '00000000-0000-0000-0000-0000000042b3', '00000000-0000-0000-0000-0000000042b4',
                       '00000000-0000-0000-0000-0000000042b5', '00000000-0000-0000-0000-0000000042b6']::uuid[];
  v_esencial uuid; v_pro uuid; v_gratis uuid;
  v_u uuid;
  v_quien text;
  v_o text; v_esperado text;
  v_n int;
  v_post uuid; v_item uuid; v_doc uuid; v_enc_comp uuid; v_enc_curso uuid; v_enc_pend uuid;
  v_fila record;
begin
  alter table public.convocatorias alter column todos_los_paises set default true;
  select id into v_gratis from public.planes where es_gratuito;
  select id into v_esencial from public.planes where nombre = 'Empresa Esencial';
  select id into v_pro from public.planes where nombre = 'Empresa Pro';

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_g, 'f42g@prueba.co', '{"rol": "empresa", "nombre": "G", "nombre_empresa": "Empresa Gratis", "consentimiento_datos": "true"}'),
    (v_e, 'f42e@prueba.co', '{"rol": "empresa", "nombre": "E", "nombre_empresa": "Empresa Esencial", "consentimiento_datos": "true"}'),
    (v_p, 'f42p@prueba.co', '{"rol": "empresa", "nombre": "P", "nombre_empresa": "Empresa Pro", "consentimiento_datos": "true"}'),
    (v_c, 'f42c@prueba.co', '{"rol": "consultor", "nombre": "C", "consentimiento_datos": "true"}'),
    (v_ad, 'f42ad@prueba.co', '{"rol": "empresa", "nombre": "Admin"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;
  delete from public.suscripciones where usuario_id = v_ad;
  update public.consultor_perfiles set nombre_profesional = 'Consultora 042', descripcion = 'Formulo',
         foto_path = v_c::text || '/f.png', cv_path = v_c::text || '/cv.pdf', estado_perfil = 'aprobado' where id = v_c;
  update public.suscripciones set plan_id = v_esencial, modalidad = 'mensual', estado = 'activa',
         fecha_vencimiento = v_hoy + 30 where usuario_id = v_e;
  update public.suscripciones set plan_id = v_pro, modalidad = 'mensual', estado = 'activa',
         fecha_vencimiento = v_hoy + 30 where usuario_id = v_p;

  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion)
  values (v_conv, 'Convocatoria 042', 'Prueba', true, v_hoy + 20, 'publicada', 'https://prueba.gov.co/042');
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden)
  values (v_conv, 'Requisito uno', 'documento', true, 1), (v_conv, 'Requisito dos', 'documento', true, 2);
  insert into public.proyectos (id, usuario_id, nombre, problema) values
    (v_pr[1], v_g, 'Proyecto G', 'Problema'), (v_pr[2], v_e, 'Proyecto E', 'Problema'),
    (v_pr[3], v_p, 'Proyecto P1', 'Problema'), (v_pr[4], v_p, 'Proyecto P2', 'Problema'),
    (v_pr[5], v_p, 'Proyecto P3', 'Problema'), (v_pr[6], v_g, 'Proyecto G2', 'Problema');

  -- ---------------------------------------------------------------- datos del plan (RN-41)
  select string_agg(format('%s:%s%s%s%s%s', p.nombre,
           case when p.incluye_proyecto_ia then 'i' else '-' end, case when p.incluye_sugerencias then 's' else '-' end,
           case when p.incluye_documento_ia then 'd' else '-' end, case when p.incluye_postulaciones then 'p' else '-' end,
           case when p.incluye_consultores then 'c' else '-' end), ' ' order by p.precio_mensual) into v_o
    from public.planes p where p.rol = 'empresa' and p.activo;
  v_res := v_res || format(E'\n%s RN-41: las funciones son datos de cada plan -> %s',
    case when v_o = 'Gratis:----- Empresa Esencial:isdp- Empresa Pro:isdpc' then 'OK   ' else 'FALLA' end, v_o);
  select creditos_ia_mensuales into v_n from public.planes where id = v_gratis;
  v_res := v_res || format(E'\n%s RN-11: Gratis no trae créditos de IA -> %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- IA (las llama el servidor)
  foreach v_quien in array array['gratis', 'esencial', 'pro'] loop
    v_u := case v_quien when 'gratis' then v_g when 'esencial' then v_e else v_p end;
    v_esperado := case v_quien when 'gratis' then 'funcion_no_incluida' else 'ok' end;
    v_o := '';
    begin perform * from public.iniciar_estructuracion(v_u); v_o := v_o || 'ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || h; end; end;
    v_o := v_o || ' ';
    begin perform * from public.iniciar_transcripcion(v_u); v_o := v_o || 'ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || h; end; end;
    v_o := v_o || ' ';
    begin perform * from public.iniciar_edicion_apartado(v_u, case v_quien when 'gratis' then v_pr[1] when 'esencial' then v_pr[2] else v_pr[3] end); v_o := v_o || 'ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || h; end; end;
    v_o := v_o || ' ';
    begin perform * from public.iniciar_generacion(v_u, case v_quien when 'gratis' then v_pr[1] when 'esencial' then v_pr[2] else v_pr[3] end, v_conv); v_o := v_o || 'ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || h; end; end;
    v_res := v_res || format(E'\n%s RN-41: %s · crear proyecto con IA, dictar, editar apartado y generar documento -> %s',
      case when v_o = concat_ws(' ', v_esperado, v_esperado, v_esperado, v_esperado) then 'OK   ' else 'FALLA' end, v_quien, v_o);
  end loop;
  delete from public.reservas_estructuracion where usuario_id in (v_e, v_p);
  delete from public.documentos_generados where usuario_id in (v_e, v_p) and estado = 'generando';

  -- ---------------------------------------------------------------- con la sesión de cada empresa
  foreach v_quien in array array['gratis', 'esencial', 'pro'] loop
    v_u := case v_quien when 'gratis' then v_g when 'esencial' then v_e else v_p end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    execute 'set local role authenticated';
    select nombre into v_esperado from public.mi_plan_efectivo();
    v_o := v_esperado;
    begin perform * from public.sugerencias_proyecto(case v_quien when 'gratis' then v_pr[1] when 'esencial' then v_pr[2] else v_pr[3] end); v_o := v_o || ' ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ' ' || h; end; end;
    begin perform * from public.iniciar_postulacion(v_conv, case v_quien when 'gratis' then v_pr[1] when 'esencial' then v_pr[2] else v_pr[3] end); v_o := v_o || ' ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ' ' || h; end; end;
    begin perform public.solicitar_encargo(case v_quien when 'gratis' then v_pr[6] when 'esencial' then v_pr[2] else v_pr[4] end,
                                           v_c, 'Tarea 042', 'Descripción', 'buscar_convocatoria', null); v_o := v_o || ' ok';
    exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ' ' || h; end; end;
    execute 'reset role';
    v_esperado := case v_quien
      when 'gratis' then 'Gratis funcion_no_incluida funcion_no_incluida funcion_no_incluida'
      when 'esencial' then 'Empresa Esencial ok ok funcion_no_incluida'
      else 'Empresa Pro ok ok ok' end;
    v_res := v_res || format(E'\n%s RN-41: %s · plan efectivo, sugerencias, postular y solicitar consultor -> %s',
      case when v_o = v_esperado then 'OK   ' else 'FALLA' end, v_quien, v_o);
  end loop;

  -- La RLS también: Gratis no inserta una postulación directamente.
  perform set_config('request.jwt.claims', json_build_object('sub', v_g, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin insert into public.postulaciones (convocatoria_id, proyecto_id) values (v_conv, v_pr[1]); v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-20: la RLS rechaza la postulación de Gratis aunque se salte la función -> %s',
    case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);

  -- ---------------------------------------------------------------- el administrador cambia funciones (RF-36)
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.guardar_plan(v_esencial, 'Empresa Esencial', 'empresa', 89000, 890000, 350, true, p_incluye_consultores => true);
  execute 'reset role';
  v_n := case when privado.plan_incluye(v_e, 'consultores') then 1 else 0 end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.guardar_plan(v_esencial, 'Empresa Esencial', 'empresa', 89000, 890000, 350, true, p_incluye_consultores => false);
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-36: el panel abre y cierra una función de Esencial sin desplegar (abierta %s, cerrada %s)',
    case when v_n = 1 and not privado.plan_incluye(v_e, 'consultores') then 'OK   ' else 'FALLA' end,
    v_n = 1, not privado.plan_incluye(v_e, 'consultores'));

  -- ---------------------------------------------------------------- Pro con datos, que vence
  select id into v_post from public.postulaciones where usuario_id = v_p;
  select id into v_item from public.postulacion_checklist where postulacion_id = v_post order by orden limit 1;
  insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
  values (v_pr[3], v_p, v_c, 'Completado', 'directorio', 'pendiente', 'buscar_convocatoria') returning id into v_enc_comp;
  update public.encargos set estado = 'en_curso' where id = v_enc_comp;
  update public.encargos set estado = 'completado' where id = v_enc_comp;
  insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
  values (v_pr[5], v_p, v_c, 'En curso', 'directorio', 'pendiente', 'buscar_convocatoria') returning id into v_enc_curso;
  update public.encargos set estado = 'en_curso' where id = v_enc_curso;
  select id into v_enc_pend from public.encargos where empresa_id = v_p and proyecto_id = v_pr[4] and estado = 'pendiente';
  insert into public.documentos_generados (usuario_id, proyecto_id, convocatoria_id, estado, version, titulo, contenido)
  values (v_p, v_pr[5], v_conv, 'generado', 1, 'Documento 042', '## Uno' || chr(10) || 'texto') returning id into v_doc;
  perform public.compartir_documento(v_p, v_doc, v_c);
  v_res := v_res || format(E'\n%s RN-41: con Pro comparte su documento con el consultor del encargo en curso',
    case when (select compartido_con_consultor_id from public.documentos_generados where id = v_doc) = v_c then 'OK   ' else 'FALLA' end);
  perform public.revocar_documento(v_p, v_doc);

  -- Vence hace 10 días y el job no corrió: el plan efectivo ya es Gratis (RN-16).
  update public.suscripciones set fecha_inicio = v_hoy - 40, fecha_vencimiento = v_hoy - 10 where usuario_id = v_p;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select nombre into v_o from public.mi_plan_efectivo();
  select count(*) into v_n from public.postulaciones where id = v_post;
  v_o := v_o || format(' ve %s postulación', v_n);
  select count(*) into v_n from public.encargos where empresa_id = v_p;
  v_o := v_o || format(', %s encargos', v_n);
  update public.postulacion_checklist set completado = true where id = v_item;
  get diagnostics v_n = row_count;
  v_o := v_o || format(', marca %s', v_n);
  update public.postulaciones set estado = 'presentada' where id = v_post;
  get diagnostics v_n = row_count;
  v_o := v_o || format(', avanza %s', v_n);
  begin perform public.calificar_encargo(v_enc_comp, 5, 'Bien'); v_o := v_o || ', califica ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', califica ' || h; end; end;
  begin insert into public.calificaciones (encargo_id, consultor_id, empresa_id, estrellas) values (v_enc_comp, v_c, v_p, 5); v_o := v_o || ', inserta ok';
  exception when others then v_o := v_o || ', inserta ' || sqlstate; end;
  begin perform public.retirar_encargo(v_enc_pend); v_o := v_o || ', retira ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', retira ' || h; end; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-16, RN-41: Pro vencido en Gratis ve lo suyo, no lo avanza ni califica, y sí retira una solicitud -> %s',
    case when v_o = 'Gratis ve 1 postulación, 3 encargos, marca 0, avanza 0, califica funcion_no_incluida, inserta 42501, retira ok'
         then 'OK   ' else 'FALLA' end, v_o);

  v_o := '';
  begin perform public.compartir_documento(v_p, v_doc, v_c); v_o := 'comparte ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := 'comparte ' || h; end; end;
  begin perform * from public.preparar_ajuste(v_p, v_doc); v_o := v_o || ', ajusta ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', ajusta ' || h; end; end;
  begin perform * from public.iniciar_generacion(v_p, v_pr[3], v_conv); v_o := v_o || ', genera ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', genera ' || h; end; end;
  begin perform * from public.leer_documento(v_p, v_doc); v_o := v_o || ', lee ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', lee ' || h; end; end;
  begin perform public.marcar_exportado(v_p, v_doc); v_o := v_o || ', exporta ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ', exporta ' || h; end; end;
  v_res := v_res || format(E'\n%s RN-41: en Gratis no comparte, ni ajusta, ni genera; sí lee y descarga su documento -> %s',
    case when v_o = 'comparte funcion_no_incluida, ajusta funcion_no_incluida, genera funcion_no_incluida, lee ok, exporta ok'
         then 'OK   ' else 'FALLA' end, v_o);

  -- RN-28: el ajuste que pide el consultor cuenta el plan de la empresa dueña.
  update public.documentos_generados set compartido_con_consultor_id = v_c where id = v_doc;
  begin perform * from public.preparar_ajuste(v_c, v_doc); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-28, RN-41: el consultor no ajusta el documento de una empresa en Gratis -> %s',
    case when v_o = 'funcion_no_incluida' then 'OK   ' else 'FALLA' end, v_o);

  -- El job la baja a Gratis y todo sigue en su sitio (RN-16).
  perform * from privado.vencer_suscripciones();
  select s.estado, s.plan_id, s.fecha_vencimiento,
         (select count(*) from public.postulaciones where usuario_id = v_p) as post,
         (select count(*) from public.encargos where empresa_id = v_p) as enc,
         (select count(*) from public.documentos_generados where usuario_id = v_p) as docs,
         (select count(*) from public.proyectos where usuario_id = v_p) as proys
    into v_fila from public.suscripciones s where s.usuario_id = v_p;
  v_res := v_res || format(E'\n%s RN-16: el job la deja en Gratis sin borrar nada -> %s, %s postulación, %s encargos, %s documento, %s proyectos',
    case when v_fila.estado = 'gratis' and v_fila.plan_id = v_gratis and v_fila.fecha_vencimiento is null
              and v_fila.post = 1 and v_fila.enc = 3 and v_fila.docs = 1 and v_fila.proys = 3 then 'OK   ' else 'FALLA' end,
    v_fila.estado, v_fila.post, v_fila.enc, v_fila.docs, v_fila.proys);

  -- Y al renovar recupera las funciones (CU-29).
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.activar_suscripcion(v_p, v_pro, 'mensual', 189000, v_hoy);
  execute 'reset role';
  v_res := v_res || format(E'\n%s CU-29: al renovar Pro vuelven las funciones -> consultores %s',
    case when privado.plan_incluye(v_p, 'consultores') then 'OK   ' else 'FALLA' end, privado.plan_incluye(v_p, 'consultores'));

  -- El plan Gratis no se activa por pago, ni el panel lo vuelve de pago.
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  v_o := '';
  begin perform public.activar_suscripcion(v_g, v_gratis, 'mensual', 1, v_hoy); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  begin perform public.guardar_plan(v_gratis, 'Gratis', 'empresa', 1000, 0, 0, true); v_o := v_o || ' ok';
  exception when others then declare h text; begin get stacked diagnostics h = pg_exception_hint; v_o := v_o || ' ' || h; end; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-11: Gratis no se compra ni cobra -> %s',
    case when v_o = 'plan_invalido gratuito_fijo' then 'OK   ' else 'FALLA' end, v_o);

  -- Las funciones nuevas no se llaman sin sesión ni para otra cuenta.
  perform set_config('request.jwt.claims', json_build_object('sub', v_g, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform privado.plan_incluye(v_p, 'consultores'); v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-20: una sesión no pregunta por el plan de otra cuenta -> %s',
    case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
