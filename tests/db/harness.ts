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
 * Identity is set through a TenantContextAdapter: `app` does exactly what
 * withTenant() does (SET LOCAL ROLE wacrm_app + app.user_id).
 *
 * DB_TENANT_ADAPTER selects it (default and only adapter: app).
 */
import { Client, type QueryResultRow } from 'pg';

export type Principal =
  | { kind: 'user'; userId: string; label: string }
  | { kind: 'anon' }
  | { kind: 'service' };

export interface TenantContextAdapter {
  name: string;
  /** Postgres role names behind each principal kind. */
  roles: { app: string; service: string; anon: string };
  /**
   * SECURITY DEFINER functions the anon role may EXECUTE. Supabase's
   * baseline exposes the member RPCs too; 0003_hardening revokes them.
   */
  anonDefinerAllowlist: string[];
  /** Switch the current (sub)transaction to act as `p`. */
  enter(c: Client, p: Principal): Promise<void>;
}

/**
 * The new stack (db/migrations): exactly what withTenant() does. The
 * login role SETs LOCAL ROLE to a NOLOGIN role and the current user is
 * carried in `app.user_id`, which the auth.uid() shim reads.
 */
export const appAdapter: TenantContextAdapter = {
  name: 'app',
  roles: { app: 'wacrm_app', service: 'wacrm_service', anon: 'wacrm_anon' },
  anonDefinerAllowlist: ['peek_invitation'],
  async enter(c, p) {
    if (p.kind === 'service') {
      await c.query('SET LOCAL ROLE wacrm_service');
      return;
    }
    if (p.kind === 'anon') {
      await c.query('SET LOCAL ROLE wacrm_anon');
      return;
    }
    await c.query('SET LOCAL ROLE wacrm_app');
    await c.query("SELECT set_config('app.user_id', $1, true)", [p.userId]);
  },
};

const ADAPTERS: Record<string, TenantContextAdapter> = {
  app: appAdapter,
};

export function selectedAdapter(): TenantContextAdapter {
  const name = process.env.DB_TENANT_ADAPTER ?? 'app';
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
  'postgresql://postgres:admin@127.0.0.1:54330/wacrm';

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
