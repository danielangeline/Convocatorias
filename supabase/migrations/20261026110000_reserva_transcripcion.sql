-- =============================================================================
-- Reserva atómica de la transcripción (sesión 030, revisión de seguridad)
-- docs/05-modelo-de-datos.md §9.29 · RF-97, RF-52
--
-- `iniciar_transcripcion` contaba las transcripciones del día y devolvía sin
-- escribir nada: N peticiones simultáneas pasaban todas el tope de 30 y
-- gastaban saldo del proveedor. Ahora bloquea la suscripción, cuenta también
-- las que están en curso, rechaza una segunda simultánea y deja la fila del
-- consumo creada antes de llamar a la IA; `registrar_transcripcion` la cierra.
-- =============================================================================

drop function public.iniciar_transcripcion(uuid);
drop function public.registrar_transcripcion(uuid, boolean, text, numeric, text, int);

create or replace function public.iniciar_transcripcion(p_usuario uuid)
returns table (
  consumo_id uuid,
  modelo text,
  precio_usd_min numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sus uuid;
  v_hoy int;
  v_pl public.plantillas_generacion%rowtype;
  v_consumo uuid;
begin
  if (select p.rol from public.perfiles p where p.id = p_usuario) is distinct from 'empresa' then
    raise exception 'Solo una cuenta de empresa dicta proyectos' using hint = 'no_es_empresa';
  end if;

  v_sus := privado.suscripcion_de_cobro(p_usuario);
  if v_sus is null then
    raise exception 'Sin suscripción vigente' using hint = 'sin_suscripcion';
  end if;
  -- Serializa las peticiones de la misma empresa: el conteo y la reserva van juntos.
  perform 1 from public.suscripciones s where s.id = v_sus for update;

  if privado.creditos_disponibles(v_sus) - privado.reservas_de(p_usuario) <= 0 then
    raise exception 'Sin créditos disponibles' using hint = 'sin_creditos';
  end if;

  -- Una a la vez: la que sigue en curso (sin duración) de hace menos de 2 minutos.
  if exists (
    select 1 from public.consumos_ia c
    where c.usuario_id = p_usuario and c.tipo = 'transcripcion' and c.duracion_ms is null
      and c.fecha > now() - interval '2 minutes'
  ) then
    raise exception 'Ya hay una transcripción en curso' using hint = 'transcripcion_en_curso';
  end if;

  -- Cuentan todas las del día, también las en curso y las fallidas.
  select count(*) into v_hoy
  from public.consumos_ia c
  where c.usuario_id = p_usuario and c.tipo = 'transcripcion'
    and c.fecha >= (privado.hoy_colombia()::timestamp at time zone 'America/Bogota');
  if v_hoy >= 30 then
    raise exception 'Tope diario de transcripciones' using hint = 'tope_transcripciones';
  end if;

  select * into v_pl from public.plantillas_generacion pg where pg.activa limit 1;
  if v_pl.id is null then
    raise exception 'No hay plantilla de generación activa' using hint = 'sin_plantilla';
  end if;

  insert into public.consumos_ia (usuario_id, empresa_id, tipo, exito, mensaje_error, modelo, plantilla_id)
  values (p_usuario, p_usuario, 'transcripcion', false, 'Transcripción en curso', v_pl.modelo_transcripcion, v_pl.id)
  returning id into v_consumo;

  return query select v_consumo, v_pl.modelo_transcripcion, v_pl.precio_transcripcion_usd_min;
end;
$$;

create or replace function public.registrar_transcripcion(
  p_consumo uuid,
  p_exito boolean,
  p_mensaje text,
  p_costo numeric,
  p_duracion_ms int
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.consumos_ia
  set exito = p_exito,
      mensaje_error = case when p_exito then null else left(coalesce(p_mensaje, 'Falló la transcripción'), 500) end,
      costo_estimado = p_costo,
      duracion_ms = greatest(coalesce(p_duracion_ms, 0), 0)
  where id = p_consumo and tipo = 'transcripcion' and duracion_ms is null;
$$;

revoke all on function public.iniciar_transcripcion(uuid) from public, anon, authenticated;
revoke all on function public.registrar_transcripcion(uuid, boolean, text, numeric, int) from public, anon, authenticated;
grant execute on function public.iniciar_transcripcion(uuid) to service_role;
grant execute on function public.registrar_transcripcion(uuid, boolean, text, numeric, int) to service_role;
