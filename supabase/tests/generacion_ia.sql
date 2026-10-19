-- CU-33, CU-34 · Generación, ajustes y exportación con IA (docs/05 §9.26).
-- Sesión 026, Sprint 5. RF-48, RF-50, RF-52, RF-61, RF-72, RF-77, RN-17, RN-18,
-- RN-27, RN-28, RNF-20; RF-71, RF-76 y RF-79 (migración 20261019200000).
--
--   npx supabase db query --linked -f supabase/tests/generacion_ia.sql
--
-- Prepara datos como postgres (que hace de service_role: las funciones son
-- solo del servidor) y comprueba con `authenticated` lo que el cliente no
-- puede. Termina SIEMPRE con un error "RESULTADO …" que revierte todo.
do $$
declare
  v_res text := '';
  v_e1 uuid := '00000000-0000-0000-0000-0000000026e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000026e2';
  v_c1 uuid := '00000000-0000-0000-0000-0000000026c1';
  v_p1 uuid := '00000000-0000-0000-0000-0000000026b1';
  v_p2 uuid := '00000000-0000-0000-0000-0000000026b2';
  v_va uuid := '00000000-0000-0000-0000-0000000026a1';  -- vigente
  v_vb uuid := '00000000-0000-0000-0000-0000000026a2';  -- vigente
  v_vd uuid := '00000000-0000-0000-0000-0000000026a4';  -- vencida
  v_sus uuid;
  v_d1 uuid; v_d2 uuid; v_d3 uuid; v_d4 uuid; v_dv2 uuid;
  v_enc uuid;
  v_row record;
  v_n int; v_m int;
  v_o text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'ge1@prueba.co', '{"rol": "empresa", "nombre": "Ana", "nombre_empresa": "Empresa Uno", "consentimiento_datos": "true"}'),
    (v_e2, 'ge2@prueba.co', '{"rol": "empresa", "nombre": "Beto", "nombre_empresa": "Empresa Dos", "consentimiento_datos": "true"}'),
    (v_c1, 'gc1@prueba.co', '{"rol": "consultor", "nombre": "Cata", "consentimiento_datos": "true"}');
  update public.consultor_perfiles set nombre_profesional = 'Consultora', estado_perfil = 'aprobado' where id = v_c1;
  select id into v_sus from public.suscripciones where usuario_id = v_e1;

  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (v_va, 'A · vigente', 'Prueba', true, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (v_vb, 'B · vigente', 'Prueba', true, privado.hoy_colombia() + 30, 'publicada', 'https://prueba.gov.co/b'),
    (v_vd, 'D · vencida', 'Prueba', true, privado.hoy_colombia() - 1, 'publicada', 'https://prueba.gov.co/d');
  insert into public.proyectos (id, usuario_id, nombre, problema) values
    (v_p1, v_e1, 'Proyecto Uno', 'Problema uno'),
    (v_p2, v_e2, 'Proyecto Dos', 'Problema dos');

  -- ================================================================ solo el servidor
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_n := 0;
  begin perform * from public.iniciar_generacion(v_e1, v_p1, v_va); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin perform public.marcar_exportado(v_e1, v_va); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin perform * from public.preparar_ajuste(v_e1, v_va); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin insert into public.documentos_generados (usuario_id, proyecto_id, convocatoria_id) values (v_e1, v_p1, v_va);
  exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s §9.26: el cliente no inicia, ni prepara, ni exporta, ni inserta -> %s/4',
    case when v_n = 4 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ precondiciones (CU-33)
  begin perform * from public.iniciar_generacion(v_c1, v_p1, v_va); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-33: el consultor no genera -> %s', case when v_o = 'no_es_empresa' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.iniciar_generacion(v_e1, v_p2, v_va); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-30: proyecto ajeno -> %s', case when v_o = 'proyecto_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.iniciar_generacion(v_e1, v_p1, v_vd); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-78: convocatoria vencida -> %s', case when v_o = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ reservas (RN-17)
  select documento_id into v_d1 from public.iniciar_generacion(v_e1, v_p1, v_va);
  select documento_id into v_d2 from public.iniciar_generacion(v_e1, v_p1, v_vb);
  select documento_id into v_d3 from public.iniciar_generacion(v_e1, v_p1, v_va);
  begin perform * from public.iniciar_generacion(v_e1, v_p1, v_vb); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-50: con 3 créditos y 3 reservas, la cuarta se rechaza -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);
  select version into v_n from public.documentos_generados where id = v_d3;
  v_res := v_res || format(E'\n%s RF-61: dos reservas del mismo par llevan versiones distintas -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  perform public.fallar_generacion(v_d2, 'Tiempo agotado', 900, 0, 0.0007, 'gpt-prueba', 120000);
  select count(*) into v_n from public.documentos_generados where id = v_d2;
  select creditos_usados_periodo into v_m from public.suscripciones where id = v_sus;
  select * into v_row from public.consumos_ia where empresa_id = v_e1 and not exito order by fecha desc limit 1;
  v_res := v_res || format(E'\n%s RN-17: la fallida libera la reserva, no cobra y queda registrada -> doc %s, usados %s, %s/%s/%s',
    case when v_n = 0 and v_m = 0 and v_row.tokens_entrada = 900 and not v_row.credito_descontado and v_row.mensaje_error = 'Tiempo agotado'
      then 'OK   ' else 'FALLA' end, v_n, v_m, v_row.tokens_entrada, v_row.credito_descontado, v_row.mensaje_error);

  perform public.completar_generacion(v_d1, 'Título', E'## Resumen\n\nTexto [COMPLETAR: monto]', array['monto'], 1000, 500, 0.003, 'gpt-prueba', 30000);
  select creditos_usados_periodo into v_m from public.suscripciones where id = v_sus;
  select * into v_row from public.documentos_generados where id = v_d1;
  v_res := v_res || format(E'\n%s RF-48: la exitosa guarda el documento y descuenta 1 -> %s, usados %s, pendientes %s',
    case when v_row.estado = 'generado' and v_m = 1 and v_row.pendientes = array['monto'] then 'OK   ' else 'FALLA' end,
    v_row.estado, v_m, v_row.pendientes);
  select * into v_row from public.consumos_ia where documento_id = v_d1;
  v_res := v_res || format(E'\n%s RF-52: consumo con tokens, costo, modelo, plantilla y crédito -> %s/%s/%s/%s/%s',
    case when v_row.exito and v_row.credito_descontado and v_row.tokens_salida = 500 and v_row.costo_estimado = 0.003
      and v_row.modelo = 'gpt-prueba' and v_row.plantilla_id is not null then 'OK   ' else 'FALLA' end,
    v_row.exito, v_row.credito_descontado, v_row.tokens_salida, v_row.costo_estimado, v_row.modelo);
  begin perform public.completar_generacion(v_d1, 'Otra', 'x', '{}', 1, 1, 0, 'm', 1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-17: completar dos veces no cobra dos veces -> %s',
    case when v_o = 'generacion_no_encontrada' then 'OK   ' else 'FALLA' end, v_o);

  perform public.completar_generacion(v_d3, 'Título v2', E'## Resumen\n\nTexto', '{}', 1, 1, 0, 'gpt-prueba', 1);
  select documento_padre_id, version into v_row from public.documentos_generados where id = v_d3;
  v_res := v_res || format(E'\n%s RF-61: la regeneración es la versión 2 y conserva la 1 como padre -> v%s, padre %s',
    case when v_row.version = 2 and v_row.documento_padre_id = v_d1 then 'OK   ' else 'FALLA' end, v_row.version, v_row.documento_padre_id = v_d1);

  -- Reserva huérfana: a los 5 minutos se libera sola, sin cobrar.
  select documento_id into v_d4 from public.iniciar_generacion(v_e1, v_p1, v_vb);
  update public.documentos_generados set creado_at = now() - interval '10 minutes' where id = v_d4;
  select count(*) into v_m from public.consumos_ia where empresa_id = v_e1 and not exito;
  select documento_id into v_dv2 from public.iniciar_generacion(v_e1, v_p1, v_vb);
  select count(*) into v_n from public.documentos_generados where id = v_d4;
  v_res := v_res || format(E'\n%s RN-17: la reserva huérfana se libera y queda como fallida -> doc %s, fallidas +%s',
    case when v_n = 0 and (select count(*) from public.consumos_ia where empresa_id = v_e1 and not exito) = v_m + 1
      then 'OK   ' else 'FALLA' end, v_n, (select count(*) from public.consumos_ia where empresa_id = v_e1 and not exito) - v_m);
  perform public.fallar_generacion(v_dv2, 'x', null, null, null, null, null);

  -- ================================================================ RLS de lectura
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.documentos_generados where id = v_d1;
  select count(*) into v_m from public.consumos_ia where empresa_id = v_e1;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-22: otra empresa no ve ni el documento ni sus consumos -> %s, %s',
    case when v_n = 0 and v_m = 0 then 'OK   ' else 'FALLA' end, v_n, v_m);

  -- ================================================================ ajustes (RF-59, RN-17)
  select * into v_row from public.preparar_ajuste(v_e1, v_d1);
  v_res := v_res || format(E'\n%s RF-59: el primer ajuste no cobra -> cobra %s, dueño %s',
    case when not v_row.cobra and v_row.es_dueno then 'OK   ' else 'FALLA' end, v_row.cobra, v_row.es_dueno);
  perform public.completar_ajuste(v_e1, v_d1, 0, E'## Resumen\n\nAjustado', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  perform public.completar_ajuste(v_e1, v_d1, 1, E'## Resumen\n\nAjustado 2', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  begin perform public.completar_ajuste(v_e1, v_d1, 1, 'x', '{}', 1, 1, 0, 'm', 1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-34: un ajuste sobre un contador viejo se rechaza -> %s',
    case when v_o = 'ajuste_concurrente' then 'OK   ' else 'FALLA' end, v_o);
  perform public.completar_ajuste(v_e1, v_d1, 2, E'## Resumen\n\nAjustado 3', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  select creditos_usados_periodo into v_m from public.suscripciones where id = v_sus;
  select * into v_row from public.documentos_generados where id = v_d1;
  v_res := v_res || format(E'\n%s RN-17: tres ajustes gratis -> ajustes %s, usados %s, estado %s, editó %s',
    case when v_row.ajustes_usados = 3 and v_m = 2 and v_row.estado = 'editado' and v_row.ultima_edicion_por = v_e1
      then 'OK   ' else 'FALLA' end, v_row.ajustes_usados, v_m, v_row.estado, v_row.ultima_edicion_por = v_e1);
  select * into v_row from public.preparar_ajuste(v_e1, v_d1);
  v_res := v_res || format(E'\n%s RN-17: el cuarto cobra -> %s', case when v_row.cobra then 'OK   ' else 'FALLA' end, v_row.cobra);
  perform public.completar_ajuste(v_e1, v_d1, 3, E'## Resumen\n\nAjustado 4', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  select creditos_usados_periodo into v_m from public.suscripciones where id = v_sus;
  v_res := v_res || format(E'\n%s RN-17: el cuarto descuenta un crédito -> usados %s', case when v_m = 3 then 'OK   ' else 'FALLA' end, v_m);
  begin perform * from public.preparar_ajuste(v_e1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-50: sin cupo, el quinto se rechaza antes de llamar a la IA -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);

  -- RN-18: con un paquete, se gasta el paquete y los usados no pasan del plan.
  update public.suscripciones set creditos_extra = 2 where id = v_sus;
  perform public.completar_ajuste(v_e1, v_d1, 4, E'## Resumen\n\nAjustado 5', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  select creditos_usados_periodo, creditos_extra into v_row from public.suscripciones where id = v_sus;
  v_res := v_res || format(E'\n%s RN-18: agotado el plan, se descuenta del paquete -> usados %s, extra %s',
    case when v_row.creditos_usados_periodo = 3 and v_row.creditos_extra = 1 then 'OK   ' else 'FALLA' end,
    v_row.creditos_usados_periodo, v_row.creditos_extra);

  -- ================================================================ consultor (RN-27, RN-28, RF-77)
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-22: el consultor sin autorización no ajusta -> %s',
    case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.compartir_documento(v_e1, v_d1, v_c1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-71: no se comparte con un consultor sin encargo en curso -> %s',
    case when v_o = 'sin_encargo_en_curso' then 'OK   ' else 'FALLA' end, v_o);
  update public.documentos_generados set compartido_con_consultor_id = v_c1 where id = v_d1;
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-27: autorizado pero sin encargo en curso, tampoco -> %s',
    case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  update public.documentos_generados set compartido_con_consultor_id = null where id = v_d1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_enc := public.solicitar_encargo(v_p1, v_c1, 'Revisar documento', null, 'buscar_convocatoria', null);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.responder_encargo(v_enc, true);
  execute 'reset role';
  begin perform public.compartir_documento(v_e2, v_d1, v_c1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-71: otra empresa no comparte el documento -> %s',
    case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-22: el encargo en curso no da acceso sin autorización -> %s',
    case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  perform public.compartir_documento(v_e1, v_d1, v_c1);
  perform public.revocar_documento(v_e1, v_d1);
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-71: revocado por la empresa, pierde el acceso -> %s',
    case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  perform public.compartir_documento(v_e1, v_d1, v_c1);

  -- RF-79 · Lecturas: la del consultor queda; la de la dueña no se registra.
  perform public.registrar_lectura_documento(v_c1, v_d1);
  perform public.registrar_lectura_documento(v_c1, v_d1);
  perform public.registrar_lectura_documento(v_e1, v_d1);
  perform public.registrar_lectura_documento(v_c1, v_d3);
  select count(*) into v_n from public.documento_lecturas where documento_id in (v_d1, v_d3);
  v_res := v_res || format(E'\n%s RF-79: dos lecturas del consultor, ninguna de la dueña ni de otro documento -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.documento_lecturas where documento_id = v_d1;
  begin insert into public.documento_lecturas (documento_id, consultor_id) values (v_d1, v_c1); v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_m from public.documento_lecturas where documento_id = v_d1;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-79: la dueña las lee, el consultor no, y nadie las escribe desde el cliente -> %s, %s, %s',
    case when v_n = 2 and v_m = 0 and v_o = '42501' then 'OK   ' else 'FALLA' end, v_n, v_m, v_o);

  select * into v_row from public.preparar_ajuste(v_c1, v_d1);
  v_res := v_res || format(E'\n%s RN-27: autorizado y con encargo en curso, prepara -> cobra %s, dueño %s',
    case when v_row.cobra and not v_row.es_dueno then 'OK   ' else 'FALLA' end, v_row.cobra, v_row.es_dueno);
  perform public.completar_ajuste(v_c1, v_d1, 5, E'## Resumen\n\nDel consultor', '{}', 10, 10, 0.0001, 'gpt-prueba', 1);
  select creditos_extra into v_m from public.suscripciones where id = v_sus;
  select * into v_row from public.consumos_ia where documento_id = v_d1 and usuario_id = v_c1;
  v_res := v_res || format(E'\n%s RN-28: el ajuste del consultor se cobra a la empresa -> extra %s, origen consultor, cupo %s',
    case when v_m = 0 and v_row.empresa_id = v_e1 and v_row.credito_descontado then 'OK   ' else 'FALLA' end,
    v_m, v_row.empresa_id = v_e1);
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-77: sin cupo de la empresa, el consultor no ajusta -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);
  select count(*) into v_n from public.consumos_ia where usuario_id = v_c1 and empresa_id = v_c1;
  v_res := v_res || format(E'\n%s RN-28: nada se carga al consultor -> %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  begin perform public.marcar_exportado(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-72: el consultor no exporta -> %s', case when v_o = 'documento_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  perform public.marcar_exportado(v_e1, v_d1);
  select estado into v_o from public.documentos_generados where id = v_d1;
  v_res := v_res || format(E'\n%s RF-60: la dueña exporta -> %s', case when v_o = 'exportado' then 'OK   ' else 'FALLA' end, v_o);

  -- RF-76: al cancelarse el encargo, el consultor pierde el documento solo.
  update public.encargos set estado = 'cancelado', motivo_cancelacion = 'Prueba' where id = v_enc;
  begin perform * from public.preparar_ajuste(v_c1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  select compartido_con_consultor_id into v_row from public.documentos_generados where id = v_d1;
  v_res := v_res || format(E'\n%s RF-76: encargo cancelado, autorización limpia y sin acceso -> %s, %s',
    case when v_o = 'documento_no_existe' and v_row.compartido_con_consultor_id is null then 'OK   ' else 'FALLA' end,
    v_o, v_row.compartido_con_consultor_id);
  perform public.registrar_lectura_documento(v_c1, v_d1);
  select count(*) into v_n from public.documento_lecturas where documento_id = v_d1;
  v_res := v_res || format(E'\n%s RF-79: tras revocar, las lecturas se conservan y no se suman más -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ sin suscripción (RNF-20)
  update public.suscripciones set creditos_extra = 5, fecha_inicio = privado.hoy_colombia() - 30,
    fecha_vencimiento = privado.hoy_colombia() - 10 where id = v_sus;
  begin perform * from public.iniciar_generacion(v_e1, v_p1, v_va); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-40: vencida, no genera aunque tenga créditos -> %s',
    case when v_o = 'sin_suscripcion' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.preparar_ajuste(v_e1, v_d1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-40: ni ajusta -> %s', case when v_o = 'sin_suscripcion' then 'OK   ' else 'FALLA' end, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
