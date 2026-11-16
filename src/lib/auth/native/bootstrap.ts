/**
 * First-start accounts, created from env at server boot
 * (src/instrumentation.ts):
 *
 *   PLATFORM_ADMIN_EMAIL / _PASSWORD / _NAME  a verified user who is a
 *                                             platform admin (/admin)
 *   SEED_USER_EMAIL / _PASSWORD / _NAME       a verified normal user
 *
 * Idempotent and conservative: an account is created ONCE, only when no
 * user with that email exists. An existing account is never modified
 * (its password is never reset from env), except that an existing user
 * named in PLATFORM_ADMIN_EMAIL is granted the admin role. Each user gets
 * their own workspace through the signup trigger, like any sign-up.
 *
 * Users are written directly (verified, with a Better Auth credential
 * hashed by the same scrypt function sign-in verifies against), so first
 * boot needs no working SMTP and sends no emails.
 */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import { MIN_PASSWORD_LENGTH } from './auth';
import { hashPassword } from './password';

export interface BootstrapAccount {
  email: string;
  password: string;
  name: string;
  platformAdmin: boolean;
}

export type BootstrapResult =
  | { email: string; status: 'created' | 'exists' | 'granted-admin' }
  | { email: string; status: 'skipped'; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function bootstrapAccountsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): BootstrapAccount[] {
  const out: BootstrapAccount[] = [];
  const pick = (
    prefix: string,
    platformAdmin: boolean,
    fallbackName: string
  ) => {
    const email = env[`${prefix}_EMAIL`]?.trim().toLowerCase();
    const password = env[`${prefix}_PASSWORD`] ?? '';
    if (!email) return;
    out.push({
      email,
      password,
      name: env[`${prefix}_NAME`]?.trim() || fallbackName,
      platformAdmin,
    });
  };
  pick('PLATFORM_ADMIN', true, 'Platform Admin');
  pick('SEED_USER', false, 'User');
  return out;
}

export async function ensureAccounts(
  pool: Pool,
  accounts: BootstrapAccount[]
): Promise<BootstrapResult[]> {
  const results: BootstrapResult[] = [];
  for (const a of accounts) {
    if (!EMAIL_RE.test(a.email)) {
      results.push({
        email: a.email,
        status: 'skipped',
        reason: 'invalid email',
      });
      continue;
    }
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const existing = await c.query<{ id: string }>(
        'SELECT id FROM auth.users WHERE lower(email) = $1',
        [a.email]
      );
      let userId = existing.rows[0]?.id;
      let status: 'created' | 'exists' | 'granted-admin' = 'exists';

      if (!userId) {
        if (a.password.length < MIN_PASSWORD_LENGTH) {
          await c.query('ROLLBACK');
          results.push({
            email: a.email,
            status: 'skipped',
            reason: `password shorter than ${MIN_PASSWORD_LENGTH} characters`,
          });
          continue;
        }
        const { rows } = await c.query<{ id: string }>(
          `INSERT INTO auth.users (email, name, email_verified)
           VALUES ($1, $2, true) RETURNING id`,
          [a.email, a.name]
        );
        userId = rows[0].id;
        await c.query(
          `INSERT INTO auth.identities (id, user_id, provider_id, account_id, password)
           VALUES ($1, $2::uuid, 'credential', $2::text, $3)`,
          [randomUUID(), userId, await hashPassword(a.password)]
        );
        status = 'created';
      }

      if (a.platformAdmin) {
        const granted = await c.query(
          `INSERT INTO auth.platform_admins (user_id) VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
        if (granted.rowCount && status === 'exists') status = 'granted-admin';
      }
      await c.query('COMMIT');
      results.push({ email: a.email, status });
    } catch (err) {
      await c.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }
  return results;
}

/** Is this user a platform admin? (service role; never cached) */
export async function isPlatformAdmin(
  pool: Pool,
  userId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM auth.platform_admins WHERE user_id = $1',
    [userId]
  );
  return (rowCount ?? 0) > 0;
}
