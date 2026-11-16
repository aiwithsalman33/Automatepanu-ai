/**
 * Shared implementation of POST /api/data/<table> and
 * POST /api/data/rpc/<fn>: session → validation → RLS-scoped query.
 */
import { NextResponse } from 'next/server';

import { isSameOrigin } from '@/lib/api/same-origin';
import { getCurrentAccount } from '@/lib/auth/account';
import { getRequestDb } from '@/lib/db/server';

import { executeDataRequest } from './execute';
import type { DataError, DataResponse } from './protocol';
import { DATA_RPCS, DATA_TABLES } from './registry';
import { DataRequestError, validateRequest } from './validate';

function fail(status: number, message: string, code = ''): NextResponse {
  const error: DataError = { message, code, details: null, hint: null };
  return NextResponse.json(
    { data: null, error, count: null, status } satisfies DataResponse,
    { status }
  );
}

export async function handleDataRequest(
  request: Request,
  table: string
): Promise<NextResponse> {
  if (!isSameOrigin(request)) return fail(403, 'Cross-origin request refused');
  const body = await request.json().catch(() => null);

  let req;
  try {
    req = validateRequest(table, body);
  } catch (err) {
    if (err instanceof DataRequestError) return fail(err.status, err.message);
    throw err;
  }

  const { db, user } = await getRequestDb();
  if (!user) return fail(401, 'Not signed in', '401');

  // Only inserts that stamp tenant columns need the account lookup.
  let accountId = '';
  const stamps = DATA_TABLES[table].stamp?.account;
  if (stamps && (req.op === 'insert' || req.op === 'upsert')) {
    try {
      accountId = (await getCurrentAccount()).accountId;
    } catch {
      return fail(403, 'Your account could not be resolved', '42501');
    }
  }

  const res = await executeDataRequest(db, table, req, {
    userId: user.id,
    accountId,
  });
  return NextResponse.json(res, {
    status: res.error ? Math.max(res.status, 400) : 200,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function handleRpcRequest(
  request: Request,
  fn: string
): Promise<NextResponse> {
  if (!isSameOrigin(request)) return fail(403, 'Cross-origin request refused');
  const allowed = Object.hasOwn(DATA_RPCS, fn) ? DATA_RPCS[fn] : null;
  if (!allowed) return fail(404, `Unknown function "${fn}"`);

  const body = (await request.json().catch(() => null)) as {
    args?: Record<string, unknown>;
  } | null;
  const args = body?.args ?? {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    return fail(400, 'Bad arguments');
  }
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) return fail(400, `Unknown argument ${key}`);
  }

  const { db, user } = await getRequestDb();
  if (!user) return fail(401, 'Not signed in', '401');

  const res = await db.rpc(fn, args);
  const error = res.error
    ? {
        message: res.error.message,
        code: res.error.code ?? '',
        details: res.error.details ?? null,
        hint: res.error.hint ?? null,
      }
    : null;
  const status = res.status ?? (error ? 400 : 200);
  return NextResponse.json(
    { data: res.data ?? null, error, count: res.count ?? null, status },
    {
      status: error ? Math.max(status, 400) : 200,
      headers: { 'cache-control': 'no-store' },
    }
  );
}
