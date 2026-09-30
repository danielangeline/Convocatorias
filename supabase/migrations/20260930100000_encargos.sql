-- Encargos de punta a punta (RF-28..33, RF-68..70, RF-74, RF-89, RF-90, RN-09,
-- RN-25, RN-26, RN-36 · CU-18, 19, 22, 23, 24, 26 · docs/05 §9.23 · sesión 023,
-- Sprint 4 paso 3).
--
-- Las tablas, la lectura por las partes, el rating y la revocación de
-- documentos existen desde el Sprint 0. Aquí se agrega lo que faltaba para
-- servirlos de verdad:
--   · el estado `atendido` y la vía del equipo sin consultor (CU-23, CU-26);
--   · el grafo de estados en la base, también para service_role (RF-29);
--   · una solicitud abierta por proyecto y consultor (RN-36);
--   · las funciones que escriben, cada una con su comprobación de parte y
--     estado de origen;
--   · el correo de la contraparte solo tras aceptar (RF-70, RN-26);
--   · el checklist vinculado para el consultor (RN-25).
-- Decisiones del Product Owner en la sesión 023. La tabla está vacía.

-- ---------------------------------------------------------------------------
-- 1. Estados, vía y columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.encargos drop constraint encargos_estado_check;
alter table public.encargos add constraint encargos_estado_check
  check (estado in ('esperando_asignacion', 'atendido', 'pendiente', 'en_curso', 'rechazado',
                    'completado', 'calificado', 'cancelado'));

alter table public.encargos drop constraint encargos_consultor_segun_estado;

alter table public.encargos
  add column atendido_por uuid references public.perfiles (id),
  add column atendido_at  timestamptz,
  add column nota_interna text check (nota_interna is null or char_length(nota_interna) <= 2000),
  add constraint encargos_consultor_segun_via
    check ((via = 'directorio') = (consultor_id is not null)),
  add constraint encargos_estado_segun_via
    check (estado = 'cancelado'
           or (via = 'asignacion_interna' and estado in ('esperando_asignacion', 'atendido'))
           or (via = 'directorio' and estado in ('pendiente', 'en_curso', 'rechazado',
                                                 'completado', 'calificado'))),
  add constraint encargos_titulo_largo
    check (char_length(trim(titulo_tarea)) between 1 and 200),
  add constraint encargos_descripcion_larga
    check (descripcion_tarea is null or char_length(descripcion_tarea) <= 4000);

alter table public.encargo_avances
  add constraint encargo_avances_nota_larga check (char_length(trim(nota)) between 1 and 2000);

alter table public.calificaciones
  add constraint calificaciones_comentario_largo
    check (comentario is null or char_length(comentario) <= 1000);

-- La nota interna y quién atendió no se leen por columna: el administrador las
-- lee con solicitudes_equipo() (§9.23).
revoke select on public.encargos from anon, authenticated;
grant select (id, proyecto_id, empresa_id, consultor_id, titulo_tarea, descripcion_tarea, via,
              estado, tipo_ayuda, convocatoria_id, postulacion_id, motivo_cancelacion,
              asignado_por, creada_at, aceptado_at, completado_at, atendido_at)
  on public.encargos to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Una solicitud abierta por proyecto y consultor (RN-36)
-- ---------------------------------------------------------------------------
create unique index encargos_uno_abierto_por_consultor
  on public.encargos (proyecto_id, consultor_id)
  where estado in ('pendiente', 'en_curso');

create unique index encargos_uno_al_equipo_por_proyecto
  on public.encargos (proyecto_id)
  where estado = 'esperando_asignacion';

create index encargos_esperando_idx on public.encargos (creada_at)
  where estado = 'esperando_asignacion';

-- ---------------------------------------------------------------------------
-- 3. Grafo de estados y columnas fijas (RF-29). Se aplica a todos, también a
--    service_role y a las funciones security definer.
-- ---------------------------------------------------------------------------
create or replace function privado.transicion_encargo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not ((new.via = 'directorio' and new.estado = 'pendiente')
            or (new.via = 'asignacion_interna' and new.estado = 'esperando_asignacion')) then
      raise exception 'Un encargo nace pendiente o esperando al equipo'
        using errcode = '23514', hint = 'transicion_invalida';
    end if;
    return new;
  end if;

  if new.proyecto_id is distinct from old.proyecto_id
     or new.empresa_id is distinct from old.empresa_id
     or new.consultor_id is distinct from old.consultor_id
     or new.via is distinct from old.via
     or new.tipo_ayuda is distinct from old.tipo_ayuda
     or new.convocatoria_id is distinct from old.convocatoria_id
     or (new.postulacion_id is distinct from old.postulacion_id and new.postulacion_id is not null) then
    raise exception 'Las partes y el contexto de un encargo no cambian'
      using errcode = '42501', hint = 'encargo_fijo';
  end if;

  if new.estado is distinct from old.estado and not (
       (old.estado = 'esperando_asignacion' and new.estado in ('atendido', 'cancelado'))
    or (old.estado = 'pendiente' and new.estado in ('en_curso', 'rechazado', 'cancelado'))
    or (old.estado = 'en_curso' and new.estado in ('completado', 'cancelado'))
    or (old.estado = 'completado' and new.estado = 'calificado')
  ) then
    raise exception 'Transición de encargo no permitida: % → %', old.estado, new.estado
      using errcode = '23514', hint = 'transicion_invalida';
  end if;
  return new;
end;
$$;

create trigger encargos_transicion
  before insert or update on public.encargos
  for each row execute function privado.transicion_encargo();

-- ---------------------------------------------------------------------------
-- 4. Escrituras. security definer: no hay políticas de escritura para
--    authenticated (§9.11 punto 1); cada función comprueba la parte y el
--    estado de origen con la fila bloqueada.
-- ---------------------------------------------------------------------------

-- CU-19, CU-22, CU-23, RF-28, RF-68, RF-74 · Crea la solicitud.
create or replace function public.solicitar_encargo(
  p_proyecto uuid,
  p_consultor uuid,
  p_titulo text,
  p_descripcion text,
  p_tipo_ayuda text,
  p_convocatoria uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_titulo text := nullif(trim(p_titulo), '');
  v_descripcion text := nullif(trim(p_descripcion), '');
  v_convocatoria uuid;
  v_postulacion uuid;
  v_id uuid;
begin
  if privado.rol_actual() is distinct from 'empresa' then
    raise exception 'Solo una empresa solicita consultores' using errcode = '42501', hint = 'no_es_empresa';
  end if;
  if not privado.tiene_suscripcion_vigente(v_uid) then
    raise exception 'Sin suscripción vigente' using errcode = '42501', hint = 'sin_suscripcion';
  end if;
  if not exists (select 1 from public.proyectos p where p.id = p_proyecto and p.usuario_id = v_uid) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;
  if v_titulo is null then
    raise exception 'La tarea lleva título' using hint = 'titulo_vacio';
  end if;
  if p_tipo_ayuda is null or p_tipo_ayuda not in ('convocatoria_especifica', 'buscar_convocatoria') then
    raise exception 'Tipo de ayuda no válido' using hint = 'tipo_ayuda_invalido';
  end if;

  if p_tipo_ayuda = 'convocatoria_especifica' then
    if p_convocatoria is null then
      raise exception 'Falta la convocatoria' using hint = 'falta_convocatoria';
    end if;
    if not exists (
      select 1 from public.convocatorias c
      where c.id = p_convocatoria
        and c.estado = 'publicada'
        and c.fecha_cierre >= privado.hoy_colombia()
    ) then
      raise exception 'La convocatoria no está publicada y vigente' using hint = 'convocatoria_no_vigente';
    end if;
    v_convocatoria := p_convocatoria;
    -- CU-19 2a: la postulación en curso del par se vincula sola.
    select po.id into v_postulacion
    from public.postulaciones po
    where po.usuario_id = v_uid
      and po.proyecto_id = p_proyecto
      and po.convocatoria_id = p_convocatoria
      and po.estado <> 'cerrada'
    limit 1;
  end if;

  if p_consultor is not null and not exists (
    select 1 from public.consultor_perfiles cp
    where cp.id = p_consultor and cp.estado_perfil = 'aprobado' and not cp.es_equipo_interno
  ) then
    raise exception 'El consultor no está disponible' using hint = 'consultor_no_disponible';
  end if;

  begin
    insert into public.encargos (proyecto_id, empresa_id, consultor_id, titulo_tarea, descripcion_tarea,
                                 via, estado, tipo_ayuda, convocatoria_id, postulacion_id)
    values (p_proyecto, v_uid, p_consultor, v_titulo, v_descripcion,
            case when p_consultor is null then 'asignacion_interna' else 'directorio' end,
            case when p_consultor is null then 'esperando_asignacion' else 'pendiente' end,
            p_tipo_ayuda, v_convocatoria, v_postulacion)
    returning id into v_id;
  exception when unique_violation then
    if p_consultor is null then
      raise exception 'Ya hay una solicitud al equipo para este proyecto' using hint = 'ya_solicitado_equipo';
    end if;
    raise exception 'Ya hay una solicitud abierta con este consultor para este proyecto' using hint = 'ya_solicitado';
  end;
  return v_id;
end;
$$;

-- RF-89 · La empresa retira una solicitud sin responder.
create or replace function public.retirar_encargo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select e.estado into v_estado from public.encargos e
  where e.id = p_id and e.empresa_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_estado not in ('pendiente', 'esperando_asignacion') then
    raise exception 'Solo se retira una solicitud sin responder' using hint = 'estado_no_permite';
  end if;
  update public.encargos
  set estado = 'cancelado', motivo_cancelacion = 'Retirada por la empresa'
  where id = p_id;
end;
$$;

-- RF-30, CU-18 · El consultor acepta o rechaza.
create or replace function public.responder_encargo(p_id uuid, p_acepta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select e.estado into v_estado from public.encargos e
  where e.id = p_id and e.consultor_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'Solo se responde una solicitud pendiente' using hint = 'estado_no_permite';
  end if;
  if p_acepta is null then
    raise exception 'Indica si aceptas' using hint = 'respuesta_invalida';
  end if;
  if p_acepta and not exists (
    select 1 from public.consultor_perfiles cp where cp.id = auth.uid() and cp.estado_perfil = 'aprobado'
  ) then
    raise exception 'Tu perfil no está aprobado' using hint = 'perfil_no_aprobado';
  end if;

  if p_acepta then
    update public.encargos set estado = 'en_curso', aceptado_at = now() where id = p_id;
  else
    update public.encargos set estado = 'rechazado' where id = p_id;
  end if;
end;
$$;

-- RF-32 · Nota de avance del consultor en un encargo en curso.
create or replace function public.registrar_avance(p_id uuid, p_nota text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_nota text := nullif(trim(p_nota), '');
  v_avance uuid;
begin
  select e.estado into v_estado from public.encargos e
  where e.id = p_id and e.consultor_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'en_curso' then
    raise exception 'Solo se registran avances en un encargo en curso' using hint = 'estado_no_permite';
  end if;
  if v_nota is null then
    raise exception 'La nota está vacía' using hint = 'nota_vacia';
  end if;
  if char_length(v_nota) > 2000 then
    raise exception 'La nota es demasiado larga' using hint = 'nota_larga';
  end if;
  insert into public.encargo_avances (encargo_id, nota, autor_id)
  values (p_id, v_nota, auth.uid())
  returning id into v_avance;
  return v_avance;
end;
$$;

-- RF-32, RF-33 · El consultor marca la finalización.
create or replace function public.completar_encargo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select e.estado into v_estado from public.encargos e
  where e.id = p_id and e.consultor_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'en_curso' then
    raise exception 'Solo se completa un encargo en curso' using hint = 'estado_no_permite';
  end if;
  update public.encargos set estado = 'completado', completado_at = now() where id = p_id;
end;
$$;

-- RF-33, RN-09, CU-24 · La empresa califica una vez un encargo completado.
create or replace function public.calificar_encargo(p_id uuid, p_estrellas int, p_comentario text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_consultor uuid;
  v_comentario text := nullif(trim(p_comentario), '');
begin
  select e.estado, e.consultor_id into v_estado, v_consultor from public.encargos e
  where e.id = p_id and e.empresa_id = auth.uid()
  for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_estado = 'calificado' then
    raise exception 'El encargo ya tiene calificación' using hint = 'ya_calificado';
  end if;
  if v_estado <> 'completado' then
    raise exception 'Solo se califica un encargo completado' using hint = 'estado_no_permite';
  end if;
  if p_estrellas is null or p_estrellas not between 1 and 5 then
    raise exception 'Las estrellas van de 1 a 5' using hint = 'estrellas_invalidas';
  end if;
  if char_length(v_comentario) > 1000 then
    raise exception 'El comentario es demasiado largo' using hint = 'comentario_largo';
  end if;
  -- El trigger al_calificar pasa el encargo a calificado y recalcula el rating.
  insert into public.calificaciones (encargo_id, consultor_id, empresa_id, estrellas, comentario)
  values (p_id, v_consultor, auth.uid(), p_estrellas, v_comentario);
end;
$$;

-- RF-90, CU-26 · El administrador marca como contactada una solicitud al equipo.
create or replace function public.atender_solicitud_equipo(p_id uuid, p_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador' using errcode = '42501', hint = 'no_autorizado';
  end if;
  select e.estado into v_estado from public.encargos e where e.id = p_id for update;
  if not found then
    raise exception 'La solicitud no existe' using hint = 'no_existe';
  end if;
  if v_estado <> 'esperando_asignacion' then
    raise exception 'La solicitud ya no está esperando' using hint = 'estado_no_permite';
  end if;
  if char_length(v_nota) > 2000 then
    raise exception 'La nota es demasiado larga' using hint = 'nota_larga';
  end if;
  update public.encargos
  set estado = 'atendido', atendido_por = auth.uid(), atendido_at = now(), nota_interna = v_nota
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Lecturas
-- ---------------------------------------------------------------------------

-- RF-70, RN-26 · Nombres y correo de la contraparte de los encargos propios.
-- El correo solo en encargos del directorio en curso, completados o calificados.
create or replace function public.datos_de_mis_encargos()
returns table (
  encargo_id uuid,
  proyecto_nombre text,
  convocatoria_nombre text,
  empresa_nombre text,
  correo_contraparte text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id,
         p.nombre,
         c.nombre,
         coalesce(nullif(pe.nombre_empresa, ''), pe.nombre),
         case
           when e.via = 'directorio' and e.estado in ('en_curso', 'completado', 'calificado') then
             (select u.email from auth.users u
              where u.id = case when e.empresa_id = auth.uid() then e.consultor_id else e.empresa_id end)
         end
  from public.encargos e
  join public.proyectos p on p.id = e.proyecto_id
  join public.perfiles pe on pe.id = e.empresa_id
  left join public.convocatorias c on c.id = e.convocatoria_id
  where auth.uid() in (e.empresa_id, e.consultor_id);
$$;

-- RF-90 · Solicitudes al equipo para el panel.
create or replace function public.solicitudes_equipo(p_estado text)
returns table (
  id uuid,
  proyecto_id uuid,
  empresa_id uuid,
  empresa_nombre text,
  empresa_contacto text,
  empresa_correo text,
  titulo_tarea text,
  descripcion_tarea text,
  tipo_ayuda text,
  convocatoria_id uuid,
  creada_at timestamptz,
  atendido_at timestamptz,
  atendido_por_nombre text,
  nota_interna text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.proyecto_id, e.empresa_id,
         coalesce(nullif(pe.nombre_empresa, ''), pe.nombre),
         pe.nombre,
         u.email,
         e.titulo_tarea, e.descripcion_tarea, e.tipo_ayuda, e.convocatoria_id,
         e.creada_at, e.atendido_at, pa.nombre, e.nota_interna
  from public.encargos e
  join public.perfiles pe on pe.id = e.empresa_id
  join auth.users u on u.id = e.empresa_id
  left join public.perfiles pa on pa.id = e.atendido_por
  where privado.es_admin()
    and e.via = 'asignacion_interna'
    and e.estado = p_estado
    and p_estado in ('esperando_asignacion', 'atendido')
  order by case when p_estado = 'esperando_asignacion' then e.creada_at end asc,
           e.atendido_at desc;
$$;

revoke all on function public.solicitar_encargo(uuid, uuid, text, text, text, uuid) from public, anon;
revoke all on function public.retirar_encargo(uuid) from public, anon;
revoke all on function public.responder_encargo(uuid, boolean) from public, anon;
revoke all on function public.registrar_avance(uuid, text) from public, anon;
revoke all on function public.completar_encargo(uuid) from public, anon;
revoke all on function public.calificar_encargo(uuid, int, text) from public, anon;
revoke all on function public.atender_solicitud_equipo(uuid, text) from public, anon;
revoke all on function public.datos_de_mis_encargos() from public, anon;
revoke all on function public.solicitudes_equipo(text) from public, anon;
grant execute on function public.solicitar_encargo(uuid, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.retirar_encargo(uuid) to authenticated;
grant execute on function public.responder_encargo(uuid, boolean) to authenticated;
grant execute on function public.registrar_avance(uuid, text) to authenticated;
grant execute on function public.completar_encargo(uuid) to authenticated;
grant execute on function public.calificar_encargo(uuid, int, text) to authenticated;
grant execute on function public.atender_solicitud_equipo(uuid, text) to authenticated;
grant execute on function public.datos_de_mis_encargos() to authenticated;
grant execute on function public.solicitudes_equipo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RN-25 ampliado: el consultor ve la postulación vinculada y su checklist
--    mientras el encargo está pendiente o en curso. Solo lectura.
-- ---------------------------------------------------------------------------
create or replace function privado.consultor_ve_postulacion(p_postulacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.postulacion_id = p_postulacion
      and e.consultor_id = auth.uid()
      and e.estado in ('pendiente', 'en_curso')
  );
$$;

revoke all on function privado.consultor_ve_postulacion(uuid) from public, anon;
grant execute on function privado.consultor_ve_postulacion(uuid) to authenticated;

create policy "postulaciones: el consultor ve la de su encargo vigente"
  on public.postulaciones for select to authenticated
  using ((select privado.consultor_ve_postulacion(id)));

create policy "postulacion_checklist: el consultor ve el de su encargo vigente"
  on public.postulacion_checklist for select to authenticated
  using ((select privado.consultor_ve_postulacion(postulacion_id)));
