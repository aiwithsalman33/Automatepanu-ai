#!/usr/bin/env bash
# Generate db/migrations/0002_baseline.sql: a squash of
# supabase/migrations/001…059 for plain Postgres (no Supabase).
#
# How: replay every Supabase migration, in order, inside a throwaway
# pgvector container that stubs exactly the Supabase pieces they touch
# (roles anon/authenticated/service_role, auth.users + auth.uid(), the
# storage schema, the supabase_realtime publication) on Supabase's
# *classic* default privileges. Then `pg_dump` the public schema and let
# postprocess-baseline.mjs map it onto the new roles (wacrm_app,
# wacrm_service, wacrm_anon). Because the dump carries the final ACL of
# every object, the generated file grants privileges explicitly (F1)
# and keeps every migration's own REVOKE/column GRANT.
#
# Dropped on purpose (re-implemented elsewhere in Phase 1):
#   storage.* buckets + policies   → checkpoint 1f (S3 + upload routes)
#   supabase_realtime publication  → checkpoint 1e (LISTEN/NOTIFY + SSE)
#
# Usage: bash db/scripts/build-baseline.sh   (needs Docker; ~30 s)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${BASELINE_BUILD_IMAGE:-pgvector/pgvector:0.8.1-pg17}"
NAME="wacrm-baseline-build-$$"
OUT="$ROOT/db/migrations/0002_baseline.sql"
RAW="$(mktemp)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -f "$RAW"; }
trap cleanup EXIT

echo "→ starting $IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=build "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
# pg_isready can pass during the entrypoint's temporary init server.
sleep 2
until docker exec "$NAME" psql -U postgres -qtAc 'select 1' >/dev/null 2>&1; do sleep 1; done

psql_q() { docker exec -i "$NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "→ stubbing the Supabase environment the migrations expect"
psql_q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text, name text, owner uuid, metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

CREATE PUBLICATION supabase_realtime;

-- Classic Supabase default privileges (see tests/db/README.md).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL

count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  # Fail loudly: a migration that errors must abort the build, never be
  # filtered away with the NOTICE noise.
  if ! out="$(psql_q < "$f" 2>&1)"; then
    echo "$out" >&2
    echo "✗ migration failed: $(basename "$f")" >&2
    exit 1
  fi
  count=$((count + 1))
done
echo "→ replayed $count migrations"

docker exec "$NAME" pg_dump -U postgres -d postgres \
  --schema=public --schema-only --no-owner \
  --no-publications --no-subscriptions --no-tablespaces --no-security-labels \
  > "$RAW"

node "$ROOT/db/scripts/postprocess-baseline.mjs" "$RAW" "$OUT" "$count"
echo "✓ wrote ${OUT#"$ROOT"/}"
