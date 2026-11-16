import { Pool } from 'pg';

/**
 * Connection pool for Better Auth.
 *
 * Logs in as wacrm_authenticator (DATABASE_URL) like the rest of the
 * app, but assumes wacrm_service for the whole session: the auth tables
 * (auth.users / sessions / identities / verifications) are service-role
 * only. `role` and `search_path` are set as *startup* parameters, so
 * every pooled connection is in that state before its first query. No
 * window where a connection runs as the bare login role.
 *
 * search_path = auth, public resolves Better Auth's unqualified model
 * names (users, sessions, identities, verifications) to the auth schema.
 */
export const AUTH_CONNECTION_OPTIONS =
  '-c role=wacrm_service -c search_path=auth,public';

export function createAuthPool(connectionString: string, max = 5): Pool {
  return new Pool({ connectionString, max, options: AUTH_CONNECTION_OPTIONS });
}

let pool: Pool | null = null;

export function authPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set (native auth needs the self-hosted database)'
    );
  }
  pool = createAuthPool(
    connectionString,
    Number(process.env.AUTH_DB_POOL_MAX ?? 5)
  );
  return pool;
}
