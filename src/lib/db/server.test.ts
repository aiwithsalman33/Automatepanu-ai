import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER = '11111111-2222-4333-8444-555555555555';

const ssrClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
  schema: vi.fn(),
};
const supabaseJsClient = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { tag: 'storage' },
};
const nativeUser = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: 'x=1' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ssrClient),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseJsClient),
}));
vi.mock('@/lib/auth/native/session', () => ({
  getNativeSessionUser: (...a: unknown[]) => nativeUser(...a),
}));

import { dataBackend } from './backend';
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
  ssrClient.auth.getUser.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('dataBackend', () => {
  it('defaults to supabase and rejects unknown values', () => {
    vi.stubEnv('DATA_BACKEND', '');
    expect(dataBackend()).toBe('supabase');
    vi.stubEnv('DATA_BACKEND', 'SelfHosted');
    expect(dataBackend()).toBe('selfhosted');
    vi.stubEnv('DATA_BACKEND', 'mongo');
    expect(() => dataBackend()).toThrow(/DATA_BACKEND/);
  });
});

describe('supabase backend (production today)', () => {
  beforeEach(() => vi.stubEnv('DATA_BACKEND', 'supabase'));

  it('getRequestDb uses the SSR cookie client and its user', async () => {
    ssrClient.auth.getUser.mockResolvedValue({
      data: { user: { id: USER, email: 'a@x.test' } },
      error: null,
    });
    const r = await getRequestDb();
    expect(r.db).toBe(ssrClient);
    expect(r.user).toEqual({ id: USER, email: 'a@x.test' });
  });

  it('getRequestDb returns no user on an auth error', async () => {
    ssrClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('expired'),
    });
    expect((await getRequestDb()).user).toBeNull();
  });

  it('serviceDb / serviceStorage use the service-role client', () => {
    expect(serviceDb()).toBe(supabaseJsClient);
    expect(serviceStorage()).toBe(supabaseJsClient.storage);
  });
});

describe('selfhosted backend', () => {
  beforeEach(() => {
    vi.stubEnv('DATA_BACKEND', 'selfhosted');
    vi.stubEnv('POSTGREST_URL', 'http://postgrest:3000/');
    vi.stubEnv('POSTGREST_JWT_SECRET', 's'.repeat(40));
  });

  it('user requests go to PostgREST as wacrm_app with sub = user id', async () => {
    nativeUser.mockResolvedValue({ id: USER, email: 'a@x.test' });
    const spy = fetchSpy();
    const { db, user } = await getRequestDb();
    expect(user).toEqual({ id: USER, email: 'a@x.test' });
    expect(ssrClient.auth.getUser).not.toHaveBeenCalled();

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
    await db.from('whatsapp_configs').select('*');
    await db.from('whatsapp_configs').select('*');
    const c = claimsOf(spy.mock.calls[0][1]);
    expect(c.role).toBe('wacrm_service');
    expect(c).not.toHaveProperty('sub');
    expect(spy.mock.calls[1][1]).toBeDefined();
  });

  it('has no object storage until checkpoint 1f', () => {
    expect(serviceStorage()).toBeNull();
  });

  it('fails loudly when PostgREST is not configured', () => {
    vi.stubEnv('POSTGREST_URL', '');
    expect(() => serviceDb()).toThrow(/POSTGREST_URL/);
  });
});
