<p align="center">
  <img src="./public/brand/logo.svg" alt="Automate Panu AI" width="420">
</p>

<p align="center">
  Multi-tenant WhatsApp CRM on the official WhatsApp Business (Cloud) API.<br>
  Shared team inbox · contacts · sales pipelines · broadcasts · automations · chatbot flows · AI reply assistant
</p>

---

- **App:** <https://chat.axxeler.in>
- **Website:** <https://automatepanuai.axxeler.in> (marketing site in progress)

## Features

- **Shared inbox** for a whole team on one WhatsApp number: assignment, status, notes, reactions, voice notes, media, quick replies and templates.
- **Contacts**, tags, custom fields, CSV import, deduplication.
- **Sales pipelines** (kanban) with deals linked to conversations.
- **Broadcasts** with Meta-approved templates, per-recipient personalisation, and delivery/read tracking.
- **No-code automations** and a **visual chatbot flow builder**.
- **AI reply assistant**: bring your own OpenAI, Anthropic or OpenAI-compatible key. One-click drafts, an optional auto-reply bot with human handoff, and a knowledge base.
- **Teams and roles** (owner / admin / agent / viewer), with tenant isolation enforced by Postgres row-level security.
- **Public REST API** (`/api/v1`), outbound webhooks and an **MCP server** for AI assistants.

## Stack

Everything runs in one Docker Compose project, with no external services
besides SMTP and Meta: Next.js app, PostgreSQL 17 + pgvector, a private
PostgREST, Redis, MinIO, a scheduler and nightly backups. Sign-in is
native (Better Auth). The migration off Supabase and its checkpoint
reports are in [docs/saas-migration-plan.md](./docs/saas-migration-plan.md).

## Quick start (Docker, local)

```bash
node scripts/generate-secrets.mjs --file .env   # fresh secrets from .env.example
# edit .env: SMTP_* (or Mailpit, see docs/docker.md) and META_APP_SECRET
docker compose up -d --build
```

## Development (without Docker for the app)

```bash
npm install
npm run dev                                     # http://localhost:3000
```

The dev server needs a database, PostgREST and SMTP. See
[docs/docker.md](./docs/docker.md#local-development). The UI language is
set by `NEXT_PUBLIC_APP_LOCALE` (`en`, `ko`, `pt`, `es`).

## Deploy (Dokploy)

Step by step, from an empty VPS to a running app, including DNS, the
Meta webhook, backups, restore drill, upgrades and rollback:
**[docs/deploy-dokploy.md](./docs/deploy-dokploy.md)**.

## Commands

| Command                                           | What it does                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                                     | Dev server                                                                        |
| `npm run lint` / `npm run typecheck` / `npm test` | Checks (CI runs all of them plus `build`)                                         |
| `npm run db:migrate`                              | Bootstrap and migrate the self-hosted database (`db/migrations`)                  |
| `npm run db:baseline`                             | Regenerate the squashed baseline from `supabase/migrations`                       |
| `npm run test:db`                                 | Tenant-isolation suite against a real Postgres ([tests/db](./tests/db/README.md)) |

On Windows, run commands from the canonical path (`D:\…`, not `d:\…`).
A lower-case drive letter makes vitest load twice.

More docs: [public API](./docs/public-api.md) · [MCP server](./docs/mcp.md) ·
[multiple WABAs](./docs/multi-waba.md) · [auth emails](./docs/auth-emails.md) ·
[WhatsApp connection troubleshooting](./docs/whatsapp-connection-troubleshooting.md)

## Editing the marketing site

The public site lives in `src/app/(marketing)/` and is served on
`automatepanuai.axxeler.in`; the app is served on `chat.axxeler.in`.
Both come from the same deployment, and `src/proxy.ts` routes by host
([src/lib/marketing/host-routing.ts](./src/lib/marketing/host-routing.ts)).
`/api/*` (including the Meta webhook and `/api/v1`) is never redirected.

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

Two env vars turn on the domain split (both are in `.env.example`):
`NEXT_PUBLIC_MARKETING_URL` and `NEXT_PUBLIC_APP_URL`. Without them,
everything is served from one host (marketing at `/`, app at `/dashboard`).

## Brand assets

Logo files live in [`public/brand/`](./public/brand): `logo.svg` (light
backgrounds), `logo-white.svg` (dark backgrounds), `logo-mark.svg` (icon),
plus PNG exports. The lettering is outlined, so the files don't depend on
an installed font.

## License

MIT. Based on [wacrm](https://github.com/ArnasDon/wacrm) by Arnas
Donauskas. See [LICENSE](./LICENSE).
