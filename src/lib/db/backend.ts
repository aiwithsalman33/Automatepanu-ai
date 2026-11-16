/**
 * Which data backend serves server-side requests.
 *
 *   supabase   (default) hosted Supabase: SSR cookie client for user
 *              requests, service-role key for webhook/engines/API v1.
 *   selfhosted the self-hosted stack: native Better Auth sessions and
 *              the private PostgREST (DATABASE_URL / POSTGREST_URL).
 *
 * Checkpoint 1c adds the self-hosted path next to the Supabase one so
 * production keeps running unchanged on Supabase (the rollback path)
 * until the cut-over in 1d/1g. Read at call time, never cached, so tests
 * can flip it with vi.stubEnv.
 */
export type DataBackend = 'supabase' | 'selfhosted';

export function dataBackend(): DataBackend {
  const raw = (process.env.DATA_BACKEND ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'supabase') return 'supabase';
  if (raw === 'selfhosted') return 'selfhosted';
  throw new Error(
    `DATA_BACKEND must be "supabase" or "selfhosted" (got "${process.env.DATA_BACKEND}")`
  );
}

export const isSelfHosted = () => dataBackend() === 'selfhosted';
