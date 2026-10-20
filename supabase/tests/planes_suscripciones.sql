-- CU-28..31 · Planes, suscripciones y paquetes administrables (docs/05 §9.28).
-- Sesión 028, Sprint 5. RF-36, RF-38, RF-42, RF-51, RN-18, RN-28, RN-29, RNF-20, RNF-28.
--
--   npx supabase db query --linked -f supabase/tests/planes_suscripciones.sql
--
-- Termina SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice
-- OK o FALLA.
do $$
declare
  v_res text := '';
  v_ad uuid := '00000000-0000-0000-0000-0000000028ad';
  v_e1 uuid := '00000000-0000-0000-0000-0000000028e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000028e2';
  v_c1 uuid := '00000000-0000-0000-0000-0000000028c1';
  v_c2 uuid := '00000000-0000-0000-0000-0000000028c2';
  v_pr uuid := '00000000-0000-0000-0000-0000000028a1';
  v_hoy date := privado.hoy_colombia();
  v_trial uuid; v_esencial uuid; v_pro uuid; v_cons uuid; v_nuevo uuid;
  v_sus_e1 uuid; v_sus_c1 uuid; v_id uuid;
  v_quien text;
  v_msg text;
  v_n int;
  v_fila record;
  v_ok boolean;
  v_filas int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_ad, 'sad@prueba.co', '{"rol": "empresa", "nombre": "Admin"}'),
    (v_e1, 'se1@prueba.co', '{"rol": "empresa", "nombre": "Uno", "nombre_empresa": "Empresa Uno", "consentimiento_datos": "true"}'),
    (v_e2, 'se2@prueba.co', '{"rol": "empresa", "nombre": "Dos", "nombre_empresa": "Empresa Dos", "consentimiento_datos": "true"}'),
    (v_c1, 'sc1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}'),
    (v_c2, 'sc2@prueba.co', '{"rol": "consultor", "nombre": "Dos", "consentimiento_datos": "true"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;
  update public.consultor_perfiles
     set nombre_profesional = 'Consultora Uno', descripcion = 'Formulo proyectos',
         foto_path = id::text || '/f.png', cv_path = id::text || '/cv.pdf', estado_perfil = 'aprobado'
   where id = v_c1;
  insert into public.proyectos (id, usuario_id, nombre) values (v_pr, v_e1, 'Proyecto 028');
  -- Un encargo nace pendiente: se lleva por el grafo de transiciones.
  -- Uno abierto por proyecto y consultor: primero el que se completa.
  insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
  values (v_pr, v_e1, v_c1, 'Tarea completada', 'directorio', 'pendiente', 'buscar_convocatoria');
  update public.encargos set estado = 'en_curso' where consultor_id = v_c1;
  update public.encargos set estado = 'completado' where consultor_id = v_c1;
  insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
  values (v_pr, v_e1, v_c1, 'Tarea en curso', 'directorio', 'pendiente', 'buscar_convocatoria');
  update public.encargos set estado = 'en_curso' where consultor_id = v_c1 and titulo_tarea = 'Tarea en curso';

  select id into v_trial from public.planes where es_trial;
  select id into v_esencial from public.planes where nombre = 'Empresa Esencial';
  select id into v_pro from public.planes where nombre = 'Empresa Pro';
  select id into v_cons from public.planes where nombre = 'Consultor' and rol = 'consultor';
  select id into v_sus_e1 from public.suscripciones where usuario_id = v_e1;

  v_res := v_res || format(E'\n%s §9.28: planes semilla de docs/07 (Esencial 10, Pro 30, Consultor 0)',
    case when (select creditos_ia_mensuales from public.planes where id = v_esencial) = 10
              and (select creditos_ia_mensuales from public.planes where id = v_pro) = 30
              and (select creditos_ia_mensuales from public.planes where id = v_cons) = 0 then 'OK   ' else 'FALLA' end);

  -- ---------------------------------------------------------------- quien no es admin con aal2
  foreach v_quien in array array['empresa', 'consultor', 'admin_aal1'] loop
    perform set_config('request.jwt.claims', json_build_object(
      'sub', case v_quien when 'empresa' then v_e1 when 'consultor' then v_c1 else v_ad end,
      'role', 'authenticated', 'aal', 'aal1')::text, true);
    execute 'set local role authenticated';
    v_n := 0;
    begin perform public.guardar_plan(null, 'Gratis', 'empresa', 0, 0, 999, true); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.activar_suscripcion(v_e1, v_pro, 'mensual', 1, v_hoy); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.otorgar_creditos_extra(v_sus_e1, 100, 0); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.suspender_suscripcion(v_sus_e1); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.cuentas_suscripcion_admin(); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.tablero_suscripciones(); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    -- Y nada directo en las tablas.
    update public.suscripciones set creditos_extra = 99 where usuario_id = v_e1;
    get diagnostics v_filas = row_count;
    begin
      insert into public.pagos_suscripcion (suscripcion_id, monto) values (v_sus_e1, 1);
    exception when others then v_n := v_n + 1; end;
    execute 'reset role';
    v_res := v_res || format(E'\n%s RNF-20/28: %s no administra planes ni suscripciones -> %s de 7 rechazos; filas tocadas directo: %s',
      case when v_n = 7 and v_filas = 0 then 'OK   ' else 'FALLA' end, v_quien, v_n, v_filas);
  end loop;

  -- La empresa lee su suscripción y los planes activos; no los inactivos.
  update public.planes set activo = false where id = v_pro;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.planes where id = v_pro;
  v_ok := exists (select 1 from public.suscripciones where usuario_id = v_e1);
  execute 'reset role';
  update public.planes set activo = true where id = v_pro;
  v_res := v_res || format(E'\n%s RF-41/82: la empresa lee su suscripción y no ve un plan inactivo (%s)',
    case when v_ok and v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- administrador con aal2
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  -- Ni el administrador escribe directo.
  update public.planes set precio_mensual = 1 where id = v_esencial;
  get diagnostics v_n = row_count;
  v_ok := false;
  begin insert into public.pagos_suscripcion (suscripcion_id, monto) values (v_sus_e1, 1);
  exception when others then v_ok := true; end;
  v_res := v_res || format(E'\n%s §9.28: el administrador tampoco escribe directo (planes %s filas, pagos rechazado %s)',
    case when v_n = 0 and v_ok then 'OK   ' else 'FALLA' end, v_n, v_ok);

  -- RF-36: crear y editar planes.
  v_nuevo := public.guardar_plan(null, '  Empresa Plus ', 'empresa', 120000, 1200000, 20, true);
  select * into v_fila from public.planes where id = v_nuevo;
  v_res := v_res || format(E'\n%s RF-36: crea un plan con precio, anual y créditos',
    case when v_fila.nombre = 'Empresa Plus' and v_fila.creditos_ia_mensuales = 20 and v_fila.activo and not v_fila.es_trial then 'OK   ' else 'FALLA' end);
  perform public.guardar_plan(v_nuevo, 'Empresa Plus', 'empresa', 125000, 1250000, 25, false);
  select * into v_fila from public.planes where id = v_nuevo;
  v_res := v_res || format(E'\n%s RF-36: lo edita y lo desactiva sin borrarlo',
    case when v_fila.precio_mensual = 125000 and v_fila.creditos_ia_mensuales = 25 and not v_fila.activo then 'OK   ' else 'FALLA' end);

  v_n := 0;
  begin perform public.guardar_plan(null, 'empresa pro', 'empresa', 1, 1, 1, true); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'nombre_repetido' then v_n := v_n + 1; end if; end;
  begin perform public.guardar_plan(null, 'Con IA', 'consultor', 1, 1, 5, true); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.guardar_plan(null, 'Caro', 'empresa', 100000001, 1, 1, true); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.guardar_plan(null, 'Muchos', 'empresa', 1, 1, 1001, true); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.guardar_plan(null, 'Negativo', 'empresa', -1, 1, 1, true); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.guardar_plan(null, '   ', 'empresa', 1, 1, 1, true); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.guardar_plan(v_trial, 'Trial', 'empresa', 1000, 0, 3, true, 7); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'trial_fijo' then v_n := v_n + 1; end if; end;
  begin perform public.guardar_plan(v_trial, 'Trial', 'empresa', 0, 0, 3, false, 7); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'trial_fijo' then v_n := v_n + 1; end if; end;
  begin perform public.guardar_plan(v_trial, 'Trial', 'empresa', 0, 0, 3, true, 61); exception when check_violation then v_n := v_n + 1; end;
  v_res := v_res || format(E'\n%s §9.28: nombre repetido, consultor con créditos (RN-28), topes y trial fijo -> %s de 9 rechazos',
    case when v_n = 9 then 'OK   ' else 'FALLA' end, v_n);

  -- El trial sí ajusta créditos y días.
  perform public.guardar_plan(v_trial, 'Trial', 'empresa', 0, 0, 4, true, 10);
  select * into v_fila from public.planes where id = v_trial;
  v_res := v_res || format(E'\n%s RF-37: el trial ajusta créditos y días sin migración',
    case when v_fila.creditos_ia_mensuales = 4 and v_fila.dias_trial = 10 then 'OK   ' else 'FALLA' end);
  perform public.guardar_plan(v_trial, 'Trial', 'empresa', 0, 0, 3, true, 7);

  -- RF-38: activar desde el trial. Empieza hoy, vence el último día del mes, cupo en cero.
  execute 'reset role';
  update public.suscripciones set creditos_usados_periodo = 2, creditos_extra = 4 where id = v_sus_e1;
  execute 'set local role authenticated';
  v_id := public.activar_suscripcion(v_e1, v_esencial, 'mensual', 89000, v_hoy);
  select * into v_fila from public.suscripciones where id = v_sus_e1;
  v_res := v_res || format(E'\n%s RF-38: activar convierte la fila del trial (misma suscripción), activa, mensual, hoy -> %s',
    case when v_id = v_sus_e1 and v_fila.estado = 'activa' and v_fila.plan_id = v_esencial and v_fila.modalidad = 'mensual'
              and v_fila.fecha_inicio = v_hoy and v_fila.fecha_vencimiento = (v_hoy + interval '1 month')::date - 1
              and v_fila.activada_por = v_ad then 'OK   ' else 'FALLA' end, v_fila.fecha_vencimiento);
  v_res := v_res || format(E'\n%s RN-18: el cupo del periodo arranca en cero y los paquetes se conservan (usados %s, extra %s)',
    case when v_fila.creditos_usados_periodo = 0 and v_fila.periodo_creditos_inicio = v_hoy and v_fila.creditos_extra = 4 then 'OK   ' else 'FALLA' end,
    v_fila.creditos_usados_periodo, v_fila.creditos_extra);
  select count(*) into v_n from public.suscripciones where usuario_id = v_e1;
  select * into v_fila from public.pagos_suscripcion where suscripcion_id = v_sus_e1;
  v_res := v_res || format(E'\n%s RF-38: una sola suscripción y el pago registrado con plan, modalidad y quién (%s filas)',
    case when v_n = 1 and v_fila.monto = 89000 and v_fila.concepto = 'suscripcion' and v_fila.plan_id = v_esencial
              and v_fila.modalidad = 'mensual' and v_fila.registrado_por = v_ad and v_fila.medio = 'manual' then 'OK   ' else 'FALLA' end, v_n);

  begin perform public.guardar_plan(v_esencial, 'Empresa Esencial', 'consultor', 89000, 890000, 0, true);
    v_ok := false;
  exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; v_ok := v_msg = 'plan_en_uso'; end;
  v_res := v_res || format(E'\n%s §9.28: un plan con suscripciones no cambia de rol', case when v_ok then 'OK   ' else 'FALLA' end);

  -- Renovación anticipada: corre el vencimiento, no toca el cupo.
  execute 'reset role';
  update public.suscripciones set creditos_usados_periodo = 5 where id = v_sus_e1;
  execute 'set local role authenticated';
  perform public.activar_suscripcion(v_e1, v_esencial, 'mensual', 89000, v_hoy);
  select * into v_fila from public.suscripciones where id = v_sus_e1;
  v_res := v_res || format(E'\n%s CU-29: renovar antes de vencer corre un mes el vencimiento (%s) y conserva el cupo usado (%s)',
    case when v_fila.fecha_vencimiento = ((((v_hoy + interval '1 month')::date - 1) + 1) + interval '1 month')::date - 1
              and v_fila.creditos_usados_periodo = 5 and v_fila.fecha_inicio = v_hoy then 'OK   ' else 'FALLA' end,
    v_fila.fecha_vencimiento, v_fila.creditos_usados_periodo);

  -- Cambio a anual de otro plan: periodo nuevo de 12 meses y cupo en cero.
  perform public.activar_suscripcion(v_e1, v_pro, 'anual', 1890000, v_hoy - 2);
  select * into v_fila from public.suscripciones where id = v_sus_e1;
  v_res := v_res || format(E'\n%s RF-38: cambiar a Pro anual empieza hoy, vence en 12 meses (%s) y reinicia el cupo',
    case when v_fila.plan_id = v_pro and v_fila.modalidad = 'anual' and v_fila.fecha_inicio = v_hoy
              and v_fila.fecha_vencimiento = (v_hoy + interval '12 months')::date - 1 and v_fila.creditos_usados_periodo = 0 then 'OK   ' else 'FALLA' end,
    v_fila.fecha_vencimiento);
  select count(*) into v_n from public.pagos_suscripcion where suscripcion_id = v_sus_e1;
  v_res := v_res || format(E'\n%s CU-30: el historial guarda los tres pagos (%s)', case when v_n = 3 then 'OK   ' else 'FALLA' end, v_n);

  -- Rechazos de la activación.
  v_n := 0;
  begin perform public.activar_suscripcion(v_e2, v_cons, 'mensual', 69000, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plan_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_e2, v_trial, 'mensual', 1, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plan_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_e2, v_nuevo, 'mensual', 1, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plan_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_c2, v_cons, 'mensual', 69000, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'consultor_no_aprobado' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_ad, v_pro, 'mensual', 1, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'cuenta_invalida' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_e2, v_pro, 'trial', 1, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_e2, v_pro, 'mensual', 0, v_hoy); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.activar_suscripcion(v_e2, v_pro, 'mensual', 1, v_hoy + 1); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  v_res := v_res || format(E'\n%s RF-38: plan de otro rol, trial, inactivo, consultor sin aprobar, admin, modalidad, monto 0 y fecha futura -> %s de 8 rechazos',
    case when v_n = 8 then 'OK   ' else 'FALLA' end, v_n);

  -- El consultor aprobado sin fila: se crea la suya, sin créditos.
  v_sus_c1 := public.activar_suscripcion(v_c1, v_cons, 'mensual', 69000, v_hoy);
  select * into v_fila from public.suscripciones where id = v_sus_c1;
  v_res := v_res || format(E'\n%s CU-28: el consultor aprobado queda activo con su plan',
    case when v_fila.usuario_id = v_c1 and v_fila.estado = 'activa' and v_fila.plan_id = v_cons then 'OK   ' else 'FALLA' end);

  -- RF-51: paquetes.
  perform public.otorgar_creditos_extra(v_sus_e1, 10, 39000);
  perform public.otorgar_creditos_extra(v_sus_e1, 2, 0);
  select creditos_extra into v_n from public.suscripciones where id = v_sus_e1;
  v_ok := exists (select 1 from public.pagos_suscripcion where suscripcion_id = v_sus_e1 and concepto = 'paquete' and creditos = 10 and monto = 39000)
          and exists (select 1 from public.pagos_suscripcion where suscripcion_id = v_sus_e1 and concepto = 'paquete' and creditos = 2 and monto = 0);
  v_res := v_res || format(E'\n%s RF-51: dos paquetes (uno de cortesía) suman a los extra (4 + 12 = %s) y quedan en el historial',
    case when v_n = 16 and v_ok then 'OK   ' else 'FALLA' end, v_n);
  v_n := 0;
  begin perform public.otorgar_creditos_extra(v_sus_c1, 10, 0); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'consultor_sin_creditos' then v_n := v_n + 1; end if; end;
  begin perform public.otorgar_creditos_extra(v_sus_e1, 0, 0); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.otorgar_creditos_extra(v_sus_e1, 101, 0); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.otorgar_creditos_extra(v_sus_e1, 5, -1); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'dato_invalido' then v_n := v_n + 1; end if; end;
  begin perform public.otorgar_creditos_extra(gen_random_uuid(), 5, 0); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'suscripcion_no_existe' then v_n := v_n + 1; end if; end;
  v_res := v_res || format(E'\n%s RN-28/RF-51: consultor, 0, 101, monto negativo e inexistente -> %s de 5 rechazos',
    case when v_n = 5 then 'OK   ' else 'FALLA' end, v_n);

  -- RF-42: cuentas y tablero.
  select count(*) into v_n from public.cuentas_suscripcion_admin() where usuario_id in (v_e1, v_e2, v_c1, v_c2, v_ad);
  select * into v_fila from public.cuentas_suscripcion_admin() where usuario_id = v_e1;
  v_res := v_res || format(E'\n%s RF-42: las cuentas traen empresas y el consultor aprobado, no el que no lo está ni el admin (%s de 3), con nombre, correo y cupo',
    case when v_n = 3 and v_fila.nombre = 'Empresa Uno' and v_fila.correo = 'se1@prueba.co' and v_fila.plan_nombre = 'Empresa Pro'
              and v_fila.creditos_incluidos = 30 and v_fila.creditos_extra = 16 then 'OK   ' else 'FALLA' end, v_n);
  select * into v_fila from public.tablero_suscripciones();
  v_res := v_res || format(E'\n%s RF-42: el tablero cuenta por estado (activas %s, trial %s) y trae el consumo del mes',
    case when v_fila.activas >= 2 and v_fila.trial >= 1 and v_fila.costo_usd is not null then 'OK   ' else 'FALLA' end,
    v_fila.activas, v_fila.trial);

  -- CU-31 paso 4: suspender. El consultor pierde sus encargos en curso (RN-29).
  v_n := public.suspender_suscripcion(v_sus_c1);
  execute 'reset role';
  select count(*) into v_filas from public.encargos where consultor_id = v_c1 and estado = 'cancelado'
     and motivo_cancelacion = 'Suscripción del consultor suspendida';
  v_res := v_res || format(E'\n%s RN-29: suspender al consultor cancela su encargo en curso (%s) y no el completado',
    case when v_n = 1 and v_filas = 1 and (select count(*) from public.encargos where consultor_id = v_c1 and estado = 'completado') = 1 then 'OK   ' else 'FALLA' end, v_n);
  v_ok := privado.tiene_suscripcion_vigente(v_c1);
  v_res := v_res || format(E'\n%s RF-40: suspendida no da acceso', case when not v_ok then 'OK   ' else 'FALLA' end);
  execute 'set local role authenticated';
  begin perform public.suspender_suscripcion(v_sus_c1); v_ok := false; exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; v_ok := v_msg = 'estado_invalido'; end;
  v_res := v_res || format(E'\n%s CU-31: no se suspende dos veces', case when v_ok then 'OK   ' else 'FALLA' end);
  -- Se sale de la suspensión con una nueva activación.
  perform public.activar_suscripcion(v_c1, v_cons, 'mensual', 69000, v_hoy);
  select estado into v_msg from public.suscripciones where id = v_sus_c1;
  v_res := v_res || format(E'\n%s CU-31: una nueva activación levanta la suspensión (%s)', case when v_msg = 'activa' then 'OK   ' else 'FALLA' end, v_msg);
  execute 'reset role';

  -- ---------------------------------------------------------------- job 3 con la fecha de Colombia
  update public.suscripciones set periodo_creditos_inicio = (v_hoy - interval '1 month')::date - 3, creditos_usados_periodo = 7 where id = v_sus_e1;
  update public.suscripciones set periodo_creditos_inicio = v_hoy - 10, creditos_usados_periodo = 1 where usuario_id = v_e2;
  perform privado.reiniciar_creditos();
  select * into v_fila from public.suscripciones where id = v_sus_e1;
  v_ok := (select creditos_usados_periodo from public.suscripciones where usuario_id = v_e2) = 1;
  v_res := v_res || format(E'\n%s RN-18: el job 3 reinicia el periodo cumplido (inicio %s, usados %s, extra intactos %s) y no el que no',
    case when v_fila.creditos_usados_periodo = 0 and v_fila.periodo_creditos_inicio = (v_hoy - interval '3 days')::date
              and v_fila.creditos_extra = 16 and v_ok then 'OK   ' else 'FALLA' end,
    v_fila.periodo_creditos_inicio, v_fila.creditos_usados_periodo, v_fila.creditos_extra);
  select count(*) into v_n from cron.job where jobname = 'reiniciar-creditos-ia' and command = 'select privado.reiniciar_creditos();';
  v_res := v_res || format(E'\n%s RN-18: el job programado llama a la función', case when v_n = 1 then 'OK   ' else 'FALLA' end);

  raise exception 'RESULTADO%', v_res;
end;
$$;
