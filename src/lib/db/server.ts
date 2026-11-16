// ============================================================
// Server data access: the one place server code gets a database
// client from.
//
//   getRequestDb()  user requests (route handlers / server
//                   components): the Better Auth session user, and a
//                   private-PostgREST client signed as wacrm_app with
//                   sub = user id, so RLS scopes every query.
//   serviceDb()     webhook, engines, cron, public API v1, worker:
//                   wacrm_service. Bypasses RLS: every query MUST
//                   filter by account_id.
//   anonDb()        wacrm_anon: only the SECURITY DEFINER RPCs granted
//                   to anon (invitation peek).
//   serviceStorage() object storage for the webhook's inbound-media
//                   mirror. Null until checkpoint 1f (MinIO); callers
//                   fall back to the media proxy URL.
// ============================================================

import { headers } from 'next/headers';

import { getNativeSessionUser } from '@/lib/auth/native/session';

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
  const u = await getNativeSessionUser(await headers());
  if (!u) return { db: restAnon(), user: null };
  return { db: restForUser(u.id), user: { id: u.id, email: u.email } };
}

/** Service-role client. Bypasses RLS: always filter by account_id. */
export function serviceDb(): DbClient {
  return restService();
}

/** Minimal storage surface the inbound-media mirror needs. */
export type ServiceStorage = Parameters<
  typeof import('@/lib/whatsapp/mirror-inbound-media').mirrorInboundMedia
>[0]['storage'];

/** Object storage for service code, or null (MinIO arrives in 1f). */
export function serviceStorage(): ServiceStorage | null {
  return null;
}

/** Anonymous client (SECURITY DEFINER RPCs granted to anon). */
export async function anonDb(): Promise<DbClient> {
  return restAnon();
}
