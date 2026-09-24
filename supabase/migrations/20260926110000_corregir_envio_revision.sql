-- =============================================================================
-- Corrige enviar_perfil_a_revision() (sesión 021, docs/05 §9.20 · CU-17)
--
-- `v_faltan || 'la foto'` hacía que Postgres leyera el texto como un arreglo
-- ("malformed array literal") y el envío fallaba con un error sin sentido en
-- vez de enumerar lo que falta. Lo encontró supabase/tests/perfil_consultor.sql.
-- =============================================================================

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
    v_faltan := array_append(v_faltan, 'el nombre profesional');
  end if;
  if v_perfil.foto_path is null or not exists (
    select 1 from storage.objects o where o.bucket_id = 'fotos-consultores' and o.name = v_perfil.foto_path
  ) then
    v_faltan := array_append(v_faltan, 'la foto');
  end if;
  if nullif(trim(v_perfil.descripcion), '') is null then
    v_faltan := array_append(v_faltan, 'la descripción');
  end if;
  if not exists (
    select 1 from public.consultor_especialidades e
    join public.categorias c on c.id = e.categoria_id and c.activa
    where e.consultor_id = v_id
  ) then
    v_faltan := array_append(v_faltan, 'al menos una especialidad');
  end if;
  if v_perfil.cv_path is null or not exists (
    select 1 from storage.objects o where o.bucket_id = 'hojas-de-vida' and o.name = v_perfil.cv_path
  ) then
    v_faltan := array_append(v_faltan, 'la hoja de vida en PDF');
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
