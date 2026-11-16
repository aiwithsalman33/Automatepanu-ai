// ============================================================
// Server data access: the one place server code gets a database
// client from.
//
//   getRequestDb()  user requests (route handlers / server
//                   components). RLS-scoped to the signed-in user.
//   serviceDb()     webhook, engines, cron, public API v1, worker.
//                   Bypasses RLS: every query MUST filter by
//                   account_id.
//   serviceStorage() service-role object storage (Supabase only
//                   until checkpoint 1f moves media to MinIO).
//
// Backend selected by DATA_BACKEND (see ./backend.ts):
//   supabase    SSR cookie client + service-role key (production
//               today; the rollback path until 1g).
//   selfhosted  Better Auth session + private PostgREST with a
//               short-lived JWT: role wacrm_app + sub for users,
//               wacrm_service for service work. Same queries, same
//               RLS policies, same results.
// ============================================================

import { headers } from 'next/headers';
import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createSupabaseSsr } from '@/lib/supabase/server';
import { getNativeSessionUser } from '@/lib/auth/native/session';

import { dataBackend } from './backend';
import { restAnon, restForUser, restService } from './postgrest';
import type { DbClient } from './types';

export type { DbClient } from './types';

export interface RequestUser {
  id: string;
  email: string | null;
}

export interface RequestDb {
  /** RLS-scoped to `user` (anonymous when user is null). */
  db: DbClient;
  /** The signed-in user, or null. */
  user: RequestUser | null;
}

/**
 * The caller's identity and a database client scoped to it.
 *
 * Never throws for "not signed in": returns `user: null` (the client
 * is then anonymous) so each route keeps its own 401 wording.
 */
export async function getRequestDb(): Promise<RequestDb> {
  if (dataBackend() === 'selfhosted') {
    const u = await getNativeSessionUser(await headers());
    if (!u) return { db: restAnon(), user: null };
    return { db: restForUser(u.id), user: { id: u.id, email: u.email } };
  }

  const supabase = await createSupabaseSsr();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { db: supabase, user: null };
  return { db: supabase, user: { id: user.id, email: user.email ?? null } };
}

let supabaseService: SupabaseClient | null = null;
function supabaseServiceClient(): SupabaseClient {
  return (supabaseService ??= createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ));
}

/** Service-role client. Bypasses RLS: always filter by account_id. */
export function serviceDb(): DbClient {
  return dataBackend() === 'selfhosted'
    ? restService()
    : supabaseServiceClient();
}

/**
 * Service-role object storage, or null when the backend has none yet.
 * The self-hosted backend gets MinIO in checkpoint 1f; until then
 * callers fall back (the webhook keeps the media proxy URL).
 */
export function serviceStorage(): SupabaseClient['storage'] | null {
  return dataBackend() === 'selfhosted'
    ? null
    : supabaseServiceClient().storage;
}

/** Anonymous client (SECURITY DEFINER RPCs granted to anon). */
export async function anonDb(): Promise<DbClient> {
  if (dataBackend() === 'selfhosted') return restAnon();
  return createSupabaseSsr();
}
