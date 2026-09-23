-- "Hoy" es el día en Colombia, y el cierre diario pasa por una función
-- (RF-10, CU-06, RN-02, RN-03, RF-78, RF-44 · docs/05 §9.7 · sesión 017,
-- Sprint 2 paso 6).
--
-- Una convocatoria vence al terminar su día de cierre en hora de Colombia. El
-- job ya lo cumplía por su horario (05:00 UTC = 00:00 en Bogotá), pero el resto
-- usaba `current_date`, que en Supabase va en UTC: desde las 7 p. m. de
-- Colombia una convocatoria que cerraba ese día ya contaba como vencida para
-- postular, publicar y los indicadores. Ahora todos usan la misma fecha.
--
-- Las suscripciones (crear_cuenta, tiene_suscripcion_vigente, job 2) también
-- usan current_date; se revisan con su propio módulo (Sprint 5).

create or replace function privado.hoy_colombia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

revoke all on function privado.hoy_colombia() from public, anon;
grant execute on function privado.hoy_colombia() to authenticated, service_role;

-- RF-10, CU-06 · Cierre de las vencidas. Devuelve cuántas cerró, para que el
-- historial de pg_cron y las pruebas lo muestren.
create or replace function privado.cerrar_convocatorias_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cerradas integer;
begin
  update public.convocatorias
     set estado = 'cerrada'
   where estado = 'publicada'
     and fecha_cierre < privado.hoy_colombia();
  get diagnostics v_cerradas = row_count;
  return v_cerradas;
end;
$$;

revoke all on function privado.cerrar_convocatorias_vencidas() from public, anon, authenticated;
grant execute on function privado.cerrar_convocatorias_vencidas() to service_role;

-- El job ejecuta la función: mismo horario (00:00 en Colombia), mismo código
-- que las pruebas.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'cerrar-convocatorias-vencidas'),
  command := 'select privado.cerrar_convocatorias_vencidas();'
);

-- RF-44 · Indicadores con la misma fecha.
create or replace function public.indicadores_catalogo()
returns table (convocatorias_vigentes bigint, monto_disponible numeric, entidades bigint, consultores_aprobados bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*),
    coalesce(sum(coalesce(c.monto_max, c.monto_min)), 0),
    count(distinct c.entidad_convocante),
    (select count(*) from public.consultor_perfiles cp where cp.estado_perfil = 'aprobado')
  from public.convocatorias c
  where c.estado = 'publicada' and c.fecha_cierre >= privado.hoy_colombia();
$$;

-- RF-78, RN-03 · Postular exige una convocatoria publicada y vigente, con la misma fecha.
drop policy if exists "postulaciones: la empresa inicia las suyas" on public.postulaciones;
create policy "postulaciones: la empresa inicia las suyas"
  on public.postulaciones for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
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

-- RN-03 · Publicar no admite una fecha ya vencida, con la misma fecha.
CREATE OR REPLACE FUNCTION public.publicar_convocatoria(p_id uuid, p_publicar boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  -- RN-01 · la ficha entera, incluidos categoría, adjunto y 2 requisitos.
  if not (select privado.ficha_publicable(p_id)) then
    raise exception 'La ficha está incompleta para publicar' using hint = 'publicada_incompleta';
  end if;

  -- No se publica lo que ya cerró: el job de RF-10 lo cerraría esa misma noche
  -- y RN-03 prohíbe postular o generar sobre ello.
  if v_actual.fecha_cierre < privado.hoy_colombia() then
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
$function$

;
