-- CU-37 · Versiones de la plantilla de generación (docs/05 §9.27).
-- Sesión 027, Sprint 5. RF-63, RNF-11, RNF-28.
--
--   npx supabase db query --linked -f supabase/tests/plantillas_generacion.sql
--
-- Termina SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice
-- OK o FALLA.
do $$
declare
  v_res text := '';
  v_ad uuid := '00000000-0000-0000-0000-0000000027ad';
  v_e1 uuid := '00000000-0000-0000-0000-0000000027e1';
  v_c1 uuid := '00000000-0000-0000-0000-0000000027c1';
  v_texto text := repeat('Instrucción de prueba. ', 12);
  v_v1 uuid; v_nueva uuid; v_otra uuid;
  v_quien text;
  v_msg text;
  v_n int;
  v_fila record;
  v_ok boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_ad, 'pad@prueba.co', '{"rol": "empresa", "nombre": "Admin"}'),
    (v_e1, 'pe1@prueba.co', '{"rol": "empresa", "nombre": "Empresa", "nombre_empresa": "E", "consentimiento_datos": "true"}'),
    (v_c1, 'pc1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;
  select id into v_v1 from public.plantillas_generacion where activa;

  -- ---------------------------------------------------------------- quien no es admin con aal2
  foreach v_quien in array array['empresa', 'consultor', 'admin_aal1'] loop
    perform set_config('request.jwt.claims', json_build_object(
      'sub', case v_quien when 'empresa' then v_e1 when 'consultor' then v_c1 else v_ad end,
      'role', 'authenticated', 'aal', 'aal1')::text, true);
    execute 'set local role authenticated';
    v_n := 0;
    begin perform public.crear_version_plantilla(v_texto, 'gpt-5.4-mini', 0.75, 4.5, 60000); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.activar_plantilla(v_v1); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.estadisticas_plantillas(); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    execute 'reset role';
    v_res := v_res || format(E'\n%s RNF-28: %s no crea, no activa ni ve estadísticas -> %s de 3 rechazos',
      case when v_n = 3 then 'OK   ' else 'FALLA' end, v_quien, v_n);
  end loop;

  -- La empresa y el consultor tampoco leen el prompt.
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.plantillas_generacion;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-63: la empresa no lee ninguna plantilla (%s)', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- administrador con aal2
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.plantillas_generacion;
  v_res := v_res || format(E'\n%s CU-37: el administrador lee las versiones (%s)', case when v_n >= 1 then 'OK   ' else 'FALLA' end, v_n);

  -- Ya no escribe directo en la tabla.
  v_ok := false;
  begin
    insert into public.plantillas_generacion (nombre, version, contenido) values ('Documento base de postulación', 999, v_texto);
  exception when insufficient_privilege then v_ok := true; when others then v_ok := sqlstate = '42501'; end;
  v_res := v_res || format(E'\n%s §9.27: sin insertar directo', case when v_ok then 'OK   ' else 'FALLA' end);
  update public.plantillas_generacion set activa = false where id = v_v1;
  get diagnostics v_n = row_count;
  v_res := v_res || format(E'\n%s §9.27: sin actualizar directo (%s filas)', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- Crear: versión siguiente, inactiva, con su autor.
  v_nueva := public.crear_version_plantilla(v_texto, 'gpt-5.4', 1.25, 10, 80000);
  select * into v_fila from public.plantillas_generacion where id = v_nueva;
  v_res := v_res || format(E'\n%s CU-37 paso 2: nueva versión %s, inactiva, con autor y su modelo',
    case when v_fila.version = (select max(version) from public.plantillas_generacion) and not v_fila.activa
              and v_fila.creada_por = v_ad and v_fila.modelo = 'gpt-5.4' and v_fila.tope_caracteres_tdr = 80000
              and v_fila.nombre = 'Documento base de postulación' then 'OK   ' else 'FALLA' end, v_fila.version);
  select activa into v_ok from public.plantillas_generacion where id = v_v1;
  v_res := v_res || format(E'\n%s CU-37: crear no cambia la activa', case when v_ok then 'OK   ' else 'FALLA' end);

  -- Topes de la base.
  v_n := 0;
  begin perform public.crear_version_plantilla('corta', 'gpt-5.4-mini', 0.75, 4.5, 60000); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.crear_version_plantilla(v_texto, 'GPT 5; drop', 0.75, 4.5, 60000); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.crear_version_plantilla(v_texto, 'gpt-5.4-mini', -1, 4.5, 60000); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.crear_version_plantilla(v_texto, 'gpt-5.4-mini', 0.75, 5000, 60000); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.crear_version_plantilla(v_texto, 'gpt-5.4-mini', 0.75, 4.5, 500); exception when check_violation then v_n := v_n + 1; end;
  begin perform public.crear_version_plantilla(repeat('x', 50001), 'gpt-5.4-mini', 0.75, 4.5, 60000); exception when check_violation then v_n := v_n + 1; end;
  v_res := v_res || format(E'\n%s §9.27: topes de contenido, modelo, precios y TDR -> %s de 6 rechazos', case when v_n = 6 then 'OK   ' else 'FALLA' end, v_n);

  -- Activar: exactamente una activa, con quién y cuándo.
  perform public.activar_plantilla(v_nueva);
  select count(*) into v_n from public.plantillas_generacion where activa;
  select * into v_fila from public.plantillas_generacion where id = v_nueva;
  v_res := v_res || format(E'\n%s CU-37 paso 3: activa la nueva, una sola activa, con activada_por y activada_at',
    case when v_n = 1 and v_fila.activa and v_fila.activada_por = v_ad and v_fila.activada_at is not null then 'OK   ' else 'FALLA' end);
  perform public.activar_plantilla(v_v1);
  select count(*) into v_n from public.plantillas_generacion where activa and id = v_v1;
  v_res := v_res || format(E'\n%s CU-37: se puede volver a una versión anterior', case when v_n = 1 then 'OK   ' else 'FALLA' end);
  v_ok := false;
  begin perform public.activar_plantilla('00000000-0000-0000-0000-000000000000'); exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; v_ok := v_msg = 'plantilla_no_existe'; end;
  select count(*) into v_n from public.plantillas_generacion where activa;
  v_res := v_res || format(E'\n%s CU-37: activar una que no existe -> plantilla_no_existe, y sigue una activa (%s)',
    case when v_ok and v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  -- Estadísticas por versión.
  select count(*) into v_n from public.estadisticas_plantillas();
  select * into v_fila from public.estadisticas_plantillas() where plantilla_id = v_nueva;
  v_res := v_res || format(E'\n%s CU-37 paso 4: estadísticas de cada versión (%s), la nueva en cero',
    case when v_n = (select count(*) from public.plantillas_generacion) and v_fila.documentos = 0
              and v_fila.generaciones_exitosas = 0 then 'OK   ' else 'FALLA' end, v_n);
  execute 'reset role';

  -- ---------------------------------------------------------------- inmutable, también para service_role
  v_n := 0;
  begin update public.plantillas_generacion set contenido = v_texto || '!' where id = v_v1; exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plantilla_inmutable' then v_n := v_n + 1; end if; end;
  begin update public.plantillas_generacion set modelo = 'otro' where id = v_v1; exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plantilla_inmutable' then v_n := v_n + 1; end if; end;
  begin update public.plantillas_generacion set version = 99 where id = v_v1; exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plantilla_inmutable' then v_n := v_n + 1; end if; end;
  begin update public.plantillas_generacion set precio_salida_usd_mtok = 1 where id = v_v1; exception when others then
    get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'plantilla_inmutable' then v_n := v_n + 1; end if; end;
  v_res := v_res || format(E'\n%s RF-63: una versión no cambia de contenido, modelo, número ni precio (%s de 4), ni con service_role',
    case when v_n = 4 then 'OK   ' else 'FALLA' end, v_n);

  -- Una versión usada por la generación conserva el dato: se reserva con la activa.
  select count(*) into v_n from public.plantillas_generacion where activa and id = v_v1;
  v_res := v_res || format(E'\n%s §9.27: la v1 sigue activa al final', case when v_n = 1 then 'OK   ' else 'FALLA' end);

  raise exception 'RESULTADO%', v_res;
end;
$$;
