-- =============================================================================
-- Perfil del consultor: consentimiento, guardado, archivos y envío a revisión
-- docs/05-modelo-de-datos.md §9.20 · Sprint 4 paso 1a (sesión 021)
-- RF-22, RF-23, RF-24, RF-25, RF-88 · CU-14, CU-15, CU-16, CU-17 · RN-12, RN-13
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Consentimiento de tratamiento de datos (RF-88, Ley 1581 de 2012)
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column if not exists consentimiento_datos_at timestamptz;

-- El cliente no fija ni cambia la fecha: la pone el registro o
-- aceptar_consentimiento_datos(), que corren como dueño.
create or replace function privado.guardar_columnas_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if privado.es_cliente() then
    if new.id is distinct from old.id
       or new.rol is distinct from old.rol
       or new.mfa_habilitado is distinct from old.mfa_habilitado
       or new.es_propietario is distinct from old.es_propietario
       or new.admin_revocado_at is distinct from old.admin_revocado_at
       or new.admin_revocado_por is distinct from old.admin_revocado_por then
      raise exception 'No puedes modificar el rol, la verificación en dos pasos ni el acceso administrativo de tu perfil'
        using errcode = '42501';
    end if;
    if new.consentimiento_datos_at is distinct from old.consentimiento_datos_at then
      raise exception 'La autorización de tratamiento de datos no se modifica directamente'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Registro (§9.2): igual que en 20260916160000, más la fecha del consentimiento
-- cuando el formulario lo trae marcado.
create or replace function privado.crear_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- RN-06: solo `consultor` produce consultor; cualquier otro valor, empresa.
  v_rol      text := case when v_meta ->> 'rol' = 'consultor' then 'consultor' else 'empresa' end;
  v_plan     uuid;
  v_dias     int;
begin
  insert into public.perfiles (id, nombre, rol, nombre_empresa, telefono, consentimiento_datos_at)
  values (
    new.id,
    nullif(trim(v_meta ->> 'nombre'), ''),
    v_rol,
    case when v_rol = 'empresa' then nullif(trim(v_meta ->> 'nombre_empresa'), '') end,
    nullif(trim(v_meta ->> 'telefono'), ''),
    case when v_meta ->> 'consentimiento_datos' = 'true' then now() end
  );

  if v_rol = 'empresa' then
    select p.id, p.dias_trial into v_plan, v_dias
    from public.planes p
    where p.es_trial and p.activo;

    if v_plan is null then
      raise exception 'No hay un plan trial activo: no se puede registrar la empresa';
    end if;

    insert into public.suscripciones (usuario_id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento)
    values (new.id, v_plan, 'trial', 'trial', current_date, current_date + v_dias);
  else
    insert into public.consultor_perfiles (id, nombre_profesional)
    values (new.id, nullif(trim(v_meta ->> 'nombre'), ''));
  end if;

  return new;
end;
$$;

create or replace function public.aceptar_consentimiento_datos()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles
  set consentimiento_datos_at = now()
  where id = auth.uid() and consentimiento_datos_at is null;
$$;

revoke all on function public.aceptar_consentimiento_datos() from public, anon;
grant execute on function public.aceptar_consentimiento_datos() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reglas de la fila del consultor (§9.20)
-- ---------------------------------------------------------------------------

create or replace function privado.guardar_columnas_consultor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Para todos, también service_role: un archivo solo puede ser de la carpeta
  -- propia. Si no, un consultor apuntaría su hoja de vida a la de otro y la
  -- empresa con solicitud activa la descargaría (RN-12).
  if new.foto_path is not null and not starts_with(new.foto_path, new.id::text || '/') then
    raise exception 'La foto tiene que estar en la carpeta del propio consultor' using errcode = '42501';
  end if;
  if new.cv_path is not null and not starts_with(new.cv_path, new.id::text || '/') then
    raise exception 'La hoja de vida tiene que estar en la carpeta del propio consultor' using errcode = '42501';
  end if;

  if not privado.es_cliente() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado_perfil := 'incompleto';
    new.motivo_rechazo := null;
    new.es_equipo_interno := false;
    new.revisado_por := null;
    new.revisado_at := null;
    new.rating_promedio := 0;
    new.total_encargos_completados := 0;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.estado_perfil is distinct from old.estado_perfil
     or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.es_equipo_interno is distinct from old.es_equipo_interno
     or new.revisado_por is distinct from old.revisado_por
     or new.revisado_at is distinct from old.revisado_at
     or new.rating_promedio is distinct from old.rating_promedio
     or new.total_encargos_completados is distinct from old.total_encargos_completados then
    raise exception 'No puedes modificar el estado de revisión ni las métricas de tu perfil'
      using errcode = '42501';
  end if;

  -- CU-16 1a: lo que la revisión vio no se vacía después.
  if new.estado_perfil in ('en_revision', 'aprobado')
     and (new.foto_path is null or new.cv_path is null or nullif(trim(new.descripcion), '') is null) then
    raise exception 'Tu perfil está en revisión o aprobado: la foto, la descripción y la hoja de vida no pueden quedar vacías'
      using errcode = '23514', hint = 'minimos_incompletos';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Guardar el perfil (RF-23, CU-16)
-- ---------------------------------------------------------------------------

create or replace function public.guardar_perfil_consultor(
  p_datos           jsonb,
  p_especialidades  uuid[],
  p_redes           jsonb,
  p_portafolio      jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id      uuid := auth.uid();
  v_nombre  text := nullif(trim(p_datos ->> 'nombre_profesional'), '');
  v_estado  text;
  v_especialidades uuid[] := coalesce(p_especialidades, '{}');
begin
  if privado.rol_actual() is distinct from 'consultor' then
    raise exception 'Solo un consultor edita su perfil' using errcode = '42501', hint = 'no_es_consultor';
  end if;

  if not exists (select 1 from public.perfiles p where p.id = v_id and p.consentimiento_datos_at is not null) then
    raise exception 'Acepta la autorización de tratamiento de datos antes de guardar tu perfil'
      using errcode = '42501', hint = 'sin_consentimiento';
  end if;

  if v_nombre is null then
    raise exception 'Escribe tu nombre profesional' using errcode = '23514', hint = 'nombre_vacio';
  end if;

  -- Una especialidad nueva tiene que ser una categoría activa; la que ya tenía
  -- se conserva aunque el administrador la haya desactivado después.
  if exists (
    select 1 from unnest(v_especialidades) as e(categoria_id)
    where not exists (select 1 from public.categorias c where c.id = e.categoria_id and c.activa)
      and not exists (
        select 1 from public.consultor_especialidades ce
        where ce.consultor_id = v_id and ce.categoria_id = e.categoria_id
      )
  ) then
    raise exception 'Alguna especialidad no existe o ya no está disponible'
      using errcode = '23514', hint = 'categoria_invalida';
  end if;

  update public.consultor_perfiles
  set nombre_profesional = v_nombre,
      descripcion = nullif(trim(p_datos ->> 'descripcion'), ''),
      sitio_web = nullif(trim(p_datos ->> 'sitio_web'), '')
  where id = v_id
  returning estado_perfil into v_estado;

  if not found then
    raise exception 'No encontramos tu perfil de consultor' using errcode = '42501', hint = 'no_es_consultor';
  end if;

  if v_estado in ('en_revision', 'aprobado') and cardinality(v_especialidades) = 0 then
    raise exception 'Tu perfil está en revisión o aprobado: necesita al menos una especialidad'
      using errcode = '23514', hint = 'minimos_incompletos';
  end if;

  delete from public.consultor_especialidades where consultor_id = v_id;
  insert into public.consultor_especialidades (consultor_id, categoria_id)
  select distinct v_id, e from unnest(v_especialidades) as e;

  delete from public.consultor_redes where consultor_id = v_id;
  insert into public.consultor_redes (consultor_id, tipo, url)
  select v_id, r.tipo, trim(r.url)
  from jsonb_to_recordset(coalesce(p_redes, '[]'::jsonb)) as r (tipo text, url text);

  delete from public.consultor_portafolio where consultor_id = v_id;
  insert into public.consultor_portafolio (consultor_id, nombre_proyecto, entidad, anio, descripcion, resultado, orden)
  select v_id, trim(i.valor ->> 'nombre_proyecto'), nullif(trim(i.valor ->> 'entidad'), ''),
         (i.valor ->> 'anio')::int, nullif(trim(i.valor ->> 'descripcion'), ''),
         nullif(trim(i.valor ->> 'resultado'), ''), (i.orden - 1)::int
  from jsonb_array_elements(coalesce(p_portafolio, '[]'::jsonb)) with ordinality as i (valor, orden);
end;
$$;

revoke all on function public.guardar_perfil_consultor(jsonb, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.guardar_perfil_consultor(jsonb, uuid[], jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Enviar a revisión (RF-24, RF-25, CU-17)
-- ---------------------------------------------------------------------------

create or replace function public.enviar_perfil_a_revision()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid := auth.uid();
  v_perfil public.consultor_perfiles%rowtype;
  v_faltan text[] := '{}';
begin
  if privado.rol_actual() is distinct from 'consultor' then
    raise exception 'Solo un consultor envía su perfil a revisión' using errcode = '42501', hint = 'no_es_consultor';
  end if;

  select * into v_perfil from public.consultor_perfiles where id = v_id for update;
  if not found then
    raise exception 'No encontramos tu perfil de consultor' using errcode = '42501', hint = 'no_es_consultor';
  end if;

  -- CU-17 3a: se envía desde incompleto o, tras un rechazo, se reenvía.
  if v_perfil.estado_perfil not in ('incompleto', 'rechazado') then
    raise exception 'Tu perfil ya fue enviado o no admite envío en su estado actual'
      using errcode = '23514', hint = 'estado_no_permite';
  end if;

  if not exists (select 1 from public.perfiles p where p.id = v_id and p.consentimiento_datos_at is not null) then
    raise exception 'Acepta la autorización de tratamiento de datos antes de enviar tu perfil'
      using errcode = '42501', hint = 'sin_consentimiento';
  end if;

  if nullif(trim(v_perfil.nombre_profesional), '') is null then
    v_faltan := v_faltan || 'el nombre profesional';
  end if;
  if v_perfil.foto_path is null or not exists (
    select 1 from storage.objects o where o.bucket_id = 'fotos-consultores' and o.name = v_perfil.foto_path
  ) then
    v_faltan := v_faltan || 'la foto';
  end if;
  if nullif(trim(v_perfil.descripcion), '') is null then
    v_faltan := v_faltan || 'la descripción';
  end if;
  if not exists (
    select 1 from public.consultor_especialidades e
    join public.categorias c on c.id = e.categoria_id and c.activa
    where e.consultor_id = v_id
  ) then
    v_faltan := v_faltan || 'al menos una especialidad';
  end if;
  if v_perfil.cv_path is null or not exists (
    select 1 from storage.objects o where o.bucket_id = 'hojas-de-vida' and o.name = v_perfil.cv_path
  ) then
    v_faltan := v_faltan || 'la hoja de vida en PDF';
  end if;

  if cardinality(v_faltan) > 0 then
    raise exception 'Para enviar tu perfil falta: %', array_to_string(v_faltan, ', ')
      using errcode = '23514', hint = 'minimos_incompletos';
  end if;

  -- El motivo del rechazo anterior se conserva para el administrador (RN-13).
  update public.consultor_perfiles set estado_perfil = 'en_revision' where id = v_id;
end;
$$;

revoke all on function public.enviar_perfil_a_revision() from public, anon;
grant execute on function public.enviar_perfil_a_revision() to authenticated;
