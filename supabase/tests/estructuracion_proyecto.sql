-- CU-43 · Crear el proyecto con IA a partir de una explicación (docs/05 §9.29).
-- Sesión 030. RF-96, RF-97, RF-52, RN-17, RN-24, RNF-20.
--
--   npx supabase db query --linked -f supabase/tests/estructuracion_proyecto.sql
--
-- Prepara datos como postgres (que hace de service_role: las funciones son
-- solo del servidor) y comprueba con `authenticated` lo que el cliente no
-- puede. Termina SIEMPRE con un error "RESULTADO …" que revierte todo.
do $$
declare
  v_res text := '';
  v_e1 uuid := '00000000-0000-0000-0000-0000000030e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000030e2';
  v_c1 uuid := '00000000-0000-0000-0000-0000000030c1';
  v_sus uuid;
  v_r1 uuid; v_r2 uuid; v_r3 uuid;
  v_n int; v_m int;
  v_o text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'ee1@prueba.co', '{"rol": "empresa", "nombre": "Ana", "nombre_empresa": "Empresa Uno", "consentimiento_datos": "true"}'),
    (v_e2, 'ee2@prueba.co', '{"rol": "empresa", "nombre": "Beto", "nombre_empresa": "Empresa Dos", "consentimiento_datos": "true"}'),
    (v_c1, 'ec1@prueba.co', '{"rol": "consultor", "nombre": "Cata", "consentimiento_datos": "true"}');
  select id into v_sus from public.suscripciones where usuario_id = v_e1;

  -- ================================================================ solo el servidor
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_n := 0;
  begin perform * from public.iniciar_estructuracion(v_e1); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin perform * from public.iniciar_transcripcion(v_e1); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin perform public.registrar_transcripcion(v_e1, true, null, 0, 'x', 1); exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  begin insert into public.reservas_estructuracion (usuario_id) values (v_e1);
  exception when others then if sqlstate = '42501' then v_n := v_n + 1; end if; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s §9.29: el cliente no inicia, ni transcribe, ni registra, ni inserta reservas -> %s/4',
    case when v_n = 4 then 'OK   ' else 'FALLA' end, v_n);

  -- ================================================================ precondiciones
  begin perform * from public.iniciar_estructuracion(v_c1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-43: el consultor no estructura -> %s', case when v_o = 'no_es_empresa' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.iniciar_transcripcion(v_c1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-97: el consultor no transcribe -> %s', case when v_o = 'no_es_empresa' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ reservas (RN-17): trial con 3 créditos
  select reserva_id into v_r1 from public.iniciar_estructuracion(v_e1);
  select reserva_id into v_r2 from public.iniciar_estructuracion(v_e1);
  select reserva_id into v_r3 from public.iniciar_estructuracion(v_e1);
  begin perform * from public.iniciar_estructuracion(v_e1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-17: con 3 créditos y 3 reservas, la cuarta se rechaza -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);
  begin perform * from public.iniciar_transcripcion(v_e1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-97: sin crédito libre tampoco se transcribe -> %s',
    case when v_o = 'sin_creditos' then 'OK   ' else 'FALLA' end, v_o);

  -- Las reservas cuentan también contra la generación (privado.reservas_de).
  select privado.reservas_de(v_e1) into v_n;
  v_res := v_res || format(E'\n%s §9.29: las estructuraciones en curso cuentan como reservas -> %s',
    case when v_n = 3 then 'OK   ' else 'FALLA' end, v_n);

  -- Fallar libera sin cobro.
  perform public.fallar_estructuracion(v_r2, 'Tiempo agotado', 900, 0, 0.0007, 'gpt-prueba', 60000);
  select creditos_usados_periodo into v_n from public.suscripciones where id = v_sus;
  select count(*) into v_m from public.consumos_ia where usuario_id = v_e1 and tipo = 'estructuracion' and not exito and not credito_descontado;
  v_res := v_res || format(E'\n%s RN-17: fallar no cobra y registra el consumo -> usados %s, fallidos %s',
    case when v_n = 0 and v_m = 1 then 'OK   ' else 'FALLA' end, v_n, v_m);

  -- Completar cobra uno y deja el consumo con crédito.
  perform public.completar_estructuracion(v_r1, 1200, 400, 0.0027, 'gpt-prueba', 8000);
  select creditos_usados_periodo into v_n from public.suscripciones where id = v_sus;
  select count(*) into v_m from public.consumos_ia where usuario_id = v_e1 and tipo = 'estructuracion' and exito and credito_descontado;
  v_res := v_res || format(E'\n%s RN-17: completar cobra un crédito -> usados %s, exitosos %s',
    case when v_n = 1 and v_m = 1 then 'OK   ' else 'FALLA' end, v_n, v_m);

  begin perform public.completar_estructuracion(v_r1, 1, 1, 0, 'gpt-prueba', 1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-17: la misma reserva no se cobra dos veces -> %s',
    case when v_o = 'estructuracion_no_encontrada' then 'OK   ' else 'FALLA' end, v_o);

  -- Reserva huérfana: a los 5 minutos se libera sin cobro al iniciar otra.
  update public.reservas_estructuracion set creada_at = now() - interval '6 minutes' where id = v_r3;
  select reserva_id into v_r2 from public.iniciar_estructuracion(v_e1);
  select count(*) into v_n from public.reservas_estructuracion where id = v_r3;
  select count(*) into v_m from public.consumos_ia where usuario_id = v_e1 and tipo = 'estructuracion' and mensaje_error like 'La estructuración no terminó%';
  v_res := v_res || format(E'\n%s RN-17: la reserva vencida se libera sin cobro -> quedan %s, registradas %s',
    case when v_n = 0 and v_m = 1 then 'OK   ' else 'FALLA' end, v_n, v_m);
  perform public.fallar_estructuracion(v_r2, 'limpieza', null, null, null, 'gpt-prueba', 1);

  -- ================================================================ transcripción (RF-97)
  select count(*) into v_n from public.iniciar_transcripcion(v_e1);
  perform public.registrar_transcripcion(v_e1, true, null, 0.0015, 'gpt-4o-mini-transcribe', 2500);
  select creditos_usados_periodo into v_m from public.suscripciones where id = v_sus;
  v_res := v_res || format(E'\n%s RF-97: transcribir no cobra crédito -> usados %s',
    case when v_n = 1 and v_m = 1 then 'OK   ' else 'FALLA' end, v_m);

  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito)
  select v_e1, v_e1, 'transcripcion', true from generate_series(1, 29);
  begin perform * from public.iniciar_transcripcion(v_e1); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-97: tope de 30 transcripciones al día -> %s',
    case when v_o = 'tope_transcripciones' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ sin suscripción
  update public.suscripciones set estado = 'vencida', fecha_inicio = privado.hoy_colombia() - 40, fecha_vencimiento = privado.hoy_colombia() - 30 where usuario_id = v_e2;
  begin perform * from public.iniciar_estructuracion(v_e2); v_o := 'ok';
  exception when others then get stacked diagnostics v_o = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-43 3b: sin suscripción vigente no se estructura -> %s',
    case when v_o = 'sin_suscripcion' then 'OK   ' else 'FALLA' end, v_o);

  -- ================================================================ RLS de la reserva (RN-24, RN-30)
  select reserva_id into v_r3 from public.iniciar_estructuracion(v_e1);
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.reservas_estructuracion;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_m from public.reservas_estructuracion;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-30: cada empresa ve solo sus reservas -> ajena %s, propia %s',
    case when v_n = 0 and v_m = 1 then 'OK   ' else 'FALLA' end, v_n, v_m);

  raise exception 'RESULTADO %', v_res;
end $$;
