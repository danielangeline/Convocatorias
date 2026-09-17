-- =============================================================================
-- service_role puede invocar las funciones del esquema privado
-- docs/05-modelo-de-datos.md §9.11 punto 1 · RNF-26 · sesión 007
--
-- Los triggers de perfiles, consultor_perfiles, proyectos y demás llaman
-- funciones de `privado`. Solo `authenticated` tenía uso del esquema, así que
-- las escrituras del servidor (service_role) sobre esas tablas fallaban con
-- 42501 "permission denied for schema privado"; por ejemplo, marcar
-- perfiles.mfa_habilitado al confirmar el MFA (RF-64). `privado` sigue sin
-- exponerse por la API: el permiso es de uso, no de exposición.
-- =============================================================================

grant usage on schema privado to service_role;
grant execute on all functions in schema privado to service_role;
alter default privileges in schema privado grant execute on functions to service_role;
