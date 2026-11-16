import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import { originOf } from '@/config/brand';
import { decideHostRouting } from '@/lib/marketing/host-routing';
import { getNativeSessionUser } from '@/lib/auth/native/session';

/** Better Auth cookie prefix (src/lib/auth/native/auth.ts `cookiePrefix`). */
const COOKIE_PREFIX = 'wacrm';

// Every top-level route under src/app/(dashboard)/ belongs here —
// proxy.test.ts reads that directory and fails on a missing one.
export const PROTECTED_PATHS = [
  '/dashboard',
  '/inbox',
  '/contacts',
  '/pipelines',
  '/broadcasts',
  '/automations',
  '/flows',
  '/agents',
  '/notifications',
  '/settings',
  // Platform admin panel (the page itself 404s for non-admins).
  '/admin',
];

const AUTH_PAGES = new Set(['/login', '/signup', '/forgot-password']);

/**
 * Session-aware routing. Runs on the Node.js runtime (Next 16 proxy).
 *
 * Session checks are only paid where they decide something: protected
 * pages, auth pages, the app root and the cookie-authenticated
 * /api/whatsapp/* routes. Without a session cookie there is no lookup at
 * all; with one, the session is validated against the database, so a
 * revoked or expired cookie never counts as signed in (and can't cause
 * a /login <-> /dashboard redirect loop). Route handlers still check the
 * session themselves; this is the first fence, not the only one.
 *
 * Never gated: /api/whatsapp/webhook (Meta signs it), /api/v1 (API
 * keys), /api/auth (sign-in itself) and every other /api route (each
 * authenticates on its own).
 */
export async function proxy(request: NextRequest) {
  // One deployment, two domains (src/lib/marketing/host-routing.ts).
  // Decided BEFORE any auth work: public marketing pages never pay for a
  // session lookup, and /api/* is never redirected on either host.
  const hostDecision = decideHostRouting(
    {
      host:
        request.headers.get('x-forwarded-host') ??
        request.headers.get('host') ??
        request.nextUrl.host,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
    },
    {
      marketingOrigin: originOf(process.env.NEXT_PUBLIC_MARKETING_URL),
      appOrigin: originOf(process.env.NEXT_PUBLIC_APP_URL),
    }
  );
  if (hostDecision.kind === 'redirect') {
    return NextResponse.redirect(hostDecision.location, hostDecision.status);
  }
  if (hostDecision.kind === 'public') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.has(pathname);
  const isGatedApi =
    pathname.startsWith('/api/whatsapp/') && !pathname.includes('/webhook');
  const isAppRoot = hostDecision.kind === 'app-root';

  if (!isProtected && !isAuthPage && !isGatedApi && !isAppRoot) {
    return NextResponse.next();
  }

  const signedIn =
    getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX }) !== null &&
    (await getNativeSessionUser(request.headers).catch(() => null)) !== null;

  // App host root (chat.axxeler.in/): straight into the app.
  if (isAppRoot) {
    const url = request.nextUrl.clone();
    url.pathname = signedIn ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Auth pages: signed-in users go to the dashboard, or straight to
  // /join/<token> when an invite token is in the query string, so a
  // forwarded invite link works in one click.
  if (signedIn && isAuthPage) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (inviteToken && pathname !== '/forgot-password') {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
    } else {
      url.pathname = '/dashboard';
    }
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (!signedIn && isGatedApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
