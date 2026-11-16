#!/usr/bin/env bash
# Preizkus migracije glasovnega asistenta v začasnem Postgresu (potreben Docker).
# Uporaba: bash tests/glas/sql/zazeni.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
IME="jp-glas-sql-$$"
docker run -d --rm --name "$IME" -e POSTGRES_PASSWORD=preizkus postgres:16-alpine >/dev/null
trap 'docker stop "$IME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 30); do
  docker exec "$IME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 1
psql_v() { docker exec -i "$IME" psql -v ON_ERROR_STOP=1 -q -U postgres "$@"; }
psql_v < tests/glas/sql/osnova.sql
psql_v < supabase/migrations/1793500000_glasovni_asistent.sql
# idempotenca: drugi zagon migracije ne sme pasti
psql_v < supabase/migrations/1793500000_glasovni_asistent.sql
psql_v < supabase/migrations/1793600000_glas_kontekst.sql
psql_v < supabase/migrations/1793600000_glas_kontekst.sql
psql_v < tests/glas/sql/preizkus.sql
psql_v < supabase/migrations/1793700000_glas_sporocila.sql
psql_v < supabase/migrations/1793700000_glas_sporocila.sql
psql_v < supabase/migrations/1793700001_glas_sporocila_ponudba.sql
psql_v < tests/glas/sql/preizkus_sporocila.sql
psql_v < supabase/migrations/1793700002_glas_opomniki.sql
psql_v < supabase/migrations/1793700002_glas_opomniki.sql
psql_v < tests/glas/sql/preizkus_opomniki.sql
psql_v < supabase/migrations/1793700003_termini_serije.sql
psql_v < supabase/migrations/1793700003_termini_serije.sql
psql_v < tests/glas/sql/preizkus_serije.sql
