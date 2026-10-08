#!/usr/bin/env bash
# Respaldo manual de la base y de los archivos (RNF-10 · decisión del Product
# Owner en la sesión 025: copias manuales en vez del plan Pro).
#
#   bash scripts/respaldo-bd.sh [carpeta-destino]
#
# Destino por defecto: ~/Respaldos/Convocatorias/<AAAA-MM-DD_HHMM>. NUNCA
# dentro del repositorio: el respaldo lleva correos, hashes de contraseña y
# hojas de vida (datos personales, Ley 1581).
#
# Sin Docker y sin la contraseña de la base: `supabase db dump --dry-run`
# imprime el script oficial de pg_dump con un rol de acceso temporal, y aquí
# se ejecuta con el pg_dump instalado en la máquina (PostgreSQL 17 o 18).
# Produce los tres archivos del procedimiento de restauración de Supabase
# (roles.sql, schema.sql, data.sql), más auth_storage.sql (lo nuestro en esos
# esquemas, que la CLI omite), y la copia de los tres buckets
# (scripts/respaldo-storage.mjs). El simulacro de restauración está en
# scripts/simulacro-restauracion.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"
export PATH="$PG_BIN:$PATH"
command -v pg_dump >/dev/null || { echo "No encuentro pg_dump (PG_BIN=$PG_BIN)"; exit 1; }

DESTINO="${1:-$HOME/Respaldos/Convocatorias/$(date +%Y-%m-%d_%H%M)}"
mkdir -p "$DESTINO"
echo "Respaldo en $DESTINO"

volcar() {  # $1 = archivo, resto = opciones de supabase db dump
  local archivo="$1"; shift
  local script
  # pg_dumpall 18 no acepta la abreviatura --quote-all-identifier que escribe la CLI.
  script="$(npx supabase db dump --linked --dry-run "$@" 2>/dev/null \
    | sed -n '/^#!\/usr\/bin\/env bash/,$p' \
    | sed -E 's/--quote-all-identifier /--quote-all-identifiers /')"
  [ -n "$script" ] || { echo "La CLI no devolvió el script de pg_dump ($archivo)"; exit 1; }
  bash -c "$script" > "$DESTINO/$archivo"
  echo "  $archivo: $(wc -c < "$DESTINO/$archivo") bytes"
}

volcar roles.sql --role-only
volcar schema.sql
volcar data.sql --data-only

# schema.sql excluye los esquemas auth y storage, y con ellos lo que nuestras
# migraciones crearon allí: el trigger de registro sobre auth.users y las
# políticas de storage.objects. Sin este archivo, un proyecto restaurado no
# crea el perfil al registrarse y deja los buckets sin RLS (sesión 025).
eval "$(npx supabase db dump --linked --dry-run 2>/dev/null | grep '^export PG')"
pg_dump --role postgres --schema-only -n auth -n storage --no-comments   | awk -f scripts/extraer-auth-storage.awk > "$DESTINO/auth_storage.sql"
echo "  auth_storage.sql: $(grep -c '^CREATE POLICY' "$DESTINO/auth_storage.sql") políticas y $(grep -c '^CREATE TRIGGER' "$DESTINO/auth_storage.sql") trigger(s)"

node --env-file=.env.local scripts/respaldo-storage.mjs "$DESTINO/storage"

( cd "$DESTINO" && sha256sum roles.sql schema.sql auth_storage.sql data.sql > SHA256SUMS )
echo "Listo. Comprueba la restauración con: bash scripts/simulacro-restauracion.sh \"$DESTINO\""
