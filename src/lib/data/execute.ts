/**
 * Run a validated /api/data request on the caller's RLS-scoped client.
 * The chain is built exactly as the browser used to build it against
 * Supabase, so results (rows, counts, `.single()` errors) are identical.
 */
import { contactSearchFilter } from '@/lib/contacts/search-filter';
import type { DbClient } from '@/lib/db/types';

import type { DataRequest, DataResponse } from './protocol';
import { DATA_TABLES } from './registry';

export interface Caller {
  userId: string;
  accountId: string;
}

/** Overwrite tenant columns with the caller's (never trust the browser). */
function stampRows(
  table: string,
  rows: Record<string, unknown>[],
  caller: Caller
): Record<string, unknown>[] {
  const stamp = DATA_TABLES[table].stamp;
  if (!stamp) return rows;
  return rows.map((row) => ({
    ...row,
    ...(stamp.account ? { account_id: caller.accountId } : {}),
    ...(stamp.user ? { user_id: caller.userId } : {}),
  }));
}

export async function executeDataRequest(
  db: DbClient,
  table: string,
  req: DataRequest,
  caller: Caller
): Promise<DataResponse> {
  // The PostgREST builder's generics don't survive a dynamic chain; the
  // request has been validated field by field before this point.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const base: any = db.from(table);
  const countOpt = req.count ? { count: req.count } : {};
  let q: any;
  switch (req.op) {
    case 'select':
      q = base.select(req.select, { ...countOpt, head: req.head === true });
      break;
    case 'insert': {
      const rows = stampRows(
        table,
        req.values as Record<string, unknown>[],
        caller
      );
      q = base.insert(rows.length === 1 ? rows[0] : rows, countOpt);
      break;
    }
    case 'upsert': {
      const rows = stampRows(
        table,
        req.values as Record<string, unknown>[],
        caller
      );
      q = base.upsert(rows, {
        ...countOpt,
        ...(req.onConflict ? { onConflict: req.onConflict } : {}),
        ...(req.ignoreDuplicates ? { ignoreDuplicates: true } : {}),
      });
      break;
    }
    case 'update':
      q = base.update(req.values, countOpt);
      break;
    case 'delete':
      q = base.delete(countOpt);
      break;
  }
  if (req.op !== 'select' && req.select) q = q.select(req.select);

  for (const [op, col, val] of req.filters ?? []) q = q[op](col, val);

  if (req.search) {
    const filter =
      DATA_TABLES[table].search === 'contacts'
        ? contactSearchFilter(req.search.term, {
            includeEmail: req.search.includeEmail,
          })
        : null;
    if (filter) q = q.or(filter);
  }
  for (const [col, opts] of req.order ?? []) q = q.order(col, opts);
  if (req.range) q = q.range(req.range[0], req.range[1]);
  if (req.limit !== undefined) q = q.limit(req.limit);
  if (req.single === 'single') q = q.single();
  if (req.single === 'maybe') q = q.maybeSingle();

  const res = await q;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    data: res.data ?? null,
    error: res.error
      ? {
          message: res.error.message,
          code: res.error.code ?? '',
          details: res.error.details ?? null,
          hint: res.error.hint ?? null,
        }
      : null,
    count: res.count ?? null,
    status: res.status ?? (res.error ? 400 : 200),
  };
}
