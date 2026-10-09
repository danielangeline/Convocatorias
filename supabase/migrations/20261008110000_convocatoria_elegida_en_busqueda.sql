-- RF-93 (docs/05 §9.25 · sesión 025). El check del Sprint 0
-- `encargos_convocatoria_segun_tipo` solo admitía convocatoria en los encargos
-- de "convocatoria específica", y rechazaba fijar la elegida en uno de
-- búsqueda. Lo gobierna ahora el trigger `privado.transicion_encargo`: en uno
-- de búsqueda, la convocatoria solo puede ser la propuesta elegida.
alter table public.encargos drop constraint encargos_convocatoria_segun_tipo;
