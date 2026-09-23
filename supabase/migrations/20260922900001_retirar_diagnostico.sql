-- Retira la función de diagnóstico que la sesión 015 usó para localizar un
-- fallo de red (ECONNRESET). No debe quedar en la base: lee pg_stat_activity.
drop function if exists public.diag_actividad();
