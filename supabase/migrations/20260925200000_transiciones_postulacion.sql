-- Estados de la postulación según el grafo declarado (RF-83, RF-19, CU-13 ·
-- docs/05 §9.19 · sesión 020, Sprint 3 paso 4).
--
-- Hasta ahora la RLS dejaba a la dueña poner cualquier estado (hallazgo de la
-- sesión 004). El grafo es el mismo que `TRANSICIONES_POSTULACION` en
-- lib/utils.ts, que decide qué ofrece la pantalla; la prueba SQL recorre los 36
-- pares para que no diverjan:
--
--   en_preparacion → presentada | cerrada
--   presentada     → en_evaluacion | cerrada
--   en_evaluacion  → aprobada | rechazada | cerrada
--   aprobada       → cerrada
--   rechazada      → cerrada
--   cerrada        → (ninguno)
--
-- Vale para cualquier camino, incluido service_role: nadie salta el grafo.

create or replace function privado.transicion_postulacion_permitida(p_desde text, p_hacia text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_desde
    when 'en_preparacion' then p_hacia in ('presentada', 'cerrada')
    when 'presentada'     then p_hacia in ('en_evaluacion', 'cerrada')
    when 'en_evaluacion'  then p_hacia in ('aprobada', 'rechazada', 'cerrada')
    when 'aprobada'       then p_hacia = 'cerrada'
    when 'rechazada'      then p_hacia = 'cerrada'
    else false
  end;
$$;

revoke all on function privado.transicion_postulacion_permitida(text, text) from public, anon;
grant execute on function privado.transicion_postulacion_permitida(text, text) to authenticated;

create or replace function privado.exigir_transicion_postulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado
     and not privado.transicion_postulacion_permitida(old.estado, new.estado) then
    raise exception 'No se puede pasar de % a %', old.estado, new.estado
      using errcode = '42501', hint = 'transicion_invalida';
  end if;
  return new;
end;
$$;

revoke all on function privado.exigir_transicion_postulacion() from public, anon, authenticated;

drop trigger if exists postulaciones_exigir_transicion on public.postulaciones;
create trigger postulaciones_exigir_transicion
  before update of estado on public.postulaciones
  for each row execute function privado.exigir_transicion_postulacion();
