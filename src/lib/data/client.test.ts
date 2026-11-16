import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClient } from './client';

function stubFetch(body: unknown, status = 200) {
  const spy = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status })
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('browser data client', () => {
  it('serialises a builder chain into one POST to /api/data/<table>', async () => {
    const spy = stubFetch({
      data: [{ id: 1 }],
      error: null,
      count: 3,
      status: 200,
    });
    const res = await createClient()
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('account_id', 'a')
      .in('id', ['1', '2'])
      .search('ann')
      .order('created_at', { ascending: false })
      .range(0, 49);

    expect(res).toEqual({
      data: [{ id: 1 }],
      error: null,
      count: 3,
      status: 200,
    });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/data/contacts');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      op: 'select',
      select: '*',
      count: 'exact',
      filters: [
        ['eq', 'account_id', 'a'],
        ['in', 'id', ['1', '2']],
      ],
      search: { term: 'ann', includeEmail: false },
      order: [['created_at', { ascending: false }]],
      range: [0, 49],
    });
  });

  it('sends writes with their RETURNING select and single()', async () => {
    const spy = stubFetch({
      data: { id: 'x' },
      error: null,
      count: null,
      status: 201,
    });
    await createClient()
      .from('tags')
      .insert({ name: 'vip' })
      .select('id')
      .single();
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({
      op: 'insert',
      values: { name: 'vip' },
      select: 'id',
      single: 'single',
    });
  });

  it('surfaces server errors as { error } (callers keep their handling)', async () => {
    stubFetch(
      {
        data: null,
        error: { message: 'dup', code: '23505', details: null, hint: null },
        count: null,
        status: 409,
      },
      409
    );
    const { data, error } = await createClient()
      .from('tags')
      .insert({ name: 'x' });
    expect(data).toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('turns network failures into an error result, never a throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      })
    );
    const { error } = await createClient().from('tags').select();
    expect(error).toMatchObject({ code: 'network', message: 'offline' });
  });

  it('calls RPCs at /api/data/rpc/<fn>', async () => {
    const spy = stubFetch({
      data: null,
      error: null,
      count: null,
      status: 200,
    });
    await createClient().rpc('touch_presence', { p_status: 'online' });
    expect(spy.mock.calls[0][0]).toBe('/api/data/rpc/touch_presence');
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({
      args: { p_status: 'online' },
    });
  });
});
