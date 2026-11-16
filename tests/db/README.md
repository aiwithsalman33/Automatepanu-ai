# Tenant-isolation suite (`tests/db`)

DB-backed tests that prove one account can never read or change another
account's data. They run against a real Postgres, are kept out of
`npm test`, and are the safety net for the Supabase → own-Postgres
migration ([docs/saas-migration-plan.md](../../docs/saas-migration-plan.md)).
**They must stay green at every checkpoint.**

## Run locally

```bash
npx supabase@2.113.0 db start   # local Supabase Postgres on :54322 (needs Docker)
npm run test:db:prepare         # rebuild `public` on classic privileges (destroys local data)
npm run test:db                 # run the suite
```

### Against the new self-hosted stack (`db/migrations`)

```bash
docker run -d --name wacrm-newdb -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=wacrm \
  -p 54330:5432 pgvector/pgvector:0.8.1-pg17
DATABASE_ADMIN_URL=postgresql://postgres:admin@127.0.0.1:54330/wacrm \
DATABASE_URL=postgresql://wacrm_owner:ownerpw@127.0.0.1:54330/wacrm \
WACRM_OWNER_PASSWORD=ownerpw WACRM_AUTHENTICATOR_PASSWORD=authpw npm run db:migrate
DB_TENANT_ADAPTER=app \
TEST_DATABASE_URL=postgresql://postgres:admin@127.0.0.1:54330/wacrm npm run test:db
```

The same assertions run on both stacks. The `app` adapter does what
`withTenant()` does: `SET LOCAL ROLE wacrm_app` plus `app.user_id`. The
Supabase-only storage file is skipped there.

`TEST_DATABASE_URL` overrides the connection (default
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
`SUPABASE_DB_CONTAINER` overrides the container the prepare script uses.

### Why the prepare step?

The migrations never `GRANT` table privileges; they rely on Supabase's
_classic_ default privileges (anon / authenticated / service_role get ALL
on everything `postgres` creates in `public`). The Postgres image that
the pinned CLI pulls (`supabase/postgres:17.6.1.158`) no longer installs
those defaults, so on a fresh local database every table rejects
`authenticated` with _permission denied_ before RLS is even consulted. A
"cannot read B's row" test would then pass for the wrong reason.
`prepare-classic-supabase.sh` recreates the schema with the classic
defaults and replays every migration, so the suite tests what a hosted
project actually enforces.

## What it covers

| File                       | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rls-isolation.test.ts`    | Every table in `public` (37), each role (owner/admin/agent/viewer) plus anon and service role: cross-tenant SELECT / UPDATE / DELETE / INSERT, **WHERE-less "blind" UPDATE/DELETE** (which a strict SELECT policy would otherwise mask), re-parenting a row into another tenant, and own-account role tiers. A coverage test fails if a new table has no spec. Mutation self-tests plant leaky policies and assert the probes catch them. |
| `privilege-guards.test.ts` | Identity-column guard triggers (role / account / owner changes), column grants (notifications), assignee-membership trigger, member-management RPCs across tenants (and as anon), data RPCs (`filter_contacts_by_tags`, `match_ai_knowledge_*`, `dashboard_overview` differential, broadcast lease, flow graph replace, `touch_presence`), and the service-only allowlist for SECURITY DEFINER functions.                                 |
| `storage.supabase.test.ts` | Supabase Storage policies for `chat-media`, `flow-media`, `avatars` (baseline only; checkpoint 1f moves these rules to the S3 upload/download routes).                                                                                                                                                                                                                                                                                    |

## How it works

- `harness.ts`: one connection and one transaction per file. The fixture
  is seeded as `postgres`, each probe runs in a savepoint as the
  principal under test, and everything is rolled back. **Nothing is ever
  committed.** Identity is set by a `TenantContextAdapter`:
  `supabase` (today: `SET LOCAL ROLE authenticated` plus JWT claims, i.e.
  what PostgREST does). Checkpoint 1c adds an `app` adapter for the new
  `withTenant()` helper; select it with `DB_TENANT_ADAPTER=app`.
- `fixture.ts`: tenant A (owner, admin, agent, viewer) and tenant B
  (owner, agent), created through the real signup trigger, with one row
  in every table for each tenant.
- `tables.ts`: the per-table spec (read/insert/update/delete tier, tenant
  column, row builder). Tiers are read from the live `pg_policies`. If
  you change a policy on purpose, change its tier here in the same PR.
- `run.mjs`: launcher that re-runs vitest from the canonical path (works
  around a Windows `d:` vs `D:` duplicate-module issue).
