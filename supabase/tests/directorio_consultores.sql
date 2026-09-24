-- RF-26, RF-27, RF-80 · Directorio y contacto tras la aceptación
-- (docs/05 §9.22). Sesión 022, Sprint 4 paso 1c.
--
--   npx supabase db query --linked -f supabase/tests/directorio_consultores.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`. Termina
-- SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice OK o
-- FALLA.
do $$
declare
  v_res text := '';
  v_c1 uuid := '00000000-0000-0000-0000-0000000023c1';  -- aprobado, externo
  v_c2 uuid := '00000000-0000-0000-0000-0000000023c2';  -- aprobado, equipo interno
  v_c3 uuid := '00000000-0000-0000-0000-0000000023c3';  -- suspendido
  v_e1 uuid := '00000000-0000-0000-0000-0000000023e1';  -- empresa con encargo
  v_e2 uuid := '00000000-0000-0000-0000-0000000023e2';  -- otra empresa
  v_pr uuid := '00000000-0000-0000-0000-0000000023b1';
  v_en uuid := '00000000-0000-0000-0000-0000000023a1';
  v_n int;
  v_b boolean;
  v_obtenido text;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_c1, 'dc1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}'),
    (v_c2, 'dc2@prueba.co', '{"rol": "consultor", "nombre": "Dos", "consentimiento_datos": "true"}'),
    (v_c3, 'dc3@prueba.co', '{"rol": "consultor", "nombre": "Tres", "consentimiento_datos": "true"}'),
    (v_e1, 'de1@prueba.co', '{"rol": "empresa", "nombre": "E1", "nombre_empresa": "E1", "consentimiento_datos": "true"}'),
    (v_e2, 'de2@prueba.co', '{"rol": "empresa", "nombre": "E2", "nombre_empresa": "E2", "consentimiento_datos": "true"}');

  update public.consultor_perfiles
  set nombre_profesional = 'Consultor', descripcion = 'Formulo proyectos', sitio_web = 'https://uno.co',
      foto_path = id::text || '/foto-a.png', cv_path = id::text || '/cv-a.pdf', estado_perfil = 'aprobado'
  where id in (v_c1, v_c2, v_c3);
  update public.consultor_perfiles set es_equipo_interno = true where id = v_c2;
  update public.consultor_perfiles set estado_perfil = 'suspendido', motivo_suspension = 'x', suspendido_at = now() where id = v_c3;
  insert into public.consultor_redes (consultor_id, tipo, url) values (v_c1, 'linkedin', 'https://linkedin.com/in/uno');

  insert into public.proyectos (id, usuario_id, nombre) values (v_pr, v_e1, 'Proyecto 023');
  insert into public.encargos (id, proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda)
  values (v_en, v_pr, v_e1, v_c1, 'Tarea', 'directorio', 'pendiente', 'buscar_convocatoria');

  -- ---------------------------------------------------------------- E1 con la solicitud pendiente
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.consultor_perfiles
  where id in (v_c1, v_c2, v_c3) and estado_perfil = 'aprobado' and not es_equipo_interno;
  v_res := v_res || format(E'\n%s RF-26: el directorio es solo el aprobado externo -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  select count(*) into v_n from public.contacto_consultor(v_c1);
  v_res := v_res || format(E'\n%s RF-80: con la solicitud pendiente no hay sitio web ni hoja de vida -> %s filas',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.consultor_redes where consultor_id = v_c1;
  v_res := v_res || format(E'\n%s RF-80: ni redes -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  v_b := privado.cv_visible_para_empresa(v_c1::text || '/cv-a.pdf');
  v_res := v_res || format(E'\n%s RF-80: ni la hoja de vida en Storage -> %s',
    case when not v_b then 'OK   ' else 'FALLA' end, v_b);

  v_b := privado.foto_visible_para_empresa(v_c1::text || '/foto-a.png');
  v_res := v_res || format(E'\n%s §9.22: la foto vigente de un aprobado sí se firma -> %s',
    case when v_b then 'OK   ' else 'FALLA' end, v_b);
  v_b := privado.foto_visible_para_empresa(v_c1::text || '/foto-vieja.png');
  v_res := v_res || format(E'\n%s §9.22: una foto que no es la vigente, no -> %s',
    case when not v_b then 'OK   ' else 'FALLA' end, v_b);
  v_b := privado.foto_visible_para_empresa(v_c3::text || '/foto-a.png');
  v_res := v_res || format(E'\n%s §9.22: la de un suspendido, no -> %s',
    case when not v_b then 'OK   ' else 'FALLA' end, v_b);
  execute 'reset role';

  -- ---------------------------------------------------------------- el consultor acepta
  update public.encargos set estado = 'en_curso', aceptado_at = now() where id = v_en;

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select sitio_web into v_obtenido from public.contacto_consultor(v_c1);
  v_res := v_res || format(E'\n%s RF-80: con el encargo en curso ve el sitio web -> %s',
    case when v_obtenido = 'https://uno.co' then 'OK   ' else 'FALLA' end, v_obtenido);
  select count(*) into v_n from public.consultor_redes where consultor_id = v_c1;
  v_res := v_res || format(E'\n%s RF-80: y las redes -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);
  v_b := privado.cv_visible_para_empresa(v_c1::text || '/cv-a.pdf');
  v_res := v_res || format(E'\n%s RF-80: y la hoja de vida vigente en Storage -> %s',
    case when v_b then 'OK   ' else 'FALLA' end, v_b);
  v_b := privado.cv_visible_para_empresa(v_c1::text || '/cv-vieja.pdf');
  v_res := v_res || format(E'\n%s RF-80: pero no una hoja de vida anterior -> %s',
    case when not v_b then 'OK   ' else 'FALLA' end, v_b);
  execute 'reset role';

  -- ---------------------------------------------------------------- otra empresa
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.contacto_consultor(v_c1);
  select count(*) + v_n into v_n from public.consultor_redes where consultor_id = v_c1;
  v_b := privado.cv_visible_para_empresa(v_c1::text || '/cv-a.pdf');
  v_res := v_res || format(E'\n%s RF-80: otra empresa no ve nada por el encargo ajeno -> %s filas, cv %s',
    case when v_n = 0 and not v_b then 'OK   ' else 'FALLA' end, v_n, v_b);
  execute 'reset role';

  -- El consultor no firma fotos ajenas por la regla de la empresa.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c3, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_b := privado.foto_visible_para_empresa(v_c1::text || '/foto-a.png');
  execute 'reset role';
  v_res := v_res || format(E'\n%s §9.22: la regla de la foto es solo para empresas -> %s',
    case when not v_b then 'OK   ' else 'FALLA' end, v_b);

  -- ---------------------------------------------------------------- se completa
  update public.encargos set estado = 'completado', completado_at = now() where id = v_en;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.contacto_consultor(v_c1);
  select count(*) + v_n into v_n from public.consultor_redes where consultor_id = v_c1;
  v_b := privado.cv_visible_para_empresa(v_c1::text || '/cv-a.pdf');
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-80: al completarse, el contacto se vuelve a ocultar -> %s filas, cv %s',
    case when v_n = 0 and not v_b then 'OK   ' else 'FALLA' end, v_n, v_b);

  raise exception 'RESULTADO%', v_res;
end;
$$;
