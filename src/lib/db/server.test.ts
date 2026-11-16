import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER = '11111111-2222-4333-8444-555555555555';

const nativeUser = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: 'x=1' }),
}));
vi.mock('@/lib/auth/native/session', () => ({
  getNativeSessionUser: (...a: unknown[]) => nativeUser(...a),
}));

import { resetRestClients } from './postgrest';
import { getRequestDb, serviceDb, serviceStorage } from './server';

function fetchSpy() {
  const spy = vi.fn<typeof fetch>(
    async () =>
      new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function claimsOf(init: RequestInit | undefined) {
  const auth = new Headers(init?.headers).get('authorization') ?? '';
  const token = auth.replace(/^Bearer /, '');
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

beforeEach(() => {
  resetRestClients();
  nativeUser.mockReset();
  vi.stubEnv('POSTGREST_URL', 'http://postgrest:3000/');
  vi.stubEnv('POSTGREST_JWT_SECRET', 's'.repeat(40));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('server data layer', () => {
  it('user requests go to PostgREST as wacrm_app with sub = user id', async () => {
    nativeUser.mockResolvedValue({ id: USER, email: 'a@x.test' });
    const spy = fetchSpy();
    const { db, user } = await getRequestDb();
    expect(user).toEqual({ id: USER, email: 'a@x.test' });

    await db.from('contacts').select('id').eq('account_id', 'a');
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toMatch(
      /^http:\/\/postgrest:3000\/contacts\?select=id&account_id=eq\.a$/
    );
    const claims = claimsOf(init);
    expect(claims.role).toBe('wacrm_app');
    expect(claims.sub).toBe(USER);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(60);
  });

  it('no session means an anonymous client and no user', async () => {
    nativeUser.mockResolvedValue(null);
    const spy = fetchSpy();
    const { db, user } = await getRequestDb();
    expect(user).toBeNull();
    await db.rpc('peek_invitation', { p_token_hash: 'h' });
    expect(claimsOf(spy.mock.calls[0][1]).role).toBe('wacrm_anon');
  });

  it('serviceDb signs wacrm_service tokens with no user id, fresh per request', async () => {
    const spy = fetchSpy();
    const db = serviceDb();
    await db.from('whatsapp_config').select('*');
    await db.from('whatsapp_config').select('*');
    const c = claimsOf(spy.mock.calls[0][1]);
    expect(c.role).toBe('wacrm_service');
    expect(c).not.toHaveProperty('sub');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('has no object storage until checkpoint 1f', () => {
    expect(serviceStorage()).toBeNull();
  });

  it('fails loudly when PostgREST is not configured', () => {
    vi.stubEnv('POSTGREST_URL', '');
    expect(() => serviceDb()).toThrow(/POSTGREST_URL/);
  });
});
