#!/usr/bin/env bash
# Simulacro de restauración de un respaldo (RNF-10: "restauración probada").
#
#   bash scripts/simulacro-restauracion.sh <carpeta-del-respaldo>
#
# Levanta un clúster PostgreSQL desechable en esta máquina (puerto 54329,
# en una carpeta temporal), lo prepara como un proyecto de Supabase recién
# creado —roles de la plataforma, esquemas `auth` y `storage` tomados del
# remoto, extensiones— y restaura el respaldo con el mismo comando que indica
# Supabase para un proyecto nuevo (roles.sql, schema.sql y data.sql en una
# sola transacción, con session_replication_role = replica), más
# auth_storage.sql antes de los datos. Después compara,
# tabla por tabla, el número de filas con el remoto y la huella SHA-256 de
# cada archivo de Storage con su manifiesto. Al terminar borra el clúster.
#
# Lo que el clúster local no tiene y se omite: pg_cron y supabase_vault (son
# de la plataforma). En una restauración real a un proyecto nuevo, los tres
# jobs de pg_cron se vuelven a programar con la migración 20260916120600 y
# las que la cambiaron (cron.job no viaja en data.sql).
set -euo pipefail

cd "$(dirname "$0")/.."
RESPALDO="${1:?Indica la carpeta del respaldo}"
PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"
export PATH="$PG_BIN:$PATH"
PUERTO=54329
TMP="$(mktemp -d)"
CLUSTER="$TMP/datos"
fallas=0
ok() { if [ "$1" = 0 ]; then echo "ok    $2"; else echo "FALLA $2"; fallas=$((fallas + 1)); fi; }

limpiar() { pg_ctl -D "$CLUSTER" -m fast stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpiar EXIT

( cd "$RESPALDO" && sha256sum -c --quiet SHA256SUMS ) && ok 0 "las sumas SHA-256 del respaldo coinciden" || ok 1 "las sumas SHA-256 del respaldo coinciden"

# --- Credenciales temporales del remoto (las mismas que usa respaldo-bd.sh) ---
eval "$(npx supabase db dump --linked --dry-run --schema public 2>/dev/null | grep '^export PG')"
remoto() { psql -X -q -t -A -v ON_ERROR_STOP=1 -c "set role postgres" -c "$1"; }

# --- Clúster desechable -------------------------------------------------------
initdb -D "$CLUSTER" -U postgres -A trust -E UTF8 --locale=C >/dev/null
pg_ctl -D "$CLUSTER" -o "-p $PUERTO" -l "$TMP/log.txt" -w start >/dev/null
local_() { PGHOST=localhost PGPORT=$PUERTO PGUSER=postgres PGPASSWORD= PGDATABASE=postgres psql -X -q -v ON_ERROR_STOP=1 "$@"; }

# --- Base de "proyecto nuevo": roles, esquemas auth y storage, extensiones -----
pg_dump --role postgres --schema-only -n auth -n storage --no-comments   | awk -v inverso=1 -f scripts/extraer-auth-storage.awk > "$TMP/base.sql"
roles="$(cat "$TMP/base.sql" "$RESPALDO/schema.sql" "$RESPALDO/roles.sql" \
  | grep -oE '(TO|ROLE|OWNER TO|FROM|GRANTED BY) "?[a-z_]+"?' | grep -oE '[a-z_]+$' \
  | grep -vE '^(public|postgres|to|role|from|by|pg_.*)$' | sort -u)"
# Los roles fijos de la plataforma, por si ningún volcado los nombra.
roles="$roles anon authenticated authenticator service_role dashboard_user supabase_admin supabase_auth_admin supabase_storage_admin supabase_realtime_admin supabase_replication_admin"
for r in $roles; do local_ -c "do \$\$ begin create role \"$r\" nologin; exception when duplicate_object then null; end \$\$;"; done
local_ -c 'create schema if not exists extensions; create schema if not exists vault; create publication supabase_realtime;'
# auth.uid() y compañía dependen de request.jwt.*; existen en el volcado de auth.
local_ -f "$TMP/base.sql" >/dev/null 2>"$TMP/base.err" || { cat "$TMP/base.err"; exit 1; }
ok 0 "clúster con $(local_ -t -A -c "select count(*) from pg_roles where rolname !~ '^pg_'") roles, auth y storage como un proyecto nuevo"

# --- Restauración, como la indica Supabase ----------------------------------------
grep -vE 'EXTENSION IF NOT EXISTS "(pg_cron|supabase_vault)"|COMMENT ON EXTENSION "(pg_cron|supabase_vault)"' \
  "$RESPALDO/schema.sql" > "$TMP/schema.sql"
inicio=$(date +%s)
if local_ --single-transaction -f "$RESPALDO/roles.sql" -f "$TMP/schema.sql" -f "$RESPALDO/auth_storage.sql" \
     -c 'SET session_replication_role = replica' -f "$RESPALDO/data.sql" >/dev/null 2>"$TMP/restaurar.err"; then
  ok 0 "roles.sql, schema.sql, auth_storage.sql y data.sql restaurados en una transacción ($(( $(date +%s) - inicio )) s)"
else
  ok 1 "restaurar el respaldo"; cat "$TMP/restaurar.err"; exit 1
fi

# --- Filas por tabla: restaurado vs. remoto ----------------------------------------
consulta="select string_agg(format('select %L || ''|'' || count(*) from %I.%I', n.nspname||'.'||c.relname, n.nspname, c.relname), ' union all ' order by 1)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage')
    and c.relname not in ('schema_migrations', 'migrations')"
contar() { local q; q="$($1 "$consulta")"; $1 "$q" | sort; }
remoto_filas="$(contar remoto)"
local_filas="$(contar "local_ -t -A -c")"
diferencias="$(diff <(echo "$remoto_filas") <(echo "$local_filas") || true)"
tablas=$(echo "$remoto_filas" | wc -l)
filas=$(echo "$remoto_filas" | awk -F'|' '{s += $2} END {print s}')
if [ -z "$diferencias" ]; then ok 0 "$tablas tablas y $filas filas: idénticas al remoto"
else ok 1 "filas por tabla distintas al remoto (puede haber cambiado desde el respaldo):"; echo "$diferencias"; fi

publicas=$(local_ -t -A -c "select count(*) from pg_tables where schemaname = 'public' and rowsecurity")
total=$(local_ -t -A -c "select count(*) from pg_tables where schemaname = 'public'")
[ "$publicas" = "$total" ] && ok 0 "RLS activa en las $total tablas públicas restauradas" || ok 1 "RLS en $publicas de $total tablas"
politicas=$(local_ -t -A -c "select count(*) from pg_policies where schemaname in ('public', 'storage')")
politicas_remoto=$(remoto "select count(*) from pg_policies where schemaname in ('public', 'storage')")
[ "$politicas" = "$politicas_remoto" ] && ok 0 "$politicas políticas RLS, las mismas que en el remoto" || ok 1 "políticas: $politicas local vs $politicas_remoto remoto"
funciones=$(local_ -t -A -c "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'privado')")
funciones_remoto=$(remoto "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'privado')")
trigger=$(local_ -t -A -c "select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'al_registrar_cuenta'")
[ "$trigger" = 1 ] && ok 0 "el trigger de registro sobre auth.users existe" || ok 1 "falta el trigger de registro sobre auth.users"
[ "$funciones" = "$funciones_remoto" ] && ok 0 "$funciones funciones de public y privado" || ok 1 "funciones: $funciones local vs $funciones_remoto remoto"

# --- Storage: cada archivo contra su manifiesto ------------------------------------
if node -e '
  const fs = require("fs"), path = require("path"), crypto = require("crypto");
  const dir = process.argv[1];
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifiesto.json"), "utf8"));
  const malos = m.filter((a) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, a.bucket, a.ruta))).digest("hex") !== a.sha256);
  if (malos.length) { console.error(malos); process.exit(1); }
  console.log(m.length);
' "$RESPALDO/storage" > "$TMP/storage.txt"; then
  ok 0 "$(cat "$TMP/storage.txt") archivos de Storage íntegros (SHA-256)"
else ok 1 "archivos de Storage"; fi
objetos=$(local_ -t -A -c "select count(*) from storage.objects")
[ "$objetos" = "$(cat "$TMP/storage.txt")" ] && ok 0 "cada fila de storage.objects tiene su archivo" || ok 1 "storage.objects ($objetos) vs archivos ($(cat "$TMP/storage.txt"))"

echo
[ "$fallas" = 0 ] && echo "SIMULACRO SUPERADO" || echo "$fallas FALLA(S)"
exit "$fallas"
