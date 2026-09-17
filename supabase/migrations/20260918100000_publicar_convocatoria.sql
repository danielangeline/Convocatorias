-- =============================================================================
-- Publicar y despublicar una convocatoria (sesión 013)
-- docs/05-modelo-de-datos.md §9.15 · RF-09, RN-01, RN-03, RNF-11, RNF-29
--
-- Cambiar el estado es lo único que guardar_convocatoria (§9.13) deja fuera a
-- propósito: así la ficha se edita todo lo que haga falta sin que la
-- convocatoria se vuelva visible por accidente.
--
-- security invoker: la RLS del catálogo (administrador vigente con aal2) sigue
-- aplicando; la comprobación de entrada solo da un rechazo legible.
-- =============================================================================

create or replace function public.publicar_convocatoria(
  p_id       uuid,
  p_publicar boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actual public.convocatorias%rowtype;
begin
  if not (select privado.es_admin()) then
    raise exception 'Solo un administrador con MFA publica convocatorias' using hint = 'no_es_admin';
  end if;

  select * into v_actual from public.convocatorias where id = p_id for update;
  if not found then
    raise exception 'La convocatoria no existe' using hint = 'no_existe';
  end if;

  if not p_publicar then
    if v_actual.estado <> 'publicada' then
      raise exception 'Solo se despublica una convocatoria publicada' using hint = 'no_publicada';
    end if;
    -- Se conservan publicada_at y publicado_por: son el rastro de que estuvo
    -- publicada. Nada se borra (RN-07).
    update public.convocatorias set estado = 'despublicada' where id = p_id;
    return;
  end if;

  if v_actual.estado = 'publicada' then
    raise exception 'La convocatoria ya está publicada' using hint = 'ya_publicada';
  end if;

  -- RN-01 · datos mínimos, enlace oficial y al menos un requisito. Los
  -- documentos adjuntos NO se exigen (v6, sesión 012).
  if coalesce(btrim(v_actual.nombre), '') = ''
     or coalesce(btrim(v_actual.entidad_convocante), '') = ''
     or v_actual.fecha_cierre is null
     or coalesce(btrim(v_actual.url_postulacion), '') = ''
     or not exists (select 1 from public.requisitos_convocatoria r where r.convocatoria_id = p_id) then
    raise exception 'Faltan datos mínimos, el enlace oficial o los requisitos' using hint = 'publicada_incompleta';
  end if;

  -- No se publica lo que ya cerró: el job de RF-10 lo cerraría esa misma noche
  -- y RN-03 prohíbe postular o generar sobre ello.
  if v_actual.fecha_cierre < current_date then
    raise exception 'La fecha de cierre ya pasó' using hint = 'vencida';
  end if;

  -- Se publica desde cualquier estado que no sea 'publicada', incluido
  -- 'cerrada': quien corrija la fecha de cierre debe poder volver a publicarla.
  update public.convocatorias set
    estado        = 'publicada',
    publicada_at  = now(),
    publicado_por = (select auth.uid())
  where id = p_id;
end;
$$;

revoke all on function public.publicar_convocatoria(uuid, boolean) from public, anon;
grant execute on function public.publicar_convocatoria(uuid, boolean) to authenticated;
