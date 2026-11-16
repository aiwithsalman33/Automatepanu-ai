# wacrm: Full Project Analysis

> A self-hostable **CRM for WhatsApp**, built on the official WhatsApp Business (Meta Cloud) API.
> It has a shared team inbox, contacts, sales pipelines, template broadcasts, no-code automations, a visual chatbot flow builder, an AI reply assistant (you bring your own key), a public REST API and an MCP server.

|         |                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Package | `wacrm` **v0.8.0** (changelog runs to 0.8.1), MIT licence                                                           |
| Runtime | Node **≥ 22.12**, npm 10                                                                                            |
| Size    | ~360 source files + 158 test files under `src/` (~95k lines of TS/TSX), 57 SQL migrations (~7.3k lines)             |
| Shape   | One Next.js app (UI + API + webhook) + Supabase (Postgres/Auth/Storage/Realtime) + a separate `mcp-server/` package |

---

## Table of contents

1. [Tech stack](#1-tech-stack)
2. [Repository structure](#2-repository-structure)
3. [High-level architecture](#3-high-level-architecture)
4. [Features by module](#4-features-by-module)
5. [Backend engines in depth](#5-backend-engines-in-depth)
6. [Database schema](#6-database-schema)
7. [Auth, roles and multi-tenancy](#7-auth-roles-and-multi-tenancy)
8. [API reference (internal routes)](#8-api-reference-internal-routes)
9. [Public REST API `/api/v1` and outbound webhooks](#9-public-rest-api-apiv1-and-outbound-webhooks)
10. [MCP server](#10-mcp-server)
11. [Security model](#11-security-model)
12. [Limits and constants](#12-limits-and-constants)
13. [Configuration (environment variables)](#13-configuration-environment-variables)
14. [Build, test, CI and deployment](#14-build-test-ci-and-deployment)
15. [Known gaps and quirks](#15-known-gaps-and-quirks)

---

## 1. Tech stack

| Layer         | Technology                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Framework     | **Next.js 16.3.8** (App Router, `output: 'standalone'`), **React 19.2.4**, **TypeScript 6**          |
| Styling       | **Tailwind CSS v4** (`@tailwindcss/postcss`), `tw-animate-css`, CSS-variable theme tokens            |
| UI kit        | **shadcn** (style `base-nova`) on **`@base-ui/react`** primitives (not Radix), `lucide-react` icons  |
| Data / Auth   | **Supabase**: Postgres 17, Auth, Storage, Realtime, RLS (`@supabase/ssr`, `@supabase/supabase-js`)   |
| Messaging     | **Meta WhatsApp Cloud API** (Graph API `v21.0`)                                                      |
| Flow canvas   | `@xyflow/react` 12 + `@dagrejs/dagre` (auto-layout)                                                  |
| Kanban        | `@dnd-kit/core`, `@dnd-kit/sortable`                                                                 |
| Charts        | `recharts` 3 + a vendored Tremor `BarChart`                                                          |
| Voice notes   | `opus-recorder` (in-browser Ogg/Opus encoding; worker in `public/opus/`)                             |
| Misc UI       | `sonner` (toasts), `linkify-react`, `date-fns`, `class-variance-authority`, `clsx`, `tailwind-merge` |
| i18n          | `next-intl` 4. Locales: **en, es, ko, pt**                                                           |
| AI            | REST calls to OpenAI, Anthropic, or any OpenAI-compatible endpoint (no SDKs)                         |
| Vector search | **pgvector** (`vector(1536)`, HNSW) + Postgres full-text search                                      |
| Tests         | **vitest 5** (node environment)                                                                      |
| Lint / format | ESLint 9 (`eslint-config-next`), Prettier 3 + the Tailwind plugin                                    |

---

## 2. Repository structure

```
wacrm/
├── src/
│   ├── app/
│   │   ├── (auth)/                 login, signup, forgot-password, reset-password
│   │   ├── (dashboard)/            authenticated app shell + all product pages
│   │   │   ├── dashboard/          overview / KPIs
│   │   │   ├── inbox/              shared WhatsApp inbox
│   │   │   ├── contacts/           contacts table
│   │   │   ├── pipelines/          kanban deals
│   │   │   ├── broadcasts/         list, new (4-step wizard), [id] detail
│   │   │   ├── automations/        list, new, [id]/edit, [id]/logs
│   │   │   ├── flows/              list, [id] editor, [id]/runs
│   │   │   ├── agents/             AI playground / setup / usage
│   │   │   ├── notifications/      assignment notifications
│   │   │   ├── settings/           settings rail (?tab=)
│   │   │   ├── dashboard-shell.tsx auth gate, sidebar, header, presence, notifications
│   │   │   └── layout.tsx
│   │   ├── join/[token]/           team invitation landing page
│   │   ├── auth/callback/          Supabase email-link handler (PKCE / OTP)
│   │   ├── api/                    57 route handlers (see §8, §9)
│   │   ├── layout.tsx, page.tsx (→ /dashboard), icon.tsx, globals.css
│   ├── components/
│   │   ├── ui/                     shadcn/base-ui primitives (+ gated-button)
│   │   ├── layout/                 sidebar, header, mode-toggle, account-access-alert
│   │   ├── dashboard/              KPI tiles, attention row, cards, setup checklist…
│   │   ├── inbox/                  list, thread, bubble, composer, media, reactions…
│   │   ├── contacts/               form, detail view, import modal, custom fields
│   │   ├── pipelines/              board, deal card/form, analytics, settings
│   │   ├── broadcasts/             step1–step4 wizard steps
│   │   ├── automations/            automation-builder (form-based, ~1.7k lines)
│   │   ├── flows/                  canvas, list builder, editor state, validation panel
│   │   ├── interactive/            buttons/list message builder + WhatsApp preview
│   │   ├── agents/                 AI playground, AI usage
│   │   ├── settings/               every settings panel
│   │   ├── notifications/, presence/, auth/require-role.tsx, tremor/
│   ├── hooks/                      use-auth, use-can, use-realtime, use-presence,
│   │                               use-theme, use-broadcast-sending, use-total-unread,
│   │                               use-unread-notifications, use-browser-notifications,
│   │                               use-media-blob-url
│   ├── lib/
│   │   ├── whatsapp/               Meta API client, send core, templates, broadcasts,
│   │   │                           status sync, webhook helpers, encryption, identity
│   │   ├── automations/            engine, validation, templates, tree helpers
│   │   ├── flows/                  engine, edges, fallback, timeout, layout, templates
│   │   ├── ai/                     providers, config, generate, auto-reply, knowledge
│   │   ├── api/v1/, api-keys/      public API helpers, key hashing, scopes
│   │   ├── webhooks/               outbound webhook events, signing, SSRF guard, delivery
│   │   ├── auth/, account/         account context, roles, invitations, callback
│   │   ├── contacts/, inbox/, conversations/, dashboard/, pipelines/, media/,
│   │   │   notifications/, storage/, settings/, quick-replies/, supabase/, i18n/
│   │   ├── broadcast-*.ts, rate-limit.ts, currency.ts, presence.ts, themes.ts, utils.ts
│   ├── i18n/request.ts             locale resolution (build-time env)
│   ├── middleware.ts               session refresh + route protection
│   └── types/index.ts              domain types
├── supabase/
│   ├── migrations/001…059          schema (050 and 056 intentionally absent)
│   ├── ci/verify-schema.sql        post-migration assertions
│   └── config.toml
├── mcp-server/                     standalone `wacrm-mcp` npm package (stdio MCP)
├── messages/{en,es,ko,pt}.json     UI string catalogues
├── docs/                           public-api, mcp, multi-waba, docker, auth-emails,
│                                   whatsapp-connection-troubleshooting
├── public/                         static assets, opus encoder worker
├── .github/                        CI + migrations workflows, issue templates, SECURITY.md
├── Dockerfile, docker-compose.yml, next.config.ts, vitest.config.ts, components.json
└── README.md, CHANGELOG.md, CONTRIBUTING.md, AGENTS.md, CLAUDE.md, LICENSE
```

---

## 3. High-level architecture

```
          ┌────────────────────── Browser (React 19 client) ──────────────────────┐
          │  Pages + components ── Supabase JS (anon key, RLS) ── Realtime channels│
          │  fetch → /api/* (cookie session)                                       │
          └───────────────┬────────────────────────────────────────┬──────────────┘
                          │                                        │
                ┌─────────▼─────────────── Next.js server ─────────▼────────────┐
                │ middleware.ts (session refresh, redirects)                    │
                │ /api/* route handlers                                         │
                │   ├─ session routes  → getCurrentAccount / requireRole (RLS)  │
                │   ├─ /api/v1/*       → requireApiKey (service role + acct id) │
                │   ├─ /api/whatsapp/webhook → Meta HMAC → after(processWebhook)│
                │   └─ /api/*/cron     → x-cron-secret                          │
                │ lib/: whatsapp · automations · flows · ai · webhooks          │
                └──────┬──────────────────────┬──────────────────────┬──────────┘
                       │                      │                      │
             ┌─────────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────────┐
             │ Supabase         │   │ Meta Graph API   │   │ AI providers /       │
             │ Postgres+RLS     │   │ v21.0 (send,     │   │ customer webhook     │
             │ Auth, Storage,   │   │ templates, media,│   │ endpoints (SSRF-     │
             │ Realtime, pgvec  │   │ register, health)│   │ guarded)             │
             └──────────────────┘   └──────────────────┘   └──────────────────────┘

   External: Meta → POST /api/whatsapp/webhook  ·  Scheduler → GET /api/{automations,flows}/cron
             Integrations / MCP server → /api/v1 with Bearer wacrm_live_… key
```

**Key design principles**

- **Account-scoped multi-tenancy.** Every row carries `account_id`. RLS uses `is_account_member(account_id, min_role)`.
- **Two data paths.** User requests use an RLS-scoped Supabase client. The webhook, engines and public API use a **service-role** client and always filter by `account_id` explicitly.
- **Webhook acks fast.** It verifies the signature, returns 200 straight away, and does the real work inside Next's `after()`.
- **Idempotency in the DB.** Unique indexes on `(conversation_id, message_id)` and `(account_id, contact_id)`, atomic RPCs, and forward-only status ladders absorb Meta's retries and races.
- **Dispatch order for an inbound message:** **Flows → automations waiting for a reply → automation triggers → AI auto-reply → outbound webhooks.** A step that _consumes_ the message stops content triggers and AI for it.

---

## 4. Features by module

### 4.1 App shell and navigation

- **Sidebar**, in order:
  - Dashboard
  - Inbox (unread dot)
  - Notifications (count badge, "9+")
  - Contacts
  - Pipelines
  - Broadcasts
  - Automations
  - Flows (_Beta_ chip)
  - AI Agents
  - Settings
- **Sidebar footer:** account-name strip with a role chip (Owner/Admin/Agent/Viewer) and a user menu (Profile, Settings, Sign out). On mobile it becomes a drawer with scroll lock and Esc to close.
- **Header:** page title, light/dark toggle, avatar menu.
- **Shell:** `AuthProvider` gate. Also mounts the presence heartbeat and the browser-notification listener, and shows an `AccountAccessAlert` when the account or role can't be resolved (the app then goes read-only).
- **Theming:**
  - Modes: light and dark (default dark).
  - Five accents: violet (default), emerald, cobalt, amber, rose.
  - Saved in localStorage (`wacrm.theme`, `wacrm.mode`) and applied by a pre-paint boot script, so there is no flash on load.
- **i18n:** the locale is fixed at build time via `NEXT_PUBLIC_APP_LOCALE` (en/es/ko/pt). Tests check that all catalogues have the same keys and are ICU-safe.

### 4.2 Authentication pages

- **`/login`:** email and password. Carries `?invite=` through. Shows auth-link errors.
- **`/signup`:** name, email and password, followed by a "check your email" screen. The email link goes to `/auth/callback`.
- **`/forgot-password` and `/reset-password`:** the Supabase recovery flow.
- **`/join/[token]`:** peeks at the invite (account name and role), then shows sign-up/sign-in links or an **Accept** button. A 409 conflict offers "Sign out and use a different email".

### 4.3 Dashboard (`/dashboard`)

- **Data source:** a single RPC, `dashboard_overview(days, tz)`. Ranges: Today, 7, 30 or 90 days. It refreshes every 60 s and on realtime changes (debounced).
- **Header:**
  - Greeting.
  - "N customers waiting" line.
  - Range picker.
  - "New" menu (contact, deal, broadcast, automation).
  - **WhatsApp health chip:** quality rating and daily messaging limit.
- **Setup checklist** (shown until done):
  1. Connect WhatsApp.
  2. Add contacts.
  3. Get a template approved.
  4. Invite a teammate.
- **Attention row:**
  - Waiting for a reply (oldest wait, count over target).
  - Unassigned conversations (with teammates online).
  - Reply windows closing within 2 h.
  - Failed messages in the last 24 h (dialog with Meta error codes).
- **KPI tiles** (each with a sparkline and comparison to the previous period):
  - New conversations.
  - Median first reply (human only).
  - Resolved.
  - Deals won (count and value).
  - Broadcast read rate.
- **Cards:**
  - Message volume (by day or by hour, peak detection).
  - Reply queue.
  - Pipeline (by stage, win rate, average days to win, idle deals).
  - Team (presence, open conversations, median reply, AI row).
  - Campaigns (last broadcast funnel, automation success %, failing flows, AI replies, template approvals).
  - Activity feed.

### 4.4 Shared inbox (`/inbox`)

- **Layout:** three panes (conversation list, thread, contact sidebar). Realtime updates, with an offline banner when the connection drops. Deep links: `?c=<id>` and `?filter=`.
- **Filters:** All, Unread, Waiting for reply, Unassigned, Reply window closing, Open, Pending, Closed. Plus a tag multi-filter, a company filter, and search.
- **Thread:**
  - Status (Open/Pending/Closed).
  - **Assign/unassign** (presence dots on the teammate list).
  - **24-hour session countdown**.
  - Date separators and "load older" paging.
  - Delivery ticks (sending ✓ ✓✓ read failed) and failure reasons.
- **Message types rendered:** text (links auto-detected), image, video, audio, document, location, template, interactive, button replies. An **AI badge** marks auto-reply bot messages.
- **Actions:** **Reply/quote**, **emoji reactions** (quick bar), copy text. Long-press on touch devices.
- **Media lightbox:** browse all media in the thread, zoom, download, and a "no longer available" state.
- **Composer:**
  - Enter to send, Shift+Enter for a new line.
  - Attach photo, video or document with a caption.
  - **Voice notes** (Ogg/Opus, max 5 min / 16 MB).
  - **AI draft** ✨.
  - **Quick replies** (text or interactive), plus "save as quick reply".
  - **Interactive builder** (buttons or list).
  - **Template picker** with variable fill-in and live preview.
  - Template-only once the 24 h window has expired; read-only for viewers.
  - Optimistic sends, reconciled when realtime confirms them.
- **Contact sidebar:** details, tags, deals, internal **notes**.
- **AI thread banner:** "AI is replying" with **Take over**, or a paused state showing the handoff summary with **Resume AI**.

### 4.5 Contacts (`/contacts`)

- **Table:** 25 rows per page. Search by name, phone or email; filter by tag. Bulk select and delete.
- **Contact form:**
  - The phone must be E.164 with a leading `+`.
  - Tags can be created inline.
  - **Dedupe:** an exact duplicate number is blocked; a similar one gets a warning and a "View existing" link.
- **Detail panel tabs:** Details, Activity, Notes, Custom fields, Deals, Tags. Actions: Edit, Message, Send template, Delete.
- **CSV import:**
  - Columns: `phone` (required), `name`, `email`, `company`, `tags`.
  - Preview before importing; rows are inserted in batches of 50.
  - Report covers: imported, duplicates, invalid, and failed rows with reasons.
- **Custom fields manager:** add, rename and delete custom fields.

### 4.6 Sales pipelines (`/pipelines`)

- Multiple pipelines. A new one is seeded with New Lead → Qualified → Proposal Sent → Negotiation → Won.
- **Analytics strip:** total deals, pipeline value, average deal size, weighted value, won/lost this month.
- **Kanban board:** dnd-kit with pointer and keyboard drag.
- **Deal form:**
  - Fields: title, contact, linked conversation, value, currency, expected close date, stage, assignee, notes.
  - Actions: Won / Lost / Reopen / Delete.
- **Pipeline settings:** rename, add stages, drag to reorder, stage colours, delete a stage (blocked while it has deals), delete a pipeline.
- **Currency:** a per-account default, chosen from 15 ISO currencies.

### 4.7 Broadcasts (`/broadcasts`)

- **Four-step wizard:**
  1. **Template:** choose an approved template.
  2. **Audience:** all contacts, by tags (with exclusions), a custom-field rule (`is` / `is_not` / `contains`), or a **CSV upload** (unknown numbers become contacts). Shows a live count.
  3. **Personalize:** map each `{{n}}` to a static value, a contact field or a custom field. Header media URL. Live preview.
  4. **Review & Send:** save as draft, or send behind a confirm dialog with a progress bar.
- **Sending:**
  - Runs from the browser: batches of 10 with a 1 s pause, and a **delivery lease** so two tabs can't double-send.
  - It can also be **resumed on the server** (`/resume`) after the tab closes.
  - A batch is retried only on HTTP 429.
- **Detail page:**
  - Tiles: total, sent, delivered, read, replied, failed.
  - Funnel.
  - Recipients table with a status filter and **CSV export**.
  - **Resume sending**, **Retry failed**, Delete.
- **Replies:** a reply within 7 days marks the recipient as _replied_.

### 4.8 Automations (`/automations`)

A form-based rule builder: a trigger followed by a list of steps that can contain If/Else branches.

- **Triggers:**
  - New message received
  - First message from contact
  - **Keyword match** (contains / whole word / exact, optional case sensitivity)
  - Button/list reply
  - New contact created
  - Tag added
  - Conversation assigned _(see §15)_
  - Time-based _(see §15)_
- **Steps:**
  - Send message
  - Send buttons / Send list (optional **wait for reply**)
  - Send template
  - Add tag / Remove tag
  - Assign conversation
  - Update contact field (including custom fields)
  - Create deal
  - **Wait** (minutes, hours or days)
  - **Condition** (tag present, contact field, message content, time of day with time zone)
  - **Send webhook** (SSRF-guarded)
  - Close conversation
- **Variable interpolation:** `{{message.text}}`, `{{vars.x}}`.
- **Starter templates:** Welcome Message, Out of Office, Lead Qualifier, Follow-up Reminder.
- **Other actions:** activate/deactivate, duplicate, delete. A **logs** page shows each run's status (success / partial / failed) with per-step detail.

### 4.9 Flows (`/flows`, Beta)

A visual chatbot builder. Each contact runs through a node graph as a stateful conversation.

- **Editor:**
  - **Canvas view** (React Flow): drag nodes, connect handles, minimap, dagre auto-layout.
  - **List view:** expandable node cards.
  - A validation panel that jumps to the offending node.
  - Save and Activate/Pause.
- **Triggers:** keyword (contains or exact), first-ever inbound message, manual.
- **Nodes:**
  - Start
  - Send message
  - Send buttons (1–3)
  - Send list (≤ 10 rows)
  - Send media (uploaded to `flow-media`)
  - Collect input (saves the reply to a variable)
  - If/Else (variable, tag, contact field)
  - Tag contact
  - Handoff to agent
  - End
- **Fallback policy:** when the customer sends an unexpected reply, the flow can reprompt (max N times), hand off, or ignore it. Timeout defaults to 24 h. When reprompts run out, it hands off or ends.
- **Starter templates:** Welcome menu, FAQ bot, Lead capture.
- **Runs page:** the last 50 runs, with status, current node, variables, re-prompt count, duration, and an event timeline.

### 4.10 AI Agents (`/agents`)

- **Bring your own key:** OpenAI, Anthropic, or **any OpenAI-compatible endpoint** (Ollama, vLLM, …). Keys are stored AES-256-GCM encrypted. There is a **Test key** button.
- **Playground:** chat as if you were a customer, against your knowledge base. It shows where the bot would hand off.
- **Setup:**
  - Provider, model, key.
  - Optional embeddings key for semantic search.
  - Business-context prompt.
  - Master switch.
  - **Auto-reply** on/off, with a cap per conversation (1–20).
  - **Handoff target:** a specific agent, or the unassigned queue.
- **Knowledge base:** documents are chunked and indexed, with a reindex button. Retrieval is semantic (pgvector) when an embeddings key is set, plus full-text search.
- **Usage (admin only):** token spend per day, per mode (draft or auto-reply) and per model. Counts only; no message content.

### 4.11 Notifications and presence

- **In-app notifications:** "conversation assigned to you". Created by a DB trigger and delivered in realtime. Mark one or all as read; clicking opens the inbox.
- **Browser notifications:** opt-in per device. Fired for new customer messages while a tab is open. No push service worker.
- **Presence:**
  - Heartbeat every 30 s.
  - Away after 5 min idle or when the tab is hidden.
  - Offline after 75 s without a heartbeat.
  - Shown as dots in the inbox, members list and dashboard.

### 4.12 Settings (`/settings?tab=`)

| Group     | Section              | What it does                                                                                                                                                                                  |
| --------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —         | **Overview**         | Status cards for every section                                                                                                                                                                |
| Account   | **Your profile**     | Avatar (≤ 2 MB), display name, email change (both addresses confirm), browser notifications                                                                                                   |
|           | **Login & security** | Change password, sign out of all devices                                                                                                                                                      |
|           | **Appearance**       | Light/dark mode, accent colour (saved per device)                                                                                                                                             |
| Workspace | **WhatsApp**         | Phone Number ID, WABA ID, access token, verify token, optional 2-step PIN; webhook URL; registration and subscription diagnostics; Meta error explanations; "keep inbound attachments" toggle |
|           | **Templates**        | Sync from Meta; create, edit and resubmit (header text/image/video/document, body variables, footer, Quick-reply/URL/Phone/Copy-code buttons); quality score; delete; dry-run mode            |
|           | **Quick replies**    | Shared text or interactive snippets                                                                                                                                                           |
|           | **Inbox**            | Reply-time target (1–1440 min) used for SLA metrics                                                                                                                                           |
|           | **Fields & tags**    | Tags (8 colours), custom contact fields                                                                                                                                                       |
|           | **Deals & currency** | Default currency                                                                                                                                                                              |
|           | **Team members**     | Roster with presence, change role, remove member, invite links (1/7/30 days, shown once, share via WhatsApp), revoke invites, transfer ownership                                              |
|           | **API keys**         | Create scoped keys (shown once), see last used and expiry, revoke                                                                                                                             |

---

## 5. Backend engines in depth

### 5.1 Inbound webhook pipeline (`api/whatsapp/webhook/route.ts`)

1. Read the raw body (capped at **4 MB**, otherwise 413). Verify `x-hub-signature-256`, an HMAC-SHA256 checked against **any** secret in `META_APP_SECRET`; return 401 on failure.
2. `after(processWebhook)` and **return 200 immediately**.
3. For each change:
   - **Template events** (`message_template_status_update`, `message_template_quality_update`, `message_template_components_update`) update `message_templates`. A stub row is created for a template the app hasn't seen.
   - **Statuses** move `messages.status` forward only. Failures store the error code, title and details. A status that arrives before its message row is parked in `pending_message_statuses` (24 h TTL). The status is also mirrored onto `broadcast_recipients` (a trigger keeps the counters), and a `message.status_updated` webhook is emitted.
   - **Messages:**
     1. Resolve the account by `phone_number_id`.
     2. Resolve the sender's identity: phone or **BSUID** (username-only senders).
     3. Find or create the contact, then the conversation. A new conversation emits `conversation.created`.
     4. Reactions upsert or delete `message_reactions`.
     5. Parse the content (text, media, sticker, location, interactive reply, template button).
     6. **Mirror the media** into the `chat-media` bucket (≤ 16 MB, best effort). Otherwise the message points at the `/api/whatsapp/media/<id>` proxy.
     7. **Idempotent insert.** If the row already exists, stop: this is a Meta replay.
     8. Claim "first inbound message", bump unread atomically, reopen a closed conversation, and flag a broadcast reply.
     9. **Flows** get the message first and may consume it.
     10. Next, **automations waiting for a reply**.
     11. Then **automation triggers** (new contact, first inbound, new message, keyword, interactive reply).
     12. Then **AI auto-reply**.
     13. Finally emit `message.received`.

### 5.2 Outbound send (`lib/whatsapp/send-message.ts`)

Shared by the inbox (`/api/whatsapp/send`) and the public API.

- **Validate first,** so a bad request never leaves an orphan conversation.
- **Resolve the target:** phone first, then BSUID.
- **Decrypt the token.** Legacy CBC tokens are re-encrypted as GCM in place.
- **Check the reply target** belongs to the same conversation.
- **Resolve the template row** (`en` vs `en_US` tolerant).
- **Phone-variant retry:** up to 3 forms of the number, tried only on Meta error 131030. A form that works is saved back to the contact.
- **Persist** the message, then replay any parked statuses and update the conversation preview.
- **Pause the contact's active Flow run** (`paused_by_agent`).

### 5.3 Meta Graph API client (`lib/whatsapp/meta-api.ts`, v21.0)

- **Phone and WABA management:** verify phone number, health (quality and messaging tier), `/register` (PIN), `subscribed_apps`, list WABA phone numbers.
- **Sending:** text, media, template, reaction, typing indicator (which also marks the message read), interactive buttons/list.
- **Templates:** submit, edit (full component replace), delete. Media header handles use the **resumable upload** (needs `META_APP_ID`).
- **Media:** get URL, download.
- **Errors:** a structured `MetaApiError` (code, subcode, `fbtrace_id`). `meta-error-explain.ts` maps codes to human fixes and the form field to check.

### 5.4 Templates

- **Validators:**
  - Body ≤ 1024, footer and header ≤ 60, button text ≤ 25.
  - ≤ 10 buttons: ≤ 2 URL, ≤ 1 phone, ≤ 1 copy-code.
  - Variables are either positional (`{{1}}`, contiguous) or **named**, never both.
  - Sample values must match the variables one to one.
- **Send builder:** fills header, body and URL-button parameters and auto-attaches the static media header.
- **Status enum:** DRAFT, PENDING, APPROVED, REJECTED, PAUSED, DISABLED, IN_APPEAL, PENDING_DELETION. A template can be edited when it is APPROVED, REJECTED or PAUSED.

### 5.5 Broadcast engine

- **Server path** (`broadcast-core.ts`):
  - `createBroadcast` takes ≤ 1000 recipients, validates E.164, finds or creates contacts and dedupes them.
  - The atomic RPC `create_broadcast_with_recipients` freezes each recipient's parameters.
  - `deliverBroadcast` then runs sequentially inside `after()`.
- **Resume** (`broadcast-resume.ts`): scope pending, failed or all. An atomic claim on `delivery_locked_at` (stale after 30 min) and a **5-minute lease** via RPC.
- **Status ladders:** recipients go pending → sent → delivered → read → replied; `failed` only follows pending or sent. Counters live in the DB trigger and the app never writes them.

### 5.6 Automations engine (`lib/automations/engine.ts`)

- **`runAutomationsForTrigger`:**
  - Never throws. First checks that the contact and conversation belong to the account.
  - Runs the matching active automations one after another.
  - Each run writes an `automation_logs` row and bumps the counter via RPC.
- **Steps:** run in `position` order. Conditions recurse into their yes/no branch; the first failure stops the run.
- **Wait:** inserts an `automation_pending_executions` row (`pending`, `run_at`). The cron job resumes it, including climbing back out of nested branches.
- **Wait for reply:**
  - Parks the run as `awaiting_reply` for 24 h; the newest menu supersedes older ones.
  - The webhook resumes it with the reply, which consumes the message.
- **Cron:**
  - Expires stale reply waits.
  - Requeues runs claimed more than 15 min ago.
  - Processes ≤ 50 due rows, claiming each atomically.
- **Tag chains:** `add_tag` re-fires `tag_added`, up to a depth of 3.

### 5.7 Flows engine (`lib/flows/engine.ts`)

|             | Flows                                                 | Automations                              |
| ----------- | ----------------------------------------------------- | ---------------------------------------- |
| Model       | Stateful node graph per contact                       | Trigger + step list with yes/no branches |
| Concurrency | **One active run per contact** (partial unique index) | Many runs at once                        |
| Priority    | Runs first; can consume the message                   | Runs after flows                         |
| Pauses      | Waits for a button tap or text input                  | Timed waits and reply waits              |
| Fallback    | Reprompt / handoff / ignore, plus a timeout           | None                                     |

- **Edges:** stored inside node configs as stable `node_key` strings (`next_node_key`, `true_next`, per-button `next_node_key`). This makes cloning safe.
- **Transitions:** optimistic concurrency on `current_node_key` + `transition_seq`.
- **Advancing:** ≤ 25 nodes per advance, and auto-advance chains ≤ 24.
- **Logging and privacy:** every step writes to `flow_run_events`. Raw customer text is never logged, only its length.
- **Timeouts:** `/api/flows/cron` sweeps runs past `on_timeout_hours`. The sweep is **required**: without it, abandoned runs block new triggers for that contact.
- **Validation** (at activation):
  - Entry node exists; node keys are unique.
  - Meta limits are respected; no dead ends.
  - Unreachable nodes are a warning.
  - Auto-advance cycles are an error.

### 5.8 AI subsystem (`lib/ai/`)

- **Providers:**
  - OpenAI `/v1/chat/completions`.
  - Anthropic `/v1/messages` (`anthropic-version: 2023-06-01`; consecutive same-role turns are merged).
  - OpenAI-compatible: base URL validated and SSRF-guarded; http only for allow-listed private hosts.
- **Default models** (only pre-fill the settings field):
  - OpenAI: `gpt-5.4-mini`
  - Anthropic: `claude-haiku-4-5-20251001`
- **Tunables:** max output 1024 tokens, timeout 30 s, context = the last 20 text messages.
- **System prompt:**
  - A fixed base: reply in the customer's language, keep it short, don't invent facts.
  - A prompt-injection guard.
  - In auto-reply mode, the `[[HANDOFF]]` sentinel protocol.
  - The business context and numbered knowledge-base excerpts.
- **Auto-reply gates:** it skips silently if any of these hold.
  - AI or auto-reply is off.
  - An active `new_message_received` or `keyword_match` automation exists (avoids double replies).
  - A human is assigned.
  - The bot is paused on that conversation.
  - The per-conversation cap is reached.
  - The account limit of 30/min is exceeded.
  - A newer inbound message arrived meanwhile.
- **Auto-reply send:** the slot is claimed atomically (`claim_ai_reply_slot`). The message is sent with `ai_generated = true`.
- **Handoff:** the bot pauses, writes a deterministic summary note, and assigns the handoff agent. The assignment trigger then creates a notification.
- **Knowledge base:**
  - Chunks of ~1200 characters.
  - Embeddings use OpenAI `text-embedding-3-small` (1536 dimensions, batches of 96).
  - Retrieval takes the top 5: semantic first, then topped up with FTS (`'simple'` config, OR across terms).
- **Usage logging:** one `ai_usage_log` row per call, with token counts only.

---

## 6. Database schema

Supabase Postgres 17. Extensions: `uuid-ossp` and **`vector`**. All migrations are idempotent. The only enum is `account_role_enum`; other states are `TEXT` columns with CHECK constraints.

### 6.1 Tables by domain

| Domain                | Tables                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accounts and team** | `accounts` (name, `owner_user_id`, `default_currency`, `reply_target_minutes`), `profiles` (one per user: `account_id`, `account_role`, avatar, `beta_features`), `account_invitations` (`token_hash`, role ≠ owner, expiry), `member_presence`                                                                                                                                                                |
| **Contacts**          | `contacts` (phone, generated `phone_normalized`, `wa_user_id`/BSUID, `wa_username`, name, email, company), `tags`, `contact_tags`, `custom_fields`, `contact_custom_values`, `contact_notes`                                                                                                                                                                                                                   |
| **Messaging**         | `conversations` (**unique `(account_id, contact_id)`**, status, assignee, unread, AI flags, `first_inbound_at`/`last_inbound_at`/`last_reply_at`/`closed_at`), `messages` (sender type, content type, media, template, interactive payload, `ai_generated`, `reply_to_message_id`, error fields, **unique `(conversation_id, message_id)`**), `message_reactions`, `quick_replies`, `pending_message_statuses` |
| **WhatsApp**          | `whatsapp_config` (one per account; globally unique `phone_number_id`; encrypted token; registration and subscription stamps; `mirror_inbound_media`), `message_templates` (unique `(account_id, name, language)`)                                                                                                                                                                                             |
| **Sales**             | `pipelines`, `pipeline_stages`, `deals` (value, currency, status open/won/lost, assignee, `closed_at`)                                                                                                                                                                                                                                                                                                         |
| **Broadcasts**        | `broadcasts` (counters, `delivery_locked_at`, `delivery_lease_until`), `broadcast_recipients` (status ladder, `whatsapp_message_id`, `template_params`)                                                                                                                                                                                                                                                        |
| **Automations**       | `automations`, `automation_steps` (tree via `parent_step_id` + `branch`), `automation_logs`, `automation_pending_executions` (queue: pending/running/awaiting_reply/…)                                                                                                                                                                                                                                         |
| **Flows**             | `flows` (status, trigger, `entry_node_id`, `fallback_policy`), `flow_nodes` (`node_key`, type, config, position), `flow_runs` (one active per contact, `vars`, `transition_seq`), `flow_run_events`                                                                                                                                                                                                            |
| **AI**                | `ai_configs` (one per account; encrypted keys; provider, model, `base_url`; auto-reply settings), `ai_knowledge_documents`, `ai_knowledge_chunks` (`fts tsvector` GIN + `embedding vector(1536)` HNSW), `ai_usage_log`                                                                                                                                                                                         |
| **Platform**          | `api_keys` (SHA-256 `key_hash`, prefix, scopes, expiry/revoked), `webhook_endpoints` (encrypted secret, events, `failure_count`), `notifications`                                                                                                                                                                                                                                                              |

**Realtime publication:** `messages`, `conversations`, `message_reactions`, `flow_runs`, `member_presence`, `notifications`.

### 6.2 Storage buckets

| Bucket       | Limit                          | Use                                             | Write                                 |
| ------------ | ------------------------------ | ----------------------------------------------- | ------------------------------------- |
| `avatars`    | 2 MB, images                   | Profile pictures                                | Owner's own folder                    |
| `chat-media` | 16 MB, images/video/audio/docs | Inbox outbound media and mirrored inbound media | `account-<id>/…`, agent role or above |
| `flow-media` | 16 MB                          | Flow `send_media` nodes                         | `account-<id>/…`, agent role or above |

The buckets are `public = TRUE`, because Meta must fetch media without credentials. Listing and API reads are scoped to account members.

### 6.3 Key RPCs and triggers

| Function                                                                                                                       | Purpose                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `is_account_member(account, min_role)`                                                                                         | Core RLS helper (SECURITY DEFINER)                              |
| `handle_new_user()`                                                                                                            | Signup trigger: creates a personal account and an owner profile |
| `set_member_role`, `remove_account_member`, `transfer_account_ownership`                                                       | Membership changes, with row locks                              |
| `peek_invitation`, `redeem_invitation`                                                                                         | Invitation flow                                                 |
| `create_broadcast_with_recipients`                                                                                             | Inserts a broadcast and its recipients in one transaction       |
| `acquire_/renew_broadcast_delivery_lease`, `broadcast_delivery_in_flight`                                                      | Broadcast delivery lease                                        |
| `broadcast_recipient_aggregate_trigger`, `_bcast_bump`, `recompute_broadcast_counts`                                           | O(1) incremental broadcast counters                             |
| `bump_conversation_on_inbound`                                                                                                 | Atomic unread++ and last-message update                         |
| `claim_ai_reply_slot`                                                                                                          | Atomic auto-reply cap                                           |
| `match_ai_knowledge_fts`, `match_ai_knowledge_semantic`                                                                        | RAG retrieval (SECURITY INVOKER)                                |
| `replace_flow_nodes`, `replace_flow_graph`, `list_timed_out_flow_runs`                                                         | Flow graph saves and timeout sweep                              |
| `increment_automation_execution_count`, `increment_flow_execution_count`                                                       | Run counters                                                    |
| `filter_contacts_by_tags`                                                                                                      | Server-side tag filter with paging                              |
| `merge_duplicate_contacts`, `merge_duplicate_conversations`                                                                    | Data dedupe                                                     |
| `touch_presence`                                                                                                               | Presence heartbeat                                              |
| `record_webhook_failure`                                                                                                       | Auto-disables an endpoint after 15 consecutive failures         |
| `notify_conversation_assigned` (trigger)                                                                                       | Creates an assignment notification                              |
| `enforce_profile_privilege_columns`, `enforce_account_identity_columns`, `enforce_conversation_assignee_membership` (triggers) | Anti-tampering guards                                           |
| `track_conversation_message_times`, `stamp_*_closed_at` (triggers)                                                             | Timing columns for SLAs                                         |
| `dashboard_overview(days, tz)`                                                                                                 | The whole dashboard in one JSONB                                |

### 6.4 Migration timeline (high level)

- **001–016:** initial single-tenant schema, then pipelines, broadcast tracking, automations, avatars, replies/reactions, flows, templates on Meta, registration, flow media.
- **017–021:** **multi-tenant accounts** (roles, invitations, role-tiered RLS rewrite), member and invite RPCs, default currency.
- **022–028:** phone dedupe, chat media, presence, tag filter RPC, API keys, notifications, outbound webhooks.
- **029–034:** AI reply, knowledge base with pgvector, security fixes (cross-tenant knowledge-base reads, role escalation).
- **035–049:** interactive messages and quick replies, conversation dedupe, webhook idempotency, broadcast resume, media mirror, BSUID contacts, failure reasons, storage scoping, DEFINER grant hardening, wait-for-reply, OpenAI-compatible provider, membership integrity.
- **051–059:** integrity hardening of the engines, authorization holes, template uniqueness per account, broadcast lease, **dashboard overview RPC**.

Migration numbers 050 and 056 don't exist (they were skipped).

---

## 7. Auth, roles and multi-tenancy

### 7.1 Role matrix

| Capability                                                                                                                      | Owner | Admin | Agent | Viewer |
| ------------------------------------------------------------------------------------------------------------------------------- | :---: | :---: | :---: | :----: |
| Read everything in the account                                                                                                  |   ✓   |   ✓   |   ✓   |   ✓    |
| Send messages; edit contacts, notes, conversations, deals, broadcasts, automations, flows, quick replies; upload media          |   ✓   |   ✓   |   ✓   |   ✗    |
| Settings: WhatsApp config, templates, pipelines, tags, custom fields, account, API keys, webhooks, AI config and knowledge base |   ✓   |   ✓   |   ✗   |   ✗    |
| Manage members and invites; see member emails; see AI usage                                                                     |   ✓   |   ✓   |   ✗   |   ✗    |
| Transfer ownership / delete account                                                                                             |   ✓   |   ✗   |   ✗   |   ✗    |

Rules: admins can't change their own role, can't target the owner, and can't grant owner. An invitation can never carry the owner role. Each account has exactly one owner.

### 7.2 How account context is resolved

- **Server, session:** `getCurrentAccount()` / `requireRole(min)` (`lib/auth/account.ts`).
  - Gets the user, then the profile's `account_id` and role, then the account. Returns an RLS-scoped client.
  - Errors are mapped to 401/403; anything else becomes a generic 500.
- **Server, API key:** `requireApiKey(req, scope)`.
  - Bearer `wacrm_live_…`, hashed with SHA-256 and looked up.
  - Per-key rate limit, then the scope check.
  - Returns a service-role client plus `accountId`.
- **Client:**
  - `AuthProvider` / `useAuth` load the profile and account and expose role flags.
  - `useCan(action)` and `<RequireRole min>` gate the UI.
  - `GatedButton` shows a "Read-only" tooltip on disabled buttons.

### 7.3 Middleware (`src/middleware.ts`)

- Refreshes the Supabase session and copies rotated cookies onto redirects.
- Signed-in users visiting the auth pages go to `/dashboard`, or to `/join/<token>` if an invite is present.
- Signed-out users visiting any dashboard route go to `/login`.
- Signed-out requests to `/api/whatsapp/*` get a 401 JSON response, except the webhook.

### 7.4 Invitation flow

1. An admin creates an invite. A 32-byte token is generated, only its **SHA-256 hash is stored**, and the URL `/join/<token>` is shown once. Expiry is 1–365 days (default 7).
2. The join page **peeks** at the invite (anonymous, 30/min per IP).
3. The user signs up or signs in, carrying `?invite`.
4. The user clicks **Accept**, which calls `redeem_invitation` (10/min). The RPC locks the rows and only succeeds if the user's current personal account is **empty and single-member**. It then moves the profile into the inviting account and deletes the old one.

### 7.5 Email links (`/auth/callback`)

- Supports PKCE `?code=` and `?token_hash&type=` (verifyOtp).
- `safeNextPath` blocks open redirects.
- Redirects are relative 303s, so it works behind a proxy.

---

## 8. API reference (internal routes)

Auth legend:

- **S** = session, any member
- **A+** = agent or above
- **Ad+** = admin or above
- **O** = owner
- **Pub** = public
- **Cron** = `x-cron-secret`
- **Meta** = HMAC signature

| Domain        | Route                                              | Methods                      | Auth                    | Purpose                                     |
| ------------- | -------------------------------------------------- | ---------------------------- | ----------------------- | ------------------------------------------- |
| Auth          | `/auth/callback`                                   | GET                          | Pub                     | Email-link session exchange                 |
| Account       | `/api/account`                                     | GET / PATCH                  | S / Ad+                 | Read / rename account                       |
|               | `/api/account/members`                             | GET                          | S                       | Roster (emails for admins only)             |
|               | `/api/account/members/[userId]`                    | PATCH / DELETE               | Ad+                     | Change role / remove member                 |
|               | `/api/account/transfer-ownership`                  | POST                         | O                       | Transfer ownership                          |
|               | `/api/account/invitations` (+`/[id]`)              | GET, POST / DELETE           | Ad+                     | Invites                                     |
|               | `/api/account/api-keys` (+`/[id]`)                 | GET (S), POST / DELETE (Ad+) |                         | API keys (plaintext returned once)          |
| Invites       | `/api/invitations/[token]/peek`                    | GET                          | Pub (30/min/IP)         | Invite preview                              |
|               | `/api/invitations/[token]/redeem`                  | POST                         | Signed-in user (10/min) | Join an account                             |
| AI            | `/api/ai/config`                                   | GET / POST / DELETE          | S / Ad+ / Ad+           | AI config (key validated, encrypted)        |
|               | `/api/ai/test`                                     | POST                         | Ad+                     | Validate a key without saving               |
|               | `/api/ai/draft`                                    | POST                         | A+                      | Draft a reply                               |
|               | `/api/ai/playground`                               | POST                         | A+                      | Test chat                                   |
|               | `/api/ai/autoreply/[conversationId]`               | POST                         | A+                      | Take over / resume AI                       |
|               | `/api/ai/knowledge` (+`/[id]`, `/reindex`)         | CRUD                         | S read / Ad+ write      | Knowledge base                              |
|               | `/api/ai/usage`                                    | GET                          | Ad+                     | Token usage                                 |
| Automations   | `/api/automations` (+`/[id]`, `/[id]/duplicate`)   | CRUD                         | S read / A+ write       | Automations (validated on activation)       |
|               | `/api/automations/engine`                          | POST                         | A+ (30/min)             | Manual trigger                              |
|               | `/api/automations/cron`                            | GET                          | Cron                    | Drain waits and reply-wait expiries         |
| Flows         | `/api/flows` (+`/[id]`, `/templates`)              | CRUD                         | S read / A+ write       | Flows (graph saved atomically)              |
|               | `/api/flows/[id]/activate`                         | POST                         | A+                      | Draft/active/archived (validated)           |
|               | `/api/flows/[id]/runs`                             | GET                          | S                       | Last 50 runs + events                       |
|               | `/api/flows/cron`                                  | GET                          | Cron                    | Timeout sweep                               |
| Contacts      | `/api/contacts/[id]/tags`                          | POST / DELETE                | A+                      | Tag add (fires `tag_added`) / remove        |
| Quick replies | `/api/quick-replies` (+`/[id]`)                    | CRUD                         | S read / A+ write       | Snippets                                    |
| WhatsApp      | `/api/whatsapp/webhook`                            | GET / POST                   | Verify token / Meta     | Handshake / inbound events                  |
|               | `/api/whatsapp/config`                             | GET / POST / DELETE          | S / Ad+ / Ad+           | Test / save (register + subscribe) / remove |
|               | `/api/whatsapp/config/verify-registration`         | GET                          | S                       | Diagnostics                                 |
|               | `/api/whatsapp/health`                             | GET                          | S                       | Quality and messaging limit                 |
|               | `/api/whatsapp/media/[mediaId]`                    | GET                          | S (240/min)             | Media proxy                                 |
|               | `/api/whatsapp/send`                               | POST                         | A+ (60/min)             | Send any message type                       |
|               | `/api/whatsapp/react`                              | POST                         | A+ (120/min)            | Reaction                                    |
|               | `/api/whatsapp/broadcast`                          | POST                         | A+ (60/min)             | Send one broadcast batch                    |
|               | `/api/whatsapp/broadcast/[id]/resume`              | POST                         | A+                      | Server-side resume (202, `after()`)         |
|               | `/api/whatsapp/templates/submit`, `/[id]`, `/sync` | POST / PATCH, DELETE / POST  | Ad+                     | Template lifecycle on Meta                  |

---

## 9. Public REST API `/api/v1` and outbound webhooks

**Auth:** `Authorization: Bearer wacrm_live_<43 chars>`.

- Keys are account-scoped, SHA-256 hashed, revocable, and can expire.
- Rate limit: **120 requests/min per key**.

**Response envelope:**

- Success: `{data}`.
- Lists: `{data:[…], meta:{next_cursor}}`.
- Error: `{error:{code,message}}`.

**Pagination:** keyset on `(created_at desc, id desc)`; default 50, max 100. Cursors are re-validated.

**Scopes:** `messages:send`, `messages:read`, `contacts:read`, `contacts:write`, `conversations:read`, `broadcasts:send`, `webhooks:manage`

| Endpoint                                                | Scope                | Notes                                                                                                               |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /me`                                               | —                    | Account + key identity                                                                                              |
| `POST /messages`                                        | `messages:send`      | E.164 `to` (leading `+` required); text / template / image / video / document / audio; finds or creates the contact |
| `GET/POST /contacts`                                    | read / write         | Search and tag filter; POST is find-or-create (tags added)                                                          |
| `GET/PATCH /contacts/{id}`                              | read / write         | PATCH `tags` **replaces** the set                                                                                   |
| `GET /conversations`, `/conversations/{id}`             | `conversations:read` | Filter by status or contact                                                                                         |
| `GET /conversations/{id}/messages`                      | `messages:read`      | Newest first                                                                                                        |
| `POST /broadcasts`                                      | `broadcasts:send`    | ≤ 1000 recipients; 202; fan-out in `after()`                                                                        |
| `GET /broadcasts/{id}`                                  | `broadcasts:send`    | Status + counts                                                                                                     |
| `GET/POST /webhooks`, `GET/PATCH/DELETE /webhooks/{id}` | `webhooks:manage`    | https only; the `whsec_` secret is shown once                                                                       |

**Outbound webhooks:**

- **Events:** `message.received`, `message.status_updated`, `conversation.created`.
- **Payload:** `{id, event, occurred_at, account_id, data}`.
- **Headers:** `X-Wacrm-Event`, `X-Wacrm-Webhook-Id`, `X-Wacrm-Signature: t=<unix>,v1=<HMAC-SHA256(secret, "t.body")>` (Stripe-style, 300 s tolerance).
- **Delivery:**
  - A single attempt with a 5 s timeout, sent to all matching endpoints in parallel. There is **no retry queue**.
  - Success resets the failure count.
  - Endpoints are auto-disabled after 15 consecutive failures.
- **SSRF guard:** DNS is resolved and the URL is rejected if _any_ record is private or reserved (full IPv4/IPv6 blocklist, including metadata, CGNAT, NAT64 and 6to4). It also uses `redirect: 'manual'`.

---

## 10. MCP server

`mcp-server/` is the separate npm package **`wacrm-mcp`** v0.1.1. It is a thin client over `/api/v1`, and the transport is **stdio** only.

| Env var                   | Meaning                                        |
| ------------------------- | ---------------------------------------------- |
| `WACRM_BASE_URL`          | Your deployment URL (required)                 |
| `WACRM_API_KEY`           | A `wacrm_live_…` key (required)                |
| `WACRM_ENABLE_WRITES`     | Registers the write tools                      |
| `WACRM_ENABLE_BROADCASTS` | Registers the broadcast tool (requires writes) |

| Tool                                                                                                                 | Group                                                           | Calls                |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------- |
| `whoami`, `list_contacts`, `get_contact`, `list_conversations`, `get_conversation`, `list_messages`, `get_broadcast` | read (always on)                                                | GET endpoints        |
| `send_message`, `create_contact`, `update_contact`                                                                   | write (opt-in)                                                  | POST/PATCH endpoints |
| `send_broadcast`                                                                                                     | broadcast (opt-in, requires `confirm: true`, `destructiveHint`) | POST /broadcasts     |

Read-only is the default. Write tools aren't even _registered_ unless enabled, and the key's scopes still apply on the server.

Quick start: `npx -y wacrm-mcp` with the env vars above.

---

## 11. Security model

| Area                | Implementation                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant isolation    | RLS on every table via `is_account_member`, in three tiers (read: any member, operational write: agent, settings write: admin). The service-role paths filter `account_id` explicitly.     |
| Privilege tampering | Triggers block client edits to `profiles.account_role/account_id` and `accounts.owner_user_id`. Membership changes happen only through locked DEFINER RPCs.                                |
| Secrets at rest     | **AES-256-GCM** (`iv:ct:tag`, `ENCRYPTION_KEY`) for the WhatsApp token, verify token, AI keys and webhook secrets. The legacy CBC format is decrypt-only and re-encrypted on use.          |
| Hashed tokens       | API keys and invite tokens are stored as SHA-256 only; the plaintext is shown once.                                                                                                        |
| Inbound webhook     | HMAC-SHA256 signature checked against one or more `META_APP_SECRET`s; fails closed; 4 MB body cap.                                                                                         |
| Outbound HTTP       | SSRF guard (DNS + IP blocklist) on customer webhooks, automation `send_webhook`, template media fetches and OpenAI-compatible AI base URLs.                                                |
| Headers             | HSTS (2 years, preload), `nosniff`, `X-Frame-Options: DENY`, strict referrer policy, Permissions-Policy (microphone=self for voice notes), `no-store` caching. **The CSP is report-only.** |
| Media proxy         | Safe MIME types are served inline under the CSP `default-src 'none'; sandbox`; media IDs are validated.                                                                                    |
| Redirects           | `safeNextPath` (no `//`, no control characters), relative 303s.                                                                                                                            |
| Invite links        | Optional `ALLOWED_INVITE_HOSTS` allow-list prevents Host-header spoofing.                                                                                                                  |
| Rate limiting       | In-memory fixed window **per process** (see §12).                                                                                                                                          |
| Advisories fixed    | The code and migrations reference GHSA fixes for cross-tenant knowledge-base reads, role escalation, template deletion by non-admins, an SSRF bypass, and removed-member access.           |

---

## 12. Limits and constants

| Item                  | Value                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limits (per min) | send 60 · broadcast 60 · react 120 · invite peek 30/IP · redeem 10/IP · admin actions 30 · public API 120/key · AI draft 20/user + 60/account · AI auto-reply 30/account · WhatsApp admin 30 · health 30 · media 240 · automation trigger 30 |
| Webhook body          | 4 MB                                                                                                                                                                                                                                         |
| Media                 | 16 MB per bucket (image 5 MB in the composer); voice note 5 min                                                                                                                                                                              |
| Interactive messages  | 3 buttons (20 chars) · list 10 rows (title 24, description 72) · body 1024 · header/footer 60                                                                                                                                                |
| Templates             | body 1024 · footer/header 60 · ≤ 10 buttons (≤ 2 URL, ≤ 1 phone, ≤ 1 copy-code)                                                                                                                                                              |
| Broadcasts            | ≤ 1000 recipients per API call · browser batches of 10 with 1 s gaps · 429-only retry (4 attempts, ≤ 120 s) · 7-day reply attribution                                                                                                        |
| Automations           | cron batch 50 · reply wait 24 h · stalled claim 15 min · tag-chain depth 3                                                                                                                                                                   |
| Flows                 | 1 active run per contact · 25 nodes per advance · default timeout 24 h (max 87,600 h) · 2 reprompts by default                                                                                                                               |
| AI                    | 1024 output tokens · 30 s timeout · 20-message context · ≤ 20 auto-replies per conversation (default 3) · chunks of 1200 chars · top-5 retrieval                                                                                             |
| Webhooks out          | 5 s timeout · auto-disable after 15 failures · signature tolerance 300 s                                                                                                                                                                     |
| Presence              | heartbeat 30 s · offline after 75 s · away after 5 min                                                                                                                                                                                       |
| Status buffer         | 24 h TTL for statuses that arrive before their message                                                                                                                                                                                       |

---

## 13. Configuration (environment variables)

| Variable                                                    | Required                   | Purpose                                                            |
| ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ (build time)             | Supabase client                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | ✓                          | Webhook, engines, public API                                       |
| `ENCRYPTION_KEY`                                            | ✓                          | 64 hex chars (AES-256). Rotating it orphans every stored token     |
| `META_APP_SECRET`                                           | ✓                          | Webhook HMAC; comma-separated for multiple Meta Apps               |
| `NEXT_PUBLIC_SITE_URL`                                      | recommended                | Canonical URL (invite links)                                       |
| `NEXT_PUBLIC_APP_LOCALE`                                    | recommended                | `en` / `ko` / `pt` / `es` (build time)                             |
| `AUTOMATION_CRON_SECRET`                                    | if using waits or flows    | Protects both cron endpoints                                       |
| `META_APP_ID`                                               | for image-header templates | Resumable upload                                                   |
| `ALLOWED_INVITE_HOSTS`                                      | optional                   | Invite host allow-list                                             |
| `WHATSAPP_TEMPLATES_DRY_RUN`                                | dev/CI                     | Skip the Meta call when submitting templates                       |
| `AI_REQUEST_TIMEOUT_MS`, `AI_CONTEXT_MESSAGE_LIMIT`         | optional                   | AI tuning                                                          |
| `AI_PROVIDER_ALLOWED_PRIVATE_HOSTS`                         | optional                   | Allow private hosts for OpenAI-compatible endpoints (Ollama, vLLM) |
| `ALLOWED_DEV_ORIGINS`                                       | dev                        | Extra dev origins (tunnels)                                        |

**Multi-WABA:**

- Each account connects its own number (one number belongs to one account; routing is by `phone_number_id`).
- Several Meta Apps are supported by listing all their secrets.
- `META_APP_ID` is single-valued.
- Details in `docs/multi-waba.md`.

---

## 14. Build, test, CI and deployment

**Scripts:** `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (vitest), `format` / `format:check`.

**Tests:**

- 158 `*.test.ts(x)` files sit next to the code. They cover engines, webhook handling, the Meta API, templates, security (SSRF, signatures, encryption), migrations' SQL contracts, middleware and i18n.
- Dummy `ENCRYPTION_KEY` and `META_APP_SECRET` are injected by `vitest.config.ts`.

**CI (`.github/workflows`):**

- `ci.yml`: lint → typecheck → test → build on PRs and pushes to `main`.
- `migrations.yml`: boots Postgres with the Supabase CLI 2.113.0, `db reset` replays every migration from scratch, then `verify-schema.sql` asserts the expected objects exist.

**Deployment options:**

- **Hostinger Managed Node.js** (the recommended path in the README): connect your fork and push to `main`.
- **Docker:**
  - Multi-stage `node:22-alpine` build producing Next.js standalone output.
  - Runs as a non-root user on port 3000.
  - `NEXT_PUBLIC_*` values are passed as build args; secrets are supplied at runtime via `env_file`.
  - `docker-compose.yml` includes a healthcheck.
- Anywhere Node runs (Vercel, Railway, a VPS).

**Setup checklist:**

1. Create a Supabase project and apply `supabase/migrations/*` in order.
2. Create a Meta App with WhatsApp. Point its webhook at `https://<host>/api/whatsapp/webhook` and subscribe to messages and template fields.
3. Fill in the env vars.
4. Save the WhatsApp credentials in Settings → WhatsApp.
5. Schedule `GET /api/automations/cron` and `GET /api/flows/cron` with header `x-cron-secret` (for example every 5 min) using an external scheduler. **Nothing in the repo schedules them.**

---

## 15. Known gaps and quirks

Each of these was found in the code during this analysis.

1. **`time_based` automation trigger has no scheduler.** The builder and validator accept a schedule, but nothing on the server ever fires it. It only runs through a manual `POST /api/automations/engine`.
2. **`conversation_assigned` automation trigger has no dispatcher.** It is also only reachable manually.
3. **The "round-robin" assignment isn't round-robin.** It picks the first profile in the account (`limit(1)`), and a code comment says so.
4. **Rate limits are in-memory, per process.** They don't hold across multiple instances or serverless fan-out.
5. **Outbound webhooks** make a single attempt and have no retry queue.
6. **`POST /api/v1/broadcasts`** fans out inside `after()` with `maxDuration = 60`. Very large sends can be cut off; the dashboard resume route allows 300 s.
7. **The CSP is report-only**, not enforced.
8. **Storage buckets are public** (by design, so Meta can fetch media). Anyone with a media URL can open it.
9. **No broadcast scheduling UI.** Step 4 is named "schedule-send" and `scheduled` exists as a status, but the UI only offers draft or send now.
10. **`docs/automations-and-cron.md`** is referenced in `.env.local.example` but doesn't exist.
11. **Header page title** falls back to "Dashboard" on `/flows` and `/agents` (they are missing from the `pageTitles` map).
12. **Composer hint** says "Settings → AI Assistant", but AI setup lives under **AI Agents → Setup**.
13. **"Delete message"** has a translation string but no implemented action.
14. **Flow `collect_input.validation`** exists in the config but the runner ignores it.
15. **Image-header template uploads** use the single `META_APP_ID`, so they fail for accounts whose WABA belongs to a different Meta App.

---

_Generated from a full read of the source tree (`src/`, `supabase/`, `mcp-server/`, `docs/`, config and CI files)._
