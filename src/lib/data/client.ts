/**
 * Browser data client (checkpoint 1d).
 *
 * Same query-builder shape the UI used with Supabase (`from().select()
 * .eq().order()…`, awaited for `{ data, error, count }`), but every
 * query is sent to this app's own /api/data/<table> route, which
 * validates it and runs it as the signed-in user under RLS. The
 * database (and PostgREST) are never reachable from the browser.
 *
 * Supported: select (count/head), insert, update, upsert, delete,
 * eq/neq/in/is/gt/gte/lt/lte, order, range, limit, single, maybeSingle,
 * and `search()` (server-side contact search) in place of free-form `or()`.
 */
import type {
  DataError,
  DataRequest,
  DataResponse,
  FilterOp,
  FilterValue,
} from './protocol';

export type { DataError } from './protocol';

export interface DataResult<T> {
  data: T | null;
  error: DataError | null;
  count: number | null;
  status: number;
}

async function post<T>(url: string, body: unknown): Promise<DataResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as DataResponse<T> | null;
    if (!json) {
      return {
        data: null,
        error: {
          message: `Request failed (${res.status})`,
          code: String(res.status),
          details: null,
          hint: null,
        },
        count: null,
        status: res.status,
      };
    }
    return {
      data: json.data,
      error: json.error,
      count: json.count,
      status: res.status,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'network',
        details: null,
        hint: null,
      },
      count: null,
      status: 0,
    };
  }
}

type Row = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export class QueryBuilder<T = any> implements PromiseLike<DataResult<T>> {
  private req: DataRequest;

  constructor(
    private readonly table: string,
    op: DataRequest['op'] = 'select'
  ) {
    this.req = { op };
  }

  /** Internal: start a new operation on the same table. */
  private withOp(op: DataRequest['op'], patch: Partial<DataRequest>) {
    this.req = { ...this.req, op, ...patch };
    return this;
  }

  select(
    columns = '*',
    opts: { count?: 'exact'; head?: boolean } = {}
  ): QueryBuilder<T> {
    if (this.req.op === 'select') {
      this.req = {
        ...this.req,
        select: columns,
        ...(opts.count ? { count: opts.count } : {}),
        ...(opts.head ? { head: true } : {}),
      };
    } else {
      // RETURNING list after insert/update/upsert/delete.
      this.req.select = columns;
    }
    return this;
  }

  insert(values: object | object[]) {
    return this.withOp('insert', { values: values as Row | Row[] });
  }

  update(values: object) {
    return this.withOp('update', { values: values as Row });
  }

  upsert(
    values: object | object[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  ) {
    return this.withOp('upsert', {
      values: values as Row | Row[],
      ...(opts.onConflict ? { onConflict: opts.onConflict } : {}),
      ...(opts.ignoreDuplicates ? { ignoreDuplicates: true } : {}),
    });
  }

  delete() {
    return this.withOp('delete', {});
  }

  private filter(op: FilterOp, col: string, val: FilterValue | FilterValue[]) {
    (this.req.filters ??= []).push([op, col, val]);
    return this;
  }
  eq(col: string, val: FilterValue) {
    return this.filter('eq', col, val);
  }
  neq(col: string, val: FilterValue) {
    return this.filter('neq', col, val);
  }
  in(col: string, vals: readonly FilterValue[]) {
    return this.filter('in', col, [...vals]);
  }
  is(col: string, val: null | boolean) {
    return this.filter('is', col, val);
  }
  gt(col: string, val: FilterValue) {
    return this.filter('gt', col, val);
  }
  gte(col: string, val: FilterValue) {
    return this.filter('gte', col, val);
  }
  lt(col: string, val: FilterValue) {
    return this.filter('lt', col, val);
  }
  lte(col: string, val: FilterValue) {
    return this.filter('lte', col, val);
  }
  ilike(col: string, pattern: string) {
    return this.filter('ilike', col, pattern);
  }
  ilikeAnyOf(col: string, patterns: readonly string[]) {
    return this.filter('ilikeAnyOf', col, [...patterns]);
  }

  /** Server-side search (contacts: name / phone / optionally email). */
  search(term: string, opts: { includeEmail?: boolean } = {}) {
    this.req.search = { term, includeEmail: opts.includeEmail === true };
    return this;
  }

  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    (this.req.order ??= []).push([col, opts]);
    return this;
  }
  range(from: number, to: number) {
    this.req.range = [from, to];
    return this;
  }
  limit(n: number) {
    this.req.limit = n;
    return this;
  }

  single<R = T extends (infer U)[] ? U : T>(): QueryBuilder<R> {
    this.req.single = 'single';
    return this as unknown as QueryBuilder<R>;
  }
  maybeSingle<R = T extends (infer U)[] ? U : T>(): QueryBuilder<R | null> {
    this.req.single = 'maybe';
    return this as unknown as QueryBuilder<R | null>;
  }

  /** Narrow the row type, like supabase-js `.returns<T>()`. */
  returns<R>(): QueryBuilder<R> {
    return this as unknown as QueryBuilder<R>;
  }

  then<A = DataResult<T>, B = never>(
    onfulfilled?: ((value: DataResult<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return post<T>(
      `/api/data/${encodeURIComponent(this.table)}`,
      this.req
    ).then(onfulfilled, onrejected);
  }
}

export interface DataClient {
  from<T = any>(table: string): QueryBuilder<T[]>;
  rpc<T = any>(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<DataResult<T>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const client: DataClient = {
  from: (table) => new QueryBuilder(table),
  rpc: (fn, args = {}) =>
    post(`/api/data/rpc/${encodeURIComponent(fn)}`, { args }),
};

/** The browser data client. Cheap: no connection state. */
export function createClient(): DataClient {
  return client;
}
