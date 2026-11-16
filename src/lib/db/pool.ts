import { Pool, type PoolClient } from 'pg';

import { UUID_RE } from './jwt';

/**
 * Direct Postgres access for the self-hosted backend.
 *
 * The pool logs in as wacrm_authenticator (DATABASE_URL): a NOINHERIT
 * role with no privileges of its own. Every unit of work runs in a
 * transaction that first assumes a real role with SET LOCAL, so nothing
 * executes as the login role and the role can't leak to the next
 * borrower of the connection (SET LOCAL ends with the transaction).
 *
 *   withTenant(userId, fn)  wacrm_app (RLS) + app.user_id = userId
 *   withService(fn)         wacrm_service (BYPASSRLS): filter by
 *                           account_id in every query
 */

let pool: Pool | null = null;

export function dbPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
  return pool;
}

async function inTransaction<T>(
  p: Pool,
  setup: (c: PoolClient) => Promise<void>,
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const c = await p.connect();
  try {
    await c.query('BEGIN');
    await setup(c);
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

export function withTenant<T>(
  userId: string,
  fn: (c: PoolClient) => Promise<T>,
  p: Pool = dbPool()
): Promise<T> {
  if (!UUID_RE.test(userId)) {
    return Promise.reject(new Error('withTenant needs a user id (uuid)'));
  }
  return inTransaction(
    p,
    async (c) => {
      await c.query('SET LOCAL ROLE wacrm_app');
      await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    },
    fn
  );
}

export function withService<T>(
  fn: (c: PoolClient) => Promise<T>,
  p: Pool = dbPool()
): Promise<T> {
  return inTransaction(
    p,
    async (c) => {
      await c.query('SET LOCAL ROLE wacrm_service');
    },
    fn
  );
}
