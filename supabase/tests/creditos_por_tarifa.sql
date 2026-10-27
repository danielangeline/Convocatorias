-- Créditos por tarifa (docs/05 §9.32). Sesión 030. RN-17, RN-18, RF-48, RF-50,
-- RF-100, RNF-20, RNF-28.
--
--   npx supabase db query --linked -f supabase/tests/creditos_por_tarifa.sql
--
-- Con las tarifas y el trial reales: documento 100, proyecto 50, ajuste 10 y un
-- trial de 125. Termina SIEMPRE con un error "RESULTADO …" que revierte todo.
do $$
declare
  v_res text := '';
  v_e1 uuid := '00000000-0000-0000-0000-0000000032e1';
  v_ad uuid := '00000000-0000-0000-0000-0000000032ad';
  v_p1 uuid := '00000000-0000-0000-0000-0000000032b1';
  v_va uuid := '00000000-0000-0000-0000-0000000032a1';
  v_vb uuid := '00000000-0000-0000-0000-0000000032a2';
  v_sus uuid;
  v_d1 uuid; v_r1 uuid;
  v_n int; v_m int;
  v_o text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'te1@prueba.co', '{"rol": "empresa", "nombre": "Ana", "nombre_empresa": "Empresa Tarifas", "consentimiento_datos": "true"}'),
    (v_ad, 'tad@prueba.co', '{"rol": "empresa", "nombre": "Admin"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;
  select id into v_sus from public.suscripciones where usuario_id = v_e1;
  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (v_va, 'A · vigente', 'Prueba', true, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (v_vb, 'B · vigente', 'Prueba', true, privado.hoy_colombia() + 30, 'publicada', 'https://prueba.gov.co/b');
  insert into public.proyectos (id, usuario_id, nombre, problema) values (v_p1, v_e1, 'Proyecto Tarifas', 'Problema');

  select privado.creditos_disponibles(v_sus) into v_n;
  v_res := v_res || format(E'\n%s §9.32: el trial trae 125 créditos -> %s', case when v_n = 125 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ generar: 100
  select documento_id into v_d1 from public.iniciar_generacion(v_e1, v_p1, v_va);
  begin perform * from public.iniciar_generacion(v_e1, v_p1, v_vb); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-17: con 125 y una generación en curso (100 reservados), otra no cabe -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);
  perform public.completar_generacion(v_d1, 'Doc', '## A' || chr(10) || 'texto', '{}', 500, 100, 0.003, 'gpt-prueba', 1000);
  select creditos_usados_periodo into v_n from public.suscripciones where id = v_sus;
  select creditos into v_m from public.consumos_ia where documento_id = v_d1 and tipo = 'generacion';
  v_res := v_res || format(E'\n%s RF-48: generar descuenta 100 y el consumo lo registra -> usados %s, consumo %s',
    case when v_n = 100 and v_m = 100 then 'OK   ' else 'FALLA' end, v_n, v_m);

  -- ================================================================ sin saldo para la tarifa
  begin perform * from public.iniciar_estructuracion(v_e1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-50: con 25 libres no se crea un proyecto con IA (50) -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.iniciar_transcripcion(v_e1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-97: ni se dicta, porque no alcanza para estructurar -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ plan primero, después paquetes (RN-18)
  update public.suscripciones set creditos_extra = 100 where id = v_sus;
  select reserva_id into v_r1 from public.iniciar_estructuracion(v_e1);
  perform public.completar_estructuracion(v_r1, 300, 80, 0.0006, 'gpt-prueba', 900);
  select creditos_usados_periodo, creditos_extra into v_n, v_m from public.suscripciones where id = v_sus;
  v_res := v_res || format(E'\n%s RN-18: el proyecto (50) toma 25 del plan y 25 del paquete -> usados %s, extra %s',
    case when v_n = 125 and v_m = 75 then 'OK   ' else 'FALLA' end, v_n, v_m);

  -- ================================================================ ajuste desde el cuarto: 10
  update public.documentos_generados set ajustes_usados = 3 where id = v_d1;
  select ajustes_usados into v_n from public.preparar_ajuste(v_e1, v_d1);
  perform public.completar_ajuste(v_e1, v_d1, 3, '## A' || chr(10) || 'ajustado', '{}', 400, 90, 0.0005, 'gpt-prueba', 800);
  select creditos_extra into v_m from public.suscripciones where id = v_sus;
  select creditos into v_n from public.consumos_ia where documento_id = v_d1 and tipo = 'ajuste';
  v_res := v_res || format(E'\n%s RN-17: el cuarto ajuste cuesta 10 -> extra %s, consumo %s',
    case when v_m = 65 and v_n = 10 then 'OK   ' else 'FALLA' end, v_m, v_n);
  select count(*) into v_n from public.consumos_ia where usuario_id = v_e1 and exito and credito_descontado;
  select coalesce(sum(creditos), 0) into v_m from public.consumos_ia where usuario_id = v_e1;
  v_res := v_res || format(E'\n%s RF-52: tres usos cobrados suman 160 créditos -> %s usos, %s créditos',
    case when v_n = 3 and v_m = 160 then 'OK   ' else 'FALLA' end, v_n, v_m);

  -- ================================================================ tarifas (RF-100)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.tarifas_ia;
  begin update public.tarifas_ia set creditos = 1; get diagnostics v_m = row_count; v_o := 'filas ' || v_m;
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-100: la empresa lee las 4 tarifas (sesión 031: + editar apartado) y no las cambia -> lee %s, cambiar %s',
    case when v_n = 4 and v_o in ('filas 0', '42501') then 'OK   ' else 'FALLA' end, v_n, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.guardar_tarifa('generacion', 1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-28: la empresa no guarda tarifas -> %s', case when v_o = 'no_es_admin' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform public.guardar_tarifa('generacion', 1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-28: el administrador sin MFA tampoco -> %s', case when v_o = 'no_es_admin' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.guardar_tarifa('generacion', 120);
  begin perform public.guardar_tarifa('generacion', 0); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  execute 'reset role';
  select creditos into v_n from public.tarifas_ia where accion = 'generacion';
  v_res := v_res || format(E'\n%s RF-100: el administrador con MFA cambia la tarifa (%s), con autor, y 0 se rechaza (%s)',
    case when v_n = 120 and v_o = 'dato_invalido'
              and (select actualizado_por from public.tarifas_ia where accion = 'generacion') = v_ad then 'OK   ' else 'FALLA' end, v_n, v_o);
  select privado.tarifa('generacion') into v_n;
  v_res := v_res || format(E'\n%s RF-100: rige desde el siguiente uso -> %s', case when v_n = 120 then 'OK   ' else 'FALLA' end, v_n);

  raise exception 'RESULTADO %', v_res;
end $$;
