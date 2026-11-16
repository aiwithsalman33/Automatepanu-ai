import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The query surface server code may use: PostgREST tables, RPCs and
 * schema switching. Deliberately excludes `.auth`, `.storage` and
 * `.channel`: those move to Better Auth (1d), MinIO (1f) and
 * LISTEN/NOTIFY (1e). Both a Supabase client and the private-PostgREST
 * client satisfy it, so engine code is backend-agnostic.
 *
 * (Typed off SupabaseClient only while it is installed; 1g re-points
 * this at the PostgREST client type.)
 */
export type DbClient = Pick<SupabaseClient, 'from' | 'rpc' | 'schema'>;

/**
 * For helpers shared by server code and the browser (dashboard queries,
 * audience counts, tag writes, delivery leases…): satisfied by both the
 * server's DbClient and the browser data client (src/lib/data/client.ts).
 * The browser side is validated by /api/data, so these helpers may only
 * use the builder subset it supports (see src/lib/data/registry.ts).
 */
export interface SharedDb {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
