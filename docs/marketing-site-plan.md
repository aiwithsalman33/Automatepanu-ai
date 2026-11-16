# Marketing website: plan (awaiting approval)

Public site for **Automate Panu AI** at **https://automatepanuai.axxeler.in**,
in the same Next.js 16 app as the CRM (**https://chat.axxeler.in**),
inside `src/app/(marketing)/`. No code has been written yet.

## 1. What the current code means for this

| Finding                                                                               | Consequence                                                                                    | Plan                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx` redirects `/` → `/dashboard`                                       | Collides with a marketing home at `/`                                                          | The marketing home becomes `/`. On the **app host**, the proxy sends `/` to `/dashboard` (signed in) or `/login`. |
| `src/proxy.ts` calls `supabase.auth.getUser()` on **every** non-static request        | Each marketing page view would pay an auth round-trip, hurting speed and the Lighthouse target | The proxy checks the host/path first; marketing and `/tools` paths return immediately **without** touching auth.  |
| The root layout's `theme-boot` script sets `data-mode` (default **dark**) on `<html>` | The marketing site must always be light                                                        | The script skips marketing paths, and the marketing layout pins light tokens on its own wrapper.                  |
| next-intl catalogue parity test (`messages.test.ts`)                                  | New `Marketing.*` keys must exist in en/es/ko/pt                                               | English copy goes in all four files for now, so es/ko/pt can be translated later without code changes.            |

## 2. Two domains, one deployment (recommended)

One image and one Dokploy service, with **both domains attached to the `app` service**. The proxy routes by `Host`:

| Host                                                      | `/`, `/pricing`, `/features/*`, `/tools/*`, blog, legal… | `/login`, `/dashboard`, …         |
| --------------------------------------------------------- | -------------------------------------------------------- | --------------------------------- |
| `automatepanuai.axxeler.in` (`NEXT_PUBLIC_MARKETING_URL`) | served (static)                                          | 308 → `https://chat.axxeler.in/…` |
| `chat.axxeler.in` (`NEXT_PUBLIC_APP_URL`)                 | 308 → marketing domain (`/` → dashboard/login)           | served                            |
| either env unset (single-domain mode)                     | served                                                   | served                            |

Other host-aware pieces:

- `robots.txt` lets crawlers index the marketing host and blocks the app host.
- `sitemap.xml` lists marketing URLs only.
- "Sign in" and "Start free" link to `NEXT_PUBLIC_APP_URL`.

Both setups (split domains, or one domain) will be documented in `docs/deploy-dokploy.md`. _Alternative:_ two separate Dokploy services from the same image. It's more isolated but uses twice the RAM; I don't recommend it at this size.

## 3. Routes

| Route                                              | Content                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                | Home: the 14 sections from your brief (announcement pill → navbar → hero with an inbox mock → placeholder logo marquee → bento grid → 4 deep-dives → placeholder stats → What's new → pricing preview → use-case tabs → FAQ with JSON-LD → CTA band → free-tools strip → footer) |
| `/pricing`                                         | Plans, monthly/yearly toggle, full comparison table, FAQ                                                                                                                                                                                                                         |
| `/features/[slug]`                                 | inbox, broadcasts, automations, flows, ai-assistant, api                                                                                                                                                                                                                         |
| `/solutions/[slug]`                                | sales, support, agencies, ecommerce, education                                                                                                                                                                                                                                   |
| `/tools`, `/tools/[slug]`                          | Hub with search, plus link generator, QR generator, text formatter, chat widget (optional extras later)                                                                                                                                                                          |
| `/about`, `/contact`                               | Contact form → `POST /api/contact` (rate-limited, honeypot, sent with the SMTP mailer from 1b)                                                                                                                                                                                   |
| `/blog`, `/blog/[slug]`, `/changelog`              | MDX-ready index, 2 sample posts; changelog from a data file                                                                                                                                                                                                                      |
| `/privacy`, `/terms`, `/refund-policy`, `/cookies` | Scaffolds with `[REPLACE WITH REAL LEGAL TEXT]`                                                                                                                                                                                                                                  |

Every page is statically generated and has its own metadata, canonical URL and `opengraph-image`. JSON-LD: Organization, WebSite, FAQPage, SoftwareApplication.

## 4. Design tokens (`globals.css`, scoped to `.mk`)

| Token                                        | Value                                    |
| -------------------------------------------- | ---------------------------------------- |
| `--mk-bg` / `--mk-bg-alt` / `--mk-bg-alt2`   | `#FFFFFF` / `#FAF8FF` / `#F4F0FF`        |
| `--mk-primary` / `--mk-primary-hover`        | `#7C3AED` / `#6D28D9`                    |
| `--mk-soft` / `--mk-soft-2`                  | `#EDE9FE` / `#DDD6FE`                    |
| `--mk-heading` / `--mk-body` / `--mk-border` | `#1E1B2E` / `#5B5675` / `#E9E4F5`        |
| `--mk-wa`                                    | `#25D366` (WhatsApp mock UI only)        |
| `--mk-shadow`                                | `0 10px 40px -12px rgba(124,58,237,.25)` |
| radius                                       | 12–16 px cards, full pills               |

Typography: **Plus Jakarta Sans** via `next/font` (self-hosted at build time; the same family as the logo lettering), with tight tracking on headings and 1.6 body line height. Motion: fade/slide on scroll and hover lift, disabled under `prefers-reduced-motion`. AA contrast, visible focus rings, mobile-first (checked at 360 px).

## 5. Components (`src/components/marketing/`)

`Container`, `Section`, `SectionHeader`, `Button` (primary/secondary/ghost), `Badge`, `FeatureCard`, `StatTile`, `PricingCard`, `FaqAccordion`, `LogoMarquee`, `CtaBand`, `ToolCard`, `Navbar` (dropdowns, mobile drawer), `QuickLinks` (free-tool pills above the footer), `Footer`, plus CSS/SVG product mocks (inbox, flow, broadcast, AI draft).

Data files (README section "Editing the marketing site"):

- `src/content/marketing/plans.config.ts`
- `changelog.ts`
- `faq.ts`
- `logos.ts` (placeholders)
- `tools.ts`
- `countries.ts`

## 6. Dependencies

| Dependency                                     | Why                         | Notes                                                 |
| ---------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| `qrcode` (pinned)                              | QR generation (PNG and SVG) | Small, no runtime dependencies                        |
| `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react` | MDX blog posts              | Official Next integration                             |
| **Not added:** a PDF library                   | jsPDF is ~300 KB            | QR download as **PNG + SVG**; PDF only if you want it |
| **Not added:** an emoji-picker library         | Typical pickers are 100 KB+ | A small built-in curated emoji palette instead        |

The country list (dial codes and flags) is a static data file; flags are emoji.

## 7. Content rules

- **Never claimed:** Meta Business Partner status, SOC 2, Instagram/Messenger, AI calling, customer counts, "green tick included".
- **Placeholders, clearly labelled:** logo strip, stats, testimonials.
- **Plan prices are placeholders** until you give real ones; billing (Phase 3) replaces `plans.config.ts`.

## 8. Order (after approval)

1. Tokens, components, navbar/footer, host-aware proxy
2. Home
3. The 4 free tools + `/tools` hub, with unit tests for number normalisation and URL encoding
4. Pricing and feature pages
5. Legal / contact / blog scaffolds
6. SEO, a11y and Lighthouse pass, then `docs/deploy-dokploy.md`

Gates at every step: typecheck, lint, vitest, build.

## 9. Decisions needed

1. **Hosting:** one deployment with host routing (recommended), or two services?
2. **Prices and currency** for Free / Growth / Pro / Business, monthly and yearly (INR? also USD?). Or ship labelled placeholders for now?
3. **Brand name in copy:** "Automate Panu AI" everywhere? Your brief says "wacrm", but you've since named the product.
4. **Optional extras:** QR PDF download? The three optional tools?
5. **Contact details** for the contact page and footer: email, social links (or placeholders).

---

## Status: approved; Phase 1 done

**Your decisions:**

- One deployment, with host redirects that skip all of `/api/*` (Meta webhook, `/api/v1`, `/api/auth`).
- Host-only session cookies on `chat.axxeler.in`.
- "Coming soon" placeholder prices in `plans.config.ts`.
- One brand config (`src/config/brand.ts`).
- The core 4 tools first.

**Phase 1 (done):**

- Tokens (`.mk` scope in `globals.css`); components in `src/components/marketing/`.
- Navbar (dropdowns, mobile drawer), footer and quick links.
- Home page with all 14 sections, JSON-LD (Organization, WebSite, FAQPage) and an `opengraph-image`.
- Host routing in `src/proxy.ts`, tested by 47 unit tests and 9 proxy tests.

**Corrections to the brief (only shipped features are claimed):**

- _Multi-number WhatsApp_ is not built yet (Phase 2). It's shown with a "Coming soon" badge, and the announcement pill uses a shipped feature (AI auto-reply with handoff).
- _Hero trust ticks:_ "free trial / no credit card / live in 20 minutes" can't be verified yet, so they became true product facts: official Cloud API, bring-your-own AI key, team roles.
- _Stats row:_ true product facts (4 roles, 3 AI provider types, 4 languages, official API) instead of placeholder business numbers.

**Measured** (production build, local Lighthouse 12.8.2):

|                         | Performance          | Accessibility | Best practices | SEO     |
| ----------------------- | -------------------- | ------------- | -------------- | ------- |
| Desktop                 | **100**              | **100**       | 96             | **100** |
| Mobile (412 px, 4× CPU) | 86–90 on quiet runs* | **100**       | 96             | **100** |
| 360 px                  | n/a                  | **100**       | n/a            | **100** |

\* Mobile Performance swings by ±25 points between identical runs on this machine (TBT 230 ms → 1.8 s) while Docker workloads run alongside; re-measure on the server or with PageSpeed Insights after deploy. CLS is 0 everywhere.

**Performance fixes along the way:**

1. next-intl messages were sent from the root layout with the _entire app catalogue_ on every page. Now each route group provides only its own namespaces, and the home HTML went from 359 KB to 230 KB.
2. Inter (the app font) is no longer preloaded on every page.
3. Blur-filter glows were replaced by radial gradients.
4. Scroll reveal is progressive (content is visible without JS and for crawlers).

**Tried and reverted:** `experimental.inlineCss`. It inlines the whole app's CSS (compressed HTML 37 KB → 121 KB) for a ~0.4 s LCP gain.

**Remaining for the Lighthouse ≥95 mobile target (SEO/a11y pass at the end):**

- Split marketing CSS from the app's Tailwind bundle.
- Defer hydration of below-the-fold islands (pricing toggle, use-case tabs).
- Measure on real infrastructure.

**Best practices 96** is caused only by prefetch 404s for `/pricing` and `/changelog`, which arrive in the next steps.
