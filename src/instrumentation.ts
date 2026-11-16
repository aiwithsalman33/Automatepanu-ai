/**
 * Runs once when the server starts, before it takes requests.
 * Creates the first-start accounts from env (PLATFORM_ADMIN_*, SEED_USER_*);
 * see src/lib/auth/native/bootstrap.ts. A failure is logged and never
 * stops the server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.PLATFORM_ADMIN_EMAIL && !process.env.SEED_USER_EMAIL) return;
  if (!process.env.DATABASE_URL) return;

  try {
    const { bootstrapAccountsFromEnv, ensureAccounts } =
      await import('@/lib/auth/native/bootstrap');
    const { authPool } = await import('@/lib/auth/native/db');
    const results = await ensureAccounts(
      authPool(),
      bootstrapAccountsFromEnv()
    );
    for (const r of results) {
      console.info(
        `[bootstrap] ${r.email}: ${r.status}${'reason' in r ? ` (${r.reason})` : ''}`
      );
    }
  } catch (err) {
    console.error('[bootstrap] could not create first-start accounts:', err);
  }
}
