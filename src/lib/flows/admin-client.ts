import { serviceDb, type DbClient } from '@/lib/db/server'

// Service-role client for this engine (webhook / cron / API paths have
// no user session). Bypasses RLS: every query MUST filter by
// account_id. Kept as a named module so tests can mock it per engine;
// the backend (Supabase or self-hosted PostgREST) is chosen in
// src/lib/db/server.ts.
export function supabaseAdmin(): DbClient {
  return serviceDb()
}
