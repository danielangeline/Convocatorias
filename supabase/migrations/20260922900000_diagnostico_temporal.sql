-- TEMPORAL · diagnóstico de la sesión 015, retirado en la migración siguiente.
--
-- Se usó para averiguar si un PATCH que tardaba 20 s y moría estaba esperando
-- un bloqueo en Postgres. No lo estaba: era la conexión con Supabase la que se
-- cortaba (ECONNRESET). El archivo se conserva porque la migración llegó a
-- aplicarse y el historial debe poder reconstruirse tal como ocurrió.
create or replace function public.diag_actividad()
returns table (pid int, estado text, espera text, inicio_xact timestamptz, consulta text)
language sql
security definer
set search_path = ''
as $$
  select a.pid,
         a.state,
         coalesce(a.wait_event_type, '') || ':' || coalesce(a.wait_event, ''),
         a.xact_start,
         left(a.query, 300)
    from pg_catalog.pg_stat_activity a
   where a.datname = current_database()
     and a.pid <> pg_backend_pid()
     and a.state is not null
     and a.state <> 'idle'
$$;

revoke all on function public.diag_actividad() from public, anon, authenticated;
grant execute on function public.diag_actividad() to service_role;
