-- =============================================================================
-- RF-57 · El trigger de edición del cliente corre con su rol (security invoker):
-- necesita ejecutar privado.pendientes_de (sesión 026, lo encontró la prueba SQL).
-- La función es inmutable y solo extrae marcadores del texto que recibe.
-- =============================================================================

grant execute on function privado.pendientes_de(text) to authenticated;
