-- RF-34, RF-35, RN-13, RN-29 · Revisión, suspensión y reactivación de
-- consultores (docs/05 §9.21). Sesión 022, Sprint 4 paso 1b.
--
--   npx supabase db query --linked -f supabase/tests/revision_consultores.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`, así que la
-- RLS y los permisos deciden de verdad. Termina SIEMPRE con un error
-- "RESULTADO …" que revierte todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_ad  uuid := '00000000-0000-0000-0000-0000000022ad';  -- administrador
  v_c1  uuid := '00000000-0000-0000-0000-0000000022c1';  -- consultor en revisión
  v_c2  uuid := '00000000-0000-0000-0000-0000000022c2';  -- consultor aprobado con encargos
  v_e1  uuid := '00000000-0000-0000-0000-0000000022e1';  -- empresa
  v_pr  uuid := '00000000-0000-0000-0000-0000000022b1';
  v_cat uuid;
  v_obtenido text;
  v_msg text;
  v_n int;
  v_fila record;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_ad, 'rad@prueba.co', '{"rol": "empresa", "nombre": "Admin"}'),
    (v_c1, 'rc1@prueba.co', '{"rol": "consultor", "nombre": "Uno", "consentimiento_datos": "true"}'),
    (v_c2, 'rc2@prueba.co', '{"rol": "consultor", "nombre": "Dos", "consentimiento_datos": "true"}'),
    (v_e1, 're1@prueba.co', '{"rol": "empresa", "nombre": "Empresa", "nombre_empresa": "E", "consentimiento_datos": "true"}');
  update public.perfiles set rol = 'administrador' where id = v_ad;

  select id into v_cat from public.categorias where activa order by nombre limit 1;
  update public.consultor_perfiles
  set nombre_profesional = 'Consultor', descripcion = 'Formulo proyectos',
      foto_path = id::text || '/foto.png', cv_path = id::text || '/cv.pdf'
  where id in (v_c1, v_c2);
  insert into public.consultor_especialidades values (v_c1, v_cat), (v_c2, v_cat);
  update public.consultor_perfiles set estado_perfil = 'en_revision' where id = v_c1;
  update public.consultor_perfiles set estado_perfil = 'aprobado' where id = v_c2;

  insert into public.proyectos (id, usuario_id, nombre) values (v_pr, v_e1, 'Proyecto 022');
  insert into public.encargos (id, proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda) values
    ('00000000-0000-0000-0000-0000000022a1', v_pr, v_e1, v_c2, 'En curso',   'directorio', 'en_curso',   'buscar_convocatoria'),
    ('00000000-0000-0000-0000-0000000022a2', v_pr, v_e1, v_c2, 'Pendiente',  'directorio', 'pendiente',  'buscar_convocatoria'),
    ('00000000-0000-0000-0000-0000000022a3', v_pr, v_e1, v_c2, 'Completado', 'directorio', 'completado', 'buscar_convocatoria'),
    ('00000000-0000-0000-0000-0000000022a4', v_pr, v_e1, v_c2, 'Rechazado',  'directorio', 'rechazado',  'buscar_convocatoria');
  insert into public.calificaciones (encargo_id, consultor_id, empresa_id, estrellas)
  values ('00000000-0000-0000-0000-0000000022a3', v_c2, v_e1, 4);

  -- ---------------------------------------------------------------- quien no es admin
  foreach v_obtenido in array array['consultor', 'empresa', 'admin_aal1'] loop
    perform set_config('request.jwt.claims', json_build_object(
      'sub', case v_obtenido when 'consultor' then v_c1 when 'empresa' then v_e1 else v_ad end,
      'role', 'authenticated', 'aal', 'aal1')::text, true);
    execute 'set local role authenticated';
    v_n := 0;
    begin perform public.revisar_perfil_consultor(v_c1, true); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.suspender_consultor(v_c2, 'x'); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    begin perform public.reactivar_consultor(v_c2); exception when others then
      get stacked diagnostics v_msg = pg_exception_hint; if v_msg = 'no_es_admin' then v_n := v_n + 1; end if; end;
    execute 'reset role';
    v_res := v_res || format(E'\n%s RF-34/35: %s no revisa, no suspende ni reactiva -> %s de 3 rechazos',
      case when v_n = 3 then 'OK   ' else 'FALLA' end, v_obtenido, v_n);
  end loop;

  -- ---------------------------------------------------------------- administrador con aal2
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  begin
    update public.consultor_perfiles set estado_perfil = 'aprobado' where id = v_c1;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s §9.21: ni el administrador cambia el estado con un update directo -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.revisar_perfil_consultor(v_c1, false, '   ');
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-13: rechazar sin motivo se rechaza -> %s',
    case when v_obtenido = 'motivo_vacio' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform public.revisar_perfil_consultor(v_c1, false, ' Falta el portafolio ');
  select estado_perfil, motivo_rechazo, revisado_por, revisado_at into v_fila from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-34: rechazar con motivo -> %s, "%s", revisor %s',
    case when v_fila.estado_perfil = 'rechazado' and v_fila.motivo_rechazo = 'Falta el portafolio'
              and v_fila.revisado_por = v_ad and v_fila.revisado_at is not null then 'OK   ' else 'FALLA' end,
    v_fila.estado_perfil, v_fila.motivo_rechazo, v_fila.revisado_por = v_ad);

  begin
    perform public.revisar_perfil_consultor(v_c1, true);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-25 3a: un perfil ya revisado no se vuelve a revisar -> %s',
    case when v_obtenido = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_obtenido);

  execute 'reset role';

  -- El consultor reenvía (RN-13: reenvíos sin límite) y el motivo se conserva.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.enviar_perfil_a_revision();
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlerrm; end;
  execute 'reset role';
  -- Sin objetos reales en Storage, el envío no pasa: se simula como postgres.
  update public.consultor_perfiles set estado_perfil = 'en_revision' where id = v_c1;
  select motivo_rechazo into v_obtenido from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RN-13: en el reenvío el administrador ve el motivo anterior -> "%s"',
    case when v_obtenido = 'Falta el portafolio' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';

  perform public.revisar_perfil_consultor(v_c1, true, 'se ignora');
  select estado_perfil, motivo_rechazo into v_fila from public.consultor_perfiles where id = v_c1;
  v_res := v_res || format(E'\n%s RF-34: aprobar deja aprobado y borra el motivo anterior -> %s, %s',
    case when v_fila.estado_perfil = 'aprobado' and v_fila.motivo_rechazo is null then 'OK   ' else 'FALLA' end,
    v_fila.estado_perfil, coalesce(v_fila.motivo_rechazo, 'null'));

  select count(*) into v_n from public.suscripciones where usuario_id = v_c1;
  v_res := v_res || format(E'\n%s RN-11 transitorio: aprobar no crea suscripción -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- suspender
  begin
    perform public.suspender_consultor(v_c2, '');
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-27: suspender sin motivo se rechaza -> %s',
    case when v_obtenido = 'motivo_vacio' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.reactivar_consultor(v_c2);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-27: no se reactiva un perfil aprobado -> %s',
    case when v_obtenido = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_obtenido);

  v_n := public.suspender_consultor(v_c2, ' Quejas reiteradas ');
  v_res := v_res || format(E'\n%s RN-29: suspender cancela en curso y pendiente -> %s cancelados',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  -- El administrador lee el motivo por la función, no por la columna (§9.21).
  select cp.estado_perfil, s.motivo_suspension, s.suspendido_at into v_fila
  from public.consultor_perfiles cp, public.suspension_consultor(cp.id) s where cp.id = v_c2;
  v_res := v_res || format(E'\n%s RF-35: queda suspendido con motivo y fecha -> %s, "%s"',
    case when v_fila.estado_perfil = 'suspendido' and v_fila.motivo_suspension = 'Quejas reiteradas'
              and v_fila.suspendido_at is not null then 'OK   ' else 'FALLA' end,
    v_fila.estado_perfil, v_fila.motivo_suspension);

  select count(*) into v_n from public.encargos
  where consultor_id = v_c2 and estado = 'cancelado'
    and motivo_cancelacion = 'Consultor suspendido por el administrador'
    and titulo_tarea in ('En curso', 'Pendiente');
  v_res := v_res || format(E'\n%s CU-27: los cancelados llevan el motivo fijo -> %s de 2',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  select string_agg(titulo_tarea || '=' || estado, ', ' order by titulo_tarea) into v_obtenido
  from public.encargos where consultor_id = v_c2 and titulo_tarea in ('Completado', 'Rechazado');
  v_res := v_res || format(E'\n%s RN-29: el historial no se altera -> %s',
    case when v_obtenido = 'Completado=calificado, Rechazado=rechazado' then 'OK   ' else 'FALLA' end, v_obtenido);

  select rating_promedio::text || '/' || total_encargos_completados into v_obtenido from public.consultor_perfiles where id = v_c2;
  v_res := v_res || format(E'\n%s RN-29: la calificación y las métricas se conservan -> %s',
    case when v_obtenido = '4.00/1' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.suspender_consultor(v_c2, 'otra vez');
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-27: no se suspende dos veces -> %s',
    case when v_obtenido = 'estado_no_permite' then 'OK   ' else 'FALLA' end, v_obtenido);

  select count(*) into v_n from public.suspension_consultor(v_c2);
  v_res := v_res || format(E'\n%s §9.21: el administrador lee el motivo -> %s fila',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  execute 'reset role';

  -- ---------------------------------------------------------------- quién ve el motivo
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select motivo_suspension into v_obtenido from public.suspension_consultor(v_c2);
  execute 'reset role';
  v_res := v_res || format(E'\n%s CU-27: el consultor ve su motivo -> "%s"',
    case when v_obtenido = 'Quejas reiteradas' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.suspension_consultor(v_c2);
  v_res := v_res || format(E'\n%s §9.21: la empresa no lee el motivo por la función -> %s filas',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  begin
    select motivo_suspension into v_obtenido from public.consultor_perfiles where id = v_c2;
    v_obtenido := 'leyó';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s §9.21: ni leyendo la columna directamente -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);
  select count(*) into v_n from public.consultor_perfiles where id = v_c2;
  v_res := v_res || format(E'\n%s RN-15: la empresa con encargos sigue viendo el perfil suspendido -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.consultor_perfiles where id = v_c2 and estado_perfil = 'aprobado';
  v_res := v_res || format(E'\n%s RN-08: suspendido no cuenta como aprobado (sale del directorio) -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  begin
    perform public.suspender_consultor(v_c1, 'x');
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-35: la empresa no suspende -> %s',
    case when v_obtenido = 'no_es_admin' then 'OK   ' else 'FALLA' end, v_obtenido);

  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    update public.consultor_perfiles set motivo_suspension = null where id = v_c2;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s §9.21: el consultor no borra su suspensión -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- reactivar
  perform set_config('request.jwt.claims', json_build_object('sub', v_ad, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.reactivar_consultor(v_c2);
  execute 'reset role';
  select estado_perfil, motivo_suspension, suspendido_at into v_fila from public.consultor_perfiles where id = v_c2;
  v_res := v_res || format(E'\n%s RF-35: reactivar vuelve a aprobado y borra el motivo -> %s, %s',
    case when v_fila.estado_perfil = 'aprobado' and v_fila.motivo_suspension is null and v_fila.suspendido_at is null
         then 'OK   ' else 'FALLA' end, v_fila.estado_perfil, coalesce(v_fila.motivo_suspension, 'null'));
  select count(*) into v_n from public.encargos where consultor_id = v_c2 and estado = 'cancelado';
  v_res := v_res || format(E'\n%s CU-27 3a: reactivar no revive los encargos -> %s siguen cancelados',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  -- El check también ata a service_role/postgres.
  begin
    update public.consultor_perfiles set estado_perfil = 'suspendido' where id = v_c2;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s §9.21: sin motivo no hay suspensión, ni para postgres -> %s',
    case when v_obtenido = '23514' then 'OK   ' else 'FALLA' end, v_obtenido);

  raise exception 'RESULTADO%', v_res;
end;
$$;
