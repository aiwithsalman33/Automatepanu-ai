# Docker reference

Two Compose files:

| File | For | What it runs |
| --- | --- | --- |
| [`docker-compose.yml`](../docker-compose.yml) | **local development** | db, migrate, postgrest, redis, minio, mailpit on `127.0.0.1` ports, fixed local-only passwords. The app runs with `npm run dev`. |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | **production** (Dokploy) | the whole stack below, behind Caddy on :8080, every secret required, nothing published on the host. |

Production deployment, step by step: [deploy-dokploy.md](./deploy-dokploy.md).

## Production services (docker-compose.prod.yml)

| Service      | Image                                      | Role                                                                                                                                  |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `caddy`      | `caddy:2.10.2-alpine`                      | The only entry point: HTTP on **8080** → `app`. Compression, security headers, real client IP. Dokploy routes `chat.axxeler.in` here. |
| `app`        | `ghcr.io/aiwithsalman33/automatepanu-app` (built by GitHub Actions from the `runner` target) | Next.js standalone, non-root, read-only filesystem. CRM, website at `/`, API, webhook, `/admin`.                                      |
| `cron`       | `curlimages/curl:8.11.1`                   | Calls `/api/automations/cron` and `/api/flows/cron` every minute (`x-cron-secret`).                                                   |
| `db`         | `pgvector/pgvector:0.8.1-pg17`             | PostgreSQL 17 + pgvector, volume `db-data`, tuned via `PG_*` variables.                                                               |
| `migrate`    | `ghcr.io/aiwithsalman33/automatepanu-migrate` (`migrate` target) | One-shot: bootstrap roles/schemas/extensions as superuser, then apply `db/migrations` as `wacrm_owner`.                               |
| `postgrest`  | `postgrest/postgrest:v12.2.12`             | Private REST layer between the app and Postgres (short-lived JWT per request). Never public.                                          |
| `redis`      | `redis:7.4.12-alpine`                      | Rate limits shared across instances. Password, AOF persistence, 256 MB cap.                                                           |
| `minio`      | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` | S3 storage, console disabled. Community MinIO build (AGPLv3).                                                                         |
| `minio-init` | same                                       | One-shot: creates the private buckets `avatars`, `chat-media`, `flow-media`.                                                          |
| `backup`     | `postgres:17.12-alpine`                    | `pg_dump -Fc` every `BACKUP_INTERVAL_HOURS` into volume `backups`, keeps `BACKUP_RETENTION_DAYS`; restore script.                     |

Start order: `db` healthy → `migrate` exits 0 → `postgrest`; `minio`
healthy → `minio-init` exits 0; then `app` → (healthy) → `caddy` and `cron`.
The app creates the first-start accounts (`PLATFORM_ADMIN_*`, `SEED_USER_*`)
on boot.

**Hardening:**

- Every image is pinned and every service has a restart policy, a memory limit and log rotation (10 MB × 5 files).
- `db`, `postgrest`, `redis` and `minio` live on the `backend` network, which is `internal: true` (no route to the internet). `app` also joins the default network (Meta, SMTP, AI providers), where `caddy` reaches it.
- No host ports are published; Dokploy reaches `caddy:8080` over Docker's network.
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

## Local development (docker-compose.yml)

```bash
cp .env.example .env.local     # then replace its contents with the
                               # "LOCAL DEVELOPMENT" block at the bottom, uncommented
docker compose up -d           # services + migrations (first run builds the migrator)
npm install
npm run dev                    # http://localhost:3000
```

| Service | Address | Notes |
| --- | --- | --- |
| Postgres | `127.0.0.1:54330` | db `wacrm`, superuser `postgres` / `local-postgres` |
| PostgREST | `http://127.0.0.1:54331` | |
| Redis | `127.0.0.1:63790` | password `local-redis` |
| MinIO | `http://127.0.0.1:9000`, console `:9001` | `local-minio` / `local-minio-password` |
| Mailpit | SMTP `127.0.0.1:1025`, inbox <http://localhost:8025> | every email (sign-up, reset, invites) lands here |

These credentials are fixed and local-only (ports bind to 127.0.0.1).
Sign-in works over plain http locally (cookies are only `Secure` in
production). Add `PLATFORM_ADMIN_*` / `SEED_USER_*` to `.env.local` to get
ready-made accounts on first boot.

```bash
docker compose run --rm migrate   # apply new migrations
docker compose logs -f postgrest  # follow a service
docker compose down               # stop (data kept)
docker compose down -v            # stop and DELETE local data
```

## Try the production stack on a PC

```bash
npm run secrets -- --file .env.dokploy        # fill the remaining FILL lines
docker compose -f docker-compose.prod.yml --env-file .env.dokploy up -d   # pulls the GHCR images
```

Nothing is published on the host by design (Dokploy reaches `caddy:8080`
over Docker networking). Production cookies are `Secure`, so browser
sign-in needs the real HTTPS domain.

## Build-time vs runtime variables

- `NEXT_PUBLIC_*` are **inlined at build time** (Docker build args).
  They are set in `.github/workflows/docker-images.yml` (repository
  variables). Change one → re-run that workflow, then Deploy.
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

On the server (Dokploy → the compose app → Terminal, or SSH; `-f docker-compose.prod.yml` when run from the code folder):

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
