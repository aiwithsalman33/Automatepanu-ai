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
