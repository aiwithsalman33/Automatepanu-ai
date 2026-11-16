/**
 * DB test harness for the tenant-isolation suite.
 *
 * Every test file opens ONE connection and ONE transaction, seeds its
 * fixture inside it as the superuser-ish `postgres` role, then runs each
 * check inside a SAVEPOINT under the role/identity being tested. The
 * savepoint is always rolled back, so checks cannot see each other's
 * writes, and the outer transaction is rolled back at the end, so the
 * database is left exactly as it was. Nothing is ever committed.
 *
 * Identity is set through a pluggable TenantContextAdapter so the same
 * suite can run against:
 *   - `supabase` (today): SET LOCAL ROLE authenticated + request.jwt.claims,
 *     which is what PostgREST does per request and what auth.uid() reads.
 *   - `app` (Phase 1c): SET LOCAL ROLE wacrm_app + app.user_id, i.e. the
 *     new withTenant() helper. Added when that helper exists.
 *
 * Select with DB_TENANT_ADAPTER (default: supabase).
 */
import { Client, type QueryResultRow } from 'pg';

export type Principal =
  | { kind: 'user'; userId: string; label: string }
  | { kind: 'anon' }
  | { kind: 'service' };

export interface TenantContextAdapter {
  name: string;
  /** Switch the current (sub)transaction to act as `p`. */
  enter(c: Client, p: Principal): Promise<void>;
}

export const supabaseAdapter: TenantContextAdapter = {
  name: 'supabase',
  async enter(c, p) {
    if (p.kind === 'service') {
      await c.query('SET LOCAL ROLE service_role');
      await c.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: 'service_role' }),
      ]);
      return;
    }
    if (p.kind === 'anon') {
      await c.query('SET LOCAL ROLE anon');
      await c.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: 'anon' }),
      ]);
      return;
    }
    await c.query('SET LOCAL ROLE authenticated');
    await c.query(
      "SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)",
      [JSON.stringify({ sub: p.userId, role: 'authenticated' }), p.userId]
    );
  },
};

const ADAPTERS: Record<string, TenantContextAdapter> = {
  supabase: supabaseAdapter,
};

export function selectedAdapter(): TenantContextAdapter {
  const name = process.env.DB_TENANT_ADAPTER ?? 'supabase';
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(
      `Unknown DB_TENANT_ADAPTER "${name}" (known: ${Object.keys(ADAPTERS).join(', ')})`
    );
  }
  return adapter;
}

export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function openTestTransaction(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  return c;
}

export async function closeTestTransaction(c: Client | undefined) {
  if (!c) return;
  try {
    await c.query('ROLLBACK');
  } finally {
    await c.end();
  }
}

/** Outcome of one statement, classified for isolation assertions. */
export type Outcome =
  | { status: 'ok'; rowCount: number; rows: QueryResultRow[] }
  | { status: 'error'; code: string; message: string };

let spSeq = 0;

/** Run `sql` in its own savepoint; never leaves the transaction aborted. */
export async function attempt(
  c: Client,
  sql: string,
  params: unknown[] = []
): Promise<Outcome> {
  const sp = `att_${++spSeq}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    const r = await c.query(sql, params);
    await c.query(`RELEASE SAVEPOINT ${sp}`);
    return { status: 'ok', rowCount: r.rowCount ?? 0, rows: r.rows };
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    const err = e as { code?: string; message?: string };
    return {
      status: 'error',
      code: err.code ?? '?',
      message: err.message ?? String(e),
    };
  }
}

/**
 * Run `fn` as `p` inside a savepoint that is ALWAYS rolled back, so the
 * role switch and every write made by `fn` disappear afterwards.
 */
export async function asPrincipal<T>(
  c: Client,
  p: Principal,
  fn: (c: Client) => Promise<T>,
  adapter: TenantContextAdapter = selectedAdapter()
): Promise<T> {
  const sp = `as_${++spSeq}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    await adapter.enter(c, p);
    return await fn(c);
  } finally {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  }
}

/** Privilege failures: RLS WITH CHECK, missing GRANT, guard triggers. */
export const PRIVILEGE_ERROR = '42501';

export function describeOutcome(o: Outcome): string {
  return o.status === 'ok'
    ? `ok(rowCount=${o.rowCount})`
    : `error(${o.code}: ${o.message})`;
}

/** The statement was refused, or ran but touched/saw nothing. */
export function isBlocked(o: Outcome): boolean {
  if (o.status === 'ok') return o.rowCount === 0;
  return o.code === PRIVILEGE_ERROR;
}

/**
 * RLS let the statement through. A constraint error raised after the
 * policy check (FK 23503, unique 23505, check 23514, not-null 23502)
 * still proves the row was visible/permitted.
 */
export function isPermitted(o: Outcome): boolean {
  if (o.status === 'ok') return o.rowCount > 0;
  return ['23503', '23505', '23514', '23502'].includes(o.code);
}
