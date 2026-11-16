# Deploy on Dokploy

From an empty VPS to a running Automate Panu AI. One domain,
**`chat.axxeler.in`**, and one Compose stack (`docker-compose.prod.yml`). Nothing
is hosted elsewhere except your SMTP provider and Meta.

```
Internet ──HTTPS──▶ Dokploy (Traefik, Let's Encrypt)
                      │  chat.axxeler.in → caddy:8080
                      ▼
                   caddy :8080 ──▶ app :3000 ──▶ postgrest ─▶ db
                                    │  └──────▶ redis, minio
                   cron ────────────┘          (internal network, no internet)
```

- **Caddy** is the only entry point, plain HTTP on port **8080** inside the
  stack. Dokploy's Traefik terminates HTTPS and forwards to it.
- **The website** is `/`; the CRM is `/login`, `/dashboard`… The Meta webhook
  is `/api/whatsapp/webhook`, and the admin panel `/admin`. All on the same
  domain.
- PostgreSQL, PostgREST, Redis and MinIO are never reachable from outside.

---

## 1. VPS

| Size                       | Good for                    | Notes                                                                                                      |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 2 vCPU / 4 GB RAM / 60 GB  | launch, a few dozen tenants | the defaults in `docker-compose.prod.yml` are tuned for this                                                    |
| 4 vCPU / 8 GB RAM / 120 GB | growth                      | set `PG_SHARED_BUFFERS=2GB`, `PG_EFFECTIVE_CACHE_SIZE=6GB`, `DB_MEMORY_LIMIT=3g`, `APP_MEMORY_LIMIT=2048m` |

Ubuntu 24.04 LTS. The image build needs about 3 GB RAM. On a 4 GB box,
add swap once:

```sh
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Firewall: only 22, 80 and 443 (and 3000 for the Dokploy panel until it
has its own domain). Port 8080 does **not** need to be open: Caddy is
reached over Docker's internal network.

```sh
sudo ufw allow 22,80,443/tcp && sudo ufw allow 3000/tcp && sudo ufw enable
```

## 2. Install Dokploy

```sh
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://<server-ip>:3000` and create the Dokploy admin user.

## 3. DNS

One record at your DNS provider for `axxeler.in`:

| Name   | Type | Value         |
| ------ | ---- | ------------- |
| `chat` | A    | `<server-ip>` |

If you use Cloudflare, set the record to DNS-only (grey cloud) so
Let's Encrypt can issue the certificate. Check with
`nslookup chat.axxeler.in`.

## 4. SMTP (sign-up and password reset need it)

Choose a provider (Brevo, Postmark, Amazon SES, Mailgun, Zoho…), verify
your sending domain and add its SPF/DKIM records. Note the host, port,
user and password.

## 5. Meta app secret

Meta for Developers → your app → **App settings → Basic → App secret**.

## 6. Create the app in Dokploy

1. **Projects → Create project**, e.g. `automatepanu`.
2. **Create service → Compose.**
3. **General → Provider:** GitHub → `aiwithsalman33/Automatepanu-ai`,
   branch **`main`**, compose path **`./docker-compose.prod.yml`**, type
   **Docker Compose**.
4. **Environment:** paste the whole of your `.env.dokploy` (in the repo
   folder on your PC; git-ignored). Fill the `>>> FILL <<<` lines:
   `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `META_APP_SECRET`. To start
   from scratch instead: `node scripts/generate-secrets.mjs --file .env.dokploy`
   (template with every variable explained: `.env.example`).
5. **Domains → Add domain:**

   | Host              | Path | Service | Container port | HTTPS             |
   | ----------------- | ---- | ------- | -------------- | ----------------- |
   | `chat.axxeler.in` | `/`  | `caddy` | **8080**       | on, Let's Encrypt |

   That's the only domain.

6. **Deploy.** The first build takes 5–10 minutes. In **Logs**:
   - `migrate` → `migration(s) applied`, exits 0
   - `minio-init` → 3 × `Bucket created successfully`, exits 0
   - `app` → `[bootstrap] axxeler@gmail.com: created` (and the seed user), then `✓ Ready`
   - `caddy` → healthy
   - `cron` → silent unless a run fails

   If `app` stops with `Not starting: N configuration problem(s)`, the log
   lists exactly which variables to fix.

## 7. First sign-in

1. `https://chat.axxeler.in/api/health` → `{"ok":true}`
2. `https://chat.axxeler.in` → the website; **Sign in** →
   `https://chat.axxeler.in/login`.
3. Sign in with the accounts from `.env.dokploy`:
   - `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`: a platform admin.
     Opens **`https://chat.axxeler.in/admin`** (every workspace and user)
     and has its own workspace at `/dashboard`.
   - `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`: a normal user with their own
     workspace.

   Both are created once, already verified, on first start. A later
   deploy never changes them, even if you edit the env values.

4. **Change both passwords** (Settings → Profile → Password). Then you can
   delete the two `*_PASSWORD` lines from the Dokploy environment.
5. New customers sign up at `/signup` (verification email), and teammates
   join via Settings → Members → Invite.

## 8. Connect WhatsApp

Meta for Developers → your app → **WhatsApp → Configuration → Webhook**:

- Callback URL: `https://chat.axxeler.in/api/whatsapp/webhook`
- Verify token: the one shown in the app under **Settings → WhatsApp**
- Subscribe to **messages** (and `message_template_status_update`)

Then in the app, Settings → WhatsApp → phone number ID, WABA ID, access
token → Save. Send the number a WhatsApp message: it appears in Inbox.

## 9. Scheduler

Built in: the `cron` service calls `/api/automations/cron` and
`/api/flows/cron` every minute. Nothing to configure.

## 10. Backups

`backup` writes a `pg_dump` every `BACKUP_INTERVAL_HOURS` (24) to the
`backups` volume and keeps `BACKUP_RETENTION_DAYS` (14).

- **Copy them off the server.** Dokploy → Volume Backups (S3/B2), or a host
  cron. A backup on the same disk doesn't survive losing the disk.
- **List:** Dokploy → service `backup` → Terminal:
  `sh /scripts/restore.sh`

## 11. Restore drill (do it monthly)

In the `backup` service terminal:

```sh
sh /scripts/restore.sh latest wacrm_restore_test   # restores into a scratch DB, prints row counts
psql -d postgres -c 'DROP DATABASE wacrm_restore_test'
```

Real restore over the live database: stop `app` and `cron` (Dokploy →
service → Stop), run `sh /scripts/restore.sh <file>.dump`, start them again.

## 12. Upgrades

Push to `main`, then click **Deploy** (or turn on **Autodeploy**).

- **Order:** Dokploy builds while the old containers keep serving. `migrate` runs first, and the app restarts only after migrations succeed. A failed migration leaves the old version running.
- **Downtime:** a few seconds while `app` restarts. Migrations are additive (expand → migrate → contract).
- **First:** take a backup before any big upgrade: `pg_dump -Fc -f /backups/pre-upgrade.dump` in the `backup` terminal.

## 13. Rollback

- **Code:** Dokploy → Deployments → previous deployment → **Rollback**
  (or `git revert` on `main` and deploy).
- **Data:** only if a migration damaged something. Restore the pre-upgrade
  dump (§11), then deploy the matching code.

## 14. Rotating secrets

`node scripts/generate-secrets.mjs` prints a fresh set. Update Dokploy →
Environment, then redeploy.

- `AUTH_SECRET`: signs everyone out.
- Database passwords: change them inside Postgres too (`ALTER ROLE …`).
- `ENCRYPTION_KEY`: **never** on a live install (stored WhatsApp/AI tokens
  become unreadable).

## Troubleshooting

| Symptom                                     | Fix                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Build stops at `Creating an optimized production build` (“cancelled”, exit 137, `Killed`) | Out of RAM during `next build`: add the swap from §1, redeploy. Build uses 1 worker by default (`NEXT_BUILD_CPUS`); raise only on 8 GB+ |
| `required variable X is missing a value`    | Add `X` in Environment, redeploy                                                |
| `app` exits: `Not starting: … problem(s)`   | The log lists the bad variables                                                 |
| 502/404 on the domain                       | Domain must point to service **caddy**, port **8080**; check `caddy` is healthy |
| Certificate errors                          | DNS not on the VPS yet, or Cloudflare proxy on                                  |
| `[bootstrap] … skipped (password shorter…)` | Bootstrap passwords need 6+ characters                                          |
| No verification email                       | `SMTP_*` wrong (the app log shows the SMTP error); check spam, SPF/DKIM         |
| Meta webhook verification fails             | Verify token must match Settings → WhatsApp; URL must be HTTPS                  |
| `/admin` shows 404                          | You're not signed in as the `PLATFORM_ADMIN_EMAIL` account                      |
