import { describe, expect, it, vi } from 'vitest';

import type { DbClient } from '@/lib/db/types';

import { executeDataRequest } from './execute';
import { validateRequest } from './validate';

/** Records every builder call; resolves to `result`. */
function fakeDb(
  result: Record<string, unknown> = {
    data: [],
    error: null,
    count: null,
    status: 200,
  }
) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const m of [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'in',
    'is',
    'or',
    'order',
    'range',
    'limit',
    'single',
    'maybeSingle',
    'ilikeAnyOf',
  ]) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    });
  }
  builder.then = (res: (v: unknown) => unknown) =>
    Promise.resolve(result).then(res);
  const db = {
    from: vi.fn((t: string) => (calls.push(['from', [t]]), builder)),
  };
  return { db: db as unknown as DbClient, calls };
}

const caller = { userId: 'user-A', accountId: 'acct-A' };

describe('executeDataRequest', () => {
  it('stamps tenant columns from the session, overriding the browser', async () => {
    const { db, calls } = fakeDb();
    const req = validateRequest('tags', {
      op: 'insert',
      values: {
        name: 'vip',
        color: '#f00',
        account_id: 'acct-B',
        user_id: 'user-B',
      },
      select: 'id',
    });
    await executeDataRequest(db, 'tags', req, caller);
    const insert = calls.find(([m]) => m === 'insert')!;
    expect(insert[1][0]).toEqual({
      name: 'vip',
      color: '#f00',
      account_id: 'acct-A',
      user_id: 'user-A',
    });
    expect(calls.find(([m]) => m === 'select')![1]).toEqual(['id']);
  });

  it('does not invent tenant columns on tables without them', async () => {
    const { db, calls } = fakeDb();
    const req = validateRequest('pipeline_stages', {
      op: 'insert',
      values: { pipeline_id: 'p', name: 's', position: 0 },
    });
    await executeDataRequest(db, 'pipeline_stages', req, caller);
    expect(calls.find(([m]) => m === 'insert')![1][0]).toEqual({
      pipeline_id: 'p',
      name: 's',
      position: 0,
    });
  });

  it('builds the same chain the browser used to build', async () => {
    const { db, calls } = fakeDb();
    const req = validateRequest('contacts', {
      op: 'select',
      select: '*',
      count: 'exact',
      filters: [['eq', 'account_id', 'a']],
      search: { term: 'ann', includeEmail: true },
      order: [['created_at', { ascending: false }]],
      range: [0, 49],
    });
    await executeDataRequest(db, 'contacts', req, caller);
    expect(calls.map(([m]) => m)).toEqual([
      'from',
      'select',
      'eq',
      'or',
      'order',
      'range',
    ]);
    expect(calls[1][1]).toEqual(['*', { count: 'exact', head: false }]);
    expect(calls[3][1][0]).toBe('name.ilike.*ann*,email.ilike.*ann*');
  });

  it('passes PostgREST errors through unchanged (code included)', async () => {
    const { db } = fakeDb({
      data: null,
      error: {
        message: 'duplicate key',
        code: '23505',
        details: 'd',
        hint: null,
      },
      count: null,
      status: 409,
    });
    const req = validateRequest('tags', {
      op: 'insert',
      values: { name: 'x' },
    });
    const res = await executeDataRequest(db, 'tags', req, caller);
    expect(res.error).toEqual({
      message: 'duplicate key',
      code: '23505',
      details: 'd',
      hint: null,
    });
    expect(res.status).toBe(409);
  });
});
