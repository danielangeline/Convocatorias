# Del volcado de los esquemas `auth` y `storage` (pg_dump --schema-only),
# conserva solo lo que crearon nuestras migraciones y que `supabase db dump`
# deja fuera: los triggers que llaman a funciones nuestras (el registro sobre
# auth.users, docs/05 §9.2) y las políticas RLS (las de storage.objects). Lo
# demás —tablas, funciones, índices, triggers propios de la plataforma y la
# RLS activada— ya existe en un proyecto nuevo. Lo usa scripts/respaldo-bd.sh
# (RNF-10).
#
# Con -v inverso=1 hace lo contrario: deja la base de un proyecto nuevo, sin
# lo nuestro (la usa scripts/simulacro-restauracion.sh).
#
# pg_dump separa cada objeto con un encabezado "-- Name: …; Type: …;".
/^-- Name: .*; Type: / {
  match($0, /Type: [A-Z ]+;/)
  tipo = substr($0, RSTART + 6, RLENGTH - 7)
}
{
  nuestro = (tipo == "POLICY") || (tipo == "TRIGGER" && /^CREATE TRIGGER .*EXECUTE FUNCTION (privado|public)\./)
  if (inverso ? !nuestro : nuestro) print
}
