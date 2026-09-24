-- RF-15, RF-16, CU-10, RN-05, RN-34, RNF-05 · Sugerencias con porcentaje
-- (sugerencias_proyecto, docs/05 §9.6) y cobertura por departamentos (§9.18).
-- Sesión 019, Sprint 3 paso 2.
--
--   npx supabase db query --linked -f supabase/tests/sugerencias.sql
--
-- Prepara datos como postgres y llama a las funciones con el rol
-- `authenticated`, así que la RLS decide de verdad. Termina SIEMPRE con un
-- error "RESULTADO …" que revierte todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_e1 uuid := '00000000-0000-0000-0000-0000000019e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000019e2';
  v_c1 uuid := '00000000-0000-0000-0000-0000000019c1';
  v_admin uuid;
  v_p uuid := '00000000-0000-0000-0000-00000000019a';  -- proyecto completo de E1
  v_q uuid := '00000000-0000-0000-0000-00000000019b';  -- proyecto vacío de E1
  v_r uuid := '00000000-0000-0000-0000-00000000019c';  -- proyecto de E2
  v_tp uuid; v_se uuid; v_te uuid; v_se2 uuid; v_fuente uuid;
  a uuid := '00000000-0000-0000-0000-0000000190a1';
  b uuid := '00000000-0000-0000-0000-0000000190b1';
  c uuid := '00000000-0000-0000-0000-0000000190c1';
  d uuid := '00000000-0000-0000-0000-0000000190d1';
  e uuid := '00000000-0000-0000-0000-0000000190e1';
  f uuid := '00000000-0000-0000-0000-0000000190f1';
  g uuid := '00000000-0000-0000-0000-000000019001';
  v_obtenido text;
  v_ids uuid[];
  v_fila record;
  v_t0 timestamptz;
  v_ms numeric;
  v_datos jsonb;

begin
  -- Cuentas: nacen por el trigger de registro, con trial (RF-37).
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'sug1@prueba.co', '{"rol": "empresa", "nombre": "Sugerencias uno"}'),
    (v_e2, 'sug2@prueba.co', '{"rol": "empresa", "nombre": "Sugerencias dos"}'),
    (v_c1, 'sugc@prueba.co', '{"rol": "consultor", "nombre": "Consultor sugerencias"}');

  insert into public.categorias (tipo, nombre, activa) values ('tipo_proyecto', 'Sug s019 tp ' || gen_random_uuid(), true) returning id into v_tp;
  insert into public.categorias (tipo, nombre, activa) values ('sector', 'Sug s019 se ' || gen_random_uuid(), true) returning id into v_se;
  insert into public.categorias (tipo, nombre, activa) values ('tipo_entidad', 'Sug s019 te ' || gen_random_uuid(), true) returning id into v_te;
  insert into public.categorias (tipo, nombre, activa) values ('sector', 'Sug s019 se2 ' || gen_random_uuid(), true) returning id into v_se2;

  insert into public.convocatorias (id, nombre, entidad_convocante, monto_min, monto_max, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (a, 'A · todo coincide',       'Prueba', 100, 500,  true,  privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (b, 'B · nada coincide',       'Prueba', 1000, 2000, false, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/b'),
    (c, 'C · tipo y ubicación',    'Prueba', null, 150,  false, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/c'),
    (g, 'G · igual a C, cierra antes', 'Prueba', null, 150, false, privado.hoy_colombia(), 'publicada', 'https://prueba.gov.co/g'),
    (d, 'D · vencida sin cerrar',  'Prueba', 100, 500,  true,  privado.hoy_colombia() - 1,  'publicada', 'https://prueba.gov.co/d'),
    (e, 'E · borrador',            'Prueba', 100, 500,  true,  privado.hoy_colombia() + 20, 'borrador',  null),
    (f, 'F · cerrada',             'Prueba', 100, 500,  true,  privado.hoy_colombia() - 9,  'cerrada',   'https://prueba.gov.co/f');

  insert into public.convocatoria_categoria values
    (a, v_tp), (a, v_se), (a, v_te), (b, v_se2), (c, v_tp), (g, v_tp),
    (d, v_tp), (d, v_se), (e, v_tp), (f, v_tp);
  insert into public.convocatoria_departamento values (b, '05'), (c, '08'), (c, '13'), (g, '08');

  insert into public.proyectos (id, usuario_id, nombre, monto_buscado, departamento_codigo) values
    (v_p, v_e1, 'P completo', 200, '08'),
    (v_q, v_e1, 'Q vacío', null, null),
    (v_r, v_e2, 'R de otra empresa', 200, '08');
  insert into public.proyecto_categoria values (v_p, v_tp), (v_p, v_se), (v_p, v_te), (v_r, v_tp);
  v_ids := array[a, b, c, d, e, f, g];

  -- ---------------------------------------------------------------- E1 · P
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  select array_agg(s.convocatoria_id order by ord) into v_ids
    from public.sugerencias_proyecto(v_p) with ordinality as s(convocatoria_id, tp, se, te, mo, ub, n, pct, ord)
   where s.convocatoria_id = any (array[a, b, c, d, e, f, g]);
  v_res := v_res || format(E'\n%s solo vigentes y en orden: A 100, G 40 (cierra hoy), C 40, B 0; sin D, E ni F -> %s',
    case when v_ids = array[a, g, c, b] then 'OK   ' else 'FALLA' end, v_ids);

  select * into v_fila from public.sugerencias_proyecto(v_p) s where s.convocatoria_id = a;
  v_res := v_res || format(E'\n%s A: los cinco criterios y 100 %% -> %s',
    case when v_fila.tipo_proyecto and v_fila.sector and v_fila.tipo_entidad and v_fila.monto and v_fila.ubicacion
              and v_fila.coincidencias = 5 and v_fila.porcentaje = 100 then 'OK   ' else 'FALLA' end, v_fila);

  select * into v_fila from public.sugerencias_proyecto(v_p) s where s.convocatoria_id = c;
  v_res := v_res || format(E'\n%s C: tipo de proyecto y departamento (08 en {08,13}); monto 200 > 150 no; 40 %% -> %s',
    case when v_fila.tipo_proyecto and not v_fila.sector and not v_fila.tipo_entidad and not v_fila.monto
              and v_fila.ubicacion and v_fila.porcentaje = 40 then 'OK   ' else 'FALLA' end, v_fila);

  select * into v_fila from public.sugerencias_proyecto(v_p) s where s.convocatoria_id = b;
  v_res := v_res || format(E'\n%s B: departamento distinto (05) y nada más; 0 %% y aun así se devuelve (CU-10 2a) -> %s',
    case when v_fila.coincidencias = 0 and v_fila.porcentaje = 0 and not v_fila.ubicacion then 'OK   ' else 'FALLA' end, v_fila);

  -- ---------------------------------------------------------------- E1 · Q (sin datos)
  select * into v_fila from public.sugerencias_proyecto(v_q) s where s.convocatoria_id = a;
  v_res := v_res || format(E'\n%s Q sin datos: solo coincide la ubicación nacional; sin monto no coincide el monto -> %s',
    case when v_fila.ubicacion and not v_fila.monto and not v_fila.tipo_proyecto and v_fila.porcentaje = 20 then 'OK   ' else 'FALLA' end, v_fila);

  select * into v_fila from public.sugerencias_proyecto(v_q) s where s.convocatoria_id = c;
  v_res := v_res || format(E'\n%s Q sin departamento: C (departamental) no coincide en ubicación -> %s',
    case when not v_fila.ubicacion and v_fila.porcentaje = 0 then 'OK   ' else 'FALLA' end, v_fila);

  -- ---------------------------------------------------------------- aislamiento
  begin
    perform * from public.sugerencias_proyecto(v_r);
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s E1 pide sugerencias del proyecto de E2 -> %s',
    case when v_obtenido = 'no_existe' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- guardar_proyecto
  begin
    perform public.guardar_proyecto(v_q, '{"nombre": "Q vacío", "departamento_codigo": "00"}'::jsonb, '{}');
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s guardar_proyecto con un departamento que no existe -> %s',
    case when v_obtenido = 'departamento_invalido' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.guardar_proyecto(v_q, '{"nombre": "Q vacío", "departamento_codigo": "13"}'::jsonb, '{}');
  select * into v_fila from public.sugerencias_proyecto(v_q) s where s.convocatoria_id = c;
  v_res := v_res || format(E'\n%s Q guarda Bolívar (13) y ahora coincide con C {08,13} -> %s',
    case when v_fila.ubicacion then 'OK   ' else 'FALLA' end, v_fila);

  -- La empresa no escribe en la lista ni en la cobertura.
  begin
    insert into public.departamentos values ('00', 'Inventado');
    v_obtenido := 'ok';
  exception when others then
    v_obtenido := sqlstate;
  end;
  v_res := v_res || format(E'\n%s la empresa no agrega departamentos -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    insert into public.convocatoria_departamento values (a, '05');
    v_obtenido := 'ok';
  exception when others then
    v_obtenido := sqlstate;
  end;
  v_res := v_res || format(E'\n%s la empresa no cambia la cobertura de una convocatoria -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  select count(*) into v_ms from public.convocatoria_departamento where convocatoria_id in (b, c, g);
  v_res := v_res || format(E'\n%s la empresa lee la cobertura de las vigentes -> %s filas',
    case when v_ms = 4 then 'OK   ' else 'FALLA' end, v_ms);

  execute 'reset role';

  -- ---------------------------------------------------------------- suscripción
  update public.suscripciones set estado = 'vencida', fecha_inicio = current_date - 60, fecha_vencimiento = current_date - 30 where usuario_id = v_e2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform * from public.sugerencias_proyecto(v_r);
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s E2 con la suscripción vencida (CU-10 2b) -> %s',
    case when v_obtenido = 'sin_suscripcion' then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform * from public.sugerencias_proyecto(v_p);
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s un consultor (sin suscripción de empresa) -> %s',
    case when v_obtenido in ('sin_suscripcion', 'no_existe') then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  -- ---------------------------------------------------------------- cobertura desde el panel
  select id into v_admin from public.perfiles where es_propietario;
  insert into public.fuentes (nombre, activa) values ('Fuente s019 ' || gen_random_uuid(), true) returning id into v_fuente;
  update public.convocatorias set fuente_id = v_fuente, descripcion = 'Objeto' where id = c;
  insert into public.documentos_convocatoria (convocatoria_id, tipo_doc, nombre, storage_path) values (c, 'TDR', 'TDR', c || '/s019.pdf');
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, orden) values (c, 'RUT', 'documento', 1), (c, 'Cámara', 'documento', 2);
  v_datos := jsonb_build_object('fuente_id', v_fuente, 'nombre', 'C', 'entidad_convocante', 'Prueba', 'descripcion', 'Objeto',
    'monto_min', '', 'monto_max', '150', 'fecha_apertura', '', 'fecha_cierre', (privado.hoy_colombia() + 20)::text,
    'url_postulacion', 'https://prueba.gov.co/c');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  begin
    perform public.guardar_convocatoria(c, v_datos || '{"departamentos": ["08", "77"]}', array[v_tp],
      (select jsonb_agg(jsonb_build_object('id', r.id, 'descripcion', r.descripcion, 'tipo', r.tipo)) from public.requisitos_convocatoria r where r.convocatoria_id = c));
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s guardar_convocatoria con un departamento inexistente -> %s',
    case when v_obtenido = 'departamento_invalido' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.guardar_convocatoria(c, v_datos || '{"departamentos": []}', array[v_tp],
      (select jsonb_agg(jsonb_build_object('id', r.id, 'descripcion', r.descripcion, 'tipo', r.tipo)) from public.requisitos_convocatoria r where r.convocatoria_id = c));
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s quitarle toda la cobertura a una publicada (RN-01) -> %s',
    case when v_obtenido = 'publicada_incompleta' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.guardar_convocatoria(c, v_datos || '{"cobertura_nacional": true, "departamentos": ["08"]}', array[v_tp],
    (select jsonb_agg(jsonb_build_object('id', r.id, 'descripcion', r.descripcion, 'tipo', r.tipo)) from public.requisitos_convocatoria r where r.convocatoria_id = c));
  select count(*) into v_ms from public.convocatoria_departamento where convocatoria_id = c;
  v_res := v_res || format(E'\n%s pasar a nacional borra los departamentos y sigue publicable -> %s departamentos, publicable %s',
    case when v_ms = 0 and (select privado.ficha_publicable(c)) then 'OK   ' else 'FALLA' end, v_ms, (select privado.ficha_publicable(c)));

  perform public.guardar_convocatoria(c, v_datos || '{"departamentos": ["05", "76"]}', array[v_tp],
    (select jsonb_agg(jsonb_build_object('id', r.id, 'descripcion', r.descripcion, 'tipo', r.tipo)) from public.requisitos_convocatoria r where r.convocatoria_id = c));
  select count(*) into v_ms from public.convocatoria_departamento where convocatoria_id = c;
  v_res := v_res || format(E'\n%s volver a departamental con dos departamentos -> %s, nacional %s',
    case when v_ms = 2 and not (select cobertura_nacional from public.convocatorias where id = c) then 'OK   ' else 'FALLA' end,
    v_ms, (select cobertura_nacional from public.convocatorias where id = c));
  execute 'reset role';

  -- ---------------------------------------------------------------- RNF-05 · volumen
  insert into public.convocatorias (id, nombre, entidad_convocante, monto_min, monto_max, cobertura_nacional, fecha_cierre, estado, url_postulacion)
  select gen_random_uuid(), 'Volumen ' || i, 'Prueba', 10 * (i % 50), 1000 + 1000 * (i % 70), i % 4 = 0,
         privado.hoy_colombia() + (i % 90), 'publicada', 'https://prueba.gov.co/v' || i
    from generate_series(1, 2000) i;
  insert into public.convocatoria_categoria
  select cv.id, (array[v_tp, v_se, v_te, v_se2])[1 + (abs(hashtext(cv.id::text)) % 4)]
    from public.convocatorias cv where cv.nombre like 'Volumen %';
  insert into public.convocatoria_departamento
  select cv.id, (array['05','08','11','13','76'])[1 + (abs(hashtext(cv.nombre)) % 5)]
    from public.convocatorias cv where cv.nombre like 'Volumen %' and not cv.cobertura_nacional;
  -- En producción autovacuum mantiene las estadísticas; aquí se calculan a mano.
  analyze public.convocatorias; analyze public.convocatoria_categoria; analyze public.convocatoria_departamento;

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_t0 := clock_timestamp();
  select count(*) into v_ms from public.sugerencias_proyecto(v_p);
  v_ms := extract(epoch from clock_timestamp() - v_t0) * 1000;
  v_res := v_res || format(E'\n%s con 2 000 convocatorias más, responde en %s ms (RNF-05: < 3 000)',
    case when v_ms < 3000 then 'OK   ' else 'FALLA' end, round(v_ms));
  execute 'reset role';

  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
