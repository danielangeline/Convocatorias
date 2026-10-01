-- RNF-01, RNF-11, RNF-12, RNF-25 · Revisión del esquema y la auditoría
-- (Sprint 4 paso 5, sesión 023).
--
--   npx supabase db query --linked -f supabase/tests/rnf_esquema.sql
--
-- Las comprobaciones de esquema leen el catálogo de Postgres; la del historial
-- de encargos actúa con el rol `authenticated`. Termina SIEMPRE con un error
-- "RESULTADO …" que revierte todo; cada línea dice OK, FALLA o INFO.
do $$
declare
  v_res text := '';
  v_n int;
  v_o text;
  v_e uuid := '00000000-0000-0000-0000-0000000026e1';
  v_c uuid := '00000000-0000-0000-0000-0000000026c1';
  v_x uuid := '00000000-0000-0000-0000-0000000026e2';
  v_p uuid := '00000000-0000-0000-0000-0000000026b1';
  v_en uuid;
begin
  -- ---------------------------------------------------------------- RNF-25
  select count(*) into v_n from pg_tables where schemaname = 'public';
  v_res := v_res || format(E'\n%s RNF-25: 30 tablas en public -> %s', case when v_n = 30 then 'OK   ' else 'FALLA' end, v_n);

  select string_agg(tablename, ', ') into v_o from pg_tables where schemaname = 'public' and not rowsecurity;
  v_res := v_res || format(E'\n%s RNF-25: todas con RLS habilitado -> sin RLS: %s', case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'ninguna'));

  select string_agg(t.tablename, ', ') into v_o
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename);
  v_res := v_res || format(E'\n%s RNF-25: todas con al menos una política -> sin política: %s', case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'ninguna'));

  select count(*) into v_n from pg_policies p
  where p.schemaname = 'public' and 'anon' = any (p.roles) and p.cmd <> 'SELECT';
  v_res := v_res || format(E'\n%s RNF-25: ninguna política deja escribir al anónimo -> %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  select string_agg(p.tablename || '.' || p.policyname, ', ') into v_o from pg_policies p
  where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and coalesce(p.qual, '') in ('', 'true') and coalesce(p.with_check, '') in ('', 'true');
  v_res := v_res || format(E'\n%s RNF-25: ninguna política de escritura es abierta (true) -> %s', case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'ninguna'));

  -- ---------------------------------------------------------------- RNF-12
  select count(*) into v_n from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public' and c.contype = 'f' and not c.convalidated;
  v_res := v_res || format(E'\n%s RNF-12: todas las claves foráneas están validadas -> sin validar: %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- Columnas *_id que parecen referencias y no tienen clave foránea.
  select string_agg(c.table_name || '.' || c.column_name, ', ') into v_o
  from information_schema.columns c
  where c.table_schema = 'public' and c.column_name ~ '_id$' and c.column_name <> 'id'
    and not exists (
      select 1 from information_schema.key_column_usage k
      join information_schema.table_constraints tc on tc.constraint_name = k.constraint_name and tc.table_schema = k.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and k.table_schema = 'public' and k.table_name = c.table_name and k.column_name = c.column_name
    );
  v_res := v_res || format(E'\n%s RNF-12: toda columna *_id tiene clave foránea -> sin clave: %s', case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'ninguna'));

  select count(*) into v_n from auth.users u where not exists (select 1 from public.perfiles p where p.id = u.id);
  v_res := v_res || format(E'\n%s RNF-12: toda cuenta tiene su perfil -> sin perfil: %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  select count(*) into v_n from public.perfiles p
  where p.rol = 'consultor' and not exists (select 1 from public.consultor_perfiles c where c.id = p.id);
  v_res := v_res || format(E'\n%s RNF-12: todo consultor tiene su perfil profesional -> sin él: %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  select count(*) into v_n from public.perfiles p
  where p.rol = 'empresa' and not exists (select 1 from public.suscripciones s where s.usuario_id = p.id);
  v_res := v_res || format(E'\n%s RNF-12: toda empresa tiene su suscripción -> sin ella: %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- Objetos de Storage sin fila que los nombre (hallazgo conocido: no son
  -- registros de la base y nadie los sirve, pero ocupan espacio).
  select count(*) into v_n from storage.objects o
  where o.bucket_id = 'documentos-convocatorias'
    and not exists (select 1 from public.documentos_convocatoria d where d.storage_path = o.name);
  v_res := v_res || format(E'\nINFO  RNF-12: adjuntos en Storage sin fila -> %s', v_n);

  -- ---------------------------------------------------------------- RNF-01
  select count(*) into v_n from auth.users where encrypted_password is not null and encrypted_password <> ''
    and encrypted_password !~ '^\$2[aby]\$';
  v_res := v_res || format(E'\n%s RNF-01: toda contraseña se guarda con bcrypt -> otras: %s', case when v_n = 0 then 'OK   ' else 'FALLA' end, v_n);

  -- ---------------------------------------------------------------- RNF-11
  select string_agg(x, ', ') into v_o from (values
    ('convocatorias.creado_por'), ('convocatorias.publicado_por'), ('convocatorias.publicada_at'),
    ('consultor_perfiles.revisado_por'), ('consultor_perfiles.revisado_at'), ('consultor_perfiles.suspendido_at'),
    ('postulacion_historial.cambiado_por'), ('encargo_historial.cambiado_por'), ('encargos.atendido_por'),
    ('documentos_convocatoria.subido_por'), ('suscripciones.activada_por'), ('eventos_seguridad.fecha')
  ) v(x)
  where not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name || '.' || c.column_name = v.x);
  v_res := v_res || format(E'\n%s RNF-11: columnas de auditoría presentes -> faltan: %s', case when v_o is null then 'OK   ' else 'FALLA' end, coalesce(v_o, 'ninguna'));

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e, 're1@prueba.co', '{"rol": "empresa", "nombre": "E", "nombre_empresa": "E", "consentimiento_datos": "true"}'),
    (v_x, 're2@prueba.co', '{"rol": "empresa", "nombre": "X", "nombre_empresa": "X", "consentimiento_datos": "true"}'),
    (v_c, 'rc1@prueba.co', '{"rol": "consultor", "nombre": "C", "consentimiento_datos": "true"}');
  update public.consultor_perfiles set nombre_profesional = 'C', estado_perfil = 'aprobado' where id = v_c;
  insert into public.proyectos (id, usuario_id, nombre) values (v_p, v_e, 'P');

  perform set_config('request.jwt.claims', json_build_object('sub', v_e, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  v_en := public.solicitar_encargo(v_p, v_c, 'Tarea', null, 'buscar_convocatoria', null);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  perform public.responder_encargo(v_en, true);
  perform public.completar_encargo(v_en);
  execute 'reset role';

  select string_agg(coalesce(estado_anterior, '∅') || '→' || estado_nuevo || ':' ||
                    case cambiado_por when v_e then 'empresa' when v_c then 'consultor' else 'nadie' end, ' ' order by fecha, estado_nuevo desc)
    into v_o from public.encargo_historial where encargo_id = v_en;
  v_res := v_res || format(E'\n%s RNF-11: el historial del encargo dice qué cambió y quién -> %s',
    case when v_o = '∅→pendiente:empresa pendiente→en_curso:consultor en_curso→completado:consultor' then 'OK   ' else 'FALLA' end, v_o);

  perform set_config('request.jwt.claims', json_build_object('sub', v_x, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_n from public.encargo_historial where encargo_id = v_en;
  begin
    insert into public.encargo_historial (encargo_id, estado_nuevo) values (v_en, 'calificado');
    v_o := 'ok';
  exception when others then v_o := sqlstate; end;
  execute 'reset role';
  v_res := v_res || format(E'\n%s RNF-11: otra empresa no lo lee ni nadie lo escribe -> %s filas, insertar %s',
    case when v_n = 0 and v_o = '42501' then 'OK   ' else 'FALLA' end, v_n, v_o);

  raise exception 'RESULTADO%', v_res;
end;
$$;
