-- =============================================================================
-- Bloqueos por límite de tasa y su liberación (sesión 030)
-- docs/05-modelo-de-datos.md §9.31 · CU-40 · RF-66, RF-67, RNF-27, RNF-33
--
-- El conteo vive en Upstash (lib/limite-tasa.ts); aquí queda el bloqueo
-- confirmado, con la clave del contador, para auditarlo y para que el
-- administrador lo libere antes de que expire.
-- =============================================================================

alter table public.eventos_seguridad
  add column clave_limite text check (clave_limite is null or length(clave_limite) <= 300),
  add column liberado_por uuid references public.perfiles (id) on delete set null,
  add constraint eventos_seguridad_clave_solo_limite_tasa check (clave_limite is null or tipo = 'limite_tasa');

-- CU-40 paso 3: deja el bloqueo vencido ahora y devuelve la clave del contador
-- para que el servidor la borre en Upstash. Solo un bloqueo activo.
create or replace function public.liberar_bloqueo(p_evento uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clave text;
begin
  if not privado.es_admin() then
    raise exception 'Solo un administrador con verificación en dos pasos' using hint = 'no_es_admin';
  end if;
  update public.eventos_seguridad
     set bloqueado_hasta = now(), liberado_por = auth.uid()
   where id = p_evento and tipo = 'limite_tasa' and bloqueado_hasta > now()
  returning clave_limite into v_clave;
  if not found then
    raise exception 'No hay un bloqueo activo con ese id' using hint = 'bloqueo_no_existe';
  end if;
  return v_clave;
end;
$$;

revoke all on function public.liberar_bloqueo(uuid) from public, anon;
grant execute on function public.liberar_bloqueo(uuid) to authenticated;
