-- RF-22, RF-23, RF-24, RF-25, RF-88 · Perfil del consultor: consentimiento,
-- guardado, rutas de archivo y envío a revisión (docs/05 §9.20). Sesión 021,
-- Sprint 4 paso 1a.
--
--   npx supabase db query --linked -f supabase/tests/perfil_consultor.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`, así que la
-- RLS decide de verdad. Termina SIEMPRE con un error "RESULTADO …" que revierte
-- todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_c1 uuid := '00000000-0000-0000-0000-0000000021c1';  -- consultor con consentimiento
  v_c2 uuid := '00000000-0000-0000-0000-0000000021c2';  -- consultor sin consentimiento
  v_e1 uuid := '00000000-0000-0000-0000-0000000021e1';  -- empresa
  v_cat1 uuid;
  v_cat2 uuid;
  v_inactiva uuid := '00000000-0000-0000-0000-00000002100a';
  v_obtenido text;
  v_msg text;
  v_n int;
  v_fecha timestamptz;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_c1, 'pc1@prueba.co', '{"rol": "consultor", "nombre": "Consultora uno", "consentimiento_datos": "true"}'),
    (v_c2, 'pc2@prueba.co', '{"rol": "consultor", "nombre": "Consultor dos"}'),
    (v_e1, 'pe1@prueba.co', '{"rol": "empresa", "nombre": "Empresa", "nombre_empresa": "E", "consentimiento_datos": "true"}');

  select id into v_cat1 from public.categorias where activa order by nombre limit 1;
  select id into v_cat2 from public.categorias where activa order by nombre offset 1 limit 1;
  insert into public.categorias (id, tipo, nombre, activa) values (v_inactiva, 'sector', 'Prueba 021 inactiva', false);

  -- ---------------------------------------------------------------- registro (RF-88)
  select consentimiento_datos_at into v_fecha from public.perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-88: el registro con la casilla guarda la fecha -> %s',
    case when v_fecha is not null then 'OK   ' else 'FALLA' end, v_fecha is not null);
  select consentimiento_datos_at into v_fecha from public.perfiles where id = v_c2;
  v_res := v_res || format(E'\n%s RF-88: sin la casilla nace sin fecha -> %s',
    case when v_fecha is null then 'OK   ' else 'FALLA' end, v_fecha is null);

  -- ---------------------------------------------------------------- C2 sin consentimiento
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Dos"}', '{}', '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-88: guardar sin consentimiento se rechaza -> %s %s',
    case when v_obtenido = '42501' and v_msg = 'sin_consentimiento' then 'OK   ' else 'FALLA' end, v_obtenido, v_msg);

  begin
    update public.perfiles set consentimiento_datos_at = now() where id = v_c2;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s RF-88: el cliente no escribe la fecha directamente -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.aceptar_consentimiento_datos();
  select consentimiento_datos_at into v_fecha from public.perfiles where id = v_c2;
  v_res := v_res || format(E'\n%s RF-88: aceptar_consentimiento_datos() la fija -> %s',
    case when v_fecha is not null then 'OK   ' else 'FALLA' end, v_fecha is not null);

  execute 'reset role';

  -- ---------------------------------------------------------------- C1 guarda
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  perform public.guardar_perfil_consultor(
    '{"nombre_profesional": " Consultora Uno ", "descripcion": "Formulo proyectos", "sitio_web": "https://uno.co"}',
    array[v_cat1, v_cat1],
    '[{"tipo": "linkedin", "url": "https://linkedin.com/in/uno"}]',
    '[{"nombre_proyecto": "A", "entidad": "MinCiencias", "anio": 2024}, {"nombre_proyecto": "B"}]');
  select count(*) into v_n from public.consultor_especialidades where consultor_id = v_c1;
  select nombre_profesional into v_obtenido from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-23: guarda datos y especialidades sin duplicar -> "%s", %s especialidad',
    case when v_obtenido = 'Consultora Uno' and v_n = 1 then 'OK   ' else 'FALLA' end, v_obtenido, v_n);

  select count(*) into v_n from public.consultor_portafolio where consultor_id = v_c1;
  select string_agg(nombre_proyecto || ':' || orden, ',' order by orden) into v_obtenido
    from public.consultor_portafolio where consultor_id = v_c1;
  v_res := v_res || format(E'\n%s portafolio en orden y redes guardadas -> %s',
    case when v_obtenido = 'A:0,B:1' and (select count(*) from public.consultor_redes where consultor_id = v_c1) = 1
      then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.guardar_perfil_consultor('{"nombre_profesional": "Consultora Uno", "descripcion": "Formulo proyectos"}',
    array[v_cat2], '[]', '[{"nombre_proyecto": "C"}]');
  select count(*) into v_n from public.consultor_portafolio where consultor_id = v_c1;
  v_res := v_res || format(E'\n%s guardar reemplaza especialidades, redes y portafolio -> %s ítem, %s redes, cat2 %s',
    case when v_n = 1 and (select count(*) from public.consultor_redes where consultor_id = v_c1) = 0
      and exists (select 1 from public.consultor_especialidades where consultor_id = v_c1 and categoria_id = v_cat2)
      then 'OK   ' else 'FALLA' end, v_n,
    (select count(*) from public.consultor_redes where consultor_id = v_c1),
    exists (select 1 from public.consultor_especialidades where consultor_id = v_c1 and categoria_id = v_cat2));

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "   "}', '{}', '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-16 1b: nombre vacío se rechaza -> %s %s',
    case when v_msg = 'nombre_vacio' then 'OK   ' else 'FALLA' end, v_obtenido, v_msg);

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Uno"}', array[v_inactiva], '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s una categoría inactiva no entra como especialidad nueva -> %s %s',
    case when v_msg = 'categoria_invalida' then 'OK   ' else 'FALLA' end, v_obtenido, v_msg);

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Uno", "sitio_web": "no es url"}', '{}', '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s un sitio web mal formado lo rechaza la base -> %s',
    case when v_obtenido = '23514' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- rutas de archivo (RN-12)
  begin
    update public.consultor_perfiles set cv_path = v_c2::text || '/hoja-de-vida-x.pdf' where id = v_c1;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s RN-12: la hoja de vida no puede apuntar a la carpeta de otro -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- enviar a revisión
  begin
    perform public.enviar_perfil_a_revision();
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = message_text; end;
  v_res := v_res || format(E'\n%s CU-17: sin foto ni hoja de vida se rechaza enumerando lo que falta -> %s',
    case when v_msg like '%la foto%' and v_msg like '%la hoja de vida%' and v_msg not like '%descripción%' then 'OK   ' else 'FALLA' end, v_msg);

  -- Rutas propias, pero sin objeto en Storage: el envío tampoco pasa.
  update public.consultor_perfiles
  set foto_path = v_c1::text || '/foto-a.png', cv_path = v_c1::text || '/hoja-de-vida-a.pdf'
  where id = v_c1;
  begin
    perform public.enviar_perfil_a_revision();
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = message_text; end;
  v_res := v_res || format(E'\n%s CU-17: con rutas escritas pero sin archivo en Storage se rechaza -> %s',
    case when v_obtenido = '23514' and v_msg like '%la foto%' then 'OK   ' else 'FALLA' end, v_msg);

  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner_id) values
    ('fotos-consultores', v_c1::text || '/foto-a.png', v_c1::text),
    ('hojas-de-vida', v_c1::text || '/hoja-de-vida-a.pdf', v_c1::text);
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  begin
    update public.consultor_perfiles set estado_perfil = 'en_revision' where id = v_c1;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s el cliente no se pone en revisión él mismo -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.enviar_perfil_a_revision();
  select estado_perfil into v_obtenido from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-24: con los mínimos pasa a en_revision -> %s',
    case when v_obtenido = 'en_revision' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.enviar_perfil_a_revision();
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s enviar otra vez desde en_revision se rechaza -> %s',
    case when v_msg = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_msg);

  -- CU-16 1a: en revisión no se vacían los mínimos; lo demás sí se edita.
  begin
    update public.consultor_perfiles set cv_path = null where id = v_c1;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-16 1a: en revisión no se quita la hoja de vida -> %s',
    case when v_msg = 'minimos_incompletos' then 'OK   ' else 'FALLA' end, v_msg);

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Uno", "descripcion": "x"}', '{}', '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-16 1a: en revisión no se quitan todas las especialidades -> %s',
    case when v_msg = 'minimos_incompletos' then 'OK   ' else 'FALLA' end, v_msg);

  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Uno"}', array[v_cat2], '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-16 1a: en revisión no se vacía la descripción -> %s',
    case when v_msg = 'minimos_incompletos' then 'OK   ' else 'FALLA' end, v_msg);

  perform public.guardar_perfil_consultor('{"nombre_profesional": "Uno", "descripcion": "Nueva descripción"}',
    array[v_cat2], '[{"tipo": "otra", "url": "https://uno.co/blog"}]', '[]');
  select descripcion into v_obtenido from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s CU-16: en revisión se edita sin perder el estado -> %s',
    case when v_obtenido = 'Nueva descripción'
      and (select estado_perfil from public.consultor_perfiles where id = v_c1) = 'en_revision' then 'OK   ' else 'FALLA' end, v_obtenido);

  execute 'reset role';

  -- Rechazado → reenvía (RF-25, CU-17 3a). El motivo se conserva.
  update public.consultor_perfiles set estado_perfil = 'rechazado', motivo_rechazo = 'Falta el portafolio' where id = v_c1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.enviar_perfil_a_revision();
  select estado_perfil || ' / ' || coalesce(motivo_rechazo, '-') into v_obtenido from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-25: rechazado reenvía y el motivo anterior se conserva -> %s',
    case when v_obtenido = 'en_revision / Falta el portafolio' then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  -- ---------------------------------------------------------------- otros roles
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.guardar_perfil_consultor('{"nombre_profesional": "Intruso"}', '{}', '[]', '[]');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s una empresa no guarda perfil de consultor -> %s',
    case when v_msg = 'no_es_consultor' then 'OK   ' else 'FALLA' end, v_msg);
  begin
    perform public.enviar_perfil_a_revision();
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; get stacked diagnostics v_msg = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s una empresa no envía a revisión -> %s',
    case when v_msg = 'no_es_consultor' then 'OK   ' else 'FALLA' end, v_msg);

  -- La empresa no lee el sitio web ni la hoja de vida de un consultor sin solicitud (RN-12).
  begin
    perform cv_path from public.consultor_perfiles where id = v_c1;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s RN-12: la empresa no lee cv_path directamente -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  raise exception 'RESULTADO (se revierte todo):%', v_res;
end $$;
