-- RF-78, RN-03 · Ninguna postulación ni documento generado se crea sobre una
-- convocatoria que no esté publicada y vigente (trigger de docs/05 §9.7 ·
-- sesión 017, Sprint 2 paso 7).
--
--   npx supabase db query --linked -f supabase/tests/vigencia_al_crear.sql
--
-- Inserta como postgres, que igual que service_role se salta la RLS: justo el
-- camino que el trigger tiene que cubrir. Termina SIEMPRE con un error
-- "RESULTADO …" que revierte todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_emp uuid := '00000000-0000-0000-0000-0000000000f7';
  v_proy uuid := '00000000-0000-0000-0000-0000000000f8';
  v_post uuid;
  v_obtenido text;
  f record;
begin
  insert into auth.users (id, email, raw_user_meta_data)
    values (v_emp, 'vigencia@prueba.co', '{"rol": "empresa", "nombre": "Empresa vigencia"}');
  insert into public.proyectos (id, usuario_id, nombre) values (v_proy, v_emp, 'Proyecto vigencia');
  insert into public.convocatorias (id, nombre, entidad_convocante, fecha_cierre, estado, url_postulacion) values
    ('00000000-0000-0000-0000-00000000d001', 'Vigente', 'Prueba', privado.hoy_colombia() + 10, 'publicada', 'https://prueba.gov.co/1'),
    ('00000000-0000-0000-0000-00000000d002', 'Cierra hoy', 'Prueba', privado.hoy_colombia(), 'publicada', 'https://prueba.gov.co/2'),
    ('00000000-0000-0000-0000-00000000d003', 'Vencida sin cerrar', 'Prueba', privado.hoy_colombia() - 1, 'publicada', 'https://prueba.gov.co/3'),
    ('00000000-0000-0000-0000-00000000d004', 'Cerrada', 'Prueba', privado.hoy_colombia() - 9, 'cerrada', 'https://prueba.gov.co/4'),
    ('00000000-0000-0000-0000-00000000d005', 'Despublicada', 'Prueba', privado.hoy_colombia() + 10, 'despublicada', 'https://prueba.gov.co/5'),
    ('00000000-0000-0000-0000-00000000d006', 'Borrador', 'Prueba', privado.hoy_colombia() + 10, 'borrador', null);

  for f in select * from (values
      ('00000000-0000-0000-0000-00000000d001'::uuid, 'ok', 'vigente'),
      ('00000000-0000-0000-0000-00000000d002'::uuid, 'ok', 'que cierra hoy (vence al terminar el día en Colombia)'),
      ('00000000-0000-0000-0000-00000000d003'::uuid, 'convocatoria_no_vigente', 'publicada pero vencida (el job aún no la cerró)'),
      ('00000000-0000-0000-0000-00000000d004'::uuid, 'convocatoria_no_vigente', 'cerrada'),
      ('00000000-0000-0000-0000-00000000d005'::uuid, 'convocatoria_no_vigente', 'despublicada'),
      ('00000000-0000-0000-0000-00000000d006'::uuid, 'convocatoria_no_vigente', 'borrador')
    ) as t(id, esperado, caso)
  loop
    -- Postulación
    begin
      insert into public.postulaciones (usuario_id, convocatoria_id) values (v_emp, f.id);
      v_obtenido := 'ok';
    exception when others then
      get stacked diagnostics v_obtenido = pg_exception_hint;
      if v_obtenido = '' then v_obtenido := sqlerrm; end if;
    end;
    v_res := v_res || format(E'\n%s postular a una %s -> %s', case when v_obtenido = f.esperado then 'OK   ' else 'FALLA' end, f.caso, v_obtenido);

    -- Documento generado
    begin
      insert into public.documentos_generados (usuario_id, proyecto_id, convocatoria_id, titulo, contenido)
        values (v_emp, v_proy, f.id, 'Doc vigencia', '{}'::jsonb);
      v_obtenido := 'ok';
    exception when others then
      get stacked diagnostics v_obtenido = pg_exception_hint;
      if v_obtenido = '' then v_obtenido := sqlerrm; end if;
    end;
    v_res := v_res || format(E'\n%s generar sobre una %s -> %s', case when v_obtenido = f.esperado then 'OK   ' else 'FALLA' end, f.caso, v_obtenido);
  end loop;

  -- Cambiar una postulación existente a una convocatoria cerrada tampoco vale.
  select id into v_post from public.postulaciones where usuario_id = v_emp and convocatoria_id = '00000000-0000-0000-0000-00000000d001' limit 1;
  begin
    update public.postulaciones set convocatoria_id = '00000000-0000-0000-0000-00000000d004' where id = v_post;
    v_obtenido := 'ok';
  exception when others then
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s mover una postulación a una cerrada -> %s', case when v_obtenido = 'convocatoria_no_vigente' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- Editar lo ya creado sí se puede, aunque la convocatoria cierre después (la regla es para crear).
  update public.convocatorias set estado = 'cerrada' where id = '00000000-0000-0000-0000-00000000d001';
  begin
    update public.postulaciones set proyecto_id = v_proy where id = v_post;
    v_obtenido := 'ok';
  exception when others then
    v_obtenido := sqlerrm;
  end;
  v_res := v_res || format(E'\n%s editar una postulación cuya convocatoria ya cerró -> %s', case when v_obtenido = 'ok' then 'OK   ' else 'FALLA' end, v_obtenido);

  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
