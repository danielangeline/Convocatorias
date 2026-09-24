-- Postulaciones con checklist (RF-17, RF-18, RN-04, RN-35 · CU-11, CU-12 ·
-- docs/05 §9.19 · sesión 020, Sprint 3 paso 3).
--
-- Las tablas, la copia del checklist (RN-04), el historial y la vigencia al
-- crear (RF-78) existen desde el Sprint 0 y la sesión 017. Aquí se agrega lo
-- que faltaba para servirlas de verdad:
--   · la postulación nace siempre en `en_preparacion` (CU-11);
--   · una sola en curso por par proyecto-convocatoria (RN-35);
--   · el proyecto se vincula una sola vez (RN-35, CU-13 3a);
--   · el checklist no se marca en una cerrada (RN-35, CU-12 2a);
--   · `iniciar_postulacion()`, que crea o devuelve la existente.
-- Decisiones del Product Owner en la sesión 020.

-- ---------------------------------------------------------------------------
-- 1. Nace en preparación (CU-11). La política de inserción es la de la sesión
--    017 (hoy en Colombia) más el estado.
-- ---------------------------------------------------------------------------
drop policy if exists "postulaciones: la empresa inicia las suyas" on public.postulaciones;
create policy "postulaciones: la empresa inicia las suyas"
  on public.postulaciones for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and estado = 'en_preparacion'
    and (select privado.rol_actual()) = 'empresa'
    and (select privado.tiene_suscripcion_vigente((select auth.uid())))
    and exists (
      select 1 from public.convocatorias c
      where c.id = convocatoria_id
        and c.estado = 'publicada'
        and c.fecha_cierre >= (select privado.hoy_colombia())
    )
    and (proyecto_id is null or (select privado.es_dueno_proyecto(proyecto_id)))
  );

-- ---------------------------------------------------------------------------
-- 2. Una en curso por par (RN-35). Con proyecto, un índice único parcial. Sin
--    proyecto se comprueba al crear, en iniciar_postulacion(): al borrar un
--    proyecto sus postulaciones quedan sin proyecto (on delete set null), y un
--    índice sobre esas filas impediría borrarlo.
-- ---------------------------------------------------------------------------
create unique index postulaciones_una_en_curso_por_par
  on public.postulaciones (usuario_id, convocatoria_id, proyecto_id)
  where estado <> 'cerrada' and proyecto_id is not null;

-- ---------------------------------------------------------------------------
-- 3. El proyecto se vincula una sola vez (RN-35). El `set null` de la clave
--    foránea al borrar el proyecto corre como dueño de la tabla, no como
--    cliente, así que no lo frena esta regla.
-- ---------------------------------------------------------------------------
create or replace function privado.guardar_columnas_postulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente()
     and (new.usuario_id is distinct from old.usuario_id
          or new.convocatoria_id is distinct from old.convocatoria_id) then
    raise exception 'No puedes cambiar el propietario ni la convocatoria de una postulación'
      using errcode = '42501';
  end if;
  if privado.es_cliente()
     and old.proyecto_id is not null
     and new.proyecto_id is distinct from old.proyecto_id then
    raise exception 'El proyecto de una postulación no se cambia una vez vinculado'
      using errcode = '42501', hint = 'proyecto_fijo';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. El checklist se marca hasta que la postulación se cierra (RN-35, CU-12 2a).
-- ---------------------------------------------------------------------------
create or replace function privado.guardar_columnas_checklist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente()
     and (new.postulacion_id is distinct from old.postulacion_id
          or new.requisito_id is distinct from old.requisito_id
          or new.descripcion is distinct from old.descripcion
          or new.obligatorio is distinct from old.obligatorio
          or new.orden is distinct from old.orden) then
    raise exception 'Solo puedes marcar o desmarcar los ítems del checklist' using errcode = '42501';
  end if;
  if privado.es_cliente() and exists (
    select 1 from public.postulaciones p
     where p.id = new.postulacion_id and p.estado = 'cerrada'
  ) then
    raise exception 'La postulación está cerrada: su checklist es de solo lectura'
      using errcode = '42501', hint = 'postulacion_cerrada';
  end if;
  new.completado_at := case when new.completado then coalesce(old.completado_at, now()) end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. iniciar_postulacion (RF-17, CU-11). `security invoker`: la RLS decide.
--    Devuelve la postulación en curso del par si ya existe (CU-11 1c) o la crea;
--    el checklist lo copia el trigger de siempre (RN-04) y la vigencia la exige
--    el de la sesión 017 (RF-78, clave `convocatoria_no_vigente`).
-- ---------------------------------------------------------------------------
create or replace function public.iniciar_postulacion(p_convocatoria uuid, p_proyecto uuid)
returns table (id uuid, creada boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
begin
  if (select privado.rol_actual()) is distinct from 'empresa' then
    raise exception 'Solo una empresa inicia postulaciones' using errcode = '42501', hint = 'no_es_empresa';
  end if;

  -- CU-11 1b, RF-17: suscripción vigente o trial (RNF-20).
  if not (select privado.tiene_suscripcion_vigente((select auth.uid()))) then
    raise exception 'Hace falta una suscripción vigente para postular' using hint = 'sin_suscripcion';
  end if;

  -- Lo que la sesión no ve no existe para ella (RN-33, RN-30).
  if not exists (select 1 from public.convocatorias c where c.id = p_convocatoria) then
    raise exception 'La convocatoria no existe' using hint = 'convocatoria_no_existe';
  end if;
  if p_proyecto is not null and not exists (select 1 from public.proyectos p where p.id = p_proyecto) then
    raise exception 'El proyecto no existe' using hint = 'proyecto_no_existe';
  end if;

  -- Dos clics seguidos no crean dos: se serializan por par.
  perform pg_advisory_xact_lock(hashtextextended(
    'postulacion:' || auth.uid()::text || ':' || p_convocatoria::text || ':' || coalesce(p_proyecto::text, '-'), 0));

  -- CU-11 1c, RN-35: la en curso del par, si existe.
  select p.id into v_id
    from public.postulaciones p
   where p.usuario_id = auth.uid()
     and p.convocatoria_id = p_convocatoria
     and p.proyecto_id is not distinct from p_proyecto
     and p.estado <> 'cerrada'
   order by p.creada_at
   limit 1;
  if found then
    return query select v_id, false;
    return;
  end if;

  insert into public.postulaciones (convocatoria_id, proyecto_id)
  values (p_convocatoria, p_proyecto)
  returning postulaciones.id into v_id;

  return query select v_id, true;
end;
$$;

revoke all on function public.iniciar_postulacion(uuid, uuid) from public, anon;
grant execute on function public.iniciar_postulacion(uuid, uuid) to authenticated;
