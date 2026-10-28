-- RN-39, RN-40, RF-116, RF-117, RN-01 · Países elegibles, moneda y tasas de
-- referencia (docs/05 §9.36, migración 20261028100000). Sesión 033.
--
--   npx supabase db query --linked -f supabase/tests/paises_y_moneda.sql
--
-- Prepara datos como postgres y actúa como el Propietario (aal2) o como una
-- empresa con el rol `authenticated`, así que la RLS decide de verdad. Termina
-- SIEMPRE con un error "RESULTADO …" que revierte todo; cada línea dice OK o FALLA.
do $$
declare
  v_res text := '';
  v_admin uuid;
  v_emp uuid := '00000000-0000-0000-0000-0000000033e1';
  v_proy uuid := '00000000-0000-0000-0000-0000000033a1';
  v_fuente uuid; v_cat uuid;
  c_co uuid := '00000000-0000-0000-0000-0000000033c1';   -- Colombia elegible, COP
  c_us uuid := '00000000-0000-0000-0000-0000000033c2';   -- solo Estados Unidos
  c_todos uuid := '00000000-0000-0000-0000-0000000033c3'; -- todos los países, USD
  c_nada uuid := '00000000-0000-0000-0000-0000000033c4';  -- sin países declarados
  v_obtenido text;
  v_n int;
  v_b boolean;
  v_datos jsonb;
  v_reqs jsonb;

  -- Ejecuta una sentencia con el rol `authenticated` y la sesión dada; devuelve 'ok' o la pista del error.
  -- (Se usa con execute para no repetir el bloque de excepción en cada caso.)
begin
  select id into v_admin from public.perfiles where es_propietario;

  insert into auth.users (id, email, raw_user_meta_data)
    values (v_emp, 'paises033@prueba.co', '{"rol": "empresa", "nombre": "Empresa países"}');
  insert into public.fuentes (nombre, activa) values ('Fuente países 033 ' || gen_random_uuid(), true) returning id into v_fuente;
  insert into public.categorias (tipo, nombre, activa) values ('sector', 'Sector países 033 ' || gen_random_uuid(), true) returning id into v_cat;

  -- Cuatro convocatorias completas salvo los países, en borrador.
  insert into public.convocatorias (id, fuente_id, nombre, entidad_convocante, descripcion, cobertura_nacional, monto_min, monto_max, moneda, fecha_cierre, url_postulacion, estado) values
    (c_co,    v_fuente, 'Conv CO 033',    'Entidad', 'Objeto', true,  1000000, 9000000, 'COP', current_date + 30, 'https://entidad.gov.co/1', 'borrador'),
    (c_us,    v_fuente, 'Conv US 033',    'Entidad', 'Objeto', false, null, null, 'USD', current_date + 30, 'https://entidad.gov/2', 'borrador'),
    (c_todos, v_fuente, 'Conv todos 033', 'Entidad', 'Objeto', true,  1000, 2000, 'USD', current_date + 30, 'https://entidad.org/3', 'borrador'),
    (c_nada,  v_fuente, 'Conv nada 033',  'Entidad', 'Objeto', true,  null, null, 'COP', current_date + 30, 'https://entidad.org/4', 'borrador');
  insert into public.convocatoria_categoria select c, v_cat from unnest(array[c_co, c_us, c_todos, c_nada]) c;
  insert into public.documentos_convocatoria (convocatoria_id, tipo_doc, nombre, storage_path)
    select c, 'TDR', 'TDR', c || '/tdr.pdf' from unnest(array[c_co, c_us, c_todos, c_nada]) c;
  insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, obligatorio, orden)
    select c, r.d, 'condicion', true, r.o from unnest(array[c_co, c_us, c_todos, c_nada]) c cross join (values ('Uno', 1), ('Dos', 2)) r(d, o);
  insert into public.convocatoria_pais values (c_co, 'CO'), (c_us, 'US');
  update public.convocatorias set todos_los_paises = true where id = c_todos;

  -- ------------------------------------------------------------ RN-01 + RN-39
  v_res := v_res || format(E'\n%s RN-01: sin países declarados no es publicable -> %s',
    case when not privado.ficha_publicable(c_nada) then 'OK   ' else 'FALLA' end, privado.ficha_publicable(c_nada));
  v_res := v_res || format(E'\n%s RN-01: con Colombia y cobertura es publicable -> %s',
    case when privado.ficha_publicable(c_co) then 'OK   ' else 'FALLA' end, privado.ficha_publicable(c_co));
  v_res := v_res || format(E'\n%s RN-34: solo Estados Unidos, sin departamentos ni cobertura nacional, es publicable -> %s',
    case when privado.ficha_publicable(c_us) then 'OK   ' else 'FALLA' end, privado.ficha_publicable(c_us));
  update public.convocatorias set cobertura_nacional = false where id = c_todos;
  v_res := v_res || format(E'\n%s RN-34: todos los países incluye a Colombia, así que exige cobertura -> %s',
    case when not privado.ficha_publicable(c_todos) then 'OK   ' else 'FALLA' end, privado.ficha_publicable(c_todos));
  update public.convocatorias set cobertura_nacional = true where id = c_todos;

  -- Publicar como el Propietario (aal2): la de sin países se rechaza.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  foreach v_obtenido in array array['co', 'us', 'todos', 'nada'] loop
    declare v_id uuid := case v_obtenido when 'co' then c_co when 'us' then c_us when 'todos' then c_todos else c_nada end;
            v_r text;
    begin
      begin
        execute 'set local role authenticated';
        perform public.publicar_convocatoria(v_id, true);
        v_r := 'ok';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_r = pg_exception_hint;
        if v_r = '' then v_r := sqlerrm; end if;
      end;
      v_res := v_res || format(E'\n%s RF-09: publicar %s -> %s',
        case when (v_obtenido = 'nada') = (v_r <> 'ok') then 'OK   ' else 'FALLA' end, v_obtenido, v_r);
    end;
  end loop;

  -- --------------------------------------------- guardar_convocatoria (§9.13)
  v_datos := jsonb_build_object('fuente_id', v_fuente, 'nombre', 'Conv CO 033', 'entidad_convocante', 'Entidad', 'descripcion', 'Objeto',
    'monto_min', '1000000', 'monto_max', '9000000', 'ubicacion_cobertura', '', 'cobertura_nacional', true, 'fecha_apertura', '',
    'fecha_cierre', (current_date + 30)::text, 'url_postulacion', 'https://entidad.gov.co/1');
  v_reqs := (select jsonb_agg(jsonb_build_object('id', r.id, 'descripcion', r.descripcion, 'tipo', r.tipo)) from public.requisitos_convocatoria r where r.convocatoria_id = c_co);
  declare v_caso record;
  begin
    for v_caso in select * from (values
      ('moneda inexistente', v_datos || '{"moneda": "XYZ"}', 'moneda_invalida'),
      ('país inexistente', v_datos || '{"paises": ["ZZ"]}', 'pais_invalido'),
      ('sin llaves de países conserva los que tenía', v_datos, 'ok'),
      ('quitar todos los países a una publicada', v_datos || '{"todos_los_paises": false, "paises": []}', 'publicada_incompleta'),
      ('cambiar a Colombia y Ecuador, en USD', v_datos || '{"paises": ["co", "EC"], "moneda": "usd"}', 'ok')
    ) as t(caso, datos, esperado) loop
      begin
        execute 'set local role authenticated';
        perform public.guardar_convocatoria(c_co, v_caso.datos, array[v_cat], v_reqs);
        v_obtenido := 'ok';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_obtenido = pg_exception_hint;
        if v_obtenido = '' then v_obtenido := sqlerrm; end if;
      end;
      v_res := v_res || format(E'\n%s guardar: %s -> %s', case when v_obtenido = v_caso.esperado then 'OK   ' else 'FALLA' end, v_caso.caso, v_obtenido);
    end loop;
  end;
  select count(*) into v_n from public.convocatoria_pais where convocatoria_id = c_co;
  select moneda = 'USD' into v_b from public.convocatorias where id = c_co;
  v_res := v_res || format(E'\n%s guardar: quedaron 2 países (CO, EC) y la moneda en USD -> %s países, USD %s',
    case when v_n = 2 and v_b then 'OK   ' else 'FALLA' end, v_n, v_b);
  -- La deja en COP otra vez para las sugerencias.
  update public.convocatorias set moneda = 'COP' where id = c_co;

  -- ------------------------------------------------- RF-117 · guardar_tasa
  declare v_caso record;
  begin
    for v_caso in select * from (values
      ('el peso no lleva tasa', 'COP', 1::numeric, current_date, 'moneda_invalida'),
      ('tasa en cero', 'USD', 0::numeric, current_date, 'tasa_invalida'),
      ('fecha futura', 'USD', 4000::numeric, current_date + 5, 'fecha_invalida')
    ) as t(caso, moneda, tasa, fecha, esperado) loop
      begin
        execute 'set local role authenticated';
        perform public.guardar_tasa(v_caso.moneda, v_caso.tasa, v_caso.fecha);
        v_obtenido := 'ok';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_obtenido = pg_exception_hint;
      end;
      v_res := v_res || format(E'\n%s tasa: %s -> %s', case when v_obtenido = v_caso.esperado then 'OK   ' else 'FALLA' end, v_caso.caso, v_obtenido);
    end loop;
  end;

  -- La empresa no fija tasas ni escribe países de una convocatoria (RLS).
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    execute 'set local role authenticated';
    perform public.guardar_tasa('EUR', 4500, current_date);
    v_obtenido := 'ok';
    execute 'reset role';
  exception when others then
    execute 'reset role';
    get stacked diagnostics v_obtenido = pg_exception_hint;
  end;
  v_res := v_res || format(E'\n%s RNF-20: la empresa no fija tasas -> %s', case when v_obtenido = 'no_es_admin' then 'OK   ' else 'FALLA' end, v_obtenido);
  begin
    execute 'set local role authenticated';
    insert into public.convocatoria_pais values (c_us, 'CO');
    v_obtenido := 'ok';
    execute 'reset role';
  exception when others then
    execute 'reset role';
    v_obtenido := sqlstate;
  end;
  v_res := v_res || format(E'\n%s RLS: la empresa no se agrega como país elegible -> %s', case when v_obtenido = '42501' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- ------------------------------------- RN-39 · sugerencias y postulación
  insert into public.proyectos (id, usuario_id, nombre, monto_buscado, departamento_codigo) values (v_proy, v_emp, 'Proyecto países', 6000000, '05');
  insert into public.proyecto_categoria values (v_proy, v_cat);

  execute 'set local role authenticated';
  select count(*) filter (where s.convocatoria_id = c_us),
         count(*) filter (where s.convocatoria_id = c_todos and not s.monto)
    into v_n, v_obtenido
    from public.sugerencias_proyecto(v_proy) s;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-39: la de solo Estados Unidos no se sugiere a una empresa colombiana -> %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  v_res := v_res || format(E'\n%s RN-40: en USD y sin tasa, el monto no coincide -> %s', case when v_obtenido = '1' then 'OK   ' else 'FALLA' end, v_obtenido);

  -- Con tasa de 4.000: USD 1.000–2.000 = $4–8 millones, y el proyecto busca $6 millones.
  insert into public.tasas_referencia (moneda, cop_por_unidad, vigente_desde) values ('USD', 4000, current_date)
    on conflict (moneda) do update set cop_por_unidad = 4000;
  execute 'set local role authenticated';
  select s.monto into v_b from public.sugerencias_proyecto(v_proy) s where s.convocatoria_id = c_todos;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RN-40: con tasa de 4.000, USD 1.000–2.000 cubre $6 millones -> %s', case when v_b then 'OK   ' else 'FALLA' end, v_b);
  select monto_min = 1000 and monto_max = 2000 and moneda = 'USD' into v_b from public.convocatorias where id = c_todos;
  v_res := v_res || format(E'\n%s RN-40: el monto guardado no cambia -> %s', case when v_b then 'OK   ' else 'FALLA' end, v_b);

  -- Postular: a la de Estados Unidos, no; a la de todos los países, sí.
  foreach v_obtenido in array array['us', 'todos'] loop
    declare v_r text;
    begin
      begin
        execute 'set local role authenticated';
        perform public.iniciar_postulacion(case v_obtenido when 'us' then c_us else c_todos end, v_proy);
        v_r := 'ok';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        get stacked diagnostics v_r = pg_exception_hint;
        if v_r = '' then v_r := sqlerrm; end if;
      end;
      v_res := v_res || format(E'\n%s RN-39: postular a %s -> %s',
        case when (v_obtenido = 'us' and v_r = 'pais_no_elegible') or (v_obtenido = 'todos' and v_r = 'ok') then 'OK   ' else 'FALLA' end, v_obtenido, v_r);
    end;
  end loop;

  -- ------------------------------------------------- datos que ya existían
  select count(*) into v_n from public.convocatorias c
   where c.id not in (c_co, c_us, c_todos, c_nada)
     and not c.todos_los_paises
     and not exists (select 1 from public.convocatoria_pais p where p.convocatoria_id = c.id and p.pais_codigo = 'CO');
  v_res := v_res || format(E'\n%s migración: toda convocatoria previa admite a Colombia -> %s sin Colombia', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);
  select count(*) into v_n from public.paises;
  v_res := v_res || format(E'\n%s semilla: 249 países ISO 3166-1 -> %s', case when v_n = 249 then 'OK   ' else 'FALLA' end, v_n);

  raise exception 'RESULTADO (todo se revierte):%', v_res;
end $$;
