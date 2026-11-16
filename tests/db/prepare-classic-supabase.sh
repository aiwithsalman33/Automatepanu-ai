#!/usr/bin/env bash
# Prepare the LOCAL Supabase database for the RLS baseline suite.
#
# Why this exists
# ---------------
# The migrations never GRANT table privileges explicitly; they rely on
# Supabase's *classic* default privileges, which give anon /
# authenticated / service_role ALL on every table, sequence and function
# that `postgres` creates in `public`. Newer Supabase Postgres images
# (verified on public.ecr.aws/supabase/postgres:17.6.1.158, the image the
# pinned CLI 2.113.0 pulls) no longer install those defaults. On such a
# database every table is left with only REFERENCES/TRIGGER/TRUNCATE for
# those roles, so the RLS policies are never even reached and a
# "cross-tenant read returns 0 rows" test would pass for the wrong
# reason (permission denied, not RLS).
#
# To test what a classic hosted project actually enforces, this script:
#   1. drops and recreates the `public` schema (destroys local data!),
#   2. installs the classic default privileges,
#   3. re-applies supabase/migrations/*.sql in filename order as
#      `postgres`, exactly like `supabase db reset` does.
#
# Usage:  bash tests/db/prepare-classic-supabase.sh
# Env:    SUPABASE_DB_CONTAINER (default: supabase_db_wacrm)
#
# Only ever point this at a disposable local database.
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_wacrm}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

psql_as() {
  local role="$1"; shift
  docker exec -i "$CONTAINER" psql -U "$role" -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

echo "→ resetting public schema with classic Supabase default privileges ($CONTAINER)"
psql_as supabase_admin <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC, postgres, anon, authenticated, service_role;

-- Classic Supabase defaults, for both object creators.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL

count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  applying $(basename "$f")"
  psql_as postgres < "$f"
  count=$((count + 1))
done

echo "→ verifying schema"
psql_as postgres < "$ROOT/supabase/ci/verify-schema.sql"
echo "✓ applied $count migrations on classic privileges"
