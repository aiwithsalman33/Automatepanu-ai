/**
 * Host-based routing for ONE deployment serving two domains:
 *
 *   marketing host (automatepanuai.axxeler.in)  → public site
 *   app host       (chat.axxeler.in)            → the CRM
 *
 * Pure function so every rule is unit-tested; src/proxy.ts applies it.
 *
 * Rules
 *  - NEVER redirected: every /api/* route (Meta's /api/whatsapp/webhook,
 *    the public /api/v1, /api/auth, …), Next internals, metadata files
 *    and static assets. Those must answer on whichever host they're hit.
 *  - Marketing host: marketing pages are served; any other page path is
 *    sent to the app host (same path + query).
 *  - App host: marketing pages are sent to the marketing host, except
 *    `/`, which becomes the app's entry point (dashboard or login).
 *  - Marketing pages never need a session, so the proxy skips the auth
 *    lookup for them (fast, cacheable public pages).
 *  - If either domain isn't configured, or the request arrives on some
 *    other host (localhost, a preview URL, the server IP), nothing is
 *    redirected: single-domain mode, everything served from one host.
 */

/** Top-level path segments that belong to the marketing site. */
export const MARKETING_SEGMENTS = [
  'features',
  'solutions',
  'tools',
  'about',
  'contact',
  'docs',
  'changelog',
  'privacy',
  'terms',
  'refund-policy',
  'cookies',
] as const;

/** Paths that are served on any host and never redirected. */
const ALWAYS_PASS_PREFIXES = ['/api/', '/_next/', '/.well-known/'];
const ALWAYS_PASS_EXACT = new Set([
  '/api',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.webmanifest',
]);

export function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  const first = pathname.split('/')[1] ?? '';
  return (MARKETING_SEGMENTS as readonly string[]).includes(first);
}

export function isAlwaysPassPath(pathname: string): boolean {
  if (ALWAYS_PASS_EXACT.has(pathname)) return true;
  if (ALWAYS_PASS_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // opengraph-image / twitter-image metadata routes, at any depth
  if (/\/(opengraph|twitter)-image(\.[a-z]+)?$/.test(pathname)) return true;
  // static files (have an extension in the last segment)
  return /\.[a-z0-9]{2,5}$/i.test(pathname.split('/').pop() ?? '');
}

export interface HostRoutingConfig {
  /** e.g. https://automatepanuai.axxeler.in (null = not configured) */
  marketingOrigin: string | null;
  /** e.g. https://chat.axxeler.in (null = not configured) */
  appOrigin: string | null;
}

export type HostDecision =
  /** serve without touching auth (public marketing page / pass-through) */
  | { kind: 'public' }
  /** continue into the app's normal (auth-aware) handling */
  | { kind: 'app' }
  /** app host root: send to the app's entry (dashboard if signed in, else login) */
  | { kind: 'app-root' }
  | { kind: 'redirect'; location: string; status: 308 };

function hostOf(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export function decideHostRouting(
  req: { host: string | null; pathname: string; search: string },
  cfg: HostRoutingConfig
): HostDecision {
  const { pathname, search } = req;
  if (isAlwaysPassPath(pathname)) return { kind: 'app' };

  const marketing = isMarketingPath(pathname);
  const marketingHost = hostOf(cfg.marketingOrigin);
  const appHost = hostOf(cfg.appOrigin);
  const host = (req.host ?? '').toLowerCase();
  const split = !!marketingHost && !!appHost && marketingHost !== appHost;

  if (split && host === marketingHost) {
    if (marketing) return { kind: 'public' };
    return {
      kind: 'redirect',
      location: `${cfg.appOrigin}${pathname}${search}`,
      status: 308,
    };
  }

  if (split && host === appHost) {
    if (pathname === '/') return { kind: 'app-root' };
    if (marketing) {
      return {
        kind: 'redirect',
        location: `${cfg.marketingOrigin}${pathname}${search}`,
        status: 308,
      };
    }
    return { kind: 'app' };
  }

  // Single-domain mode (or an unknown host): serve everything here.
  return marketing ? { kind: 'public' } : { kind: 'app' };
}
