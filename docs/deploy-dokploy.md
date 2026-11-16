# Deploy on Dokploy

From an empty VPS to a running Automate Panu AI, with nothing hosted
anywhere else except your SMTP provider and Meta. Everything runs as one
Docker Compose project (`docker-compose.yml`).

| What             | Domain                      | Service (port)         |
| ---------------- | --------------------------- | ---------------------- |
| CRM app          | `chat.axxeler.in`           | `app` (3000)           |
| Website          | `automatepanuai.axxeler.in` | `app` (3000), same app |
| Media files (1f) | `files.axxeler.in`          | `minio` (9000)         |

PostgreSQL, PostgREST and Redis are never reachable from the internet,
and neither is the MinIO console (it is turned off).

---

## 1. VPS

| Size                       | Good for                    | Notes                                                                                                        |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2 vCPU / 4 GB RAM / 60 GB  | launch, a few dozen tenants | the defaults in `docker-compose.yml` are tuned for this                                                      |
| 4 vCPU / 8 GB RAM / 120 GB | growth                      | raise `PG_SHARED_BUFFERS=2GB`, `PG_EFFECTIVE_CACHE_SIZE=6GB`, `DB_MEMORY_LIMIT=3g`, `APP_MEMORY_LIMIT=2048m` |

Ubuntu 24.04 LTS. Building the image needs about 3 GB of free RAM. On a
4 GB box, add swap once:

```sh
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Firewall: allow only 22, 80, 443 (and 3000 for the Dokploy panel until
you put it behind a domain).

```sh
sudo ufw allow 22,80,443/tcp && sudo ufw allow 3000/tcp && sudo ufw enable
```

## 2. Install Dokploy

```sh
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://<server-ip>:3000`, create the admin user. (Later: Settings →
Web Server → give the panel its own domain and close port 3000.)

## 3. DNS

At your DNS provider for `axxeler.in`, add **A records** pointing at the
VPS IP (proxy **off** / DNS-only if you use Cloudflare, so Let's Encrypt
can issue certificates):

| Name             | Type | Value         |
| ---------------- | ---- | ------------- |
| `chat`           | A    | `<server-ip>` |
| `automatepanuai` | A    | `<server-ip>` |
| `files`          | A    | `<server-ip>` |

Check: `nslookup chat.axxeler.in` returns the VPS IP.

## 4. SMTP (sign-up needs it)

Pick a provider (Brevo, Postmark, Amazon SES, Mailgun, Zoho…). Verify the
sending domain and add the SPF/DKIM records it gives you, or
verification emails land in spam. Note the host, port, user and
password.

## 5. Meta app secret

Meta for Developers → your app → **App settings → Basic → App secret**
(Show). This is `META_APP_SECRET`.

## 6. Create the app in Dokploy

1. **Projects → Create project** → e.g. `automatepanu`.
2. **Create service → Compose**.
3. **General → Provider:** GitHub → repo `aiwithsalman33/Automatepanu-ai`,
   branch **`main`**, Compose path **`./docker-compose.yml`**, compose type
   **Docker Compose**.
4. **Environment:** paste your filled-in env file:
   - you already have one: the git-ignored `.env.dokploy` in the repo
     folder on your PC (fresh secrets; fill the `>>> FILL <<<` lines);
   - or create one: `node scripts/generate-secrets.mjs --file .env.dokploy`
     (template: `.env.example`, every variable commented).

   Required: the domain URLs, all secrets, `SMTP_*`, `META_APP_SECRET`.
   Compose refuses to start and names any missing one.

5. **Domains** (this is where Traefik + HTTPS are set up):

   | Host                        | Service | Container port | HTTPS                  |
   | --------------------------- | ------- | -------------- | ---------------------- |
   | `chat.axxeler.in`           | `app`   | 3000           | on, Let's Encrypt      |
   | `automatepanuai.axxeler.in` | `app`   | 3000           | on, Let's Encrypt      |
   | `files.axxeler.in`          | `minio` | 9000           | on (used from step 1f) |

   Both website and app domains go to the same `app` service; it routes
   by host.

6. **Deploy.** First build takes 5–10 minutes. Watch **Logs**:
   - `migrate`: ends with `migration(s) applied` (or "No migrations to run"), exit 0
   - `minio-init`: `Bucket created successfully` ×3, exit 0
   - `app`: `✓ Ready`; healthy after ~30 s
   - `cron`: silent unless a run fails

   If `app` exits at once with `Not starting: N configuration problem(s)`,
   the message lists exactly which variables to fix.

## 7. Check it works

1. `https://chat.axxeler.in/api/health` → `{"ok":true}`
2. `https://chat.axxeler.in` → login page; `https://automatepanuai.axxeler.in` → website.
3. **Sign up** → you receive "Confirm your email" → click → you land in the
   dashboard. The first sign-up creates its own account (workspace); invite
   teammates from Settings → Members.

## 8. Connect WhatsApp (Meta webhook)

In Meta for Developers → your app → **WhatsApp → Configuration → Webhook**:

- Callback URL: `https://chat.axxeler.in/api/whatsapp/webhook`
- Verify token: the one you set in the app (**Settings → WhatsApp**)
- Subscribe to the **messages** field (and `message_template_status_update`).

Then in the app, Settings → WhatsApp → paste the phone number ID, WABA ID
and access token → Save. Send a WhatsApp message to the number: it
appears in the Inbox.

## 9. Scheduler

Nothing to set up: the `cron` service calls `/api/automations/cron` and
`/api/flows/cron` every minute with `AUTOMATION_CRON_SECRET`. Check its
logs if automations with waits/timeouts don't fire.

## 10. Backups

The `backup` service writes `pg_dump -Fc` files to the `backups` volume
every `BACKUP_INTERVAL_HOURS` (24) and keeps `BACKUP_RETENTION_DAYS` (14).

- **Off-site copy (do this):** Dokploy → Volume Backups (or a host cron)
  copying the `automatepanu_backups` volume to S3/B2/another server. A backup
  on the same disk doesn't survive losing the disk.
- **List backups:** Dokploy → service `backup` → Terminal (or SSH):
  ```sh
  docker compose -p <dokploy-project-name> exec backup sh /scripts/restore.sh
  ```

## 11. Restore drill (monthly)

Restore the newest backup into a **scratch** database and check row counts;
production stays untouched:

```sh
docker compose exec backup sh /scripts/restore.sh latest wacrm_restore_test
docker compose exec backup psql -d postgres -c 'DROP DATABASE wacrm_restore_test'
```

Real restore (over the live database):

```sh
docker compose stop app cron
docker compose exec backup sh /scripts/restore.sh wacrm-20261116T020000Z.dump
docker compose start app cron
```

## 12. Upgrades (near-zero downtime)

1. Push to `main` (or click **Deploy** in Dokploy; enable **Autodeploy** to
   deploy on every push).
2. Dokploy builds the new image while the old containers keep serving.
3. `migrate` runs first; the app only restarts after migrations succeed,
   so a failed migration leaves the old version running.
4. Migrations are additive (expand → migrate → contract), so the running
   version keeps working while the new one starts. The switch-over is the
   few seconds the `app` container takes to restart.

Before a big upgrade, take a manual backup:

```sh
docker compose exec backup sh -c 'pg_dump -Fc -f /backups/pre-upgrade-$(date -u +%Y%m%dT%H%M%SZ).dump'
```

## 13. Rollback

- **Code:** Dokploy → Deployments → pick the previous deployment →
  **Rollback** (or `git revert` the bad commit on `main` and deploy).
- **Database:** only if a migration damaged data. Restore the pre-upgrade
  dump (step 11), then deploy the matching code version.

## 14. Rotating secrets

Generate new values with `node scripts/generate-secrets.mjs`, update
Dokploy → Environment, redeploy. Notes:

- `AUTH_SECRET`: everyone is signed out; emailed links stop working.
- `WACRM_*_PASSWORD`, `POSTGRES_PASSWORD`: also change it inside Postgres
  first (`ALTER ROLE … PASSWORD …`); the volume keeps the old one.
- `ENCRYPTION_KEY`: **never** on a live install (stored WhatsApp and AI
  tokens become unreadable).

## Troubleshooting

| Symptom                                      | Fix                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `required variable X is missing a value`     | Add `X` in Environment, redeploy                                                 |
| `app` restarts: `Not starting: … problem(s)` | The log lists the bad variables                                                  |
| Certificate errors                           | DNS not pointing at the VPS yet, or Cloudflare proxy on; wait, then redeploy     |
| No verification email                        | `SMTP_*` wrong (app logs show the SMTP error); check spam; check SPF/DKIM        |
| Webhook "verification failed" in Meta        | Verify token must match Settings → WhatsApp; the URL must be HTTPS and reachable |
| `/api/health` 503                            | Database/PostgREST down: check `db`, `migrate`, `postgrest` logs                 |
