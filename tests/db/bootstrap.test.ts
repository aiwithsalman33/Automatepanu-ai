/**
 * First-start accounts (src/lib/auth/native/bootstrap.ts) on the real
 * schema: created once and verified, signs in with the given password,
 * gets its own workspace, admin role only for PLATFORM_ADMIN_*, never
 * overwritten on a second boot.
 */
import { randomUUID } from 'node:crypto';
import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createNativeAuth } from '@/lib/auth/native/auth';
import {
  bootstrapAccountsFromEnv,
  ensureAccounts,
  isPlatformAdmin,
} from '@/lib/auth/native/bootstrap';
import { createAuthPool } from '@/lib/auth/native/db';
import { DATABASE_URL, selectedAdapter } from './harness';

const AUTHENTICATOR_URL =
  process.env.TEST_AUTHENTICATOR_DATABASE_URL ??
  'postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm';
const ORIGIN = 'http://localhost:3000';

describe.runIf(selectedAdapter().name === 'app')('first-start accounts', () => {
  let pool: Pool;
  let admin: Client;
  const tag = randomUUID().slice(0, 8);
  const adminEmail = `boot-admin.${tag}@bootstrap.test`;
  const userEmail = `boot-user.${tag}@bootstrap.test`;
  const env = {
    PLATFORM_ADMIN_EMAIL: adminEmail.toUpperCase(),
    PLATFORM_ADMIN_PASSWORD: 'Admin-Pass-1',
    PLATFORM_ADMIN_NAME: 'Boot Admin',
    SEED_USER_EMAIL: userEmail,
    SEED_USER_PASSWORD: 'User-Pass-1',
  } as unknown as NodeJS.ProcessEnv;

  beforeAll(async () => {
    pool = createAuthPool(AUTHENTICATOR_URL);
    admin = new Client({ connectionString: DATABASE_URL });
    await admin.connect();
  });
  afterAll(async () => {
    const emails = [adminEmail, userEmail];
    await admin.query(
      'DELETE FROM accounts WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email = ANY($1))',
      [emails]
    );
    await admin.query('DELETE FROM auth.users WHERE email = ANY($1)', [emails]);
    await admin.end();
    await pool.end();
  });

  it('reads both accounts from env (email lower-cased, default name)', () => {
    expect(bootstrapAccountsFromEnv(env)).toEqual([
      {
        email: adminEmail,
        password: 'Admin-Pass-1',
        name: 'Boot Admin',
        platformAdmin: true,
      },
      {
        email: userEmail,
        password: 'User-Pass-1',
        name: 'User',
        platformAdmin: false,
      },
    ]);
  });

  it('creates verified users with their own workspace; only the admin is a platform admin', async () => {
    const res = await ensureAccounts(pool, bootstrapAccountsFromEnv(env));
    expect(res.map((r) => r.status)).toEqual(['created', 'created']);

    const { rows } = await admin.query(
      `SELECT u.id, u.email, u.email_verified, m.account_role
         FROM auth.users u JOIN account_members m ON m.user_id = u.id
        WHERE u.email = ANY($1) ORDER BY u.email`,
      [[adminEmail, userEmail]]
    );
    expect(rows).toHaveLength(2);
    expect(
      rows.every((r) => r.email_verified && r.account_role === 'owner')
    ).toBe(true);
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.id]));
    expect(await isPlatformAdmin(pool, byEmail[adminEmail])).toBe(true);
    expect(await isPlatformAdmin(pool, byEmail[userEmail])).toBe(false);
  });

  it('the seeded passwords work for a real sign-in', async () => {
    const auth = createNativeAuth({
      pool,
      mailer: { send: async () => {} },
      secret: 'test-secret-test-secret-test-secret-0123',
      baseURL: ORIGIN,
      trustedOrigins: [ORIGIN],
    });
    for (const [email, password] of [
      [adminEmail, 'Admin-Pass-1'],
      [userEmail, 'User-Pass-1'],
    ]) {
      const res = await auth.handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: ORIGIN,
            'x-real-ip': `10.7.0.${email.length}`,
          },
          body: JSON.stringify({ email, password }),
        })
      );
      expect(res.status, email).toBe(200);
    }
  });

  it('a second boot changes nothing (password in env is ignored for existing users)', async () => {
    const before = await admin.query(
      `SELECT i.password FROM auth.identities i JOIN auth.users u ON u.id = i.user_id WHERE u.email = $1`,
      [userEmail]
    );
    const res = await ensureAccounts(pool, [
      {
        email: userEmail,
        password: 'Different-Pass-9',
        name: 'X',
        platformAdmin: false,
      },
    ]);
    expect(res[0].status).toBe('exists');
    const after = await admin.query(
      `SELECT i.password FROM auth.identities i JOIN auth.users u ON u.id = i.user_id WHERE u.email = $1`,
      [userEmail]
    );
    expect(after.rows[0].password).toBe(before.rows[0].password);
  });

  it('refuses a too-short password for a new account', async () => {
    const res = await ensureAccounts(pool, [
      {
        email: `short.${tag}@bootstrap.test`,
        password: '123',
        name: 'S',
        platformAdmin: false,
      },
    ]);
    expect(res[0].status).toBe('skipped');
  });
});
