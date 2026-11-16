# Docker reference

The whole stack is one Compose project: [`docker-compose.yml`](../docker-compose.yml).
Production deployment, step by step: [deploy-dokploy.md](./deploy-dokploy.md).

## Services

| Service      | Image                                      | Role                                                                                                              |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `app`        | this repo (`runner` target)                | Next.js standalone, non-root, read-only filesystem. Serves the CRM and the website (routed by host).              |
| `cron`       | `curlimages/curl:8.11.1`                   | Calls `/api/automations/cron` and `/api/flows/cron` every minute (`x-cron-secret`).                               |
| `db`         | `pgvector/pgvector:0.8.1-pg17`             | PostgreSQL 17 + pgvector, volume `db-data`, tuned via `PG_*` variables.                                           |
| `migrate`    | this repo (`migrate` target)               | One-shot: bootstrap roles/schemas/extensions as superuser, then apply `db/migrations` as `wacrm_owner`.           |
| `postgrest`  | `postgrest/postgrest:v12.2.12`             | Private REST layer between the app and Postgres (short-lived JWT per request). Never public.                      |
| `redis`      | `redis:7.4.12-alpine`                      | Rate limits shared across instances. Password, AOF persistence, 256 MB cap.                                       |
| `minio`      | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` | S3 storage, console disabled. Community MinIO build (AGPLv3).                                                     |
| `minio-init` | same                                       | One-shot: creates the private buckets `avatars`, `chat-media`, `flow-media`.                                      |
| `backup`     | `postgres:17.12-alpine`                    | `pg_dump -Fc` every `BACKUP_INTERVAL_HOURS` into volume `backups`, keeps `BACKUP_RETENTION_DAYS`; restore script. |

Start order: `db` healthy → `migrate` exits 0 → `postgrest`; `minio`
healthy → `minio-init` exits 0; then `app` → (healthy) → `cron`.

**Hardening:**

- Every image is pinned and every service has a restart policy, a memory limit and log rotation (10 MB × 5 files).
- `db`, `postgrest`, `redis` and `minio` live on the `backend` network, which is `internal: true` (no route to the internet). Only `app` also joins the default network, for Meta, SMTP, AI providers and Traefik.
- No host ports are published.
- The app receives an explicit variable list. It never sees the Postgres superuser or owner passwords.
- The app container refuses to start when a required variable is missing or still a placeholder (`scripts/check-env.mjs`), and lists them all.

## Database roles

| Role                  | Login | Purpose                                                                                   |
| --------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `postgres`            | yes   | Superuser. Only `migrate` (bootstrap) and `backup`.                                       |
| `wacrm_owner`         | yes   | Owns all schema objects; runs migrations.                                                 |
| `wacrm_authenticator` | yes   | What the app and PostgREST connect as. `NOINHERIT`: no privileges until it switches role. |
| `wacrm_app`           | no    | Tenant role, bound by RLS (`app.user_id` / JWT `sub`).                                    |
| `wacrm_service`       | no    | `BYPASSRLS`: webhook, engines, public API, scheduler. Always filters by `account_id`.     |
| `wacrm_anon`          | no    | Signed out: invitation peek only.                                                         |

## Run the stack locally

```bash
node scripts/generate-secrets.mjs --file .env     # fresh secrets from .env.example
# in .env: SMTP_HOST=mailpit SMTP_PORT=1025, META_APP_SECRET=anything-for-local
docker compose up -d --build
# catch emails locally (joins the stack's network):
docker run -d --name mailpit --network automatepanu_default -p 8025:8025 axllent/mailpit:v1.27.0
```

Nothing is published on the host, by design. To open the app in a
browser locally, put a throwaway forwarder on the network:

```bash
docker run -d --name app-port --network automatepanu_default -p 127.0.0.1:3000:3000 \
  alpine/socat:1.8.0.3 tcp-listen:3000,fork,reuseaddr tcp-connect:app:3000
# http://localhost:3000   ·   emails: http://localhost:8025
```

## Local development

`npm run dev` runs the app from source against services in Docker. Start
the stack (above), then point the dev server at it by publishing what it
needs on localhost. The simplest way is the same forwarder trick for
`postgrest:3000` and `db:5432`, then in `.env.local`:

```env
DATABASE_URL=postgresql://wacrm_authenticator:<WACRM_AUTHENTICATOR_PASSWORD>@localhost:5432/wacrm
POSTGREST_URL=http://localhost:3001
POSTGREST_JWT_SECRET=<same as .env>
AUTH_SECRET=<any 32+ chars>
SMTP_HOST=localhost
SMTP_PORT=1025
```

Without SMTP, development logs each email (and its link) to the console.

## Build-time vs runtime variables

- `NEXT_PUBLIC_*` are **inlined at build time** (Docker build args).
  Change one → rebuild (`docker compose up -d --build`, or Deploy in Dokploy).
- Everything else is read at **runtime** and never baked into an image.

## Migrations

`migrate` runs on every deploy and is idempotent (history in
`migrations.pgmigrations`). Against any database:

```bash
DATABASE_ADMIN_URL=postgresql://postgres:…@host:5432/wacrm \
DATABASE_URL=postgresql://wacrm_owner:…@host:5432/wacrm \
WACRM_OWNER_PASSWORD=… WACRM_AUTHENTICATOR_PASSWORD=… \
npm run db:migrate
```

New schema changes go in new numbered files under `db/migrations/`, and
each must `GRANT` explicitly (nothing relies on default privileges).

## Backups and restore

```bash
docker compose exec backup sh /scripts/restore.sh                    # list dumps
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/manual.dump'   # take one now
docker compose exec backup sh /scripts/restore.sh latest wacrm_restore_test   # drill: restore into a scratch DB
docker compose cp backup:/backups/<file> .                           # copy one off the server
```

Restore over the live database: stop `app` and `cron`, run
`restore.sh <file>`, start them again (details: deploy-dokploy.md §11).
A dump on the same disk is not a backup: copy dumps off the server.

## Notes

- Inbound WhatsApp media is mirrored into storage (Meta deletes media
  after ~30 days). That path comes back with the storage checkpoint
  (1f); until then the app keeps Meta's media proxy link.
- Live updates (inbox, notifications) return with the realtime
  checkpoint (1e); pages refresh normally meanwhile.
