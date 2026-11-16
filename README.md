<p align="center">
  <img src="./public/brand/logo.png" alt="Automate Panu AI" width="420">
</p>

<p align="center">
  Multi-tenant WhatsApp CRM on the official WhatsApp Business (Cloud) API.<br>
  Shared team inbox · contacts · sales pipelines · broadcasts · automations · chatbot flows · AI reply assistant
</p>

---

- **App and website:** <https://chat.axxeler.in> (website at `/`, the CRM after sign-in)
- **Admin panel:** <https://chat.axxeler.in/admin> (platform admins only)

## Features

- **Shared inbox** for a whole team on one WhatsApp number: assignment, status, notes, reactions, voice notes, media, quick replies and templates.
- **Contacts**, tags, custom fields, CSV import, deduplication.
- **Sales pipelines** (kanban) with deals linked to conversations.
- **Broadcasts** with Meta-approved templates, per-recipient personalisation, and delivery/read tracking.
- **No-code automations** and a **visual chatbot flow builder**.
- **AI reply assistant**: bring your own OpenAI, Anthropic or OpenAI-compatible key. One-click drafts, an optional auto-reply bot with human handoff, and a knowledge base.
- **Teams and roles** (owner / admin / agent / viewer), with tenant isolation enforced by Postgres row-level security.
- **Public REST API** (`/api/v1`) and outbound webhooks.

## Stack

Everything runs in one Docker Compose project, with no external services
besides SMTP and Meta: Next.js app, PostgreSQL 17 + pgvector, a private
PostgREST, Redis, MinIO, a scheduler and nightly backups. Sign-in is
native (Better Auth). The migration off Supabase and its checkpoint
reports are in [docs/saas-migration-plan.md](./docs/saas-migration-plan.md).

## Local development

```bash
# .env.local: the "LOCAL DEVELOPMENT" block at the bottom of .env.example
docker compose up -d        # Postgres, PostgREST, Redis, MinIO, Mailpit (docker-compose.yml)
npm install
npm run dev                 # http://localhost:3000 · emails: http://localhost:8025
```

Details: [docs/docker.md](./docs/docker.md). The UI language is set by
`NEXT_PUBLIC_APP_LOCALE` (`en`, `ko`, `pt`, `es`).

## Deploy (Dokploy)

Production uses **`docker-compose.prod.yml`**.

Step by step, from an empty VPS to a running app, including DNS, the
Meta webhook, backups, restore drill, upgrades and rollback:
**[docs/deploy-dokploy.md](./docs/deploy-dokploy.md)**.

## Commands

| Command                                           | What it does                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                                     | Dev server                                                                |
| `npm run lint` / `npm run typecheck` / `npm test` | Checks (CI runs all of them plus `build`)                                 |
| `npm run db:migrate`                              | Bootstrap and migrate the self-hosted database (`db/migrations`)          |
| `npm run test:db`                                 | Database suite against a real Postgres ([tests/db](./tests/db/README.md)) |

On Windows, run commands from the canonical path (`D:\…`, not `d:\…`).
A lower-case drive letter makes vitest load twice.

More docs: [public API](./docs/public-api.md) ·
[multiple WABAs](./docs/multi-waba.md) · [auth emails](./docs/auth-emails.md) ·
[WhatsApp connection troubleshooting](./docs/whatsapp-connection-troubleshooting.md)

## Editing the marketing site

The public site lives in `src/app/(marketing)/` and is served at `/` on
`chat.axxeler.in`, the same domain as the CRM (`/login`, `/dashboard`, …).

| What                                                          | Where                                   |
| ------------------------------------------------------------- | --------------------------------------- |
| Brand name, tagline, domains, contact, social links           | `src/config/brand.ts`                   |
| All page copy (English; mirrored in es/ko/pt for translation) | `messages/*.json` → `Marketing`         |
| Plans and prices (placeholders, "coming soon")                | `src/content/marketing/plans.config.ts` |
| "What's new" entries                                          | `src/content/marketing/changelog.ts`    |
| Customer logo strip (placeholders)                            | `src/content/marketing/logos.ts`        |
| Free tools list (nav, footer, quick links)                    | `src/content/marketing/tools.ts`        |
| Navigation and footer links                                   | `src/content/marketing/nav.ts`          |
| Design tokens (white + light purple)                          | `src/app/globals.css` → `.mk` block     |
| Components and product mocks                                  | `src/components/marketing/`             |

A separate website domain is optional: setting `NEXT_PUBLIC_MARKETING_URL`
(next to `NEXT_PUBLIC_APP_URL`) turns on host-based routing
([src/lib/marketing/host-routing.ts](./src/lib/marketing/host-routing.ts));
`/api/*` is never redirected.

## Brand assets

Logo files live in [`public/brand/`](./public/brand): `logo.png` (light
backgrounds), `logo-white.png` (dark backgrounds) and `logo-mark-512.png`
(the icon alone; also fits a WhatsApp profile photo). The favicon and
apple icon are `src/app/icon.png` and `src/app/apple-icon.png`. In code, use
`<BrandLogo />` from `src/components/brand-logo.tsx`; it switches to the
white version in dark mode. The UI font is Poppins (self-hosted by
`next/font`).

## License

MIT. Based on [wacrm](https://github.com/ArnasDon/wacrm) by Arnas
Donauskas. See [LICENSE](./LICENSE).
