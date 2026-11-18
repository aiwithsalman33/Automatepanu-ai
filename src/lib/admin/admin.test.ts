import { describe, expect, it } from 'vitest';

import { ACCOUNT_DISABLED_CODE, blockDisabledUsers } from '@/lib/auth/native/auth';
import { describeUserAgent, fmtRelative, initials, weekChange } from './format';
import { isUuid, likePattern, parseUserFilter } from './queries';
import { systemChecks } from './system';

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe('blockDisabledUsers (session create hook)', () => {
  const pool = (disabled_at: Date | null) => ({
    query: async () => ({ rows: [{ disabled_at }] }),
  });

  it('lets an enabled user through', async () => {
    await expect(blockDisabledUsers(pool(null) as never)({ userId: 'u' })).resolves.toBeUndefined();
  });

  it('rejects a disabled user with the ACCOUNT_DISABLED code', async () => {
    await expect(
      blockDisabledUsers(pool(new Date()) as never)({ userId: 'u' })
    ).rejects.toMatchObject({ body: { code: ACCOUNT_DISABLED_CODE } });
  });
});

describe('queries helpers', () => {
  it('escapes LIKE wildcards', () => {
    expect(likePattern('a_b%c\\')).toBe('%a\\_b\\%c\\\\%');
  });

  it('parses only known filters', () => {
    expect(parseUserFilter('disabled')).toBe('disabled');
    expect(parseUserFilter("all' OR 1=1")).toBe('all');
    expect(parseUserFilter(undefined)).toBe('all');
  });

  it('recognises UUIDs', () => {
    expect(isUuid('5f0c4c2e-8a5b-4f7e-9d2a-1b3c4d5e6f70')).toBe(true);
    expect(isUuid('../etc/passwd')).toBe(false);
  });
});

describe('format helpers', () => {
  it('week-over-week change', () => {
    expect(weekChange(15, 10)).toEqual({ percent: 50, trend: 'up' });
    expect(weekChange(5, 10)).toEqual({ percent: -50, trend: 'down' });
    expect(weekChange(3, 0)).toEqual({ percent: null, trend: 'up' });
    expect(weekChange(0, 0)).toEqual({ percent: null, trend: 'flat' });
  });

  it('relative time', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(fmtRelative(null, now)).toBe('never');
    expect(fmtRelative('2026-11-17T11:59:30Z', now)).toBe('just now');
    expect(fmtRelative('2026-11-17T09:00:00Z', now)).toBe('3 h ago');
    expect(fmtRelative('2026-11-16T12:00:00Z', now)).toBe('1 day ago');
  });

  it('user agents', () => {
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')
    ).toBe('Chrome on Windows');
    expect(describeUserAgent(null)).toBe('Unknown device');
  });

  it('initials', () => {
    expect(initials('Platform Admin', 'x@y.z')).toBe('PA');
    expect(initials('', 'john.doe@example.com')).toBe('JD');
  });
});

describe('systemChecks', () => {
  it('flags missing and template values without exposing them', () => {
    const checks = systemChecks(
      env({
        NODE_ENV: 'production',
        AUTH_SECRET: 'change-me-at-least-32-chars-hex',
        META_APP_SECRET: 'a-real-secret-value',
      })
    );
    const by = Object.fromEntries(checks.map((c) => [c.key, c]));
    expect(by.AUTH_SECRET.state).toBe('placeholder');
    expect(by.META_APP_SECRET.state).toBe('ok');
    expect(by.SMTP_HOST.state).toBe('missing');
    expect(by.REDIS_URL.state).toBe('missing');
    expect(JSON.stringify(checks)).not.toContain('a-real-secret-value');
  });
});
