-- Búsqueda y propuestas de convocatorias en un encargo "buscar convocatoria"
-- (RF-91, RF-92, RF-93, RF-69, RN-25, RN-33 · CU-18, CU-22 · docs/05 §9.25 ·
-- sesión 025, Sprint 5).
--
-- Decisiones del Product Owner (sesión 024): con el encargo `en_curso`, el
-- consultor ve todo el catálogo vigente desde el encargo y las sugerencias del
-- proyecto; propone convocatorias con una nota; la empresa elige una y el
-- encargo sigue con ella.
--
--   1. Tabla 31, `encargo_propuestas`, con RLS de lectura para las partes.
--   2. El cálculo de las sugerencias, compartido por la empresa y el consultor.
--   3. La excepción de RN-33: el catálogo vigente para el consultor que busca.
--   4. RN-25: la convocatoria elegida se ve como la de un encargo específico.
--   5. El trigger de §9.23 admite fijar la convocatoria elegida y vincular la
--      postulación después; las propuestas abiertas se descartan al terminar.
--   6. Proponer, retirar, elegir y leer.
--   7. iniciar_postulacion vincula la postulación al encargo (CU-22 paso 7).

-- ---------------------------------------------------------------------------
-- 1. Tabla 31
-- ---------------------------------------------------------------------------
create table public.encargo_propuestas (
  id               uuid primary key default gen_random_uuid(),
  encargo_id       uuid not null references public.encargos (id) on delete cascade,
  convocatoria_id  uuid not null references public.convocatorias (id),
  nota             text not null check (char_length(trim(nota)) between 1 and 1000),
  estado           text not null default 'propuesta'
                   check (estado in ('propuesta', 'elegida', 'retirada', 'descartada')),
  creada_at        timestamptz not null default now(),
  resuelta_at      timestamptz,
  constraint encargo_propuestas_resuelta_segun_estado
    check ((estado = 'propuesta') = (resuelta_at is null)),
  constraint encargo_propuestas_una_por_convocatoria unique (encargo_id, convocatoria_id)
);

create unique index encargo_propuestas_una_elegida
  on public.encargo_propuestas (encargo_id) where estado = 'elegida';
create index encargo_propuestas_convocatoria_idx on public.encargo_propuestas (convocatoria_id);

alter table public.encargo_propuestas enable row level security;

create policy "encargo_propuestas: las partes del encargo leen"
  on public.encargo_propuestas for select to authenticated
  using ((select privado.es_parte_encargo(encargo_id)));

create policy "encargo_propuestas: el administrador lee todo"
  on public.encargo_propuestas for select to authenticated
  using ((select privado.es_admin()));

-- Sin políticas de escritura: solo escriben las funciones de la sección 6.

-- ---------------------------------------------------------------------------
-- 2. Sugerencias: un solo cálculo (RF-15, RF-16, RN-05; docs/05 §9.6)
-- ---------------------------------------------------------------------------
-- security definer: quien llama ya comprobó que puede ver el proyecto. Solo
-- cuentan las categorías activas, igual que cuando la RLS las filtraba.
create or replace function privado.calcular_sugerencias(p_proyecto uuid)
returns table (
  convocatoria_id  uuid,
  tipo_proyecto    boolean,
  sector           boolean,
  tipo_entidad     boolean,
  monto            boolean,
  ubicacion        boolean,
  coincidencias    integer,
  porcentaje       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_monto  numeric;
  v_depto  text;
begin
  select p.monto_buscado, p.departamento_codigo into v_monto, v_depto
    from public.proyectos p where p.id = p_proyecto;
  if not found then
    return;
  end if;

  return query
  with vigentes as (
    select c.id, c.monto_min, c.monto_max, c.cobertura_nacional, c.fecha_cierre
      from public.convocatorias c
     where c.estado = 'publicada'
       and c.fecha_cierre >= privado.hoy_colombia()
  ),
  por_tipo as (
    select cc.convocatoria_id as id,
           bool_or(k.tipo = 'tipo_proyecto') as tp,
           bool_or(k.tipo = 'sector')        as se,
           bool_or(k.tipo = 'tipo_entidad')  as te
      from public.convocatoria_categoria cc
      join public.proyecto_categoria pc on pc.categoria_id = cc.categoria_id and pc.proyecto_id = p_proyecto
      join public.categorias k on k.id = cc.categoria_id and k.activa
     where cc.convocatoria_id in (select v.id from vigentes v)
     group by cc.convocatoria_id
  ),
  evaluadas as (
    select v.id, v.fecha_cierre,
           coalesce(t.tp, false) as tp,
           coalesce(t.se, false) as se,
           coalesce(t.te, false) as te,
           (v_monto is not null
             and (v.monto_min is null or v_monto >= v.monto_min)
             and (v.monto_max is null or v_monto <= v.monto_max)) as mo,
           (v.cobertura_nacional
             or (v_depto is not null and exists (
                   select 1 from public.convocatoria_departamento cd
                    where cd.convocatoria_id = v.id and cd.departamento_codigo = v_depto))) as ub
      from vigentes v
      left join por_tipo t on t.id = v.id
  )
  select e.id, e.tp, e.se, e.te, e.mo, e.ub, n.total,
         round(n.total * 100.0 / 5)::integer
    from evaluadas e
    cross join lateral (select e.tp::int + e.se::int + e.te::int + e.mo::int + e.ub::int as total) n
   order by n.total desc, e.fecha_cierre asc, e.id;
end;
$$;

revoke all on function privado.calcular_sugerencias(uuid) from public, anon, authenticated;

-- La de la empresa conserva sus comprobaciones (suscripción y proyecto propio
-- por RLS) y delega el cálculo. Pasa a definer para poder llamar al privado;
-- la visibilidad del proyecto la comprueba igual, con la sesión.
create or replace function public.sugerencias_proyecto(p_proyecto uuid)
returns table (
  convocatoria_id  uuid,
  tipo_proyecto    boolean,
  sector           boolean,
  tipo_entidad     boolean,
  monto            boolean,
  ubicacion        boolean,
  coincidencias    integer,
  porcentaje       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- CU-10, precondición: suscripción vigente o trial (RNF-20).
  if not privado.tiene_suscripcion_vigente(auth.uid()) then
    raise exception 'Hace falta una suscripción vigente para ver sugerencias' using hint = 'sin_suscripcion';
  end if;
  -- Antes lo decidía la RLS: solo el dueño ve su proyecto (RN-30).
  if not exists (select 1 from public.proyectos p where p.id = p_proyecto and p.usuario_id = auth.uid()) then
    raise exception 'El proyecto no existe' using hint = 'no_existe';
  end if;
  return query select * from privado.calcular_sugerencias(p_proyecto);
end;
$$;

revoke all on function public.sugerencias_proyecto(uuid) from public, anon;
grant execute on function public.sugerencias_proyecto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RN-33, excepción (RF-91): el catálogo vigente para el consultor que busca
-- ---------------------------------------------------------------------------
create or replace function privado.consultor_busca_convocatorias()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.consultor_id = auth.uid()
      and e.tipo_ayuda = 'buscar_convocatoria'
      and e.estado = 'en_curso'
  );
$$;

revoke all on function privado.consultor_busca_convocatorias() from public, anon;
grant execute on function privado.consultor_busca_convocatorias() to authenticated;

-- Las tablas hijas (categorías, departamentos, requisitos, documentos) y el
-- bucket de adjuntos heredan esta visibilidad: sus políticas preguntan si la
-- convocatoria es visible.
create policy "convocatorias: el consultor que busca ve las vigentes"
  on public.convocatorias for select to authenticated
  using (estado = 'publicada'
         and fecha_cierre >= (select privado.hoy_colombia())
         and (select privado.consultor_busca_convocatorias()));

-- ---------------------------------------------------------------------------
-- 4. RN-25: la convocatoria del encargo, también la elegida en uno de búsqueda
-- ---------------------------------------------------------------------------
create or replace function privado.consultor_ve_convocatoria(p_convocatoria uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encargos e
    where e.convocatoria_id = p_convocatoria
      and e.consultor_id = auth.uid()
      and e.estado in ('pendiente', 'en_curso', 'esperando_asignacion')
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Trigger de §9.23: dos excepciones estructurales, y el descarte al terminar
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
     or new.tipo_ayuda is distinct from old.tipo_ayuda then
    raise exception 'Las partes y el contexto de un encargo no cambian'
      using errcode = '42501', hint = 'encargo_fijo';
  end if;

  -- RF-93: la convocatoria se fija una vez, en un encargo de búsqueda en curso,
  -- y solo la que la empresa eligió entre las propuestas.
  if new.convocatoria_id is distinct from old.convocatoria_id and not (
       old.convocatoria_id is null
       and new.convocatoria_id is not null
       and old.tipo_ayuda = 'buscar_convocatoria'
       and old.estado = 'en_curso'
       and exists (select 1 from public.encargo_propuestas pr
                   where pr.encargo_id = old.id
                     and pr.convocatoria_id = new.convocatoria_id
                     and pr.estado = 'elegida')
  ) then
    raise exception 'Las partes y el contexto de un encargo no cambian'
      using errcode = '42501', hint = 'encargo_fijo';
  end if;

  -- CU-19 2a y CU-22 paso 7: la postulación se vincula una vez, si es de la
  -- empresa del encargo, sobre su proyecto y su convocatoria. Volver a nulo lo
  -- hace el `on delete set null`.
  if new.postulacion_id is distinct from old.postulacion_id and new.postulacion_id is not null and not (
       old.postulacion_id is null
       and exists (select 1 from public.postulaciones po
                   where po.id = new.postulacion_id
                     and po.usuario_id = old.empresa_id
                     and po.proyecto_id = old.proyecto_id
                     and po.convocatoria_id = new.convocatoria_id)
  ) then
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

-- Al salir de `en_curso` (completado o cancelado, también por un job o por la
-- suspensión del consultor), las propuestas abiertas quedan descartadas.
create or replace function privado.descartar_propuestas_abiertas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.encargo_propuestas
     set estado = 'descartada', resuelta_at = now()
   where encargo_id = new.id and estado = 'propuesta';
  return new;
end;
$$;

create trigger encargos_descartar_propuestas
  after update of estado on public.encargos
  for each row
  when (old.estado = 'en_curso' and new.estado <> 'en_curso')
  execute function privado.descartar_propuestas_abiertas();

-- ---------------------------------------------------------------------------
-- 6. Escrituras y lectura (todas security definer, con la fila bloqueada)
-- ---------------------------------------------------------------------------

-- RF-92 · El consultor propone una convocatoria vigente con una nota.
create or replace function public.proponer_convocatoria(p_encargo uuid, p_convocatoria uuid, p_nota text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_estado text;
  v_nota text := nullif(trim(p_nota), '');
  v_id uuid;
begin
  select e.tipo_ayuda, e.estado into v_tipo, v_estado
    from public.encargos e
   where e.id = p_encargo and e.consultor_id = auth.uid()
     for update;
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  if v_tipo <> 'buscar_convocatoria' or v_estado <> 'en_curso'
     or exists (select 1 from public.encargo_propuestas pr where pr.encargo_id = p_encargo and pr.estado = 'elegida') then
    raise exception 'Este encargo ya no admite propuestas' using hint = 'encargo_no_admite_propuestas';
  end if;
  if v_nota is null or char_length(v_nota) > 1000 then
    raise exception 'La nota va de 1 a 1.000 caracteres' using hint = 'nota_invalida';
  end if;
  if not exists (select 1 from public.convocatorias c
                 where c.id = p_convocatoria and c.estado = 'publicada'
                   and c.fecha_cierre >= privado.hoy_colombia()) then
    raise exception 'La convocatoria no está publicada y vigente' using hint = 'convocatoria_no_vigente';
  end if;

  begin
    insert into public.encargo_propuestas (encargo_id, convocatoria_id, nota)
    values (p_encargo, p_convocatoria, v_nota)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Esa convocatoria ya está propuesta en este encargo' using hint = 'ya_propuesta';
  end;
  return v_id;
end;
$$;

-- RF-92 · El consultor retira una propuesta que la empresa no ha elegido.
create or replace function public.retirar_propuesta(p_propuesta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encargo uuid;
  v_estado text;
begin
  select pr.encargo_id into v_encargo
    from public.encargo_propuestas pr
    join public.encargos e on e.id = pr.encargo_id
   where pr.id = p_propuesta and e.consultor_id = auth.uid();
  if not found then
    raise exception 'La propuesta no existe' using hint = 'no_existe';
  end if;
  -- El mismo orden de bloqueo que elegir: primero el encargo.
  perform 1 from public.encargos e where e.id = v_encargo for update;
  select pr.estado into v_estado from public.encargo_propuestas pr where pr.id = p_propuesta for update;
  if v_estado <> 'propuesta' then
    raise exception 'La propuesta ya fue resuelta' using hint = 'estado_no_permite';
  end if;
  update public.encargo_propuestas set estado = 'retirada', resuelta_at = now() where id = p_propuesta;
end;
$$;

-- RF-93 · La empresa elige una propuesta: queda como la convocatoria del
-- encargo, que sigue en curso; las demás se descartan; y si ya hay una
-- postulación en curso del par, se vincula (CU-19 2a).
create or replace function public.elegir_propuesta(p_propuesta uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encargo uuid;
  v_convocatoria uuid;
  v_empresa uuid;
  v_proyecto uuid;
  v_estado_encargo text;
  v_estado text;
  v_postulacion uuid;
begin
  select pr.encargo_id into v_encargo
    from public.encargo_propuestas pr
    join public.encargos e on e.id = pr.encargo_id
   where pr.id = p_propuesta and e.empresa_id = auth.uid();
  if not found then
    raise exception 'La propuesta no existe' using hint = 'no_existe';
  end if;

  select e.estado, e.empresa_id, e.proyecto_id into v_estado_encargo, v_empresa, v_proyecto
    from public.encargos e where e.id = v_encargo for update;
  select pr.estado, pr.convocatoria_id into v_estado, v_convocatoria
    from public.encargo_propuestas pr where pr.id = p_propuesta for update;

  if v_estado_encargo <> 'en_curso' then
    raise exception 'El encargo ya no está en curso' using hint = 'estado_no_permite';
  end if;
  if exists (select 1 from public.encargo_propuestas pr where pr.encargo_id = v_encargo and pr.estado = 'elegida') then
    raise exception 'Ya elegiste una convocatoria para este encargo' using hint = 'ya_elegida';
  end if;
  if v_estado <> 'propuesta' then
    raise exception 'La propuesta ya fue resuelta' using hint = 'estado_no_permite';
  end if;
  -- RF-78: sigue publicada y vigente.
  if not exists (select 1 from public.convocatorias c
                 where c.id = v_convocatoria and c.estado = 'publicada'
                   and c.fecha_cierre >= privado.hoy_colombia()) then
    raise exception 'La convocatoria ya no está publicada y vigente' using hint = 'convocatoria_no_vigente';
  end if;

  update public.encargo_propuestas set estado = 'elegida', resuelta_at = now() where id = p_propuesta;
  update public.encargo_propuestas set estado = 'descartada', resuelta_at = now()
   where encargo_id = v_encargo and estado = 'propuesta';

  select po.id into v_postulacion
    from public.postulaciones po
   where po.usuario_id = v_empresa
     and po.proyecto_id = v_proyecto
     and po.convocatoria_id = v_convocatoria
     and po.estado <> 'cerrada'
   order by po.creada_at
   limit 1;

  update public.encargos
     set convocatoria_id = v_convocatoria,
         postulacion_id = coalesce(postulacion_id, v_postulacion)
   where id = v_encargo;
  return v_convocatoria;
end;
$$;

-- RF-92, RF-93 · Las propuestas de un encargo para sus partes (y el
-- administrador), con los datos de la convocatoria —que el consultor quizá ya
-- no lee— y la compatibilidad con el proyecto, calculada ahora. Una que dejó
-- de estar vigente no tiene porcentaje.
create or replace function public.propuestas_de_encargo(p_encargo uuid)
returns table (
  id               uuid,
  convocatoria_id  uuid,
  nota             text,
  estado           text,
  creada_at        timestamptz,
  resuelta_at      timestamptz,
  convocatoria_nombre  text,
  entidad          text,
  fecha_cierre     date,
  vigente          boolean,
  porcentaje       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_proyecto uuid;
begin
  select e.proyecto_id into v_proyecto
    from public.encargos e
   where e.id = p_encargo
     and (auth.uid() in (e.empresa_id, e.consultor_id) or privado.es_admin());
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;

  return query
  select pr.id, pr.convocatoria_id, pr.nota, pr.estado, pr.creada_at, pr.resuelta_at,
         c.nombre, c.entidad_convocante, c.fecha_cierre,
         (c.estado = 'publicada' and c.fecha_cierre >= privado.hoy_colombia()),
         s.porcentaje
    from public.encargo_propuestas pr
    join public.convocatorias c on c.id = pr.convocatoria_id
    left join privado.calcular_sugerencias(v_proyecto) s on s.convocatoria_id = pr.convocatoria_id
   where pr.encargo_id = p_encargo
   order by case pr.estado when 'elegida' then 0 when 'propuesta' then 1 else 2 end, pr.creada_at;
end;
$$;

-- RF-91 · Las sugerencias del proyecto para el consultor de un encargo de
-- búsqueda en curso. No exige la suscripción de la empresa.
create or replace function public.sugerencias_encargo(p_encargo uuid)
returns table (
  convocatoria_id  uuid,
  tipo_proyecto    boolean,
  sector           boolean,
  tipo_entidad     boolean,
  monto            boolean,
  ubicacion        boolean,
  coincidencias    integer,
  porcentaje       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_proyecto uuid;
begin
  select e.proyecto_id into v_proyecto
    from public.encargos e
   where e.id = p_encargo
     and e.consultor_id = auth.uid()
     and e.tipo_ayuda = 'buscar_convocatoria'
     and e.estado = 'en_curso';
  if not found then
    raise exception 'El encargo no existe' using hint = 'no_existe';
  end if;
  return query select * from privado.calcular_sugerencias(v_proyecto);
end;
$$;

revoke all on function public.proponer_convocatoria(uuid, uuid, text) from public, anon;
revoke all on function public.retirar_propuesta(uuid) from public, anon;
revoke all on function public.elegir_propuesta(uuid) from public, anon;
revoke all on function public.propuestas_de_encargo(uuid) from public, anon;
revoke all on function public.sugerencias_encargo(uuid) from public, anon;
grant execute on function public.proponer_convocatoria(uuid, uuid, text) to authenticated;
grant execute on function public.retirar_propuesta(uuid) to authenticated;
grant execute on function public.elegir_propuesta(uuid) to authenticated;
grant execute on function public.propuestas_de_encargo(uuid) to authenticated;
grant execute on function public.sugerencias_encargo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. CU-22 paso 7: la postulación nueva se vincula al encargo en curso
-- ---------------------------------------------------------------------------
create or replace function privado.vincular_postulacion_a_encargos(p_postulacion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.encargos e
     set postulacion_id = po.id
    from public.postulaciones po
   where po.id = p_postulacion
     and po.usuario_id = auth.uid()
     and po.proyecto_id is not null
     and e.empresa_id = po.usuario_id
     and e.proyecto_id = po.proyecto_id
     and e.convocatoria_id = po.convocatoria_id
     and e.estado = 'en_curso'
     and e.postulacion_id is null;
end;
$$;

revoke all on function privado.vincular_postulacion_a_encargos(uuid) from public, anon;
grant execute on function privado.vincular_postulacion_a_encargos(uuid) to authenticated;

create or replace function public.iniciar_postulacion(p_convocatoria uuid, p_proyecto uuid)
returns table (id uuid, creada boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_creada boolean := false;
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

  if v_id is null then
    insert into public.postulaciones (convocatoria_id, proyecto_id)
    values (p_convocatoria, p_proyecto)
    returning postulaciones.id into v_id;
    v_creada := true;
  end if;

  -- CU-22 paso 7, RN-25: el encargo en curso del par queda con su checklist.
  perform privado.vincular_postulacion_a_encargos(v_id);

  return query select v_id, v_creada;
end;
$$;

revoke all on function public.iniciar_postulacion(uuid, uuid) from public, anon;
grant execute on function public.iniciar_postulacion(uuid, uuid) to authenticated;

