#!/usr/bin/env bash
# Runs every supabase/tests/*.sql file against the local database (supabase start).
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
cd "$(dirname "$0")"
for f in *.sql; do
  echo "== $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "SQL tests passed"
