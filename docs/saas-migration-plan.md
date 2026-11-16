# wacrm → multi-tenant SaaS: migration plan (Phase 0)

> **Status:** Phase 0 approved (decisions in §5). Pre-1a baseline isolation suite done (§7); next: checkpoint **1a**.
> **Scope:** audit of every Supabase dependency, the target architecture, the new schema, risks, the decisions that need your sign-off, and a phase-by-phase checklist.
> **Companion doc:** [`PROJECT_ANALYSIS.md`](../PROJECT_ANALYSIS.md), the full feature and structure analysis of the current code.

---

## 0. Corrections to the brief

These points in the brief don't quite match what the code does. Each comes with a proposed fix.

| #   | The brief says / assumes                                                                       | What the code actually does                                                                                                                                                                                                                                                                | Proposal                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Phase 1 should leave the app working "single-tenant as before".                                | wacrm is **already multi-tenant** at the data layer. It has `accounts`, roles, invitations, and role-tiered RLS through `is_account_member()` (migration 017+). What's missing is the _platform_ layer: billing, admin, infrastructure.                                                    | Phase 1 goal: "works exactly as today (many accounts, one WhatsApp number each), without Supabase".                                                                                                                                                                                                            |
| C2  | Replace every `supabase.from(...)` with typed route handlers using `withTenant` + `SET LOCAL`. | The browser side is 43 files (§1.2). The **server** side has a further ~450 PostgREST query-builder call sites in 121 files, including 16 embedded-join selects and 10 `.or()` filters. Hand-rewriting all of them to SQL or Kysely in Phase 1 is the single biggest risk in this project. | **Decision D1:** a hybrid. Run self-hosted **PostgREST** internally (never exposed publicly), keep `@supabase/postgrest-js` for the existing server code, and add Kysely + `withTenant()` for new code. RLS still enforces isolation in the DB (§2.3).                                                         |
| C3  | Remove `auth.*` references from the baseline.                                                  | RLS bodies call `auth.uid()` **137 times in 25 migrations**, plus 62 `SECURITY DEFINER` functions.                                                                                                                                                                                         | **Approved approach:** keep a temporary **`auth.uid()` shim** in a minimal `auth` schema. It reads `app.user_id` (set by `withTenant`), falling back to the PostgREST JWT `sub`. Policies stay byte-identical in 1a; they are rewritten to `app.uid()` later, one module at a time, under the isolation suite. |
| C4  | Realtime must cover `flow_runs`.                                                               | `flow_runs` is in the realtime publication, but **no client subscribes to it**. The client subscribes only to `messages`, `conversations`, `message_reactions`, `member_presence` and `notifications`.                                                                                     | Cover all six anyway. The runs page gets live updates as a small new feature.                                                                                                                                                                                                                                  |
| C5  | Keep "the signup trigger logic".                                                               | `handle_new_user()` is a trigger on **`auth.users`**, which won't exist after the switch.                                                                                                                                                                                                  | Move it to a trigger on the new `users` table with the same behaviour: a personal account plus an owner profile.                                                                                                                                                                                               |
| C6  | Make `META_APP_ID` per-tenant.                                                                 | It's used **only** for image-header template uploads (resumable upload). For SaaS the normal model is **one platform Meta App** serving every tenant (also required for Embedded Signup).                                                                                                  | **Decision D6:** one platform Meta App, configured in admin settings. Keep a list of extra app secrets for edge cases.                                                                                                                                                                                         |
| C7  | (not in the brief)                                                                             | **A bug turned up in the audit:** `components/flows/forms/node-config-form.tsx:851` calls `fetch("/api/tags")`, but **no `/api/tags` route exists**. The flow tag picker silently falls back to typing a raw UUID.                                                                         | Add `GET /api/tags` in Phase 1. It's needed anyway once the browser loses direct DB access.                                                                                                                                                                                                                    |
| C8  | (not in the brief)                                                                             | `node_modules` isn't installed in this checkout, so I couldn't read the bundled Next 16 docs that `AGENTS.md` asks for. **Next 16 may have renamed `middleware.ts` to `proxy.ts`.**                                                                                                        | Phase 1 starts with `npm ci` and a check of the Next docs before touching middleware or `after()`.                                                                                                                                                                                                             |
| C9  | Inbox access stays one-account-per-user.                                                       | One user belongs to **exactly one** account (`profiles.account_id`). Redeeming an invite deletes the user's personal account.                                                                                                                                                              | **Decision D10:** keep this for now, or move to `account_members` (one user in many tenants, e.g. agencies). It's cheap to decide now and expensive to change later.                                                                                                                                           |

---

## 1. Audit: every Supabase dependency

### 1.1 Summary

| Dependency                                               | Count                                                                                                                                                | Where                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase-js` browser client (`@/lib/supabase/client`)   | **48 files** (43 with direct queries; 5 shared libs called from the browser)                                                                         | pages, components, hooks, `lib/storage`                       |
| SSR cookie client (`@/lib/supabase/server`)              | 14 files                                                                                                                                             | `lib/auth/account.ts`, routes, `auth/callback`                |
| Service-role client                                      | 27 files                                                                                                                                             | webhook, engines, public API, cron, AI, quick replies, flows  |
| PostgREST query-builder calls (server + client)          | ~450 in 121 files                                                                                                                                    | everywhere                                                    |
| Supabase Auth calls (browser)                            | 14 call sites (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`×3, `getUser`, `getSession`×9, `onAuthStateChange`, `signOut`×3) | auth pages, settings, `use-auth`                              |
| Supabase Auth calls (server)                             | `getUser`×15, `getSession`×2, `exchangeCodeForSession`, `verifyOtp`                                                                                  | middleware, `lib/auth`, routes, callback                      |
| `auth.uid()` in SQL                                      | 137 in 25 migrations                                                                                                                                 | RLS policies, DEFINER RPCs                                    |
| `auth.users` in SQL                                      | 39                                                                                                                                                   | FKs, signup trigger                                           |
| `storage.*` in SQL                                       | 91 in 7 migrations                                                                                                                                   | bucket rows and policies                                      |
| Supabase roles (`anon`, `authenticated`, `service_role`) | GRANTs in ~20 migrations                                                                                                                             | RPC grants                                                    |
| Realtime publication `supabase_realtime`                 | 5 migrations, 6 tables                                                                                                                               | 001, 009, 010, 024, 027                                       |
| Realtime channels in the client                          | 8 subscriptions in 7 files                                                                                                                           | see §1.4                                                      |
| Storage                                                  | 3 buckets (`avatars`, `chat-media`, `flow-media`), 6 `getPublicUrl` calls                                                                            | composer, flow media, template header, avatar, inbound mirror |

### 1.2 Browser → database calls (all must move behind the server)

| File                                                                                                                             | Tables / RPCs / storage touched                                                                        | Becomes                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `app/(dashboard)/dashboard/page.tsx` (+ `lib/dashboard/overview`, `queries`)                                                     | rpc `dashboard_overview`; `automation_logs`, `broadcasts`, `contacts`, `deals`, `messages`             | `GET /api/dashboard/overview`, `GET /api/dashboard/activity`                               |
| `app/(dashboard)/inbox/page.tsx`                                                                                                 | `conversations`, `profiles`, `whatsapp_config`                                                         | `GET /api/conversations`, `/api/account/members`, `/api/whatsapp/numbers`                  |
| `components/inbox/conversation-list.tsx`                                                                                         | `conversations`, `tags`                                                                                | `GET /api/conversations?filter…`, `GET /api/tags`                                          |
| `components/inbox/message-thread.tsx` (+ `lib/inbox/business-reaction`)                                                          | `conversations`, `messages`, `message_reactions`, `message_templates`, `profiles`; 1 channel           | `GET/PATCH /api/conversations/[id]`, `GET /api/conversations/[id]/messages`, SSE           |
| `components/inbox/contact-sidebar.tsx`                                                                                           | `contact_notes`, `contact_tags`, `deals`                                                               | `/api/contacts/[id]/notes`, `/tags` (exists), `/deals`                                     |
| `components/inbox/template-picker.tsx`                                                                                           | `message_templates`                                                                                    | `GET /api/templates?status=APPROVED`                                                       |
| `app/(dashboard)/contacts/page.tsx`                                                                                              | `contacts`, `contact_tags`, `tags`; rpc `filter_contacts_by_tags`                                      | `GET /api/contacts`, `DELETE /api/contacts` (bulk)                                         |
| `components/contacts/contact-form.tsx` (+ `lib/contacts/dedupe`)                                                                 | `contacts`, `tags`                                                                                     | `POST/PATCH /api/contacts`, `GET /api/contacts/duplicates`                                 |
| `components/contacts/contact-detail-view.tsx`                                                                                    | `contacts`, `contact_tags`, `tags`, `contact_notes`, `custom_fields`, `contact_custom_values`, `deals` | `/api/contacts/[id]` (+ notes, custom-values, deals)                                       |
| `components/contacts/import-modal.tsx` (+ `lib/contacts/resolve-import-tags`)                                                    | `contacts`, `tags`, `contact_tags`                                                                     | `POST /api/contacts/import` (server-side batching)                                         |
| `components/contacts/custom-fields-manager.tsx`                                                                                  | `custom_fields`                                                                                        | `/api/custom-fields`                                                                       |
| `app/(dashboard)/pipelines/page.tsx`                                                                                             | `pipelines`, `pipeline_stages`, `deals`                                                                | `/api/pipelines`, `/api/deals`                                                             |
| `components/pipelines/deal-form.tsx`                                                                                             | `deals`, `contacts`, `conversations`, `profiles`                                                       | `/api/deals`, `/api/contacts/search`                                                       |
| `components/pipelines/pipeline-settings.tsx`                                                                                     | `pipelines`, `pipeline_stages`, `deals`                                                                | `/api/pipelines/[id]/stages` (reorder)                                                     |
| `app/(dashboard)/broadcasts/page.tsx`, `[id]/page.tsx`, `new/page.tsx`                                                           | `broadcasts`, `broadcast_recipients`                                                                   | `/api/broadcasts`, `/api/broadcasts/[id]`, `/recipients`                                   |
| `components/broadcasts/step1…step3` (+ `lib/broadcast-audience`)                                                                 | `message_templates`, `tags`, `custom_fields`, `contacts`, `contact_tags`, `contact_custom_values`      | `GET /api/broadcasts/audience/count`, `/api/templates`, `/api/custom-fields`               |
| `hooks/use-broadcast-sending.ts` (+ `lib/whatsapp/broadcast-delivery-lease`)                                                     | `broadcasts`, `broadcast_recipients`, `contacts`, `contact_custom_values`; lease RPCs                  | **Replaced** by `POST /api/broadcasts` → queued job (Phase 5). Phase 1: thin API wrappers. |
| `app/(dashboard)/automations/page.tsx`, `[id]/logs`                                                                              | `automations`, `automation_logs`                                                                       | `/api/automations` (exists), `GET /api/automations/[id]/logs`                              |
| `components/automations/automation-builder.tsx`                                                                                  | `custom_fields`, `message_templates`, `pipelines`, `pipeline_stages`, `tags`                           | lookup endpoints above                                                                     |
| `app/(dashboard)/notifications/page.tsx`                                                                                         | `notifications`; 1 channel                                                                             | `GET/PATCH /api/notifications`, SSE                                                        |
| `components/settings/settings-overview.tsx`                                                                                      | `custom_fields`, `message_templates`, `tags`, `whatsapp_config`                                        | `GET /api/settings/overview`                                                               |
| `components/settings/tag-manager.tsx`                                                                                            | `tags`                                                                                                 | `/api/tags`                                                                                |
| `components/settings/whatsapp-config.tsx`                                                                                        | `whatsapp_config`                                                                                      | `/api/whatsapp/numbers` (Phase 2); Phase 1: existing `/api/whatsapp/config`                |
| `components/settings/deals-settings.tsx`, `inbox-settings.tsx`                                                                   | `accounts`                                                                                             | `PATCH /api/account` (exists, extend)                                                      |
| `components/settings/profile-form.tsx`                                                                                           | `profiles`; storage `avatars`; `auth.updateUser` (email)                                               | `PATCH /api/me`, `POST /api/me/avatar`, `POST /api/auth/change-email`                      |
| `components/settings/password-form.tsx`                                                                                          | `signInWithPassword` (re-auth), `updateUser`                                                           | `POST /api/auth/change-password`                                                           |
| `components/settings/sessions-card.tsx`                                                                                          | `signOut({scope:'global'})`                                                                            | `POST /api/auth/sessions/revoke-all`                                                       |
| `components/presence/presence-heartbeat.tsx`                                                                                     | rpc `touch_presence`                                                                                   | `POST /api/presence` (or SSE heartbeat)                                                    |
| `hooks/use-auth.tsx`                                                                                                             | `profiles`, `accounts`; `getSession`, `onAuthStateChange`, `signOut`                                   | `GET /api/me` + auth client                                                                |
| `hooks/use-presence.ts`, `use-realtime.ts`, `use-total-unread.ts`, `use-unread-notifications.ts`, `use-browser-notifications.ts` | `member_presence`, `conversations`, `notifications`; 5 channels                                        | one `useEventStream()` SSE hook                                                            |
| `lib/storage/upload-media.ts` (used by composer, flow media node, template manager)                                              | `profiles`, storage `chat-media` / `flow-media`                                                        | `POST /api/uploads` (presigned PUT)                                                        |
| `app/(auth)/*`, `app/join/[token]`                                                                                               | Supabase Auth                                                                                          | new auth (§2.4)                                                                            |
| `components/flows/forms/node-config-form.tsx`                                                                                    | `fetch('/api/tags')` (**missing route**, C7)                                                           | `GET /api/tags`                                                                            |

`getSession()` is called in 9 components only to read the user id or token before an insert. Once inserts move server-side, those calls simply go away.

### 1.3 Server-side Supabase usage

| Kind                             | Files                                                                                                                                        | Migration                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| SSR client + `getUser` (session) | `middleware.ts`, `lib/auth/account.ts`, ~12 routes using raw `getUser`                                                                       | `getSession(req)` from the new auth; `getCurrentAccount()` keeps its signature          |
| Service role                     | `lib/{ai,automations,flows}/admin-client.ts`, `lib/api-keys/store.ts`, `lib/auth/api-context.ts`, webhook, cron, quick replies, flows routes | a `service` DB role (BYPASSRLS) via `db.service()`; `account_id` filters stay mandatory |
| Storage (server)                 | `webhook/route.ts`, `lib/whatsapp/mirror-inbound-media.ts`, `lib/storage/upload-media.ts`                                                    | `lib/storage/s3.ts` (MinIO)                                                             |
| Auth callback                    | `auth/callback` (`exchangeCodeForSession`, `verifyOtp`)                                                                                      | `/auth/verify`, `/auth/reset` token handlers                                            |
| `after()`                        | 4 routes (webhook, `v1/broadcasts`, broadcast resume, …)                                                                                     | webhook keeps `after()`; broadcast fan-out moves to the queue (Phase 5)                 |

### 1.4 Realtime subscriptions

| Subscriber                                              | Table                       | Event use                                               |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| `hooks/use-realtime.ts` (inbox, dashboard)              | `messages`, `conversations` | full row in `payload.new`; **no filter, relies on RLS** |
| `message-thread.tsx` (3 handlers)                       | `message_reactions`         | INSERT/UPDATE/DELETE                                    |
| `use-total-unread.ts`                                   | `conversations`             | unread set                                              |
| `use-browser-notifications.ts`                          | `messages`                  | desktop notifications                                   |
| `use-presence.ts`                                       | `member_presence`           | presence dots                                           |
| `use-unread-notifications.ts`, `notifications/page.tsx` | `notifications`             | badge + list                                            |

The client currently trusts Supabase Realtime to apply RLS to each event. The SSE replacement must filter explicitly by `account_id` for every table, **and** by `user_id` for `notifications` (that table's RLS is own-rows only).

### 1.5 SQL that is Supabase-specific

- `auth.uid()`, `auth.users` FKs, `auth.jwt()` (1 use).
- `storage.buckets` / `storage.objects` / `storage.foldername()` policies (7 migrations). All of these are dropped, and the access rules are re-implemented in the upload/download routes.
- `GRANT … TO anon | authenticated | service_role`. These map to new roles (§2.3).
- `ALTER PUBLICATION supabase_realtime`. Replaced by `NOTIFY` triggers.
- `supabase/config.toml`, the Supabase CLI in `migrations.yml`. Replaced by a plain `pgvector/pgvector:pg17` service and the migration runner.

---

## 2. Target architecture

### 2.1 Containers (one `docker-compose.yml`, deployable by Dokploy)

```
                       Traefik (Dokploy)  ── TLS, domains
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   app  (Next.js standalone, ×N)       minio console (optional, admin-only domain)
     │  UI, /api/*, /api/v1/*, SSE /api/events, Meta webhook
     │  one LISTEN connection per instance
     ├──────────► postgrest (internal only, :3000 on private network)
     ├──────────► db  (postgres 17 + pgvector)   ◄── migrate (one-shot, runs first)
     ├──────────► redis (rate limits, SSE fan-out, caches)
     └──────────► minio (S3: avatars/, chat-media/, flow-media/)
   worker (same image, `node worker.js`)
     └─ pg-boss queues: crons, broadcasts, webhooks-out, billing, rollups, template sync
   backup (cron: pg_dump → minio/S3 bucket or volume, retention)
```

| Service     | Image                            | Notes                                                                                                         |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `app`       | built from the repo `Dockerfile` | non-root, healthcheck `/api/health`, `NEXT_PUBLIC_*` as build args                                            |
| `worker`    | same image                       | `command: node dist/worker.js`; healthcheck writes a heartbeat row                                            |
| `db`        | `pgvector/pgvector:pg17`         | volume, `pg_isready` healthcheck, tuned `shared_buffers`                                                      |
| `postgrest` | `postgrest/postgrest` (pinned)   | _only if D1 = hybrid_; private network, JWT secret, `db-pre-request` hook sets `app.user_id` / read-only mode |
| `redis`     | `redis:7-alpine`                 | AOF on, password                                                                                              |
| `minio`     | `minio/minio` (pinned)           | private bucket, per-account prefixes                                                                          |
| `migrate`   | same image                       | `node dist/migrate.js up`; `app` and `worker` wait on `service_completed_successfully`                        |
| `backup`    | `postgres:17-alpine` + script    | nightly `pg_dump -Fc`, N-day retention, optional upload to S3                                                 |

### 2.2 Request paths

| Caller                             | Auth                                                  | DB access                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser → `/api/*`                 | session cookie (D2)                                   | `withTenant(userId)` (role `wacrm_app`, RLS on) or PostgREST with a short-lived JWT `sub=userId`                                                  |
| Integrations / MCP → `/api/v1/*`   | API key (unchanged)                                   | `db.service()` + explicit `account_id` (unchanged pattern)                                                                                        |
| Meta → `/api/whatsapp/webhook`     | HMAC (platform app secret(s) from settings, then env) | `db.service()`                                                                                                                                    |
| Worker jobs                        | n/a                                                   | `db.service()`; each job carries `account_id`                                                                                                     |
| Admin → `/admin/*`, `/api/admin/*` | session + `is_platform_admin` + (optional) TOTP       | `db.platform()` (BYPASSRLS), every call audited                                                                                                   |
| Impersonation                      | admin session + `impersonation_sessions` row          | `withTenant(targetUserId, { actorAdminId, readOnly })`; read-only uses `SET LOCAL transaction_read_only = on`, which **Postgres itself enforces** |

### 2.3 Tenant isolation in the DB

- **Roles:**
  - `wacrm_owner`: owns the schema; used by migrations.
  - `wacrm_app`: NOBYPASSRLS; used by sessions and PostgREST `authenticated`.
  - `wacrm_service`: BYPASSRLS; used by the webhook, engines, public API and worker.
  - `wacrm_anon`: only the invite peek RPC.
  - `wacrm_platform`: BYPASSRLS; used by the admin panel.
- **`app.uid()`:** `coalesce(nullif(current_setting('app.user_id', true), ''), current_setting('request.jwt.claims', true)::json->>'sub')::uuid`. Every `auth.uid()` in the baseline becomes this.
- **`withTenant(userId, fn, opts)`:**
  1. `BEGIN`
  2. `SET LOCAL ROLE wacrm_app`
  3. `SELECT set_config('app.user_id', $1, true)`
  4. Optionally `set_config('app.actor_admin_id', …)` and `SET LOCAL transaction_read_only = on`
  5. Run `fn(tx)`, then `COMMIT`

  This is safe with transaction-mode pooling.

- **Suspended tenants (billing):** the `is_account_member()` write tiers also check `accounts.status <> 'suspended'`. The DB itself makes a suspended tenant read-only, while inbound webhooks (service role) are still stored.
- **Tests:** a new `test:db` suite runs against a real Postgres (CI service container). It proves that user A can't select, insert, update or delete account B's rows in **every** table, that a viewer can't write, and that an agent can't touch settings tables.

### 2.4 Auth (D2, recommended: **Better Auth**)

Better Auth is a good fit for the requirements:

- Email and password, email verification, password reset.
- DB sessions with revoke-all ("sign out of all devices").
- httpOnly, Secure, SameSite=Lax cookies.
- Rate limiting (backed by Redis).
- A TOTP two-factor plugin (admins).
- An admin/impersonation plugin (audited by us).
- Google login later, through a social provider.
- Its own tables (`users`, `sessions`, `accounts_oauth`, `verifications`), mapped onto our naming.

**Password migration:** Supabase stores **bcrypt** hashes. We verify bcrypt on the first login and rehash with argon2id or scrypt, so migrated users never need a reset.

**Email:** nodemailer over SMTP. Settings are read from platform settings first, then env. Templates are i18n-aware: verify, reset, invite, email change, billing notices.

### 2.5 Realtime

1. **Producer:** an `AFTER INSERT/UPDATE/DELETE` trigger on the 6 tables calls `pg_notify('wacrm_events', json_build_object('t', table, 'op', op, 'id', id, 'a', account_id, 'u', user_id_if_notifications))`. The payload carries only ids, well under the 8 KB NOTIFY limit.
2. **Fan-out:** each `app` instance holds **one** `LISTEN` connection. When an event arrives, it loads the row once with `db.service()`, checks the `account_id`, and pushes it to its connected SSE clients for that account (and, for notifications, only to that user).
   - Redis pub/sub is the fallback if we ever run `LISTEN` only in the worker.
3. **Endpoint:** `GET /api/events` (SSE).
   - Requires a session; resolves the account once at connect time.
   - Sends a heartbeat every 25 s.
   - Supports `Last-Event-ID` with a short Redis replay buffer (about 2 min), so a reconnect doesn't miss events.
   - The client reconnects with exponential backoff, and the "offline" banner is kept.
4. **Client:** a single `EventStreamProvider` plus `useEventStream(table, handler)`. It keeps the current `payload.new` / `payload.old` shape, so the inbox reducers (`optimistic-messages`, `unread-set`, `stage-sync`) stay unchanged.

### 2.6 Storage (MinIO / S3)

- **Bucket:** one private bucket, `wacrm`. Keys keep today's layout:
  - `avatars/<userId>/…`
  - `chat-media/account-<id>/…`
  - `flow-media/account-<id>/…`
  - `chat-media/account-<id>/inbound/…`
- **Upload:**
  1. `POST /api/uploads {kind, filename, mime, size}` checks role, per-kind MIME and size limits, and the account's storage quota.
  2. The server returns a **presigned PUT**.
  3. The client uploads directly to MinIO.
  4. `POST /api/uploads/complete` records the object in a new `media_objects` table (also used for quota accounting).
- **Display in the app:**
  - `GET /api/media/[...key]` checks account membership and returns a 302 redirect to a presigned GET URL (about 5 min).
  - Avatars get a longer-cached URL.
- **Outbound to Meta:**
  - At send time the server generates a **presigned GET** with about a 24 h TTL. The DB stores object keys, not URLs.
  - This covers composer media, flow `send_media` and template header media.
  - The existing `media_url` columns get a companion `media_key` column; old rows keep working.
- **Inbound mirror:** `mirror-inbound-media.ts` writes to S3 instead of the old bucket; the rest of its logic is unchanged.

### 2.7 Data access (D1, recommended: **hybrid**)

| Option                      | What it means                                                                                                                                                                                                                      | Phase 1 effort                                  | Risk                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| **A. Full rewrite**         | Replace all ~450 PostgREST calls with Kysely and `withTenant`                                                                                                                                                                      | very high (121 files plus 25 mocked test files) | high: regressions across every module at once                        |
| **B. Hybrid (recommended)** | Run PostgREST internally. The server keeps `@supabase/postgrest-js` (`db.rest(userId)` mints a 60 s JWT; `db.rest.service()`). New and hot-path code uses Kysely + `withTenant`. Modules are migrated to Kysely opportunistically. | low–medium                                      | low: query semantics stay identical; RLS is still enforced in the DB |

With either option the **browser** loses DB access entirely (§1.2). Option B only changes how the **server** talks to Postgres.

### 2.8 Migrations (D4, recommended: **node-pg-migrate in SQL mode**)

- `db/migrations/0001_baseline.sql` is a squash of 001–059. It:
  - removes `storage.*` and the realtime publication;
  - rewrites `auth.uid()` to `app.uid()` and the `auth.users` FKs to `users`;
  - maps the roles (§2.3);
  - keeps every RPC, trigger, `pgvector` and full-text index.
- **Verification:** run `pg_dump --schema-only` on both the squashed baseline and a database built by replaying 001–059 on plain Postgres with stub `auth`/`storage` schemas, normalise the output, and diff it in CI. Any difference must be deliberate and listed.
- After the baseline, each further change is a numbered SQL file. Runs are tracked in a `pgmigrations` version table. The `migrate` container runs `up`.
- `supabase/ci/verify-schema.sql` is kept and extended. It runs in the new `migrations.yml`, which uses a `pgvector` service container instead of the Supabase CLI.

### 2.9 Optional: data import from an existing Supabase project

A `scripts/import-from-supabase.ts` script will:

1. `pg_dump --data-only` the `public` schema.
2. Copy `auth.users` (id, email, `encrypted_password` as bcrypt, `email_confirmed_at`) into `users`.
3. Copy the storage objects using Supabase's S3-compatible endpoint (or the REST API) into MinIO under the same keys.
4. Rewrite `media_url` columns that point at Supabase public URLs to `media_key`.

It will be documented in `docs/migrate-from-supabase.md`.

---

## 3. New schema (on top of the squashed baseline)

### 3.1 Platform and auth

- `users` (id uuid, email citext unique, email_verified_at, password_hash, `is_platform_admin` bool, `disabled_at`, `totp_secret_enc`, timestamps).
  - The trigger `enforce_platform_admin_column` blocks changes from `wacrm_app` / `wacrm_service`. Only `wacrm_platform` or a migration can grant admin.
- `sessions`, `verification_tokens` (hashed), `oauth_accounts`: the Better Auth tables.
- `platform_settings` (key, `value_enc`, `updated_by`, `updated_at`): Meta App id and secrets, verify token, Graph version, SMTP, payment keys, branding, signup on/off, trial days. Encrypted with versioned keys (§3.6).
- `admin_audit_log` (id, `actor_admin_id`, action, target_type, target_id, account_id, ip, user_agent, `metadata` jsonb, at). Insert-only for every role (no UPDATE/DELETE grants).
- `impersonation_sessions` (id, admin_id, target_user_id, `read_only`, reason, started_at, expires_at, ended_at).
- `announcements` (title, body, level, audience, starts_at, ends_at).
- `accounts` gains: `status` (`active` / `suspended` / `deleted`), `suspended_reason`, `deleted_at` (soft delete), `trial_ends_at`, `plan_id`.

### 3.2 Multiple WhatsApp numbers per account

- **`whatsapp_numbers`:** id, account_id, label, `phone_number_id` (globally UNIQUE), `waba_id`, `access_token_enc`, `verify_token_enc`, display_phone, verified_name, quality_rating, messaging_tier, status, `is_default` (partial unique per account), registered_at, subscribed_apps_at, last_registration_error, `mirror_inbound_media`, `last_webhook_at`, `connection_method` (`manual` / `embedded_signup`).
  - Backfilled from `whatsapp_config`. The old table becomes a read-only view for one release, then is dropped.
- **`conversations.whatsapp_number_id`:** NOT NULL after backfill. The unique key changes from `(account_id, contact_id)` to **`(account_id, contact_id, whatsapp_number_id)`**. `merge_duplicate_conversations`, `resolve-conversation.ts`, the webhook's find-or-create and the v1 resolver all change accordingly.
- **Tables that gain `whatsapp_number_id`:**
  - `messages`: denormalised for filtering.
  - `broadcasts`: the sending number.
  - `message_templates`: becomes `waba_id`-scoped, with the unique key moving to `(account_id, waba_id, name, language)`.
- **Scoping tables:**
  - `automation_numbers` / `flow_numbers`: empty means all numbers.
  - `ai_configs.whatsapp_number_ids uuid[]`: null means all numbers.
  - `quick_replies.whatsapp_number_id`: optional.
- **Code impact:** there are 21 `.single()` / `.maybeSingle()` lookups on `whatsapp_config` across 25 files. Each becomes either `numberForConversation(conv)` or `numberById(accountId, id ?? default)`.

### 3.3 Billing and limits (amounts in minor units)

- `plans` (id, code, name, `price_monthly_minor`, `price_yearly_minor`, currency, `is_public`, `trial_days`, `sort`, `archived_at`), and `plan_prices` for per-gateway price ids.
- `plan_limits` (plan_id, `limit_key`, value bigint, null = unlimited), and `account_limit_overrides` (account_id, limit_key, value, reason, set_by).
- **Limit keys:** `whatsapp_numbers`, `seats`, `contacts`, `broadcast_recipients_month`, `messages_month`, `automations`, `flows`, `ai_replies_month`, `ai_tokens_month`, `api_keys`, `webhook_endpoints`, `storage_mb`.
- `subscriptions` (account_id, plan_id, interval, status `trialing` / `active` / `past_due` / `canceled` / `suspended`, provider, `provider_subscription_id`, `current_period_start` / `end`, `cancel_at_period_end`, `grace_until`).
- `invoices`, `payments`, `coupons`, `coupon_redemptions`, `account_credits`.
- `usage_counters` (account_id, period yyyymm, key, value): atomic `increment_usage()` RPC, with a unique `(account_id, period, key)`.
- `billing_events` (provider, `event_id` UNIQUE for idempotency, type, payload, processed_at, error).

### 3.4 Worker and reliability

- **pg-boss schema (D3):** jobs, schedules and an archive.
- `webhook_deliveries` (endpoint_id, event_id, attempt, status, response_code, next_attempt_at, `dead_lettered_at`) replaces single-attempt delivery.
- `broadcasts.scheduled_at` is already there; the UI and the scheduler job are added.
- `round_robin_cursors` (account_id, scope, `last_user_id`) for real round-robin among online agents.
- `worker_heartbeats` (job, last_run_at, last_status, last_error) for the system-health page.

### 3.5 Compliance

- `data_exports` (account_id, requested_by, status, `object_key`, expires_at). The export is a zip of JSON/CSV per table plus media keys.
- **Account deletion:** a soft delete first, then a worker purge after N days. The purge deletes every row and S3 object for that account, and writes the audit entry.

### 3.6 Secrets and key rotation

- **New encrypted format:** `v2:<kid>:<iv>:<ct>:<tag>`. Keys come from `ENCRYPTION_KEYS=kid1:hex,kid2:hex`, and `ENCRYPTION_KEY_ACTIVE=kid2` selects the one used for new writes.
- **Reading:** `decrypt()` accepts the legacy CBC format, the current `iv:ct:tag`, and v2.
- **Rotation:** a `rotate-secrets` worker job re-encrypts every encrypted column with the active key. Rotation stops orphaning tokens.

---

## 4. Risks

| #   | Risk                                                                                         | Likelihood / impact        | Mitigation                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Squashing 57 migrations silently drops a policy, grant or trigger                            | M / **High** (tenant leak) | Schema-diff CI against a replay of 001–059; RLS isolation test suite over every table; `verify-schema.sql`                                    |
| R2  | Rewriting `auth.uid()` misses a DEFINER function that relied on JWT context                  | M / High                   | grep gate (`auth\.` must be 0 in the baseline); per-RPC tests as `wacrm_app`                                                                  |
| R3  | The SSE fan-out leaks events across tenants                                                  | L / **High**               | Per-event `account_id` check plus a per-user check for notifications; dedicated tests; no client-supplied filters trusted                     |
| R4  | Moving 43 browser files behind APIs regresses inbox UX (optimistic sends, reactions, unread) | M / M                      | Keep the realtime payload shape; keep the pure reducers and their tests; module-by-module PRs                                                 |
| R5  | Changing conversation uniqueness for multiple numbers creates duplicates or breaks merge     | M / High                   | Backfill all rows to the default number before swapping the index; dry-run report; reversible migration                                       |
| R6  | Meta needs public media URLs; presigned URLs expire before Meta fetches                      | L / M                      | 24 h TTL generated at send time; never store presigned URLs                                                                                   |
| R7  | Billing webhooks double-apply or arrive out of order                                         | M / High                   | `billing_events.event_id` UNIQUE; state machine with allowed transitions; reconcile job against the provider API                              |
| R8  | Impersonation abuse or secret exposure                                                       | L / **High**               | Time-boxed sessions, a banner, read-only mode enforced by Postgres, secrets redacted at the serializer layer, audit on start/stop/every write |
| R9  | One webhook URL for all tenants becomes the hot path at scale                                | M / M                      | Webhook only verifies, stores and enqueues (`after()` → job); per-account processing in the worker; Redis rate limits per tenant              |
| R10 | Next 16 API differences (`middleware` vs `proxy`, `after()`)                                 | M / L                      | Read the bundled Next docs first (C8)                                                                                                         |
| R11 | Size of the effort                                                                           | **High** / M               | Strict phase gates; each phase is shippable on its own; D1 hybrid to shrink Phase 1                                                           |
| R12 | Existing tests mock supabase-js (25 files)                                                   | H / L                      | Hybrid keeps postgrest-js, so the mocks keep working; new DB-backed tests are added alongside                                                 |

---

## 5. Decisions (approved)

| ID      | Decision           | Approved, with conditions                                                                                                                                                                                                                                                                              |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D1**  | Server data access | **Hybrid: internal PostgREST + Kysely for new code.** PostgREST is _transitional_: modules move to Kysely + `withTenant` over time. The app's DB roles (`wacrm_app`, `wacrm_service`, PostgREST's authenticator) must **never** be the schema owner or a superuser.                                    |
| **D2**  | Auth               | **Better Auth**, with a **custom password verifier**: verify Supabase **bcrypt** hashes, then **rehash on successful login**. Must be tested against a **real Supabase-generated hash** (taken from local GoTrue), not one we made ourselves.                                                          |
| **D3**  | Queue              | **pg-boss**                                                                                                                                                                                                                                                                                            |
| **D4**  | Migration tool     | **node-pg-migrate (SQL files)**                                                                                                                                                                                                                                                                        |
| **D5**  | Payments           | **Razorpay first.** **Invoice PDFs are generated in-app and must be GST-compliant.** **Still open:** are you GST-registered (yes/no), and do you bill customers outside India (yes/no)? Both are needed before Phase 3 (tax lines, place of supply, export/LUT handling).                              |
| **D6**  | Meta App model     | **One platform Meta App** for all tenants. **The manual token connection stays as a fallback** next to Embedded Signup.                                                                                                                                                                                |
| **D7**  | Media to Meta      | **Prefer Meta media IDs**: upload media to Meta (`POST /{phone-number-id}/media`) and send by `id`, so Meta never needs to fetch from us. Presigned GET URLs (24 h) only as a fallback. **MinIO needs its own public domain** (e.g. `media.example.com`) because browsers use presigned URLs directly. |
| **D8**  | Email transport    | **SMTP via nodemailer**                                                                                                                                                                                                                                                                                |
| **D9**  | Realtime           | **LISTEN/NOTIFY → SSE.** NOTIFY payloads carry **IDs only**. The LISTEN connection is a **direct, non-pooled** connection (PgBouncer transaction mode breaks LISTEN).                                                                                                                                  |
| **D10** | Users and tenants  | Table named **`account_members`** with **`UNIQUE (user_id)`**: still one account per user, but the table can grow into many-to-many later by dropping that constraint.                                                                                                                                 |

---

## 6. Phase checklist

Every phase ends with these gates:

- `npm run typecheck`, `lint`, `test` and `build` pass, and so does the `test:db` suite from Phase 1 on.
- New logic has vitest tests in the existing style.
- Docs and the CHANGELOG are updated.
- I write a summary of the changes, then wait for your go-ahead.

### Phase 1: get off Supabase (same features, many accounts, one number each)

Split into checkpoints. **I stop for your review after each one.** The isolation suite (§7) must stay green at every checkpoint.

- [x] **Pre-1a: baseline.** `npm ci`, read the Next 16 docs (C8: `middleware.ts` is deprecated → `proxy.ts`, Node runtime only), and the cross-tenant isolation suite against current behaviour (§7).
- [ ] **1a: infrastructure + schema**
  - `docker-compose.yml` (`app`, `worker` stub, `db` = pgvector pg17, `postgrest`, `redis`, `minio`, `migrate`, `backup`), `.env.example`, healthchecks, Traefik/Dokploy labels.
  - Squashed baseline migration under node-pg-migrate, with a minimal `auth` schema providing the **`auth.uid()` shim** plus a `users` table, and no `storage.*` or realtime publication.
  - Explicit `GRANT`s for the new roles (F1), and roles that are not the owner and not superusers (D1).
  - Schema-diff check against a replay of 001–059.
  - The isolation suite runs green on the new baseline (adapter `app`, harness `SET LOCAL ROLE`).
- [ ] **1b: auth**
  - Better Auth: signup, login, email verification, reset, change email/password, revoke all sessions, Redis login rate limit, SMTP.
  - Custom bcrypt verify plus rehash, tested with a real GoTrue hash (D2).
  - Signup trigger on `users` → `account_members`.
  - Invitation peek/redeem ported; `middleware.ts` → `proxy.ts`.
- [ ] **1c: server DB access**
  - `withTenant()`, `db.service()`, `db.rest()` (internal PostgREST).
  - `getCurrentAccount()` / `requireApiKey()` keep their signatures.
  - The 27 service-role files are switched over.
  - The isolation suite is also run through `withTenant`.
- [ ] **1d: browser files, in batches** (§1.2)
  - Batch 1: contacts, tags, custom fields (+ `GET /api/tags`, C7).
  - Batch 2: inbox (conversations, messages, reactions, notes, templates).
  - Batch 3: pipelines and deals.
  - Batch 4: broadcasts.
  - Batch 5: automations, dashboard, notifications, settings, profile.

  Each batch: routes, tests, and the remaining count of browser-side DB calls.

- [ ] **1e: realtime**
  - NOTIFY triggers (IDs only, D9), the direct LISTEN connection, `/api/events` SSE with an account/user filter, reconnect plus replay.
  - Covers all six tables (adds `flow_runs`, C4), with SSE tenancy tests.
- [ ] **1f: storage**
  - MinIO with its own public domain (D7), presigned upload, the `/api/media` proxy, `media_key` columns, inbound mirror to S3.
  - Meta media-ID upload for outbound media, with a presigned fallback.
  - Storage tests replace `storage.supabase.test.ts`.
- [ ] **1g: data migration script**
  - `scripts/import-from-supabase.ts`: public data, `auth.users` → `users` with bcrypt hashes kept, storage objects → MinIO, `media_url` → `media_key`. Plus `docs/migrate-from-supabase.md`.
  - Then: remove the Supabase packages and config, update CI, and write `docs/deploy-dokploy.md` and `docs/backup-restore.md`.

### Phase 2: multiple WhatsApp numbers per account

- [ ] `whatsapp_numbers` + backfill; `whatsapp_config` becomes a compatibility view.
- [ ] Conversation uniqueness → `(account, contact, number)`; fix the merge/dedupe RPCs and the resolvers.
- [ ] Webhook routing: `phone_number_id` → number → account; `last_webhook_at`.
- [ ] Send path uses the conversation's number; the 21 single-config lookups refactored.
- [ ] Number scoping for templates (per WABA), broadcasts, automations, flows, AI, quick replies.
- [ ] Inbox: number badge and filter; the composer sends from the thread's number.
- [ ] Settings → WhatsApp: list/add/edit/remove numbers, per-number health and diagnostics, set default; plan-limit hook (it becomes enforcing in Phase 3).
- [ ] `/api/v1` + MCP: optional `from` / `whatsapp_number_id`.
- [ ] Embedded Signup designed and implemented behind `FEATURE_EMBEDDED_SIGNUP`.
- [ ] Tests: multi-number routing, uniqueness, send-from-thread.

### Phase 3: plans, billing, entitlements

- [ ] Billing tables, plan seed, `entitlements` module (`checkLimit`, `recordUsage`, `getUsage`).
- [ ] Enforcement in API routes, engines, broadcasts, AI, public API: 402 with an upgrade hint; `GatedButton` and usage meters in the UI.
- [ ] Payment provider interface + Razorpay adapter + Stripe adapter; signed, idempotent webhooks; dunning/grace period; suspension (DB-enforced read-only, §2.3); trial expiry; invoice emails/PDFs.
- [ ] Settings → Billing (plan, usage, change plan, payment method, invoices, cancel/resume); public pricing page; signup with plan or trial; onboarding adds a "connect first number" step.
- [ ] Tests: entitlements, webhook idempotency/order, state machine.

### Phase 4: Super Admin

- [ ] `/admin` route group + layout + guard (`is_platform_admin` + optional TOTP), CSRF, rate limits, `admin_audit_log`.
- [ ] Platform settings UI (encrypted, falls back to env).
- [ ] Tenants (search/filter, detail, edit, suspend, soft delete, plan change, trial extension, credits/discounts, members/roles, force password reset); Users (verify, disable, merge, memberships).
- [ ] WhatsApp oversight (every number, quality/tier/status, last webhook, error-code overview, force re-sync/re-subscribe).
- [ ] Impersonation (time-limited, banner, read-only mode, audited, secrets redacted).
- [ ] Reports (signups, DAU/WAU/MAU, MRR/ARR, churn, trial→paid, revenue by plan, message volume, per-tenant usage, AI tokens, failed payments, broadcasts, number health) with date filters and CSV export; system health page.
- [ ] Plans/coupons/invoices/announcements management.
- [ ] Tests: admin guard, impersonation guardrails, audit completeness.

### Phase 5: worker, queues, reliability

- [ ] pg-boss worker: automation waits, flow timeout sweep (both replace the external crons), billing jobs, usage rollups, broadcast delivery/resume, **scheduled broadcasts + UI**, outbound webhooks with retries, exponential backoff and a dead-letter queue, template status sync, report aggregation.
- [ ] Implement the `time_based` and `conversation_assigned` automation triggers.
- [ ] Redis rate limiter (same `RATE_LIMITS` API); per-tenant abuse limits.
- [ ] `/api/v1/broadcasts` fan-out becomes a job (no more 60 s cutoff).
- [ ] Real round-robin among online agents.
- [ ] Quirks: page titles for `/flows` and `/agents`, the "Settings → AI Assistant" hint, delete message (soft delete, local only; WhatsApp can't unsend for the customer), `collect_input.validation`, per-app `META_APP_ID` from platform settings.
- [ ] CSP: collect reports via `/api/csp-report`, then enforce.

### Phase 6: hardening, tests, docs

- [ ] Versioned encryption keys + rotation job; GDPR export/delete.
- [ ] Container hardening (non-root everywhere, read-only root filesystem where possible, pinned images, `npm audit` + Trivy in CI).
- [ ] Seed script (platform admin, demo plans, demo tenant); e2e smoke test (Playwright): signup → connect number (mock Meta) → inbound webhook → reply → upgrade plan.
- [ ] Docs: architecture, admin guide, billing setup, Meta app setup for SaaS, Dokploy deploy, backup/restore, Supabase import; README + CHANGELOG.

---

## 7. Baseline isolation suite (pre-1a)

`tests/db/` is described in [its README](../tests/db/README.md). It runs with `npm run test:db:prepare && npm run test:db` and in CI as the new `isolation` job in `migrations.yml`.

**Result on current code (migrations 001–059, classic Supabase privileges): 560 passed, 2 skipped, 0 failed.**
The 2 skips are the re-parent probes for `accounts` and `notifications`, which have no tenant column to move.

| Suite                      | Checks                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rls-isolation.test.ts`    | 37 tables × {cross-tenant SELECT/UPDATE/DELETE/INSERT, WHERE-less blind UPDATE/DELETE, re-parent into B, own-account tier for SELECT/UPDATE/DELETE/INSERT, anon read/insert, service-role bypass}, plus coverage and mutation self-tests |
| `privilege-guards.test.ts` | identity-column guards, column grants, assignee trigger, member RPCs across tenants and as anon, scoped data RPCs, DEFINER allowlists (30 tests)                                                                                         |
| `storage.supabase.test.ts` | chat-media / flow-media / avatars read and write isolation (baseline only)                                                                                                                                                               |

**Mutation self-tests.** The suite plants leaky policies inside the rolled-back transaction and asserts the probes catch each one: a read leak, an UPDATE leak hidden behind a strict SELECT policy, a DELETE leak, and a viewer writing settings. Writing these exposed that a plain `UPDATE … WHERE id = …` probe **cannot** see an UPDATE-policy leak, because Postgres applies SELECT policies to any UPDATE or DELETE that reads columns. Hence the WHERE-less blind probes.

### Findings from the baseline work

| #      | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Severity                | Action                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | **The migrations never GRANT table or function privileges.** They rely on Supabase's classic default ACLs. On the Postgres image the pinned CLI pulls (`supabase/postgres:17.6.1.158`), those defaults are gone: `anon`, `authenticated` and `service_role` get only REFERENCES/TRIGGER/TRUNCATE on every table, and functions without an explicit GRANT (e.g. `touch_presence`) aren't executable. **A fresh database built from these migrations would answer every app query with "permission denied".** The existing CI migrations job can't notice, because it only checks the schema. Hosted projects with the classic defaults still work. | High (for new installs) | The 1a baseline grants explicitly per role. Until then the suite rebuilds on classic privileges (`prepare-classic-supabase.sh`). If you create a new Supabase project before Phase 1 ships, check its table grants first. |
| F2     | Viewers (any member) can SELECT the **encrypted** secret columns: `whatsapp_config.access_token` / `verify_token`, `ai_configs.api_key` / `embeddings_api_key`, `webhook_endpoints.secret`. This is ciphertext only (AES-GCM, key server-side), so it's not directly exploitable, but it's needless exposure.                                                                                                                                                                                                                                                                                                                                     | Low                     | 1d: these reads move behind API routes that never return secret columns. 1a: revoke column SELECT on them from `wacrm_app`.                                                                                               |
| F3     | `anon` can EXECUTE five SECURITY DEFINER membership RPCs (`set_member_role`, `remove_account_member`, `transfer_account_ownership`, `redeem_invitation`, `touch_presence`). Each one refuses without a user (tested), so they're safe today, but that depends on each function's internal check.                                                                                                                                                                                                                                                                                                                                                  | Low                     | 1a: grant them to `wacrm_app` only. The allowlist test pins the current set.                                                                                                                                              |
| F4     | `flow-media` keeps a legacy `<user_id>/…` path in its read and write policies, so files under a user's own folder stay accessible to that user after they leave the account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Low                     | 1f: drop the legacy prefix when moving to S3 (rewrite keys in the 1g import).                                                                                                                                             |
| F5     | On Windows, running vitest from a lower-case drive path (`d:\`) loads vitest twice, and DB test files fail with "failed to find the runner".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Tooling                 | `tests/db/run.mjs` relaunches from the canonical path.                                                                                                                                                                    |

**Still needed from you before Phase 3 (D5):** whether you're GST-registered, and whether you bill customers outside India.
