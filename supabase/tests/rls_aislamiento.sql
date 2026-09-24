-- =============================================================================
-- Prueba cruzada de RLS y del registro (RF-01, RF-37, RN-06, RN-11, RN-31..33, RF-86, RF-87, RNF-03, RNF-25, RNF-16, RN-17, RN-25, RN-27, RNF-28, RF-05, RF-06, RF-08, RN-01, RN-04, RNF-29)
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

grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Datos (como postgres, sin RLS)
-- ---------------------------------------------------------------------------

-- Línea base de los indicadores: la base ya tiene contenido real (sesión 017),
-- así que se comparan diferencias y no cifras absolutas.
create temp table base_indicadores as select * from public.indicadores_catalogo();
grant select on base_indicadores to anon, authenticated;

-- Las cuentas nacen por el trigger de registro (RF-01, RF-37, RN-06, RN-11).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@prueba.co', '{"rol": "empresa", "nombre": "Empresa uno", "nombre_empresa": "Uno SAS"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@prueba.co', '{"nombre": "Empresa dos"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@prueba.co', '{"rol": "consultor", "nombre": "Consultora uno"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@prueba.co', '{"rol": "consultor", "nombre": "Consultor dos"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'ad@prueba.co', '{"rol": "administrador", "nombre": "Admin"}');

select pg_temp.ok((select count(*) from public.planes where es_trial and activo and dias_trial = 7 and creditos_ia_mensuales = 3) = 1,
  'Registro: existe un único plan trial activo de 7 días y 3 créditos (RF-37)');
select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000e1') = 'empresa'
  and (select nombre_empresa from public.perfiles where id = '00000000-0000-0000-0000-0000000000e1') = 'Uno SAS',
  'Registro: la empresa nace con su perfil y nombre de empresa');
select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000e2') = 'empresa',
  'Registro: sin rol en los metadatos nace empresa');
select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000ad') = 'empresa',
  'Registro: pedir rol administrador produce empresa (RN-06)');
select pg_temp.ok((select count(*) from public.suscripciones s join public.planes p on p.id = s.plan_id
                   where s.usuario_id = '00000000-0000-0000-0000-0000000000e1' and s.modalidad = 'trial' and s.estado = 'trial'
                     and p.es_trial and s.fecha_vencimiento = current_date + 7) = 1,
  'Registro: la empresa recibe el trial de 7 días contra el plan trial (RF-37)');
select pg_temp.ok((select count(*) from public.suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000c1') = 0,
  'Registro: el consultor no recibe trial (RN-11)');
select pg_temp.ok((select estado_perfil from public.consultor_perfiles where id = '00000000-0000-0000-0000-0000000000c1') = 'incompleto',
  'Registro: el consultor nace con perfil incompleto (CU-14)');
select pg_temp.rechaza($$insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_vencimiento)
  select '00000000-0000-0000-0000-0000000000e1', id, 'trial', 'trial', current_date + 7 from public.planes where es_trial$$,
  'Un segundo trial para la misma cuenta (RN-11)');
select pg_temp.rechaza($$insert into public.planes (nombre, rol, precio_mensual, precio_anual, es_trial, dias_trial) values ('Otro trial', 'empresa', 0, 0, true, 30)$$,
  'Un segundo plan trial');

-- Ajustes de los datos de prueba (como postgres, que es lo que haría el servidor).
update public.perfiles set rol = 'administrador' where id = '00000000-0000-0000-0000-0000000000ad';
delete from public.suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000ad';
update public.suscripciones set estado = 'vencida', fecha_inicio = current_date - 40, fecha_vencimiento = current_date - 33
where usuario_id = '00000000-0000-0000-0000-0000000000e2';

-- Fechas en hora de Colombia, como la vigencia (sesión 017): con current_date,
-- que va en UTC, la "vencida" seguía vigente desde las 7 p. m. de Colombia.
insert into public.convocatorias (id, nombre, entidad_convocante, fecha_cierre, estado, url_postulacion) values
  ('00000000-0000-0000-0000-00000000c001', 'Vigente', 'MinCiencias', privado.hoy_colombia() + 30, 'publicada', 'https://minciencias.gov.co/x'),
  ('00000000-0000-0000-0000-00000000c002', 'Borrador', 'iNNpulsa', privado.hoy_colombia() + 30, 'borrador', null),
  ('00000000-0000-0000-0000-00000000c003', 'Vencida', 'SENA', privado.hoy_colombia() - 1, 'publicada', 'https://sena.edu.co/x'),
  ('00000000-0000-0000-0000-00000000c004', 'Despublicada', 'SENA', privado.hoy_colombia() + 30, 'despublicada', 'https://sena.edu.co/y'),
  ('00000000-0000-0000-0000-00000000c005', 'Cerrada', 'Bancóldex', privado.hoy_colombia() - 10, 'cerrada', 'https://bancoldex.com/x');

insert into public.requisitos_convocatoria (convocatoria_id, descripcion, tipo, orden) values
  ('00000000-0000-0000-0000-00000000c001', 'RUT', 'documento', 1),
  ('00000000-0000-0000-0000-00000000c001', 'Cámara de comercio', 'documento', 2);

update public.consultor_perfiles set estado_perfil = 'aprobado', sitio_web = 'https://uno.co', cv_path = 'cv/c1.pdf'
where id = '00000000-0000-0000-0000-0000000000c1';
update public.consultor_perfiles set estado_perfil = 'en_revision', sitio_web = 'https://dos.co', cv_path = 'cv/c2.pdf'
where id = '00000000-0000-0000-0000-0000000000c2';

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
-- La tabla real ya tiene eventos: se guarda el total para comparar lo que ve cada rol.
create temp table total_eventos as select count(*) as n from public.eventos_seguridad;
grant select on total_eventos to authenticated;
-- La base remota puede tener invitaciones reales (sesión 011): se cuentan aparte.
create temp table invitaciones_previas as select count(*) as n from public.invitaciones_admin;
grant select on invitaciones_previas to authenticated;
-- Y proyectos reales de empresas (sesión 019): también se cuentan aparte.
create temp table proyectos_previos as select count(*) - 2 as n from public.proyectos;
grant select on proyectos_previos to authenticated;

-- ---------------------------------------------------------------------------
-- 0 · Cobertura (RNF-25): toda tabla de public con RLS y al menos una política
-- ---------------------------------------------------------------------------

select pg_temp.ok(count(*) = 29, 'hay 29 tablas en public (27 + departamentos y convocatoria_departamento, sesión 019)') from pg_tables where schemaname = 'public';
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
select pg_temp.ok((select count(*) from public.convocatorias) = 0, 'anon: no ve el catálogo (RN-33)');
select pg_temp.ok((select count(*) from public.requisitos_convocatoria) = 0, 'anon: no ve requisitos (RN-33)');
select pg_temp.ok((select i.convocatorias_vigentes = b.convocatorias_vigentes + 1
                          and i.entidades between b.entidades and b.entidades + 1
                          and i.consultores_aprobados = b.consultores_aprobados + 1
                     from public.indicadores_catalogo() i, base_indicadores b),
  'anon: solo recibe los indicadores agregados (RF-44)');
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
select pg_temp.ok((select count(*) from public.convocatorias where id = '00000000-0000-0000-0000-00000000c001') = 1
                  and (select count(*) from public.convocatorias where id = '00000000-0000-0000-0000-00000000c002') = 0,
  'E1: la empresa ve el catálogo vigente y no los borradores (RN-33)');
select pg_temp.ok((select count(*) from public.convocatorias where id in ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000c005')) = 2
                  and (select count(*) from public.convocatorias where id = '00000000-0000-0000-0000-00000000c004') = 0,
  'E1: ve las cerradas y las vencidas para el filtro explícito, no las despublicadas (RF-11, RN-02)');
select pg_temp.rechaza($$insert into public.postulaciones (convocatoria_id) values ('00000000-0000-0000-0000-00000000c005')$$, 'E1 postula a una cerrada (RF-78)');
select pg_temp.ok((select count(*) from public.requisitos_convocatoria where convocatoria_id = '00000000-0000-0000-0000-00000000c001') = 2, 'E1: ve los requisitos de la vigente');

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
select pg_temp.ok((select count(*) from public.convocatorias) = 0, 'C2: el consultor no ve el catálogo (RN-33)');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.ok((select count(*) from public.proyectos) = 0, 'Admin sin MFA: ningún proyecto (RNF-28)');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = 0, 'Admin sin MFA: ningún evento');
select pg_temp.rechaza($$insert into public.fuentes (nombre) values ('x')$$, 'Admin sin MFA crea una fuente');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pg_temp.ok((select count(*) from public.proyectos) = 2 + (select n from proyectos_previos), 'Admin con MFA: lee todos los proyectos');
select pg_temp.ok((select count(*) from public.eventos_seguridad) = (select n from total_eventos), 'Admin con MFA: lee todos los eventos de seguridad');
select pg_temp.ok((select count(*) from public.convocatorias where id::text like '00000000-0000-0000-0000-00000000c00%') = 5, 'Admin con MFA: lee borradores, despublicadas, cerradas y vencidas');
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

-- ---------------------------------------------------------------------------
-- 7 · Propietario, invitaciones y revocación (RN-06, RN-31, RN-32, RF-86, RF-87)
-- ---------------------------------------------------------------------------

-- La base real ya tiene Propietario: dentro de esta transacción se le quita la
-- marca para probar con el admin de prueba (el ROLLBACK la devuelve).
update public.perfiles set es_propietario = false where es_propietario;
update public.perfiles set es_propietario = true where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.invitaciones_admin (id, correo, nombre, invitado_por) values
  ('00000000-0000-0000-0000-0000000001a1', 'nuevo.admin@prueba.co', 'Nuevo admin', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000001a2', 'otro.admin@prueba.co', 'Otro admin', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000001a4', 'previa@prueba.co', 'Cuenta previa', '00000000-0000-0000-0000-0000000000ad'),
  ('00000000-0000-0000-0000-0000000001a5', 'se.vence@prueba.co', 'Se vence', '00000000-0000-0000-0000-0000000000ad');
insert into public.invitaciones_admin (id, correo, invitado_por, creada_at, expira_at) values
  ('00000000-0000-0000-0000-0000000001a3', 'vencida@prueba.co', '00000000-0000-0000-0000-0000000000ad', now() - interval '4 days', now() - interval '1 day');

-- Cuentas creadas como las crearía Auth al invitar: el trigger no sabe de invitaciones.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'nuevo.admin@prueba.co'),
  ('00000000-0000-0000-0000-0000000000f2', 'ajeno@prueba.co'),
  ('00000000-0000-0000-0000-0000000000f3', 'vencida@prueba.co'),
  ('00000000-0000-0000-0000-0000000000f5', 'se.vence@prueba.co');
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000f4', 'previa@prueba.co', now() - interval '1 day');
-- Metadatos del usuario pidiendo administrador: el trigger los ignora (RN-06).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'otro.admin@prueba.co', '{"invitacion_id": "00000000-0000-0000-0000-0000000001a2", "rol": "administrador"}');

select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000a2') = 'empresa'
                  and (select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000f1') = 'empresa',
  'Registro: una cuenta invitada nace empresa y los metadatos del usuario no producen administrador (RN-06)');

-- Solo service_role convierte y consulta correos (§9.12).
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000e1')$$,
  'E1 ejecuta aceptar_invitacion_admin');
select pg_temp.rechaza($$select public.correo_tiene_cuenta('nuevo.admin@prueba.co')$$, 'E1 consulta si un correo tiene cuenta');
reset role;
set local role anon;
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a2')$$,
  'anon ejecuta aceptar_invitacion_admin');
reset role;

set local role service_role;
select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a2');
select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a5', '00000000-0000-0000-0000-0000000000f5');
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000000f2')$$,
  'Aceptar con una cuenta de otro correo');
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000000f3')$$,
  'Aceptar una invitación vencida');
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a4', '00000000-0000-0000-0000-0000000000f4')$$,
  'Aceptar con una cuenta anterior a la invitación (RN-32)');
select pg_temp.rechaza($$select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a2')$$,
  'Aceptar dos veces la misma invitación');
select pg_temp.ok(public.correo_tiene_cuenta(' NUEVO.admin@prueba.co ') and not public.correo_tiene_cuenta('nadie@prueba.co'),
  'correo_tiene_cuenta: detecta la cuenta sin importar mayúsculas (RN-32)');
reset role;

select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000a2') = 'administrador'
                  and not exists (select 1 from public.suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000a2'),
  'Invitación aceptada por el servidor: la cuenta pasa a administrador y pierde el trial (RN-32)');
select pg_temp.ok((select usuario_id = '00000000-0000-0000-0000-0000000000a2' and estado = 'pendiente'
                   from public.invitaciones_admin where id = '00000000-0000-0000-0000-0000000001a1'),
  'La invitación queda vinculada y pendiente hasta activar el MFA');
select pg_temp.ok((select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000f2') = 'empresa'
                  and (select rol from public.perfiles where id = '00000000-0000-0000-0000-0000000000f4') = 'empresa',
  'Los intentos rechazados no convierten ninguna cuenta');
select pg_temp.rechaza($$update public.perfiles set es_propietario = true where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'Un segundo Propietario (RN-31)');
select pg_temp.rechaza($$update public.perfiles set admin_revocado_at = now() where id = '00000000-0000-0000-0000-0000000000ad'$$,
  'Revocar al Propietario (RN-31)');
select pg_temp.rechaza($$update public.perfiles set es_propietario = true where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'Propietario sin rol administrador');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.rechaza($$update public.perfiles set es_propietario = true where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'E1 se marca Propietario desde el cliente');
select pg_temp.ok((select count(*) from public.invitaciones_admin) = 0, 'E1: no ve invitaciones');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.ok((select count(*) from public.invitaciones_admin) = 0, 'Propietario sin MFA: no ve invitaciones');
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pg_temp.ok((select count(*) from public.invitaciones_admin) = 5 + (select n from invitaciones_previas), 'Propietario con MFA: ve las invitaciones (RF-86)');
select pg_temp.rechaza($$insert into public.invitaciones_admin (correo, invitado_por) values ('x@prueba.co', '00000000-0000-0000-0000-0000000000ad')$$,
  'El Propietario escribe invitaciones desde el cliente (solo servidor)');

select pg_temp.como('00000000-0000-0000-0000-0000000000a2', 'aal2');
select pg_temp.ok((select count(*) from public.perfiles) > 1, 'Nuevo admin con MFA: tiene privilegios de administrador');
select pg_temp.ok((select count(*) from public.invitaciones_admin) = 0, 'Nuevo admin: no es Propietario, no ve invitaciones (RF-86)');
reset role;

update public.perfiles set admin_revocado_at = now(), admin_revocado_por = '00000000-0000-0000-0000-0000000000ad'
where id = '00000000-0000-0000-0000-0000000000a2';

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000a2', 'aal2');
select pg_temp.ok((select count(*) from public.perfiles) = 1, 'Admin revocado: pierde privilegios en la siguiente consulta, con el mismo JWT (RF-87)');
reset role;

-- Invitación que vence sin activarse: la cuenta pierde los privilegios (§9.12).
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000f5', 'aal2');
select pg_temp.ok((select count(*) from public.perfiles) > 1 and public.rol_efectivo() = 'administrador',
  'Admin con invitación vigente sin activar: tiene privilegios');
reset role;
update public.invitaciones_admin set creada_at = now() - interval '4 days', expira_at = now() - interval '1 minute'
where id = '00000000-0000-0000-0000-0000000001a5';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000f5', 'aal2');
select pg_temp.ok((select count(*) from public.perfiles) = 1 and public.rol_efectivo() is null,
  'Admin con invitación vencida sin activar: sin privilegios y sin rol efectivo');
select pg_temp.como('00000000-0000-0000-0000-0000000000a2', 'aal2');
select pg_temp.ok(public.rol_efectivo() is null, 'Admin revocado: sin rol efectivo (RF-87)');
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(public.rol_efectivo() = 'empresa', 'rol_efectivo de una empresa: empresa');
reset role;

-- ---------------------------------------------------------------------------
-- 8 · Gestión de administradores: invitar, cancelar y revocar (CU-41, RF-86, RF-87)
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pg_temp.ok(public.soy_propietario(), 'soy_propietario: el Propietario con MFA');
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.ok(not public.soy_propietario(), 'soy_propietario: el Propietario sin MFA no lo es');
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(not public.soy_propietario(), 'soy_propietario: una empresa no lo es');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', 'x@prueba.co', 'X')$$,
  'E1 ejecuta crear_invitacion_admin');
select pg_temp.rechaza($$select * from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000001a3')$$,
  'E1 ejecuta cancelar_invitacion_admin');
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000f5')$$,
  'E1 ejecuta revocar_admin');
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', 'x@prueba.co', 'X')$$,
  'El Propietario ejecuta crear_invitacion_admin desde el cliente (solo servidor)');
reset role;

set local role service_role;
-- Invitar
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000e1', 'x@prueba.co', 'X')$$,
  'Invitar en nombre de quien no es Propietario');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000a2', 'x@prueba.co', 'X')$$,
  'Invitar en nombre de un administrador revocado');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', 'no-es-correo', 'X')$$,
  'Invitar un correo no válido');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', ' E1@prueba.co ', 'X')$$,
  'Invitar un correo que ya tiene cuenta (RN-32)');
select pg_temp.rechaza($$select public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', 'SE.VENCE@prueba.co', 'X')$$,
  'Invitar un correo con invitación pendiente (CU-41 3b)');
select pg_temp.ok(public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', ' Cancela@Prueba.co ', ' Por cancelar ') is not null,
  'El Propietario invita un correo sin cuenta');
reset role;
select pg_temp.ok((select correo = 'cancela@prueba.co' and nombre = 'Por cancelar' and estado = 'pendiente'
                          and invitado_por = '00000000-0000-0000-0000-0000000000ad' and expira_at > now() + interval '71 hours'
                   from public.invitaciones_admin where correo = 'cancela@prueba.co'),
  'La invitación nace pendiente, normalizada, a nombre del Propietario y vigente 72 horas');

-- Cancelar una invitación con cuenta vinculada
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'cancela@prueba.co');
set local role service_role;
select public.aceptar_invitacion_admin((select id from public.invitaciones_admin where correo = 'cancela@prueba.co'),
                                       '00000000-0000-0000-0000-0000000000b1');
reset role;
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'aal2');
select pg_temp.ok(public.rol_efectivo() = 'administrador' and not public.soy_propietario(),
  'Cuenta invitada sin activar: administrador mientras la invitación está vigente, no Propietario');
reset role;

set local role service_role;
select pg_temp.rechaza($$select * from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000b1',
                          (select id from public.invitaciones_admin where correo = 'cancela@prueba.co'))$$,
  'Cancelar en nombre de quien no es Propietario');
select pg_temp.ok((select usuario_id = '00000000-0000-0000-0000-0000000000b1' and estado = 'cancelada' and not ya_resuelta
                   from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000ad',
                          (select id from public.invitaciones_admin where correo = 'cancela@prueba.co'))),
  'Cancelar devuelve la cuenta por borrar y marca cancelada');
select pg_temp.ok((select ya_resuelta and usuario_id = '00000000-0000-0000-0000-0000000000b1'
                   from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000ad',
                          (select id from public.invitaciones_admin where correo = 'cancela@prueba.co'))),
  'Cancelar de nuevo con la cuenta sin borrar: reintento');
select pg_temp.ok((select estado = 'vencida' and usuario_id is null and not ya_resuelta
                   from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000001a3')),
  'Cancelar una invitación pendiente ya vencida la marca vencida');
reset role;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'aal2');
select pg_temp.ok(public.rol_efectivo() is null and (select count(*) from public.perfiles) = 1,
  'Invitación cancelada con la cuenta aún sin borrar: sin privilegios');
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.ok((select usuario_id is null and estado = 'cancelada' from public.invitaciones_admin where correo = 'cancela@prueba.co'),
  'Borrar la cuenta deja la invitación cancelada y sin cuenta vinculada');
set local role service_role;
select pg_temp.rechaza($$select * from public.cancelar_invitacion_admin('00000000-0000-0000-0000-0000000000ad',
                          (select id from public.invitaciones_admin where correo = 'cancela@prueba.co'))$$,
  'Cancelar una invitación ya resuelta y sin cuenta');
select pg_temp.ok(public.crear_invitacion_admin('00000000-0000-0000-0000-0000000000ad', 'cancela@prueba.co', null) is not null,
  'Tras cancelar y borrar la cuenta, el correo se puede invitar de nuevo');
reset role;

-- Revocar
insert into public.invitaciones_admin (id, correo, invitado_por) values
  ('00000000-0000-0000-0000-0000000001b2', 'activo@prueba.co', '00000000-0000-0000-0000-0000000000ad');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b2', 'activo@prueba.co');
set local role service_role;
select public.aceptar_invitacion_admin('00000000-0000-0000-0000-0000000001b2', '00000000-0000-0000-0000-0000000000b2');
reset role;
update public.invitaciones_admin set estado = 'aceptada', resuelta_at = now() where id = '00000000-0000-0000-0000-0000000001b2';
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-0000000005b2', '00000000-0000-0000-0000-0000000000b2');

set local role service_role;
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000ad')$$,
  'Un administrador que no es Propietario revoca al Propietario');
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000ad')$$,
  'El Propietario se revoca a sí mismo (RN-31)');
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000e1')$$,
  'Revocar a una empresa');
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000a2')$$,
  'Revocar a un administrador ya revocado');
select pg_temp.rechaza($$select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000f5')$$,
  'Revocar a quien no activó su invitación (se cancela)');
select public.revocar_admin('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000b2');
reset role;

select pg_temp.ok((select admin_revocado_at is not null and admin_revocado_por = '00000000-0000-0000-0000-0000000000ad'
                   from public.perfiles where id = '00000000-0000-0000-0000-0000000000b2')
                  and not exists (select 1 from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000b2'),
  'Revocar marca quién y cuándo y borra las sesiones de Auth (RF-87)');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000b2', 'aal2');
select pg_temp.ok(public.rol_efectivo() is null and (select count(*) from public.perfiles) = 1,
  'Administrador revocado por la función: sin privilegios con el mismo JWT (RF-87)');
reset role;

-- ---------------------------------------------------------------------------
-- 9 · Guardar una convocatoria desde el panel (RF-05, RF-06, RF-08, RN-01, RN-04, §9.13)
-- ---------------------------------------------------------------------------

insert into public.fuentes (id, nombre, activa) values
  ('00000000-0000-0000-0000-00000000f001', 'Fuente activa', true),
  ('00000000-0000-0000-0000-00000000f002', 'Fuente inactiva', false);
insert into public.categorias (id, tipo, nombre, activa) values
  ('00000000-0000-0000-0000-0000000ca701', 'sector', 'Agro prueba', true),
  ('00000000-0000-0000-0000-0000000ca702', 'sector', 'Minería prueba', false);

create temp table datos_c002 as select jsonb_build_object(
  'fuente_id', '00000000-0000-0000-0000-00000000f001', 'nombre', 'Borrador editado', 'entidad_convocante', 'iNNpulsa',
  'monto_min', '1000', 'monto_max', '5000', 'fecha_apertura', privado.hoy_colombia()::text,
  'fecha_cierre', (privado.hoy_colombia() + 30)::text, 'url_postulacion', 'https://innpulsa.gov.co/x') as d;
grant select on datos_c002 to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000e1');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002', (select d from datos_c002), '{}', '[]')$$,
  'Una empresa guarda una convocatoria');
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002', (select d from datos_c002), '{}', '[]')$$,
  'Admin sin MFA guarda una convocatoria (RNF-28)');

select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002', (select d from datos_c002),
  array['00000000-0000-0000-0000-0000000ca701']::uuid[],
  '[{"descripcion": "RUT", "tipo": "documento"}, {"descripcion": "Ser pyme", "tipo": "condicion", "obligatorio": false}]');
select pg_temp.ok((select nombre = 'Borrador editado' and estado = 'borrador' and monto_max = 5000
                   and fuente_id = '00000000-0000-0000-0000-00000000f001'
                   from public.convocatorias where id = '00000000-0000-0000-0000-00000000c002')
                  and (select count(*) from public.convocatoria_categoria where convocatoria_id = '00000000-0000-0000-0000-00000000c002') = 1
                  and (select string_agg(descripcion || ':' || orden || ':' || obligatorio, ',' order by orden)
                       from public.requisitos_convocatoria where convocatoria_id = '00000000-0000-0000-0000-00000000c002')
                      = 'RUT:1:true,Ser pyme:2:false',
  'Admin con MFA: guarda datos, categorías y requisitos en orden sin tocar el estado');

select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002',
  (select d || '{"fuente_id": "00000000-0000-0000-0000-00000000f002"}' from datos_c002), '{}', '[]')$$,
  'Asignar una fuente inactiva (CU-02)');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002', (select d from datos_c002),
  array['00000000-0000-0000-0000-0000000ca702']::uuid[], '[]')$$,
  'Asignar una categoría inactiva (RF-06)');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002',
  (select d || '{"url_postulacion": "javascript:alert(1)"}' from datos_c002), '{}', '[]')$$,
  'Guardar un enlace javascript: (RNF-29)');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c002',
  (select d from datos_c002), '{}',
  (select jsonb_build_array(jsonb_build_object('id', id, 'descripcion', 'x', 'tipo', 'documento'))
   from public.requisitos_convocatoria where convocatoria_id = '00000000-0000-0000-0000-00000000c001' limit 1))$$,
  'Editar un requisito de otra convocatoria');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c001',
  (select d || '{"nombre": "Vigente", "entidad_convocante": "MinCiencias", "url_postulacion": ""}' from datos_c002), '{}',
  '[{"descripcion": "RUT", "tipo": "documento"}]')$$,
  'Dejar una publicada sin enlace oficial (RN-01)');
select pg_temp.rechaza($$select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c001',
  (select d || '{"nombre": "Vigente", "entidad_convocante": "MinCiencias"}' from datos_c002), '{}', '[]')$$,
  'Dejar una publicada sin requisitos (RN-01)');

-- Retirar un requisito no altera el checklist ya copiado (RN-04). Desde la
-- sesión 016 una publicada no puede quedar con menos de dos requisitos (RN-01),
-- así que primero se despublica, que es el camino que la regla exige.
reset role;
update public.convocatorias set estado = 'despublicada' where id = '00000000-0000-0000-0000-00000000c001';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.guardar_convocatoria('00000000-0000-0000-0000-00000000c001',
  (select d || '{"nombre": "Vigente", "entidad_convocante": "MinCiencias", "url_postulacion": "https://minciencias.gov.co/x"}' from datos_c002),
  '{}',
  (select jsonb_build_array(jsonb_build_object('id', id, 'descripcion', descripcion, 'tipo', tipo))
   from public.requisitos_convocatoria where convocatoria_id = '00000000-0000-0000-0000-00000000c001' and orden = 1));
select pg_temp.ok((select count(*) from public.requisitos_convocatoria where convocatoria_id = '00000000-0000-0000-0000-00000000c001') = 1
                  and (select estado from public.convocatorias where id = '00000000-0000-0000-0000-00000000c001') = 'despublicada',
  'Admin con MFA: retira un requisito de una despublicada');
reset role;
select pg_temp.ok((select count(*) from public.postulacion_checklist) = 2
                  and (select count(*) from public.postulacion_checklist where requisito_id is null) = 1,
  'El checklist ya copiado conserva sus 2 ítems (RN-04)');

select 'TODAS LAS COMPROBACIONES PASARON' as resultado;

rollback;
