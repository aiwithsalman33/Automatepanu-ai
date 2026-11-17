# Database tests

These tests run against a real PostgreSQL built from `db/migrations`,
logged in the way the app logs in. They are not part of `npm test`; run
them with `npm run test:db`.

## Run locally

```sh
# A throwaway Postgres + pgvector, migrated:
docker run -d --name wacrm-testdb -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=wacrm \
  -p 54330:5432 pgvector/pgvector:0.8.1-pg17
DATABASE_ADMIN_URL=postgresql://postgres:admin@127.0.0.1:54330/wacrm \
DATABASE_URL=postgresql://wacrm_owner:ownerpw@127.0.0.1:54330/wacrm \
WACRM_OWNER_PASSWORD=ownerpw WACRM_AUTHENTICATOR_PASSWORD=authpw \
npm run db:migrate

# Optional, for the PostgREST and email tests:
docker run -d --name wacrm-postgrest-test -p 54331:3000 \
  -e PGRST_DB_URI=postgresql://wacrm_authenticator:authpw@host.docker.internal:54330/wacrm \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=wacrm_anon \
  -e PGRST_JWT_SECRET=local-postgrest-jwt-secret-0123456789abcdef postgrest/postgrest:v12.2.12
docker run -d --name wacrm-mailpit-test -p 54325:1025 -p 54326:8025 axllent/mailpit:v1.27.0

TEST_DATABASE_URL=postgresql://postgres:admin@127.0.0.1:54330/wacrm \
TEST_AUTHENTICATOR_DATABASE_URL=postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm \
TEST_POSTGREST_URL=http://localhost:54331 \
TEST_POSTGREST_JWT_SECRET=local-postgrest-jwt-secret-0123456789abcdef \
TEST_SMTP_HOST=127.0.0.1 TEST_SMTP_PORT=54325 TEST_MAILPIT_URL=http://127.0.0.1:54326 \
npm run test:db
```

On Windows, run from the canonical path (`D:\…`, not `d:\…`).
`tests/db/run.mjs` relaunches vitest from there.

Suites that need PostgREST or Mailpit skip themselves when the
`TEST_POSTGREST_*` / `TEST_SMTP_*` variables are unset. CI
(`.github/workflows/migrations.yml`) sets all of them.

## Files

| File                       | Covers                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `rls-isolation.test.ts`    | Every tenant table × every role tier: blind (WHERE-less) reads, inserts, updates and deletes across accounts. |
| `privilege-guards.test.ts` | Identity-column guard triggers, member-management and data RPCs, SECURITY DEFINER exposure, `profiles` view.  |
| `with-tenant.test.ts`      | `withTenant` / `withService` and the PostgREST path: cross-tenant access fails; the app role owns nothing.    |
| `data-api.test.ts`         | The browser data API (`/api/data`) registry + RLS through PostgREST.                                          |
| `auth.native.test.ts`      | Better Auth end to end: sign-up, verification, bcrypt import + rehash, rate limit, CSRF, cookie flags, reset. |
| `email.smtp.test.ts`       | Verification, reset and invite emails over real SMTP.                                                         |
| `bootstrap.test.ts`        | First-start accounts (`PLATFORM_ADMIN_*`, `SEED_USER_*`).                                                     |
| `admin.test.ts`            | Admin panel: every read query, disabled users blocked at sign-in, delete plan + delete order, audit log.      |

Each isolation file seeds a two-tenant fixture (`fixture.ts`) inside one
transaction and rolls everything back. The suites that drive the real
auth handler or PostgREST commit their rows and delete them afterwards.
