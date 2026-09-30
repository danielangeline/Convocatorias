-- RF-28..33, RF-68..70, RF-89, RF-90, RN-09, RN-25, RN-26, RN-36 · Encargos de
-- punta a punta (docs/05 §9.23). Sesión 023, Sprint 4 paso 3.
--
--   npx supabase db query --linked -f supabase/tests/encargos.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`. Termina
-- SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice OK o
-- FALLA.
do $$
declare
  v_res text := '';
  v_c1 uuid := '00000000-0000-0000-0000-0000000024c1';  -- aprobado, externo
  v_c2 uuid := '00000000-0000-0000-0000-0000000024c2';  -- aprobado, equipo interno
  v_c3 uuid := '00000000-0000-0000-0000-0000000024c3';  -- en revisión
  v_e1 uuid := '00000000-0000-0000-0000-0000000024e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000024e2';
  v_ad uuid := '00000000-0000-0000-0000-0000000024ad';
  v_p1 uuid := '00000000-0000-0000-0000-0000000024b1';
  v_p2 uuid := '00000000-0000-0000-0000-0000000024b2';
  v_ca uuid := '00000000-0000-0000-0000-0000000024a1';  -- vigente
  v_cd uuid := '00000000-0000-0000-0000-0000000024a2';  -- vencida
  v_po uuid;
  v_en uuid;   -- directorio, de punta a punta
  v_eq uuid;   -- al equipo
  v_x uuid;
  v_n int;
  v_o text;
  v_row record;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_c1, 'ec1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}'),
    (v_c2, 'ec2@prueba.co', '{"rol": "consultor", "nombre": "Dos", "consentimiento_datos": "true"}'),
    (v_c3, 'ec3@prueba.co', '{"rol": "consultor", "nombre": "Tres", "consentimiento_datos": "true"}'),
    (v_e1, 'ee1@prueba.co', '{"rol": "empresa", "nombre": "Ana", "nombre_empresa": "Empresa Uno", "consentimiento_datos": "true"}'),
    (v_e2, 'ee2@prueba.co', '{"rol": "empresa", "nombre": "Beto", "nombre_empresa": "Empresa Dos", "consentimiento_datos": "true"}'),
    (v_ad, 'ead@prueba.co', '{"rol": "empresa", "nombre": "Admin", "consentimiento_datos": "true"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;

  update public.consultor_perfiles set nombre_profesional = 'Consultor', estado_perfil = 'aprobado'
  where id in (v_c1, v_c2);
  update public.consultor_perfiles set es_equipo_interno = true where id = v_c2;
  update public.consultor_perfiles set estado_perfil = 'en_revision' where id = v_c3;

  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (v_ca, 'A · vigente', 'Prueba', true, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (v_cd, 'D · vencida', 'Prueba', true, privado.hoy_colombia() - 1,  'publicada', 'https://prueba.gov.co/d');
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden) values
    (v_ca, 'RUT actualizado', 'documento', true, 0),
    (v_ca, 'Carta de intención', 'documento', false, 1);
  insert into public.proyectos (id, usuario_id, nombre, problema) values
    (v_p1, v_e1, 'Proyecto Uno', 'Problema uno'),
    (v_p2, v_e2, 'Proyecto Dos', 'Problema dos');
  insert into public.postulaciones (usuario_id, convocatoria_id, proyecto_id) values (v_e1, v_ca, v_p1)
  returning id into v_po;

  -- ================================================================ E1 solicita
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  v_en := public.solicitar_encargo(v_p1, v_c1, '  Estructurar la postulación  ', 'Detalle', 'convocatoria_especifica', v_ca);
  select estado, via, postulacion_id, titulo_tarea, consultor_id, convocatoria_id, aceptado_at into v_row from public.encargos where id = v_en;
  v_res := v_res || format(E'\n%s CU-22: nace pendiente, por el directorio, con la postulación del par vinculada -> %s %s %s "%s"',
    case when v_row.estado = 'pendiente' and v_row.via = 'directorio' and v_row.postulacion_id = v_po
              and v_row.titulo_tarea = 'Estructurar la postulación' then 'OK   ' else 'FALLA' end,
    v_row.estado, v_row.via, v_row.postulacion_id = v_po, v_row.titulo_tarea);

  begin perform public.solicitar_encargo(v_p1, v_c1, 'Otra', null, 'buscar_convocatoria', null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-36: otra abierta con el mismo consultor y proyecto -> %s',
    case when v_o = 'ya_solicitado' then 'OK   ' else 'FALLA' end, v_o);

  v_n := 0;
  begin perform public.solicitar_encargo(v_p1, v_c2, 'T', null, 'buscar_convocatoria', null);
  exception when others then get stacked diagnostics v_o = pg_exception_hint; if v_o = 'consultor_no_disponible' then v_n := v_n + 1; end if; end;
  begin perform public.solicitar_encargo(v_p1, v_c3, 'T', null, 'buscar_convocatoria', null);
  exception when others then get stacked diagnostics v_o = pg_exception_hint; if v_o = 'consultor_no_disponible' then v_n := v_n + 1; end if; end;
  v_res := v_res || format(E'\n%s CU-22: ni el equipo interno ni un perfil sin aprobar reciben solicitudes -> %s/2',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  begin perform public.solicitar_encargo(v_p1, v_c1, 'T', null, 'convocatoria_especifica', v_cd); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-22 1b: con una convocatoria vencida -> %s',
    case when v_o = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.solicitar_encargo(v_p1, v_c1, 'T', null, 'convocatoria_especifica', null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-28: convocatoria específica sin convocatoria -> %s',
    case when v_o = 'falta_convocatoria' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.solicitar_encargo(v_p2, v_c1, 'T', null, 'buscar_convocatoria', null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-30: sobre el proyecto de otra empresa -> %s',
    case when v_o = 'proyecto_no_existe' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.solicitar_encargo(v_p1, v_c1, '   ', null, 'buscar_convocatoria', null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-19: sin título -> %s',
    case when v_o = 'titulo_vacio' then 'OK   ' else 'FALLA' end, v_o);

  v_eq := public.solicitar_encargo(v_p1, null, 'Ayuda del equipo', null, 'buscar_convocatoria', v_ca);
  select estado, via, postulacion_id, titulo_tarea, consultor_id, convocatoria_id, aceptado_at into v_row from public.encargos where id = v_eq;
  v_res := v_res || format(E'\n%s CU-23: al equipo nace esperando, sin consultor, y buscar ignora la convocatoria -> %s %s %s',
    case when v_row.estado = 'esperando_asignacion' and v_row.consultor_id is null and v_row.convocatoria_id is null
         then 'OK   ' else 'FALLA' end, v_row.estado, v_row.consultor_id, v_row.convocatoria_id);
  begin perform public.solicitar_encargo(v_p1, null, 'Otra al equipo', null, 'buscar_convocatoria', null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-36: una sola al equipo esperando por proyecto -> %s',
    case when v_o = 'ya_solicitado_equipo' then 'OK   ' else 'FALLA' end, v_o);

  begin
    insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
    values (v_p1, v_e1, v_c1, 'Directo', 'directorio', 'pendiente', 'buscar_convocatoria');
    v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  v_res := v_res || format(E'\n%s §9.11: la empresa no inserta encargos directamente -> %s',
    case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);
  update public.encargos set estado = 'en_curso' where id = v_en;
  select estado into v_o from public.encargos where id = v_en;
  v_res := v_res || format(E'\n%s §9.11: ni cambia el estado con un update directo -> %s',
    case when v_o = 'pendiente' then 'OK   ' else 'FALLA' end, v_o);

  select correo_contraparte into v_o from public.datos_de_mis_encargos() where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RN-26: con la solicitud pendiente no ve el correo del consultor -> %s',
    case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'nulo'));

  begin perform public.responder_encargo(v_en, true); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-30: la empresa no responde por el consultor -> %s',
    case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  -- Otro consultor no responde la solicitud ajena.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.responder_encargo(v_en, true); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  select count(*) into v_n from public.proyectos where id = v_p1;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-30: otro consultor no la responde ni ve el proyecto -> %s, %s',
    case when v_o = 'no_existe' and v_n = 0 then 'OK   ' else 'FALLA' end, v_o, v_n);

  -- ================================================================ C1 con la solicitud pendiente
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.proyectos where id = v_p1 and problema = 'Problema uno';
  v_res := v_res || format(E'\n%s RN-25, RF-68: antes de aceptar ve el contenido del proyecto -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.requisitos_convocatoria where convocatoria_id = v_ca;
  v_res := v_res || format(E'\n%s RF-68: y los requisitos de la convocatoria -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.postulacion_checklist where postulacion_id = v_po;
  v_res := v_res || format(E'\n%s RN-25: y el checklist de la postulación vinculada -> %s ítems',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  update public.postulacion_checklist set completado = true where postulacion_id = v_po;
  execute 'reset role';
  select count(*) into v_n from public.postulacion_checklist where postulacion_id = v_po and completado;
  v_res := v_res || format(E'\n%s RN-25: el checklist es de solo lectura para el consultor -> %s marcados',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select * into v_row from public.datos_de_mis_encargos() where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RN-26: ve el nombre de la empresa, no su correo -> %s, %s',
    case when v_row.empresa_nombre = 'Empresa Uno' and v_row.correo_contraparte is null then 'OK   ' else 'FALLA' end,
    v_row.empresa_nombre, coalesce(v_row.correo_contraparte, 'nulo'));

  begin perform public.registrar_avance(v_en, 'Nota'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-32: sin aceptar no registra avances -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.completar_encargo(v_en); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-32: ni lo completa -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);

  perform public.responder_encargo(v_en, true);
  select estado, via, postulacion_id, titulo_tarea, consultor_id, convocatoria_id, aceptado_at into v_row from public.encargos where id = v_en;
  v_res := v_res || format(E'\n%s RF-30: acepta -> %s, aceptado %s',
    case when v_row.estado = 'en_curso' and v_row.aceptado_at is not null then 'OK   ' else 'FALLA' end,
    v_row.estado, v_row.aceptado_at is not null);
  select correo_contraparte into v_o from public.datos_de_mis_encargos() where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RF-70: al aceptar ve el correo de la empresa -> %s',
    case when v_o = 'ee1@prueba.co' then 'OK   ' else 'FALLA' end, coalesce(v_o, 'nulo'));

  begin perform public.registrar_avance(v_en, '   '); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-32: una nota vacía -> %s',
    case when v_o = 'nota_vacia' then 'OK   ' else 'FALLA' end, v_o);
  perform public.registrar_avance(v_en, 'Encontré dos convocatorias candidatas');
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select correo_contraparte into v_o from public.datos_de_mis_encargos() where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RF-70: y la empresa ve el del consultor -> %s',
    case when v_o = 'ec1@prueba.co' then 'OK   ' else 'FALLA' end, coalesce(v_o, 'nulo'));
  select count(*) into v_n from public.encargo_avances where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RF-32: la empresa lee el avance -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);
  begin perform public.retirar_encargo(v_en); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-89: en curso ya no se retira -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.calificar_encargo(v_en, 5, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-09: en curso no se califica -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.encargos where empresa_id = v_e1;
  select count(*) + v_n into v_n from public.datos_de_mis_encargos();
  select count(*) + v_n into v_n from public.encargo_avances where encargo_id = v_en;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-30: otra empresa no ve los encargos, sus datos ni sus avances -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ completar y calificar
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.completar_encargo(v_en);
  select count(*) into v_n from public.proyectos where id = v_p1;
  select * into v_row from public.datos_de_mis_encargos() where encargo_id = v_en;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-25: completado, ya no lee el proyecto pero su historial lo nombra -> %s, "%s"',
    case when v_n = 0 and v_row.proyecto_nombre = 'Proyecto Uno' then 'OK   ' else 'FALLA' end, v_n, v_row.proyecto_nombre);
  v_res := v_res || format(E'\n%s RN-26: completado, el correo sigue visible -> %s',
    case when v_row.correo_contraparte = 'ee1@prueba.co' then 'OK   ' else 'FALLA' end, coalesce(v_row.correo_contraparte, 'nulo'));
  select total_encargos_completados into v_n from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-33: el contador avanza al completar -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.calificar_encargo(v_en, 5, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-09: el consultor no se califica -> %s',
    case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.calificar_encargo(v_en, 6, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-24: seis estrellas -> %s',
    case when v_o = 'estrellas_invalidas' then 'OK   ' else 'FALLA' end, v_o);
  perform public.calificar_encargo(v_en, 4, '  Muy bien  ');
  begin perform public.calificar_encargo(v_en, 1, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RNF-17: la segunda calificación -> %s',
    case when v_o = 'ya_calificado' then 'OK   ' else 'FALLA' end, v_o);
  select correo_contraparte into v_o from public.datos_de_mis_encargos() where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RN-26: calificado, el correo sigue visible -> %s',
    case when v_o = 'ec1@prueba.co' then 'OK   ' else 'FALLA' end, coalesce(v_o, 'nulo'));
  execute 'reset role';
  select e.estado, cp.rating_promedio, cp.total_encargos_completados, c.comentario into v_row
  from public.encargos e join public.consultor_perfiles cp on cp.id = e.consultor_id
  join public.calificaciones c on c.encargo_id = e.id where e.id = v_en;
  v_res := v_res || format(E'\n%s RF-33: calificado, rating 4 y el contador no vuelve a sumar -> %s %s %s "%s"',
    case when v_row.estado = 'calificado' and v_row.rating_promedio = 4 and v_row.total_encargos_completados = 1
              and v_row.comentario = 'Muy bien' then 'OK   ' else 'FALLA' end,
    v_row.estado, v_row.rating_promedio, v_row.total_encargos_completados, v_row.comentario);

  -- ================================================================ retirar y rechazar
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_x := public.solicitar_encargo(v_p1, v_c1, 'Segunda tarea', null, 'buscar_convocatoria', null);
  perform public.retirar_encargo(v_x);
  select estado || ' / ' || motivo_cancelacion into v_o from public.encargos where id = v_x;
  v_res := v_res || format(E'\n%s RF-89, RN-36: calificado el anterior, pide otra al mismo consultor y la retira -> %s',
    case when v_o = 'cancelado / Retirada por la empresa' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.responder_encargo(v_x, true); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-89: retirada, el consultor ya no la acepta -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_x := public.solicitar_encargo(v_p1, v_c1, 'Tercera tarea', null, 'buscar_convocatoria', null);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.responder_encargo(v_x, false);
  select count(*) into v_n from public.proyectos where id = v_p1;
  select * into v_row from public.datos_de_mis_encargos() where encargo_id = v_x;
  execute 'reset role';
  v_res := v_res || format(E'\n%s CU-22 4a: rechazada, sin correo y sin el proyecto -> %s, %s',
    case when v_row.correo_contraparte is null and v_n = 0 then 'OK   ' else 'FALLA' end,
    coalesce(v_row.correo_contraparte, 'nulo'), v_n);

  -- ================================================================ equipo de la plataforma
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.solicitudes_equipo('esperando_asignacion');
  begin perform public.atender_solicitud_equipo(v_eq, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-90: la empresa no lee la bandeja ni atiende -> %s filas, %s',
    case when v_n = 0 and v_o = 'no_autorizado' then 'OK   ' else 'FALLA' end, v_n, v_o);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.atender_solicitud_equipo(v_eq, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-28: el administrador sin aal2 no atiende -> %s',
    case when v_o = 'no_autorizado' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select * into v_row from public.solicitudes_equipo('esperando_asignacion') where id = v_eq;
  v_res := v_res || format(E'\n%s RF-90: la bandeja trae la empresa y su correo -> %s, %s',
    case when v_row.empresa_nombre = 'Empresa Uno' and v_row.empresa_correo = 'ee1@prueba.co' then 'OK   ' else 'FALLA' end,
    v_row.empresa_nombre, v_row.empresa_correo);
  perform public.atender_solicitud_equipo(v_eq, '  Le escribí el martes  ');
  begin perform public.atender_solicitud_equipo(v_eq, null); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-26 4a: ya atendida -> %s',
    case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);
  select * into v_row from public.solicitudes_equipo('atendido') where id = v_eq;
  v_res := v_res || format(E'\n%s RF-90: atendida, con nota interna y quién -> "%s", %s',
    case when v_row.nota_interna = 'Le escribí el martes' and v_row.atendido_por_nombre = 'Admin' then 'OK   ' else 'FALLA' end,
    v_row.nota_interna, v_row.atendido_por_nombre);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select estado into v_o from public.encargos where id = v_eq;
  v_res := v_res || format(E'\n%s CU-23: la empresa la ve atendida -> %s',
    case when v_o = 'atendido' then 'OK   ' else 'FALLA' end, v_o);
  begin execute 'select nota_interna from public.encargos limit 1'; v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  v_res := v_res || format(E'\n%s RF-90: la empresa no lee la nota interna -> %s',
    case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);
  v_x := public.solicitar_encargo(v_p1, null, 'Otra al equipo', null, 'buscar_convocatoria', null);
  perform public.retirar_encargo(v_x);
  select estado into v_o from public.encargos where id = v_x;
  v_res := v_res || format(E'\n%s RF-89: atendida la anterior, pide otra al equipo y la retira -> %s',
    case when v_o = 'cancelado' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  -- ================================================================ el grafo también ata al servidor
  begin update public.encargos set estado = 'en_curso' where id = v_en; v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-29: ni postgres revive un encargo calificado -> %s',
    case when v_o = 'transicion_invalida' then 'OK   ' else 'FALLA' end, v_o);
  begin update public.encargos set consultor_id = v_c2 where id = v_en; v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-29: ni cambia el consultor -> %s',
    case when v_o = 'encargo_fijo' then 'OK   ' else 'FALLA' end, v_o);
  begin
    insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
    values (v_p1, v_e1, v_c1, 'X', 'directorio', 'en_curso', 'buscar_convocatoria');
    v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-29: ni lo crea ya en curso -> %s',
    case when v_o = 'transicion_invalida' then 'OK   ' else 'FALLA' end, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
