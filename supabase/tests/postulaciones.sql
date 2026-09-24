-- RF-17, RF-18, RF-19, RF-78, RF-83, RN-04, RN-35 · Postulaciones con checklist
-- (iniciar_postulacion) y grafo de estados (docs/05 §9.19). Sesión 020,
-- Sprint 3 pasos 3 y 4.
--
--   npx supabase db query --linked -f supabase/tests/postulaciones.sql
--
-- Prepara datos como postgres y actúa con el rol `authenticated`, así que la
-- RLS decide de verdad. Termina SIEMPRE con un error "RESULTADO …" que revierte
-- todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_e1 uuid := '00000000-0000-0000-0000-0000000020e1';
  v_e2 uuid := '00000000-0000-0000-0000-0000000020e2';
  v_c1 uuid := '00000000-0000-0000-0000-0000000020c1';
  v_p  uuid := '00000000-0000-0000-0000-00000000020a';  -- proyecto de E1
  v_q  uuid := '00000000-0000-0000-0000-00000000020b';  -- otro proyecto de E1
  v_q2 uuid := '00000000-0000-0000-0000-00000000020d';  -- tercero de E1, se borra al final
  v_r  uuid := '00000000-0000-0000-0000-00000000020c';  -- proyecto de E2
  a uuid := '00000000-0000-0000-0000-0000000200a1';     -- publicada y vigente
  d uuid := '00000000-0000-0000-0000-0000000200d1';     -- publicada vencida sin cerrar
  e uuid := '00000000-0000-0000-0000-0000000200e1';     -- borrador
  f uuid := '00000000-0000-0000-0000-0000000200f1';     -- cerrada
  v_fila record;
  v_id1 uuid; v_id2 uuid; v_sin uuid; v_s uuid;
  v_item uuid;
  v_obtenido text;
  v_n int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'pos1@prueba.co', '{"rol": "empresa", "nombre": "Postulaciones uno"}'),
    (v_e2, 'pos2@prueba.co', '{"rol": "empresa", "nombre": "Postulaciones dos"}'),
    (v_c1, 'posc@prueba.co', '{"rol": "consultor", "nombre": "Consultor postulaciones"}');

  insert into public.convocatorias (id, nombre, entidad_convocante, cobertura_nacional, fecha_cierre, estado, url_postulacion) values
    (a, 'A · vigente',  'Prueba', true, privado.hoy_colombia() + 20, 'publicada', 'https://prueba.gov.co/a'),
    (d, 'D · vencida',  'Prueba', true, privado.hoy_colombia() - 1,  'publicada', 'https://prueba.gov.co/d'),
    (e, 'E · borrador', 'Prueba', true, privado.hoy_colombia() + 20, 'borrador',  null),
    (f, 'F · cerrada',  'Prueba', true, privado.hoy_colombia() - 9,  'cerrada',   'https://prueba.gov.co/f');

  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden) values
    (a, 'RUT actualizado', 'documento', true, 0),
    (a, 'Carta de intención', 'documento', false, 1);

  insert into public.proyectos (id, usuario_id, nombre) values
    (v_p, v_e1, 'P'), (v_q, v_e1, 'Q'), (v_q2, v_e1, 'Q2'), (v_r, v_e2, 'R');

  -- ---------------------------------------------------------------- E1 crea
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';

  select * into v_fila from public.iniciar_postulacion(a, v_p);
  v_id1 := v_fila.id;
  select count(*) into v_n from public.postulacion_checklist where postulacion_id = v_id1;
  v_res := v_res || format(E'\n%s RF-17: crea la postulación con el checklist copiado (2 ítems) -> creada %s, %s ítems',
    case when v_fila.creada and v_n = 2 then 'OK   ' else 'FALLA' end, v_fila.creada, v_n);

  select p.estado into v_obtenido from public.postulaciones p where p.id = v_id1;
  select count(*) into v_n from public.postulacion_historial where postulacion_id = v_id1;
  v_res := v_res || format(E'\n%s nace en preparación con una entrada de historial -> %s, %s',
    case when v_obtenido = 'en_preparacion' and v_n = 1 then 'OK   ' else 'FALLA' end, v_obtenido, v_n);

  select * into v_fila from public.iniciar_postulacion(a, v_p);
  v_res := v_res || format(E'\n%s CU-11 1c: postular otra vez al mismo par devuelve la existente -> creada %s, misma %s',
    case when not v_fila.creada and v_fila.id = v_id1 then 'OK   ' else 'FALLA' end, v_fila.creada, v_fila.id = v_id1);

  select * into v_fila from public.iniciar_postulacion(a, v_q);
  v_id2 := v_fila.id;
  v_res := v_res || format(E'\n%s RN-35: otro proyecto a la misma convocatoria sí se admite -> creada %s',
    case when v_fila.creada and v_id2 <> v_id1 then 'OK   ' else 'FALLA' end, v_fila.creada);

  select * into v_fila from public.iniciar_postulacion(a, null);
  v_sin := v_fila.id;
  select * into v_fila from public.iniciar_postulacion(a, null);
  v_res := v_res || format(E'\n%s sin proyecto también es un par: la segunda devuelve la primera -> creada %s, misma %s',
    case when not v_fila.creada and v_fila.id = v_sin then 'OK   ' else 'FALLA' end, v_fila.creada, v_fila.id = v_sin);

  -- ---------------------------------------------------------------- rechazos al crear
  begin
    insert into public.postulaciones (convocatoria_id, proyecto_id, estado) values (a, null, 'aprobada');
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s CU-11: insertar directamente como aprobada lo frena la RLS -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    insert into public.postulaciones (convocatoria_id, proyecto_id) values (a, v_p);
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s RN-35: insertar directamente un duplicado del par lo frena el índice -> %s',
    case when v_obtenido = '23505' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.iniciar_postulacion(d, v_p);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-78: publicada pero vencida -> %s',
    case when v_obtenido = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.iniciar_postulacion(f, v_p);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-21: cerrada (la empresa la ve, no postula) -> %s',
    case when v_obtenido = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.iniciar_postulacion(e, v_p);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-33: un borrador no existe para la empresa -> %s',
    case when v_obtenido = 'convocatoria_no_existe' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    perform public.iniciar_postulacion(a, v_r);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-30: con el proyecto de otra empresa -> %s',
    case when v_obtenido = 'proyecto_no_existe' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- checklist
  select id into v_item from public.postulacion_checklist where postulacion_id = v_id1 order by orden limit 1;
  update public.postulacion_checklist set completado = true where id = v_item;
  select count(*) into v_n from public.postulacion_checklist where id = v_item and completado and completado_at is not null;
  v_res := v_res || format(E'\n%s RF-18: marca un ítem y queda la fecha -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  begin
    update public.postulacion_checklist set descripcion = 'Otra cosa' where id = v_item;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s el texto del ítem no se edita -> %s',
    case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- vincular proyecto
  begin
    update public.postulaciones set proyecto_id = v_q where id = v_sin;
    v_obtenido := 'ok';
  exception when others then v_obtenido := sqlstate; end;
  v_res := v_res || format(E'\n%s RN-35: vincular un proyecto que ya tiene postulación en curso en A -> %s',
    case when v_obtenido = '23505' then 'OK   ' else 'FALLA' end, v_obtenido);

  update public.postulaciones set proyecto_id = v_q2 where id = v_sin;
  select count(*) into v_n from public.postulaciones where id = v_sin and proyecto_id = v_q2;
  v_res := v_res || format(E'\n%s CU-13 3a: vincula un proyecto a la postulación sin proyecto -> %s',
    case when v_n = 1 then 'OK   ' else 'FALLA' end, v_n);

  begin
    update public.postulaciones set proyecto_id = v_p where id = v_sin;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-35: una vez vinculado no se cambia -> %s',
    case when v_obtenido = 'proyecto_fijo' then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    update public.postulaciones set proyecto_id = null where id = v_sin;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-35: tampoco se desvincula a mano -> %s',
    case when v_obtenido = 'proyecto_fijo' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- Borrar el proyecto sí deja la postulación sin proyecto, aunque ya exista
  -- otra sin proyecto en la misma convocatoria.
  select * into v_fila from public.iniciar_postulacion(a, null);
  v_s := v_fila.id;
  delete from public.proyectos where id = v_q2;
  select count(*) into v_n from public.postulaciones where id = v_sin and proyecto_id is null;
  v_res := v_res || format(E'\n%s CU-09 2a: borrar el proyecto deja su postulación sin proyecto (ya había otra sin proyecto: %s) -> %s',
    case when v_n = 1 and v_fila.creada then 'OK   ' else 'FALLA' end, v_fila.creada, v_n);

  -- ---------------------------------------------------------------- RF-83 grafo
  select string_agg(x.d || '>' || y.h, ' ' order by x.d, y.h) into v_obtenido
    from unnest(array['en_preparacion','presentada','en_evaluacion','aprobada','rechazada','cerrada']) x(d)
   cross join unnest(array['en_preparacion','presentada','en_evaluacion','aprobada','rechazada','cerrada']) y(h)
   where privado.transicion_postulacion_permitida(x.d, y.h);
  v_res := v_res || format(E'\n%s RF-83: los 36 pares dan exactamente las 10 transiciones de lib/utils.ts -> %s',
    case when v_obtenido = 'aprobada>cerrada en_evaluacion>aprobada en_evaluacion>cerrada en_evaluacion>rechazada en_preparacion>cerrada en_preparacion>presentada presentada>cerrada presentada>en_evaluacion rechazada>cerrada'
         then 'OK   ' else 'FALLA' end, v_obtenido);

  begin
    update public.postulaciones set estado = 'aprobada' where id = v_id2;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-83: de en preparación a aprobada, saltando el grafo -> %s',
    case when v_obtenido = 'transicion_invalida' then 'OK   ' else 'FALLA' end, v_obtenido);

  update public.postulaciones set estado = 'presentada' where id = v_id2;
  update public.postulaciones set estado = 'en_evaluacion' where id = v_id2;
  select count(*) into v_n from public.postulacion_historial
   where postulacion_id = v_id2 and cambiado_por = v_e1 and estado_nuevo in ('presentada', 'en_evaluacion');
  v_res := v_res || format(E'\n%s RF-19: cada transición queda en el historial con quién -> %s de 2',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  begin
    update public.postulaciones set estado = 'presentada' where id = v_id2;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-83: no se retrocede de en evaluación a presentada -> %s',
    case when v_obtenido = 'transicion_invalida' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ---------------------------------------------------------------- cerrada
  update public.postulaciones set estado = 'cerrada' where id = v_id1;
  begin
    update public.postulacion_checklist set completado = false where id = v_item;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RN-35, CU-12 2a: el checklist de una cerrada es de solo lectura -> %s',
    case when v_obtenido = 'postulacion_cerrada' then 'OK   ' else 'FALLA' end, v_obtenido);

  select * into v_fila from public.iniciar_postulacion(a, v_p);
  v_res := v_res || format(E'\n%s RN-35: cerrada la anterior, el par admite una nueva -> creada %s',
    case when v_fila.creada and v_fila.id <> v_id1 then 'OK   ' else 'FALLA' end, v_fila.creada);

  begin
    update public.postulaciones set estado = 'en_preparacion' where id = v_id1;
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s RF-83: una cerrada no se reabre -> %s',
    case when v_obtenido = 'transicion_invalida' then 'OK   ' else 'FALLA' end, v_obtenido);

  execute 'reset role';

  -- ---------------------------------------------------------------- RN-04
  update public.requisitos_convocatoria set descripcion = 'RUT cambiado por el admin' where convocatoria_id = a and orden = 0;
  delete from public.requisitos_convocatoria where convocatoria_id = a and orden = 1;
  select count(*) into v_n from public.postulacion_checklist
   where postulacion_id = v_id2 and descripcion in ('RUT actualizado', 'Carta de intención');
  v_res := v_res || format(E'\n%s RN-04: editar y quitar requisitos no altera el checklist copiado -> %s de 2',
    case when v_n = 2 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- aislamiento
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.postulaciones where usuario_id = v_e1;
  v_res := v_res || format(E'\n%s RN-30: E2 no ve las postulaciones de E1 -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.postulacion_checklist where postulacion_id = v_id2;
  v_res := v_res || format(E'\n%s RN-30: E2 no ve su checklist -> %s',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  with t as (update public.postulacion_checklist set completado = true where postulacion_id = v_id2 returning 1)
  select count(*) into v_n from t;
  v_res := v_res || format(E'\n%s RN-30: E2 no marca su checklist -> %s filas',
    case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  execute 'reset role';

  -- ---------------------------------------------------------------- roles y suscripción
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.iniciar_postulacion(a, null);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s un consultor no postula -> %s',
    case when v_obtenido = 'no_es_empresa' then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  update public.suscripciones set estado = 'vencida', fecha_inicio = current_date - 60, fecha_vencimiento = current_date - 30 where usuario_id = v_e2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.iniciar_postulacion(a, v_r);
    v_obtenido := 'ok';
  exception when others then get stacked diagnostics v_obtenido = pg_exception_hint; end;
  v_res := v_res || format(E'\n%s CU-11 1b: sin suscripción vigente -> %s',
    case when v_obtenido = 'sin_suscripcion' then 'OK   ' else 'FALLA' end, v_obtenido);
  execute 'reset role';

  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
