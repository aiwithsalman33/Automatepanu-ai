# Running with Docker

The repo ships a multi-stage `Dockerfile` and a `docker-compose.yml`
for the self-hosted stack (decisions in
[saas-migration-plan.md](./saas-migration-plan.md)). It deploys as-is
with `docker compose` or Dokploy.

> **Phase 1 status (checkpoint 1a).** The database, migrator, PostgREST,
> Redis, MinIO and backup services are in place and tested. The `app`
> still reads **Supabase** for auth and data until checkpoints 1b/1c
> switch it over, so keep the Supabase variables in `.env.local` for now.

## Services

| Service     | Image                                      | Role                                                                                                                                            |
| ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`        | `pgvector/pgvector:0.8.1-pg17`             | Postgres 17 + pgvector. Volume `db-data`. Not published to the host.                                                                            |
| `migrate`   | this repo, `--target migrate`              | One-shot: bootstrap roles/schemas/extensions as superuser, then apply `db/migrations` as `wacrm_owner`. Everything else waits for it to exit 0. |
| `postgrest` | `postgrest/postgrest:v12.2.12`             | Internal REST layer for existing server code (transitional, D1). Never published.                                                               |
| `redis`     | `redis:7.4-alpine`                         | Rate limits, realtime fan-out, caches. Password-protected, AOF on.                                                                              |
| `minio`     | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` | S3-compatible storage (used from checkpoint 1f). Community build of MinIO (AGPLv3); upstream stopped publishing free images in 2025.            |
| `app`       | this repo (default target)                 | Next.js standalone, non-root, healthcheck.                                                                                                      |
| `backup`    | `postgres:17-alpine`                       | `pg_dump -Fc` every `BACKUP_INTERVAL_HOURS` into volume `backups`, pruned after `BACKUP_RETENTION_DAYS`.                                        |

### Database roles

None of the login roles is a superuser, and the app never logs in as the
schema owner.

| Role                  | Login | Purpose                                                                                                           |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `postgres`            | yes   | Superuser. Only `migrate` (bootstrap) and `backup` use it.                                                        |
| `wacrm_owner`         | yes   | Owns all schema objects; runs migrations.                                                                         |
| `wacrm_authenticator` | yes   | What the app and PostgREST connect as. `NOINHERIT`: no privileges until it `SET ROLE`s to one of the three below. |
| `wacrm_app`           | no    | Tenant role, bound by RLS. The current user comes from `app.user_id` (or the PostgREST JWT `sub`).                |
| `wacrm_service`       | no    | `BYPASSRLS`: webhook, engines, public API, worker. Must always filter by `account_id`.                            |
| `wacrm_anon`          | no    | Unauthenticated: invitation peek only.                                                                            |

## Quick start

1. Copy the env template and fill it in. The **SELF-HOSTED STACK**
   section lists the secrets Compose requires; generate each with
   `openssl rand -hex 32`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Build and start (the `--env-file` flag is required, because Compose
   only reads `.env` by default for `${VAR}` substitution):

   ```bash
   docker compose --env-file .env.local up --build -d
   ```

   A missing secret stops Compose before anything starts, with a
   message naming the variable.

3. The app is served on [http://localhost:3000](http://localhost:3000)
   (publish it elsewhere with `HOST_PORT=8080` in `.env.local`).

> Use `HOST_PORT`, not `PORT`, to move the published port. `PORT` is
> what the server listens on _inside_ the container. Compose pins it to
> 3000 so a stray `PORT` in `.env.local` can't desync the app from the
> port mapping and the healthcheck.

## Build-time vs runtime variables

- `NEXT_PUBLIC_*` variables are **inlined into the client bundle at
  build time** and passed as Docker build args. If you change any of
  them, rebuild with `docker compose --env-file .env.local up --build -d`.
  This includes `NEXT_PUBLIC_APP_LOCALE` (`en | ko | pt | es`).
- Everything else is read at **runtime** and is never baked into the
  image.

## Migrations

`migrate` runs on every `up` and is idempotent: already-applied
migrations are skipped, and the history lives in
`migrations.pgmigrations`. To run it locally against any database:

```bash
DATABASE_ADMIN_URL=postgresql://postgres:…@host:5432/wacrm \
DATABASE_URL=postgresql://wacrm_owner:…@host:5432/wacrm \
WACRM_OWNER_PASSWORD=… WACRM_AUTHENTICATOR_PASSWORD=… \
npm run db:migrate
```

`db/migrations/0002_baseline.sql` is **generated** from
`supabase/migrations` by `npm run db:baseline` (needs Docker). CI fails
if the committed file is out of date. New schema changes go in new
numbered files under `db/migrations/`, and each one must `GRANT`
explicitly: nothing relies on default privileges.

## Backups and restore

The `backup` service writes `wacrm-<UTC timestamp>.dump` files to the
`backups` volume. A dump is only renamed into place once `pg_dump`
succeeds. List them, or take one on demand:

```bash
docker compose exec backup ls -lh /backups
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/manual.dump'
```

Copy dumps off the server regularly (`docker compose cp
backup:/backups/<file> .`); a volume on the same disk is not a backup.

**Restore into an empty database** (this procedure is tested: data,
migration history and tenant isolation all survive):

```bash
# 1. fresh, empty db volume
docker compose --env-file .env.local up -d db
# 2. create roles/schemas/extensions only (no migrations)
docker compose --env-file .env.local run --rm migrate node db/migrate.mjs bootstrap
# 3. restore
docker compose cp ./wacrm-<stamp>.dump db:/tmp/restore.dump
docker compose exec db pg_restore -U postgres -d wacrm --clean --if-exists --exit-on-error /tmp/restore.dump
# 4. bring everything up; migrate is a no-op unless the dump is older than the code
docker compose --env-file .env.local up -d
```

## Dokploy

Create a **Compose** application pointing at this repo, paste the
`.env.local` contents into its environment, and deploy. Attach your
domain to the `app` service (port 3000) in Dokploy's UI. Dokploy's
Traefik handles TLS. The `app` service carries commented-out Traefik
labels if you prefer label-based routing. A full step-by-step guide
(VPS sizing, domains, the Meta webhook URL, upgrades) comes with
checkpoint 1g as `docs/deploy-dokploy.md`.

## Notes

- Received attachments are mirrored into storage, because Meta deletes
  media about 30 days after it arrives. Turn this off per account under
  Settings → WhatsApp → Attachment Storage. Files over 16 MB are never
  copied.
- Nothing inside the containers is scheduled yet (the `worker` arrives
  in Phase 5). If you use automation Wait steps or flows, point an
  external scheduler at `GET /api/automations/cron` and
  `GET /api/flows/cron`, sending `AUTOMATION_CRON_SECRET` in the
  `x-cron-secret` header.
