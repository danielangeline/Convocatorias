-- RF-91, RF-92, RF-93, RN-25, RN-33 · Búsqueda y propuestas de convocatorias en
-- un encargo "buscar convocatoria" (docs/05 §9.25). Sesión 025, Sprint 5.
--
--   npx supabase db query --linked -f supabase/tests/propuestas_encargo.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`. Termina
-- SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice OK o
-- FALLA.
do $$
declare
  v_res text := '';
  v_c1 uuid := '00000000-0000-0000-0000-0000000025c1';
  v_c2 uuid := '00000000-0000-0000-0000-0000000025c2';
  v_e1 uuid := '00000000-0000-0000-0000-0000000025e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000025e2';
  v_p1 uuid := '00000000-0000-0000-0000-0000000025b1';
  v_p2 uuid := '00000000-0000-0000-0000-0000000025b2';
  v_p3 uuid := '00000000-0000-0000-0000-0000000025b3';
  v_va uuid := '00000000-0000-0000-0000-0000000025a1';  -- vigente, coincide en sector
  v_vb uuid := '00000000-0000-0000-0000-0000000025a2';  -- vigente
  v_vc uuid := '00000000-0000-0000-0000-0000000025a3';  -- vigente
  v_vd uuid := '00000000-0000-0000-0000-0000000025a4';  -- vencida
  v_vx uuid := '00000000-0000-0000-0000-0000000025a5';  -- borrador
  v_cat uuid := '00000000-0000-0000-0000-0000000025f1';
  v_mias uuid[];
  v_b1 uuid;  -- e1 → c1, buscar, de punta a punta
  v_b2 uuid;  -- e1 → c2, buscar, la convocatoria se cierra antes de elegir
  v_pa uuid; v_pb uuid; v_pc uuid; v_px uuid;
  v_po uuid;
  v_n int;
  v_o text;
  v_row record;
begin
  v_mias := array[v_va, v_vb, v_vc, v_vd, v_vx];
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_c1, 'pc1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}'),
    (v_c2, 'pc2@prueba.co', '{"rol": "consultor", "nombre": "Dos", "consentimiento_datos": "true"}'),
    (v_e1, 'pe1@prueba.co', '{"rol": "empresa", "nombre": "Ana", "nombre_empresa": "Empresa Uno", "consentimiento_datos": "true"}'),
    (v_e2, 'pe2@prueba.co', '{"rol": "empresa", "nombre": "Beto", "nombre_empresa": "Empresa Dos", "consentimiento_datos": "true"}');
  update public.consultor_perfiles set nombre_profesional = 'Consultor', estado_perfil = 'aprobado' where id in (v_c1, v_c2);

  insert into public.categorias (id, tipo, nombre, activa) values (v_cat, 'sector', 'Sector propuestas 025', true);
  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (v_va, 'A · vigente', 'Prueba', false, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (v_vb, 'B · vigente', 'Prueba', false, privado.hoy_colombia() + 30, 'publicada', 'https://prueba.gov.co/b'),
    (v_vc, 'C · vigente', 'Prueba', false, privado.hoy_colombia() + 40, 'publicada', 'https://prueba.gov.co/c'),
    (v_vd, 'D · vencida', 'Prueba', true, privado.hoy_colombia() - 1, 'publicada', 'https://prueba.gov.co/d'),
    (v_vx, 'X · borrador', 'Prueba', true, privado.hoy_colombia() + 20, 'borrador', null);
  insert into public.convocatoria_categoria (convocatoria_id, categoria_id) values (v_va, v_cat);
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden) values
    (v_va, 'RUT actualizado', 'documento', true, 0),
    (v_va, 'Carta de intención', 'documento', false, 1);
  insert into public.proyectos (id, usuario_id, nombre, problema) values
    (v_p1, v_e1, 'Proyecto Uno', 'Problema uno'),
    (v_p2, v_e2, 'Proyecto Dos', 'Problema dos'),
    (v_p3, v_e1, 'Proyecto Tres', 'Problema tres');
  insert into public.proyecto_categoria (proyecto_id, categoria_id) values (v_p1, v_cat);

  -- ================================================================ RN-33 antes de aceptar
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_b1 := public.solicitar_encargo(v_p1, v_c1, 'Buscar convocatoria', null, 'buscar_convocatoria', null);
  v_b2 := public.solicitar_encargo(v_p1, v_c2, 'Buscar otra', null, 'buscar_convocatoria', null);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  v_res := v_res || format(E'\n%s RN-33: con la solicitud pendiente el consultor no ve convocatorias -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  begin perform public.proponer_convocatoria(v_b1, v_va, 'Sirve'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-92: pendiente no admite propuestas -> %s',
    case when v_o = 'encargo_no_admite_propuestas' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.sugerencias_encargo(v_b1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-91: pendiente no da sugerencias -> %s',
    case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ RF-91 al aceptar
  perform public.responder_encargo(v_b1, true);
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  v_res := v_res || format(E'\n%s RF-91: en curso ve las 3 vigentes, ni la vencida ni el borrador -> %s',
    case when v_n = 3 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.requisitos_convocatoria where convocatoria_id = v_va;
  v_res := v_res || format(E'\n%s RF-91: y sus requisitos, por la convocatoria -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.convocatoria_categoria where convocatoria_id = v_va;
  v_res := v_res || format(E'\n%s RF-91: y sus categorías -> %s', case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);
  select * into v_row from public.sugerencias_encargo(v_b1) where convocatoria_id = v_va;
  v_res := v_res || format(E'\n%s RF-91, RN-05: sugerencias del proyecto, A coincide en sector -> %s %s %%',
    case when v_row.sector and v_row.porcentaje = 20 then 'OK   ' else 'FALLA' end, v_row.sector, v_row.porcentaje);
  select count(*) into v_n from public.sugerencias_encargo(v_b1) where convocatoria_id in (v_vd, v_vx);
  v_res := v_res || format(E'\n%s RF-91: las sugerencias solo traen vigentes -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ RF-92 proponer
  v_pa := public.proponer_convocatoria(v_b1, v_va, '  Coincide en sector  ');
  v_pb := public.proponer_convocatoria(v_b1, v_vb, 'Monto alto');
  v_pc := public.proponer_convocatoria(v_b1, v_vc, 'Cierra tarde');
  select nota, estado into v_row from public.encargo_propuestas where id = v_pa;
  v_res := v_res || format(E'\n%s RF-92: propone con la nota limpia -> "%s" %s',
    case when v_row.nota = 'Coincide en sector' and v_row.estado = 'propuesta' then 'OK   ' else 'FALLA' end, v_row.nota, v_row.estado);
  begin perform public.proponer_convocatoria(v_b1, v_va, 'Otra vez'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-92: la misma convocatoria dos veces -> %s',
    case when v_o = 'ya_propuesta' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.proponer_convocatoria(v_b1, v_vd, 'Vencida'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-92: una vencida -> %s', case when v_o = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.proponer_convocatoria(v_b1, v_vx, 'Borrador'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-92: un borrador -> %s', case when v_o = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_o);
  v_n := 0;
  begin perform public.proponer_convocatoria(v_b1, v_va, '   ');
  exception when others then get stacked diagnostics v_o = pg_exception_hint; if v_o = 'nota_invalida' then v_n := v_n + 1; end if; end;
  begin perform public.proponer_convocatoria(v_b1, v_va, repeat('x', 1001));
  exception when others then get stacked diagnostics v_o = pg_exception_hint; if v_o = 'nota_invalida' then v_n := v_n + 1; end if; end;
  v_res := v_res || format(E'\n%s RF-92: nota vacía o de más de 1.000 -> %s/2', case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  begin insert into public.encargo_propuestas (encargo_id, convocatoria_id, nota) values (v_b1, v_vd, 'Directa'); v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  v_res := v_res || format(E'\n%s §9.25: sin escritura directa en la tabla -> %s', case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);

  -- RF-92 · retirar
  perform public.retirar_propuesta(v_pb);
  select estado into v_o from public.encargo_propuestas where id = v_pb;
  v_res := v_res || format(E'\n%s RF-92: retira una propuesta -> %s', case when v_o = 'retirada' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.retirar_propuesta(v_pb); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-92: retirarla otra vez -> %s', case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.elegir_propuesta(v_pa); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93: el consultor no elige -> %s', case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  -- ================================================================ aislamiento
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  begin perform public.proponer_convocatoria(v_b1, v_va, 'Ajeno'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-33: otro consultor con su solicitud pendiente no ve el catálogo ni propone en el ajeno -> %s, %s',
    case when v_n = 0 and v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_n, v_o);
  begin perform public.retirar_propuesta(v_pa); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  select count(*) into v_n from public.encargo_propuestas where encargo_id = v_b1;
  v_res := v_res || format(E'\n%s RF-92: ni retira ni lee las propuestas ajenas -> %s, %s',
    case when v_o = 'no_existe' and v_n = 0 then 'OK   ' else 'FALLA' end, v_o, v_n);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.encargo_propuestas where encargo_id = v_b1;
  begin perform * from public.propuestas_de_encargo(v_b1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-30: otra empresa no lee las propuestas -> %s, %s',
    case when v_n = 0 and v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_n, v_o);
  begin perform public.elegir_propuesta(v_pa); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93: ni elige -> %s', case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.sugerencias_proyecto(v_p1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-30: ni pide las sugerencias de un proyecto ajeno -> %s',
    case when v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  -- ================================================================ RF-93 elegir
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.propuestas_de_encargo(v_b1);
  select porcentaje, vigente into v_row from public.propuestas_de_encargo(v_b1) where convocatoria_id = v_va;
  v_res := v_res || format(E'\n%s RF-92: la empresa ve las 3, A vigente y 20 %% compatible -> %s, %s, %s',
    case when v_n = 3 and v_row.porcentaje = 20 and v_row.vigente then 'OK   ' else 'FALLA' end, v_n, v_row.porcentaje, v_row.vigente);
  select count(*) into v_n from public.sugerencias_proyecto(v_p1);
  v_res := v_res || format(E'\n%s RF-15: sus sugerencias siguen calculándose -> %s', case when v_n >= 3 then 'OK   ' else 'FALLA' end, v_n);
  begin perform public.elegir_propuesta(v_pb); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93: no elige una retirada -> %s', case when v_o = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_o);

  perform public.elegir_propuesta(v_pa);
  select estado, convocatoria_id, tipo_ayuda into v_row from public.encargos where id = v_b1;
  v_res := v_res || format(E'\n%s RF-93: el encargo sigue en curso, con A fijada y el tipo de ayuda intacto -> %s %s %s',
    case when v_row.estado = 'en_curso' and v_row.convocatoria_id = v_va and v_row.tipo_ayuda = 'buscar_convocatoria' then 'OK   ' else 'FALLA' end,
    v_row.estado, v_row.convocatoria_id = v_va, v_row.tipo_ayuda);
  select string_agg(estado, ',' order by estado) into v_o from public.encargo_propuestas where encargo_id = v_b1;
  v_res := v_res || format(E'\n%s RF-93: una elegida, una retirada y una descartada -> %s',
    case when v_o = 'descartada,elegida,retirada' then 'OK   ' else 'FALLA' end, v_o);
  begin perform public.elegir_propuesta(v_pc); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93 6b: la elección no se cambia -> %s', case when v_o = 'ya_elegida' then 'OK   ' else 'FALLA' end, v_o);

  -- CU-22 paso 7: postular vincula la postulación al encargo.
  select id into v_po from public.iniciar_postulacion(v_va, v_p1);
  execute 'reset role';
  select postulacion_id into v_o from public.encargos where id = v_b1;
  v_res := v_res || format(E'\n%s CU-22 paso 7: la postulación nueva queda vinculada al encargo -> %s',
    case when v_o = v_po::text then 'OK   ' else 'FALLA' end, v_o = v_po::text);

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.proponer_convocatoria(v_b1, v_vc, 'Tarde'); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93 (d): con una elegida no se admiten más -> %s',
    case when v_o = 'encargo_no_admite_propuestas' then 'OK   ' else 'FALLA' end, v_o);
  select count(*) into v_n from public.postulacion_checklist where postulacion_id = v_po;
  v_res := v_res || format(E'\n%s RN-25: el consultor lee el checklist de la postulación vinculada -> %s',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  v_res := v_res || format(E'\n%s RF-93 (d): la búsqueda sigue abierta en curso -> %s', case when v_n = 3 then 'OK   ' else 'FALLA' end, v_n);
  execute 'reset role';

  -- ================================================================ el trigger ata también al servidor
  begin update public.encargos set convocatoria_id = v_vb where id = v_b1; v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s §9.25: ni postgres cambia la convocatoria fijada -> %s', case when v_o = 'encargo_fijo' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.responder_encargo(v_b2, true);
  v_px := public.proponer_convocatoria(v_b2, v_vb, 'B para el segundo');
  execute 'reset role';
  begin update public.encargos set convocatoria_id = v_vb where id = v_b2; v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s §9.25: ni fija una convocatoria propuesta pero no elegida -> %s', case when v_o = 'encargo_fijo' then 'OK   ' else 'FALLA' end, v_o);
  insert into public.postulaciones (usuario_id, convocatoria_id, proyecto_id) values (v_e1, v_vc, v_p3) returning id into v_po;
  begin update public.encargos set postulacion_id = v_po where id = v_b2; v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s §9.23: ni vincula una postulación de otro proyecto -> %s', case when v_o = 'encargo_fijo' then 'OK   ' else 'FALLA' end, v_o);

  -- RF-78: la convocatoria se cierra entre la propuesta y la elección.
  update public.convocatorias set fecha_cierre = privado.hoy_colombia() - 1 where id = v_vb;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select porcentaje, vigente into v_row from public.propuestas_de_encargo(v_b2) where id = v_px;
  v_res := v_res || format(E'\n%s RF-92: una que dejó de estar vigente se marca, sin porcentaje -> %s, %s',
    case when v_row.vigente = false and v_row.porcentaje is null then 'OK   ' else 'FALLA' end, v_row.vigente, coalesce(v_row.porcentaje::text, 'nulo'));
  begin perform public.elegir_propuesta(v_px); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-93 6a: elegir una que ya cerró -> %s', case when v_o = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_o);
  execute 'reset role';

  -- ================================================================ al terminar
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.completar_encargo(v_b2);
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  execute 'reset role';
  select estado into v_o from public.encargo_propuestas where id = v_px;
  v_res := v_res || format(E'\n%s §9.25: al completar, la propuesta abierta queda descartada -> %s',
    case when v_o = 'descartada' then 'OK   ' else 'FALLA' end, v_o);
  v_res := v_res || format(E'\n%s RF-91: y el consultor pierde el catálogo al instante -> %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- La suspensión cancela el encargo: c1 pierde el catálogo y la convocatoria fijada.
  update public.consultor_perfiles set estado_perfil = 'suspendido', motivo_suspension = 'Prueba', suspendido_at = now() where id = v_c1;
  update public.encargos set estado = 'cancelado', motivo_cancelacion = 'Prueba' where id = v_b1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.convocatorias where id = any (v_mias);
  begin perform * from public.sugerencias_encargo(v_b1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-91: cancelado, ni catálogo ni sugerencias -> %s, %s',
    case when v_n = 0 and v_o = 'no_existe' then 'OK   ' else 'FALLA' end, v_n, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
