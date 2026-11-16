import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

// --- Scenario knobs ---------------------------------------------------------
// `sessionUser` — what the session lookup (validated against the sessions
//                 table) returns for a request that carries a cookie.
let sessionUser: { id: string } | null = null;
let lookups = 0;

vi.mock('@/lib/auth/native/session', () => ({
  getNativeSessionUser: async () => {
    lookups++;
    return sessionUser;
  },
}));

const { proxy } = await import('./proxy');

const COOKIE = 'wacrm.session_token=tok.sig';

function req(url: string, opts: { cookie?: boolean; method?: string } = {}) {
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers: opts.cookie === false ? {} : { cookie: COOKIE },
  });
}

beforeEach(() => {
  sessionUser = null;
  lookups = 0;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_MARKETING_URL;
});

describe('proxy — native session', () => {
  it('redirects a signed-in user off /login to /dashboard', async () => {
    sessionUser = { id: 'user-1' };
    const res = await proxy(req('https://app.test/login'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
  });

  it('redirects a signed-in user with an invite token to /join/<token>', async () => {
    sessionUser = { id: 'user-1' };
    const res = await proxy(req('https://app.test/login?invite=abc123'));
    expect(res.headers.get('location')).toContain('/join/abc123');
  });

  it('lets a signed-in user through to a protected page', async () => {
    sessionUser = { id: 'user-1' };
    const res = await proxy(req('https://app.test/dashboard'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('a revoked/expired cookie counts as signed out (no redirect loop)', async () => {
    sessionUser = null; // cookie present, but the session row is gone
    const login = await proxy(req('https://app.test/login'));
    expect(login.headers.get('location')).toBeNull();
    const dash = await proxy(req('https://app.test/dashboard'));
    expect(new URL(dash.headers.get('location')!).pathname).toBe('/login');
  });

  it('skips the database entirely when there is no session cookie', async () => {
    const res = await proxy(
      req('https://app.test/dashboard', { cookie: false })
    );
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    expect(lookups).toBe(0);
  });

  it('401s cookie-authenticated /api/whatsapp/* without a session', async () => {
    const res = await proxy(
      req('https://app.test/api/whatsapp/config', { cookie: false })
    );
    expect(res.status).toBe(401);
  });

  it('lets /api/whatsapp/* through with a valid session (smoke-test regression)', async () => {
    sessionUser = { id: 'user-1' };
    const res = await proxy(req('https://app.test/api/whatsapp/config'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it.each([
    ['GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=42'],
    ['POST', '/api/whatsapp/webhook'],
    ['GET', '/api/v1/me'],
    ['POST', '/api/v1/messages'],
    ['POST', '/api/auth/sign-in/email'],
    ['POST', '/api/data/contacts'],
  ])('never gates %s %s (each authenticates itself)', async (method, path) => {
    const res = await proxy(
      req(`https://app.test${path}`, { method, cookie: false })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(lookups).toBe(0);
  });
});

describe('proxy — every dashboard route requires a session', () => {
  // Read the route group rather than hard-coding a list, so a new page added
  // under src/app/(dashboard)/ fails here until it is added to
  // PROTECTED_PATHS.
  const dashboardRoutes = readdirSync(join(__dirname, 'app', '(dashboard)'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`);

  it('finds the dashboard route group', () => {
    expect(dashboardRoutes).toContain('/dashboard');
  });

  it.each(dashboardRoutes)(
    'redirects a signed-out visitor from %s to /login',
    async (route) => {
      const res = await proxy(req(`https://app.test${route}`));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    }
  );
});

describe('proxy — one deployment, two domains', () => {
  const MK = 'https://automatepanuai.axxeler.in';
  const APP = 'https://chat.axxeler.in';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = MK;
    process.env.NEXT_PUBLIC_APP_URL = APP;
  });

  it('serves marketing pages on the marketing host WITHOUT a session lookup', async () => {
    for (const path of ['/', '/features/inbox', '/tools/whatsapp-link-generator']) {
      const res = await proxy(req(`${MK}${path}`));
      expect(res.headers.get('location'), path).toBeNull();
      expect(res.status).toBe(200);
    }
    expect(lookups).toBe(0);
  });

  it('sends app pages on the marketing host to the app host (308, path + query kept)', async () => {
    const res = await proxy(req(`${MK}/login?invite=tok`));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${APP}/login?invite=tok`);
    expect(lookups).toBe(0);
  });

  it('sends marketing pages on the app host to the marketing host', async () => {
    const res = await proxy(req(`${APP}/features/inbox`));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`${MK}/features/inbox`);
  });

  it('app host root → /login when signed out, /dashboard when signed in', async () => {
    let res = await proxy(req(`${APP}/`));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    sessionUser = { id: 'u1' };
    res = await proxy(req(`${APP}/`));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
  });

  it.each([
    ['GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=42'],
    ['POST', '/api/whatsapp/webhook'],
    ['GET', '/api/v1/me'],
    ['POST', '/api/v1/messages'],
  ])('never redirects %s %s on either host', async (method, path) => {
    for (const origin of [MK, APP]) {
      const res = await proxy(req(`${origin}${path}`, { method }));
      expect(res.status, `${origin}${path}`).not.toBe(308);
      expect(res.headers.get('location')).toBeNull();
    }
  });
});
