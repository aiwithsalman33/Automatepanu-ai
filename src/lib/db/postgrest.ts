import { PostgrestClient } from '@supabase/postgrest-js';

import { signPostgrestJwt, type PostgrestClaims } from './jwt';
import type { DbClient } from './types';

/**
 * Clients for the private PostgREST (self-hosted backend).
 *
 * A custom fetch mints a fresh short-lived JWT for every request, so a
 * long-lived service client never sends an expired token.
 */
function config() {
  const url = process.env.POSTGREST_URL;
  const secret = process.env.POSTGREST_JWT_SECRET;
  if (!url) throw new Error('POSTGREST_URL is not set');
  if (!secret) throw new Error('POSTGREST_JWT_SECRET is not set');
  return { url: url.replace(/\/+$/, ''), secret };
}

export function postgrestClientFor(claims: PostgrestClaims): DbClient {
  const { url, secret } = config();
  // Validate eagerly so a bad role/sub fails at construction, not on
  // the first query.
  signPostgrestJwt(claims, secret);
  const authedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${signPostgrestJwt(claims, secret)}`);
    return fetch(input, { ...init, headers, cache: 'no-store' });
  };
  return new PostgrestClient(url, {
    fetch: authedFetch,
  }) as unknown as DbClient;
}

/** RLS-scoped to `userId` (role wacrm_app, auth.uid() = userId). */
export function restForUser(userId: string): DbClient {
  return postgrestClientFor({ role: 'wacrm_app', sub: userId });
}

let service: DbClient | null = null;
/** wacrm_service: bypasses RLS. Every query MUST filter by account_id. */
export function restService(): DbClient {
  return (service ??= postgrestClientFor({ role: 'wacrm_service' }));
}

/** wacrm_anon: only the SECURITY DEFINER RPCs granted to anon. */
export function restAnon(): DbClient {
  return postgrestClientFor({ role: 'wacrm_anon' });
}

/** Test hook: drop the cached service client after env changes. */
export function resetRestClients() {
  service = null;
}
