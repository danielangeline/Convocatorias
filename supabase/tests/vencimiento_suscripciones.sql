-- RF-39, RF-40, RN-16, RN-29 · Vencimiento de suscripciones con la fecha de
-- Colombia (docs/05 §9.7, CU-32). Sesión 023, Sprint 4 paso 4.
-- Sesión 042 (docs/05 §9.38, RN-11, RN-16, RN-41): el Trial se retiró; la
-- empresa nace en Gratis y, al terminar la gracia de su plan de pago, baja a
-- Gratis sin borrar nada. El consultor vencido sigue pasando a `vencida`.
--
--   npx supabase db query --linked -f supabase/tests/vencimiento_suscripciones.sql
--
-- Prepara datos como postgres y ejecuta la misma función que el job. Termina
-- SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice OK o
-- FALLA. Solo mira sus propias filas: las suscripciones reales no cambian.
do $$
declare
  v_res text := '';
  v_hoy date := privado.hoy_colombia();
  v_e uuid[] := array[
    '00000000-0000-0000-0000-0000000025e1', '00000000-0000-0000-0000-0000000025e2',
    '00000000-0000-0000-0000-0000000025e3', '00000000-0000-0000-0000-0000000025e4',
    '00000000-0000-0000-0000-0000000025e5', '00000000-0000-0000-0000-0000000025e6']::uuid[];
  v_c1 uuid := '00000000-0000-0000-0000-0000000025c1';  -- consultor que vence
  v_c2 uuid := '00000000-0000-0000-0000-0000000025c2';  -- consultor sin suscripción
  v_p uuid[] := array[
    '00000000-0000-0000-0000-0000000025b1', '00000000-0000-0000-0000-0000000025b2',
    '00000000-0000-0000-0000-0000000025b3', '00000000-0000-0000-0000-0000000025b4']::uuid[];
  v_p4 uuid := '00000000-0000-0000-0000-0000000025b9';  -- proyecto de e4, que baja a Gratis
  v_enc uuid[] := array[
    '00000000-0000-0000-0000-0000000025a1', '00000000-0000-0000-0000-0000000025a2',
    '00000000-0000-0000-0000-0000000025a3', '00000000-0000-0000-0000-0000000025a4']::uuid[];
  v_gratis uuid; v_esencial uuid; v_pro uuid; v_cons uuid;
  v_r record;
  v_n int;
  v_b boolean;
  v_o text;
begin
  select id into v_gratis from public.planes where es_gratuito;
  select id into v_esencial from public.planes where nombre = 'Empresa Esencial';
  select id into v_pro from public.planes where nombre = 'Empresa Pro';
  select id into v_cons from public.planes where nombre = 'Consultor' and rol = 'consultor';

  insert into auth.users (id, email, raw_user_meta_data)
  select v_e[i], format('ve%s@prueba.co', i), '{"rol": "empresa", "nombre": "E", "nombre_empresa": "E", "consentimiento_datos": "true"}'::jsonb
  from generate_series(1, 6) i;
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_c1, 'vc1@prueba.co', '{"rol": "consultor", "nombre": "C1", "consentimiento_datos": "true"}'),
    (v_c2, 'vc2@prueba.co', '{"rol": "consultor", "nombre": "C2", "consentimiento_datos": "true"}');

  -- ---------------------------------------------------------------- Gratis al registrarse (RN-11)
  select s.fecha_inicio, s.fecha_vencimiento, s.estado, s.modalidad, p.es_gratuito into v_r
    from public.suscripciones s join public.planes p on p.id = s.plan_id where s.usuario_id = v_e[6];
  v_res := v_res || format(E'\n%s RF-37: la empresa entra hoy a Gratis, sin vencimiento -> %s, vence %s (%s/%s)',
    case when v_r.fecha_inicio = v_hoy and v_r.fecha_vencimiento is null and v_r.estado = 'gratis'
              and v_r.modalidad = 'gratis' and v_r.es_gratuito then 'OK   ' else 'FALLA' end,
    v_r.fecha_inicio, coalesce(v_r.fecha_vencimiento::text, 'nunca'), v_r.estado, v_r.modalidad);

  -- ---------------------------------------------------------------- escenario
  -- e1: Esencial que vence hoy (último día con acceso) · e2: Esencial vencido ayer ·
  -- e3: Pro vencido hace 5 días (último día de gracia) · e4: Pro en gracia vencido
  -- hace 6 días, con créditos de paquete y un proyecto · e5: Esencial vencido hace
  -- 10 días (el job no corrió).
  update public.suscripciones set plan_id = v_esencial, modalidad = 'mensual', estado = 'activa',
         fecha_inicio = v_hoy - 30, fecha_vencimiento = v_hoy where usuario_id = v_e[1];
  update public.suscripciones set plan_id = v_esencial, modalidad = 'mensual', estado = 'activa',
         fecha_inicio = v_hoy - 31, fecha_vencimiento = v_hoy - 1 where usuario_id = v_e[2];
  update public.suscripciones set plan_id = v_pro, modalidad = 'mensual', estado = 'activa',
         fecha_inicio = v_hoy - 40, fecha_vencimiento = v_hoy - 5 where usuario_id = v_e[3];
  update public.suscripciones set plan_id = v_pro, modalidad = 'mensual', estado = 'en_gracia',
         fecha_inicio = v_hoy - 36, fecha_vencimiento = v_hoy - 6, creditos_usados_periodo = 300, creditos_extra = 40
   where usuario_id = v_e[4];
  update public.suscripciones set plan_id = v_esencial, modalidad = 'anual', estado = 'activa',
         fecha_inicio = v_hoy - 400, fecha_vencimiento = v_hoy - 10 where usuario_id = v_e[5];
  insert into public.proyectos (id, usuario_id, nombre) values (v_p4, v_e[4], 'Proyecto que se conserva');

  -- El consultor que vence, con encargos en curso, pendiente y completado; el
  -- otro consultor, sin suscripción (RN-11 transitorio), con uno en curso.
  update public.consultor_perfiles set nombre_profesional = 'C', estado_perfil = 'aprobado' where id in (v_c1, v_c2);
  insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
  values (v_c1, v_cons, 'mensual', 'en_gracia', v_hoy - 36, v_hoy - 6);
  insert into public.proyectos (id, usuario_id, nombre)
  select v_p[i], v_e[1], 'P' || i from generate_series(1, 4) i;
  insert into public.encargos (id, proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda) values
    (v_enc[1], v_p[1], v_e[1], v_c1, 'En curso',   'directorio', 'pendiente', 'buscar_convocatoria'),
    (v_enc[2], v_p[2], v_e[1], v_c1, 'Pendiente',  'directorio', 'pendiente', 'buscar_convocatoria'),
    (v_enc[3], v_p[3], v_e[1], v_c1, 'Completado', 'directorio', 'pendiente', 'buscar_convocatoria'),
    (v_enc[4], v_p[4], v_e[1], v_c2, 'Otro',       'directorio', 'pendiente', 'buscar_convocatoria');
  update public.encargos set estado = 'en_curso' where id in (v_enc[1], v_enc[3], v_enc[4]);
  update public.encargos set estado = 'completado' where id = v_enc[3];

  -- ---------------------------------------------------------------- RN-41 sin depender del job
  v_b := privado.plan_incluye(v_e[4], 'documento_ia');
  v_res := v_res || format(E'\n%s RF-40, RN-16: con 6 días de vencido, su plan efectivo ya es Gratis aunque el job no haya corrido -> IA %s',
    case when not v_b and privado.plan_efectivo(v_e[4]) = v_gratis then 'OK   ' else 'FALLA' end, v_b);
  v_b := privado.plan_incluye(v_e[3], 'consultores');
  v_res := v_res || format(E'\n%s RN-16: el quinto día de gracia conserva las funciones de Pro -> consultores %s',
    case when v_b then 'OK   ' else 'FALLA' end, v_b);

  -- ---------------------------------------------------------------- el job
  select * into v_r from privado.vencer_suscripciones();
  v_res := v_res || format(E'\n%s RF-39: devuelve los conteos -> %s en gracia, %s a Gratis, %s vencidas, %s encargos cancelados',
    case when v_r.en_gracia >= 2 and v_r.a_gratis >= 2 and v_r.vencidas >= 1 and v_r.encargos_cancelados >= 2 then 'OK   ' else 'FALLA' end,
    v_r.en_gracia, v_r.a_gratis, v_r.vencidas, v_r.encargos_cancelados);

  select string_agg(s.estado, ',' order by array_position(v_e, s.usuario_id)) into v_o
  from public.suscripciones s where s.usuario_id = any (v_e[1:6]);
  v_res := v_res || format(E'\n%s RF-39, RN-16: el de hoy sigue; ayer y a 5 días en gracia; 6 y 10 días bajan a Gratis; Gratis no vence -> %s',
    case when v_o = 'activa,en_gracia,en_gracia,gratis,gratis,gratis' then 'OK   ' else 'FALLA' end, v_o);

  select s.plan_id = v_gratis and s.modalidad = 'gratis' and s.fecha_vencimiento is null and s.fecha_inicio = v_hoy
         and s.creditos_usados_periodo = 0 and s.creditos_extra = 40
         and exists (select 1 from public.proyectos where id = v_p4)
    into v_b
  from public.suscripciones s where s.usuario_id = v_e[4];
  v_res := v_res || format(E'\n%s RN-16: al bajar a Gratis no se borra nada: misma fila, sin vencimiento, paquetes y proyectos intactos -> %s',
    case when v_b then 'OK   ' else 'FALLA' end, v_b);

  select string_agg(
           case when privado.plan_incluye(u, 'documento_ia') then 'i' else '-' end
           || case when privado.plan_incluye(u, 'consultores') then 'c' else '-' end, ' ' order by array_position(v_e, u)) into v_o
  from unnest(v_e[1:6]) u;
  v_res := v_res || format(E'\n%s RN-41: funciones tras el job (i = IA, c = consultores) -> %s',
    case when v_o = 'i- i- ic -- -- --' then 'OK   ' else 'FALLA' end, v_o);

  select string_agg(case when privado.tiene_suscripcion_vigente(u) then 's' else 'n' end, '' order by array_position(v_e, u)) into v_o
  from unnest(v_e[1:6]) u;
  v_res := v_res || format(E'\n%s RF-40: toda empresa conserva su cuenta (Gratis también es vigente) -> %s',
    case when v_o = 'ssssss' then 'OK   ' else 'FALLA' end, v_o);

  select string_agg(e.estado || coalesce(':' || e.motivo_cancelacion, ''), ' | ' order by array_position(v_enc, e.id)) into v_o
  from public.encargos e where e.id = any (v_enc);
  v_res := v_res || format(E'\n%s RN-29: al vencer el consultor, en curso y pendiente se cancelan; el completado y el de otro consultor no -> %s',
    case when v_o = 'cancelado:Suscripción del consultor vencida | cancelado:Suscripción del consultor vencida | completado | en_curso'
         then 'OK   ' else 'FALLA' end, v_o);

  select estado into v_o from public.suscripciones where usuario_id = v_c1;
  v_res := v_res || format(E'\n%s CU-32: la suscripción del consultor queda vencida (no baja a Gratis) -> %s',
    case when v_o = 'vencida' then 'OK   ' else 'FALLA' end, v_o);

  -- ---------------------------------------------------------------- idempotente
  select * into v_r from privado.vencer_suscripciones();
  v_res := v_res || format(E'\n%s RF-39: correr dos veces el mismo día no cambia nada -> %s, %s, %s, %s',
    case when v_r.en_gracia = 0 and v_r.a_gratis = 0 and v_r.vencidas = 0 and v_r.encargos_cancelados = 0 then 'OK   ' else 'FALLA' end,
    v_r.en_gracia, v_r.a_gratis, v_r.vencidas, v_r.encargos_cancelados);

  -- ---------------------------------------------------------------- permisos
  perform set_config('request.jwt.claims', json_build_object('sub', v_e[1], 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  begin perform privado.vencer_suscripciones(); v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RF-39: un usuario no ejecuta el job -> %s',
    case when v_o = '42501' then 'OK   ' else 'FALLA' end, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
