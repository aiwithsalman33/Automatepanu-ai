/**
 * Tripwires on the native-auth configuration. These fail the build if
 * someone ever weakens CSRF protection, widens the trusted origins, or
 * scopes session cookies beyond the app host.
 */
import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { brand } from '@/config/brand';
import { authTrustedOrigins, nativeAuthOptions } from './auth';

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

function opts(trustedOrigins = ['https://chat.axxeler.in']) {
  return nativeAuthOptions({
    pool: {} as Pool,
    mailer: { send: async () => {} },
    secret: 'x'.repeat(40),
    baseURL: 'https://chat.axxeler.in',
    trustedOrigins,
    production: true,
  });
}

describe('CSRF protection can never be disabled', () => {
  const advanced = opts().advanced as Record<string, unknown>;

  it('origin check is explicitly ON (Better Auth turns it off in test envs when unset)', () => {
    expect(advanced.disableOriginCheck).toBe(false);
  });

  it('the separate CSRF check is not disabled', () => {
    expect(advanced.disableCSRFCheck).not.toBe(true);
  });

  it('no option anywhere disables origin/CSRF checks', () => {
    const json = JSON.stringify(opts());
    expect(json).not.toMatch(/"disableCSRFCheck":true/);
    expect(json).not.toMatch(/"disableOriginCheck":true/);
  });
});

describe('trusted origins: only the real app domain', () => {
  it('production env → exactly https://chat.axxeler.in', () => {
    expect(
      authTrustedOrigins(
        env({
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'https://chat.axxeler.in',
          NEXT_PUBLIC_MARKETING_URL: 'https://automatepanuai.axxeler.in',
        })
      )
    ).toEqual(['https://chat.axxeler.in']);
  });

  it('defaults to the brand app domain', () => {
    expect(authTrustedOrigins(env({ NODE_ENV: 'production' }))).toEqual([
      brand.urls.app,
    ]);
    expect(brand.urls.app).toBe('https://chat.axxeler.in');
  });

  it('never includes the marketing domain or a wildcard', () => {
    const origins = authTrustedOrigins(
      env({
        NODE_ENV: 'production',
        NEXT_PUBLIC_MARKETING_URL: 'https://automatepanuai.axxeler.in',
      })
    );
    expect(origins).not.toContain('https://automatepanuai.axxeler.in');
    expect(origins.some((o) => o.includes('*'))).toBe(false);
    expect(origins).toHaveLength(1);
  });

  it('strips paths and keeps only the origin', () => {
    expect(
      authTrustedOrigins(
        env({
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'https://chat.axxeler.in/login?x=1',
        })
      )
    ).toEqual(['https://chat.axxeler.in']);
  });

  it('refuses plain http in production', () => {
    expect(() =>
      authTrustedOrigins(
        env({
          NODE_ENV: 'production',
          NEXT_PUBLIC_APP_URL: 'http://chat.axxeler.in',
        })
      )
    ).toThrow(/https/);
  });

  it('the options pass the list through unchanged', () => {
    expect(opts().trustedOrigins).toEqual(['https://chat.axxeler.in']);
  });
});

describe('session cookies are host-only (chat.axxeler.in, not .axxeler.in)', () => {
  const advanced = opts().advanced as Record<string, unknown>;

  it('cross-subdomain cookies are explicitly disabled', () => {
    expect(advanced.crossSubDomainCookies).toEqual({ enabled: false });
  });

  it('no cookie Domain attribute is configured anywhere', () => {
    expect(JSON.stringify(opts())).not.toMatch(/"domain"\s*:/i);
  });

  it('secure cookies in production', () => {
    expect(advanced.useSecureCookies).toBe(true);
  });
});
