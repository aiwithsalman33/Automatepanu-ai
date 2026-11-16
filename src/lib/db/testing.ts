/**
 * Test helper: build a `@/lib/db/server` mock from a fake client that
 * looks like the old cookie client (`auth.getUser()` + `from()`/`rpc()`).
 * Lets route tests keep their existing fakes:
 *
 *   vi.mock('@/lib/db/server', async () =>
 *     (await import('@/lib/db/testing')).requestDbMock({
 *       createClient: async () => fakeClient,
 *     }))
 *
 * serviceDb() returns `serviceClient()` when given, else the result of
 * `@supabase/supabase-js`'s createClient, so tests that mocked that module
 * for the service role keep working unchanged.
 *
 * Only imported by tests.
 */
import { createClient as createSupabaseJs } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FakeUserClient {
  auth?: { getUser: () => Promise<{ data: { user: any }; error?: any }> };
  [k: string]: any;
}

export function requestDbMock(opts: {
  createClient: () => FakeUserClient | Promise<FakeUserClient>;
  serviceClient?: () => any;
}) {
  const getRequestDb = async () => {
    const client = await opts.createClient();
    const res = client.auth
      ? await client.auth.getUser()
      : { data: { user: null }, error: null };
    const user = res.error || !res.data?.user ? null : res.data.user;
    return {
      db: client,
      user: user ? { id: user.id, email: user.email ?? null } : null,
    };
  };
  const serviceDb = () => {
    if (opts.serviceClient) return opts.serviceClient();
    // A test's own vi.mock of supabase-js applies to this import too.
    return createSupabaseJs('http://test.invalid', 'test');
  };
  return {
    getRequestDb,
    serviceDb,
    // The fake service client's `.storage`, when it has one.
    serviceStorage: () => serviceDb()?.storage ?? null,
    anonDb: async () => (await opts.createClient()) as any,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
