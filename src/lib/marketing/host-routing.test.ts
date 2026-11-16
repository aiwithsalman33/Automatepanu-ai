import { describe, expect, it } from 'vitest';
import {
  decideHostRouting,
  isAlwaysPassPath,
  isMarketingPath,
} from './host-routing';

const cfg = {
  marketingOrigin: 'https://automatepanuai.axxeler.in',
  appOrigin: 'https://chat.axxeler.in',
};
const MK = 'automatepanuai.axxeler.in';
const APP = 'chat.axxeler.in';
const at = (host: string | null, pathname: string, search = '') =>
  decideHostRouting({ host, pathname, search }, cfg);

describe('APIs are never redirected, on either host', () => {
  it.each([
    '/api/whatsapp/webhook',
    '/api/v1/messages',
    '/api/v1/contacts/123',
    '/api/v1/me',
    '/api/auth/sign-in/email',
    '/api/automations/cron',
    '/api/flows/cron',
    '/api/contact',
    '/api',
  ])('%s', (path) => {
    for (const host of [MK, APP, 'localhost:3000', null]) {
      expect(at(host, path).kind, `${host}${path}`).toBe('app');
    }
  });

  it('webhook with Meta verification query string stays put on the marketing host', () => {
    expect(
      at(MK, '/api/whatsapp/webhook', '?hub.mode=subscribe&hub.challenge=1')
    ).toEqual({ kind: 'app' });
  });
});

describe('static assets and metadata routes pass through', () => {
  it.each([
    '/_next/static/chunks/main.js',
    '/robots.txt',
    '/sitemap.xml',
    '/icon.png',
    '/apple-icon.png',
    '/brand/logo.png',
    '/opus/encoderWorker.min.js',
    '/opengraph-image',
    '/tools/whatsapp-link-generator/opengraph-image',
  ])('%s', (path) => {
    expect(isAlwaysPassPath(path)).toBe(true);
    expect(at(MK, path).kind).toBe('app');
    expect(at(APP, path).kind).toBe('app');
  });
});

describe('marketing host', () => {
  it.each([
    '/',
    '/features/inbox',
    '/features/inbox',
    '/tools',
    '/tools/whatsapp-qr-code-generator',
    '/docs',
    '/privacy',
  ])('serves marketing page %s publicly (no auth lookup)', (path) => {
    expect(at(MK, path)).toEqual({ kind: 'public' });
  });

  it.each([
    ['/login', ''],
    ['/signup', '?invite=abc'],
    ['/dashboard', ''],
    ['/inbox', '?c=42'],
    ['/join/tok123', ''],
    ['/auth/callback', '?code=x&next=/dashboard'],
  ])(
    'sends app page %s%s to the app host, keeping path and query',
    (path, search) => {
      expect(at(MK, path, search)).toEqual({
        kind: 'redirect',
        location: `https://chat.axxeler.in${path}${search}`,
        status: 308,
      });
    }
  );

  it('is case-insensitive on the Host header', () => {
    expect(at('AutomatePanuAI.Axxeler.in', '/features/inbox')).toEqual({
      kind: 'public',
    });
  });
});

describe('app host', () => {
  it('root becomes the app entry point', () => {
    expect(at(APP, '/')).toEqual({ kind: 'app-root' });
  });

  it.each([
    '/features/inbox',
    '/tools/whatsapp-text-formatter',
    '/features/flows',
    '/about',
  ])('sends marketing page %s to the marketing host', (path) => {
    expect(at(APP, path, '?ref=x')).toEqual({
      kind: 'redirect',
      location: `https://automatepanuai.axxeler.in${path}?ref=x`,
      status: 308,
    });
  });

  it.each([
    '/dashboard',
    '/login',
    '/settings',
    '/join/abc',
    '/reset-password',
  ])('serves app page %s', (path) => {
    expect(at(APP, path)).toEqual({ kind: 'app' });
  });
});

describe('single-domain mode and unknown hosts never redirect', () => {
  it('unknown host (IP / localhost / preview) serves everything', () => {
    for (const host of [
      'localhost:3000',
      '203.0.113.7',
      'preview.example.com',
      null,
    ]) {
      expect(at(host, '/')).toEqual({ kind: 'public' });
      expect(at(host, '/features/inbox')).toEqual({ kind: 'public' });
      expect(at(host, '/dashboard')).toEqual({ kind: 'app' });
    }
  });

  it('either origin unset → single-domain', () => {
    const single = {
      marketingOrigin: null,
      appOrigin: 'https://chat.axxeler.in',
    };
    expect(
      decideHostRouting({ host: APP, pathname: '/features/inbox', search: '' }, single)
    ).toEqual({ kind: 'public' });
    expect(
      decideHostRouting({ host: APP, pathname: '/', search: '' }, single)
    ).toEqual({ kind: 'public' });
  });

  it('same origin for both → single-domain (no redirect loop)', () => {
    const same = {
      marketingOrigin: 'https://x.test',
      appOrigin: 'https://x.test',
    };
    expect(
      decideHostRouting(
        { host: 'x.test', pathname: '/login', search: '' },
        same
      )
    ).toEqual({ kind: 'app' });
    expect(
      decideHostRouting(
        { host: 'x.test', pathname: '/features/inbox', search: '' },
        same
      )
    ).toEqual({ kind: 'public' });
  });
});

describe('isMarketingPath', () => {
  it('matches whole segments only', () => {
    expect(isMarketingPath('/features/inbox')).toBe(true);
    expect(isMarketingPath('/features-old')).toBe(false);
    expect(isMarketingPath('/toolsy')).toBe(false);
    expect(isMarketingPath('/settings')).toBe(false);
  });
});
