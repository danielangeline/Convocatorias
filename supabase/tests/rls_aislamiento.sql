-- =============================================================================
-- Prueba cruzada de RLS (RNF-03, RNF-25, RNF-16, RN-17, RN-25, RN-27, RNF-28)
--
-- Corre dentro de una transacción que termina en ROLLBACK: no deja datos.
--   npx supabase db query --local -f supabase/tests/rls_aislamiento.sql
-- Cualquier comprobación fallida aborta con "FALLA: ...".
-- =============================================================================

begin;

create function pg_temp.ok(condicion boolean, descripcion text) returns text
language plpgsql as $$
begin
  if condicion is not true then
    raise exception 'FALLA: %', descripcion;
  end if;
  return 'ok · ' || descripcion;
end;
$$;

-- Ejecuta una sentencia y confirma que la base la rechaza.
create function pg_temp.rechaza(sentencia text, descripcion text) returns text
language plpgsql as $$
begin
  execute sentencia;
  raise exception 'FALLA (se permitió): %', descripcion;
exception
  when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
    return 'ok · rechazado · ' || descripcion;
  when others then
    return 'ok · rechazado · ' || descripcion;
end;
$$;

-- Cambia la identidad de la sesión como lo haría un JWT de Supabase Auth.
create function pg_temp.como(usuario uuid, aal text default 'aal1') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated', 'aal', aal)::text, true);
end;
$$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Datos (como postgres, sin RLS)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@prueba.co'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@prueba.co'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@prueba.co'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@prueba.co'),
  ('00000000-0000-0000-0000-0000000000ad', 'ad@prueba.co');

insert into public.perfiles (id, nombre, rol) values
  ('00000000-0000-0000-0000-0000000000e1', 'Empresa uno', 'empresa'),
  ('00000000-0000-0000-0000-0000000000e2', 'Empresa dos', 'empresa'),
  ('00000000-0000-0000-0000-0000000000c1', 'Consultora uno', 'consultor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Consultor dos', 'consultor'),
  ('00000000-0000-0000-0000-0000000000ad', 'Admin', 'administrador');

insert into public.suscripciones (usuario_id, modalidad, estado, fecha_inicio, fecha_vencimiento) values
  ('00000000-0000-0000-0000-0000000000e1', 'trial', 'trial', current_date, current_date + 7),
  ('00000000-0000-0000-0000-0000000000e2', 'trial', 'vencida', current_date - 40, current_date - 26);

insert into public.convocatorias (id, nombre, entidad_convocante, fecha_cierre, estado, url_postulacion) values
  ('00000000-0000-0000-0000-00000000c001', 'Vigente', 'MinCiencias', current_date + 30, 'publicada', 'https://minciencias.gov.co/x'),
  ('00000000-0000-0000-0000-00000000c002', 'Borrador', 'iNNpulsa', current_date + 30, 'borrador', null),
  ('00000000-0000-0000-0000-00000000c003', 'Vencida', 'SENA', current_date - 1, 'publicada', 'https://sena.edu.co/x');

insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, orden) values
  ('00000000-0000-0000-0000-00000000c001', 'RUT', 'documento', 1),
  ('00000000-0000-0000-0000-00000000c001', 'Cámara de comercio', 'documento', 2);

insert into public.consultor_perfiles (id, nombre_profesional, estado_perfil, sitio_web, cv_path) values
  ('00000000-0000-0000-0000-0000000000c1', 'Consultora uno', 'aprobado', 'https://uno.co', 'cv/c1.pdf'),
  ('00000000-0000-0000-0000-0000000000c2', 'Consultor dos', 'en_revision', 'https://dos.co', 'cv/c2.pdf');

insert into public.consultor_redes (consultor_id, tipo, url) values
  ('00000000-0000-0000-0000-0000000000c1', 'linkedin', 'https://linkedin.com/in/uno');

insert into public.proyectos (id, usuario_id, nombre) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000e1', 'Proyecto E1'),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000e2', 'Proyecto E2');

insert into public.encargos (id, proyecto_id, empresa_id, consultor_id, titulo_tarea, via, estado, tipo_ayuda, convocatoria_id) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b001',
   '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
   'Revisar documento', 'directorio', 'en_curso', 'convocatoria_especifica',
   '00000000-0000-0000-0000-00000000c001');

insert into public.documentos_generados (id, usuario_id, proyecto_id, convocatoria_id, titulo, contenido, estado, ajustes_usados, compartido_con_consultor_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001',
   'Doc E1', 'texto', 'generado', 3, '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000e2',
   '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000c001',
   'Doc E2', 'texto', 'generado', 0, null);

insert into public.eventos_seguridad (tipo, ruta) values ('acceso_denegado', '/admin');

-- ---------------------------------------------------------------------------
-- 0 · Cobertura (RNF-25): toda tabla de public con RLS y al menos una política
-- ---------------------------------------------------------------------------

select pg_temp.ok(count(*) = 26, 'hay 26 tablas en public') from pg_tables where schemaname = 'public';
select pg_temp.ok(bool_and(c.relrowsecurity), 'todas las tablas tienen RLS habilitado')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
select pg_temp.ok(not exists (
  select 1 from pg_tables t
  where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
), 'todas las tablas tienen al menos una política');

-- ---------------------------------------------------------------------------
-- 1 · Anónimo
-- ---------------------------------------------------------------------------

set local role anon;
select pg_temp.ok((select count(*) from public.convocatorias) = 1, 'anon: solo la convocatoria publicada y vigente');
select pg_temp.ok((select count(*) from public.requisitos_convocatoria) = 2, 'anon: requisitos de la vigente');
select pg_temp.ok((select count(*) from public.proyectos) = 0, 'anon: ningún proyecto');
select pg_temp.ok((select count(*) from public.consultor_perfiles) = 1, 'anon: solo consultores aprobados');
select pg_temp.ok((select count(*) from public.consultor_redes) = 0, 'anon: ninguna red social');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = 0, 'anon: ningún evento de seguridad');
select pg_temp.rechaza('select sitio_web from public.consultor_perfiles', 'anon lee sitio_web');
select pg_temp.rechaza('select * from public.contacto_consultor(''00000000-0000-0000-0000-0000000000c1'')', 'anon llama contacto_consultor');
reset role;

-- ---------------------------------------------------------------------------
-- 2 · Empresa 1 (trial vigente, encargo en curso con C1)
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');

select pg_temp.ok((select count(*) from public.proyectos) = 1, 'E1: ve solo su proyecto');
select pg_temp.ok((select count(*) from public.documentos_generados) = 1, 'E1: ve solo su documento');
select pg_temp.ok((select count(*) from public.encargos) = 1, 'E1: ve su encargo');
select pg_temp.ok((select count(*) from public.suscripciones) = 1, 'E1: ve solo su suscripción');
select pg_temp.ok((select count(*) from public.perfiles) = 1, 'E1: ve solo su perfil');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = 0, 'E1: ningún evento de seguridad');
select pg_temp.ok((select count(*) from public.fuentes) = 0, 'E1: no lee fuentes');

insert into public.postulaciones (convocatoria_id, proyecto_id)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001');
select pg_temp.ok((select count(*) from public.postulacion_checklist) = 2, 'E1: el checklist copia los 2 requisitos (RN-04)');
select pg_temp.ok((select count(*) from public.postulacion_historial) = 1, 'E1: el historial registra el estado inicial');
update public.postulaciones set estado = 'presentada';
select pg_temp.ok((select count(*) from public.postulacion_historial) = 2, 'E1: el cambio de estado queda en el historial');
update public.postulacion_checklist set completado = true where orden = 1;
select pg_temp.ok((select count(*) from public.postulacion_checklist where completado_at is not null) = 1, 'E1: marcar fija completado_at');

select pg_temp.rechaza($$insert into public.postulaciones (convocatoria_id) values ('00000000-0000-0000-0000-00000000c002')$$, 'E1 postula a un borrador (RN-03)');
select pg_temp.rechaza($$insert into public.postulaciones (convocatoria_id) values ('00000000-0000-0000-0000-00000000c003')$$, 'E1 postula a una vencida (RF-78)');
select pg_temp.rechaza($$insert into public.postulaciones (convocatoria_id, proyecto_id) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b002')$$, 'E1 postula con el proyecto de E2');
select pg_temp.rechaza($$insert into public.proyectos (usuario_id, nombre) values ('00000000-0000-0000-0000-0000000000e2', 'ajeno')$$, 'E1 crea un proyecto a nombre de E2');
select pg_temp.rechaza($$update public.proyectos set usuario_id = '00000000-0000-0000-0000-0000000000e2'$$, 'E1 regala su proyecto a E2');
select pg_temp.rechaza($$update public.perfiles set rol = 'administrador'$$, 'E1 se asciende a administrador');
select pg_temp.rechaza($$update public.perfiles set mfa_habilitado = true$$, 'E1 marca su MFA sin verificar');
select pg_temp.rechaza($$update public.documentos_generados set ajustes_usados = 0$$, 'E1 reinicia el contador de ajustes (RN-17)');
select pg_temp.rechaza($$update public.documentos_generados set estado = 'exportado'$$, 'E1 marca el documento exportado desde el cliente');
select pg_temp.rechaza($$update public.documentos_generados set compartido_con_consultor_id = null$$, 'E1 revoca sin pasar por la API');
select pg_temp.rechaza($$insert into public.documentos_generados (usuario_id, proyecto_id, convocatoria_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001')$$, 'E1 crea un documento sin generar (sin crédito)');
with r as (update public.suscripciones set creditos_usados_periodo = 0 returning 1)
select pg_temp.ok((select count(*) from r) = 0, 'E1: no puede devolverse créditos');

update public.documentos_generados set contenido = 'editado por E1';
select pg_temp.ok((select estado = 'editado' and ultima_edicion_por = '00000000-0000-0000-0000-0000000000e1'
                   from public.documentos_generados), 'E1: editar el contenido lo marca editado y registra quién');

select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c1')) = 1, 'E1: ve sitio web y CV de C1 (solicitud activa, RF-80)');
select pg_temp.ok((select count(*) from public.consultor_redes) = 1, 'E1: ve las redes de C1');
select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c2')) = 0, 'E1: no ve el contacto de C2');
reset role;

-- ---------------------------------------------------------------------------
-- 3 · Empresa 2 (suscripción vencida, sin encargos)
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000e2');

select pg_temp.ok((select count(*) from public.proyectos) = 1, 'E2: ve solo su proyecto');
select pg_temp.ok((select count(*) from public.postulaciones) = 0, 'E2: no ve la postulación de E1');
select pg_temp.ok((select count(*) from public.postulacion_checklist) = 0, 'E2: no ve el checklist de E1');
select pg_temp.ok((select count(*) from public.documentos_generados) = 1, 'E2: ve solo su documento');
select pg_temp.ok((select count(*) from public.encargos) = 0, 'E2: no ve el encargo de E1');
select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c1')) = 0, 'E2: no ve el contacto de C1 aunque E1 tenga solicitud (RF-80)');
select pg_temp.ok((select count(*) from public.consultor_redes) = 0, 'E2: no ve las redes de C1');
select pg_temp.rechaza($$insert into public.postulaciones (convocatoria_id) values ('00000000-0000-0000-0000-00000000c001')$$, 'E2 postula con la suscripción vencida (RF-17)');

with r as (update public.proyectos set nombre = 'robado' where id = '00000000-0000-0000-0000-00000000b001' returning 1)
select pg_temp.ok((select count(*) from r) = 0, 'E2: editar el proyecto de E1 no afecta filas');
with r as (delete from public.proyectos where id = '00000000-0000-0000-0000-00000000b001' returning 1)
select pg_temp.ok((select count(*) from r) = 0, 'E2: borrar el proyecto de E1 no afecta filas');
reset role;

-- ---------------------------------------------------------------------------
-- 4 · Consultora 1 (encargo en curso, autorizada en el documento de E1)
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');

select pg_temp.ok((select count(*) from public.proyectos) = 1, 'C1: ve el proyecto de su encargo (RN-25)');
select pg_temp.ok((select count(*) from public.convocatorias where id = '00000000-0000-0000-0000-00000000c001') = 1, 'C1: ve la convocatoria del encargo');
select pg_temp.ok((select count(*) from public.documentos_generados) = 1, 'C1: ve el documento autorizado');
select pg_temp.ok((select count(*) from public.postulaciones) = 0, 'C1: no ve postulaciones de la empresa');
update public.documentos_generados set contenido = 'editado por C1';
select pg_temp.ok((select ultima_edicion_por = '00000000-0000-0000-0000-0000000000c1' from public.documentos_generados),
                  'C1: edita el contenido y queda como última edición');
select pg_temp.rechaza($$update public.documentos_generados set titulo = 'otro'$$, 'C1 cambia el título');
select pg_temp.rechaza($$update public.documentos_generados set estado = 'exportado'$$, 'C1 exporta (RF-72)');
select pg_temp.rechaza($$insert into public.proyectos (nombre) values ('del consultor')$$, 'C1 crea un proyecto (RN-28)');
select pg_temp.rechaza($$update public.consultor_perfiles set estado_perfil = 'aprobado', rating_promedio = 5$$, 'C1 se sube el rating');
select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c1')) = 1, 'C1: ve su propio contacto');
reset role;

-- ---------------------------------------------------------------------------
-- 5 · Consultor 2 (sin encargos) y administrador
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000c2');
select pg_temp.ok((select count(*) from public.proyectos) = 0, 'C2: ningún proyecto');
select pg_temp.ok((select count(*) from public.documentos_generados) = 0, 'C2: ningún documento');
select pg_temp.ok((select count(*) from public.encargos) = 0, 'C2: ningún encargo');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.ok((select count(*) from public.proyectos) = 0, 'Admin sin MFA: ningún proyecto (RNF-28)');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = 0, 'Admin sin MFA: ningún evento');
select pg_temp.rechaza($$insert into public.fuentes (nombre) values ('x')$$, 'Admin sin MFA crea una fuente');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pg_temp.ok((select count(*) from public.proyectos) = 2, 'Admin con MFA: lee todos los proyectos');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = 1, 'Admin con MFA: lee eventos de seguridad');
select pg_temp.ok((select count(*) from public.convocatorias) = 3, 'Admin con MFA: lee borradores y vencidas');
select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c2')) = 1, 'Admin con MFA: ve el contacto de un consultor');
insert into public.fuentes (nombre) values ('Fuente admin');
with r as (delete from public.convocatorias returning 1)
select pg_temp.ok((select count(*) from r) = 0, 'Admin con MFA: no borra convocatorias (RN-07)');
reset role;

-- ---------------------------------------------------------------------------
-- 6 · El encargo termina: el acceso derivado cesa y se califica una sola vez
-- ---------------------------------------------------------------------------

update public.encargos set estado = 'completado', completado_at = now()
where id = '00000000-0000-0000-0000-00000000a001';
select pg_temp.ok((select compartido_con_consultor_id is null from public.documentos_generados
                   where id = '00000000-0000-0000-0000-00000000d001'), 'Al completar, se limpia la autorización (RF-76)');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from public.documentos_generados) = 0, 'C1: pierde el documento al completar (RN-27)');
select pg_temp.ok((select count(*) from public.proyectos) = 0, 'C1: pierde el proyecto al completar (RN-25)');

select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok((select count(*) from public.contacto_consultor('00000000-0000-0000-0000-0000000000c1')) = 0, 'E1: con el encargo completado, el contacto vuelve a ocultarse');
insert into public.calificaciones (encargo_id, consultor_id, estrellas)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 5);
select pg_temp.rechaza($$insert into public.calificaciones (encargo_id, consultor_id, estrellas) values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c1', 1)$$, 'E1 califica dos veces (RN-09)');
with r as (update public.calificaciones set estrellas = 1 returning 1)
select pg_temp.ok((select count(*) from r) = 0, 'E1: no puede editar su calificación (RNF-17)');

select pg_temp.como('00000000-0000-0000-0000-0000000000e2');
select pg_temp.ok((select count(*) from public.calificaciones) = 1, 'E2: las calificaciones son públicas');
reset role;

select pg_temp.ok((select estado = 'calificado' from public.encargos where id = '00000000-0000-0000-0000-00000000a001'), 'Calificar marca el encargo calificado');
select pg_temp.ok((select rating_promedio = 5 and total_encargos_completados = 1 from public.consultor_perfiles
                   where id = '00000000-0000-0000-0000-0000000000c1'), 'El trigger actualiza rating y total de C1');

select 'TODAS LAS COMPROBACIONES PASARON' as resultado;

rollback;
