/**
 * Platform admin panel on the real schema: every read model's SQL runs,
 * a disabled user can't sign in (Better Auth session hook), and the
 * delete plan + delete order (workspace first, then user) works with the
 * accounts.owner_user_id ON DELETE RESTRICT foreign key.
 *
 * Commits rows (Better Auth uses its own pool); everything it creates is
 * removed in afterAll.
 */
import { randomUUID } from 'node:crypto';
import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  USER_FILTERS,
  listUsers,
  loadAdminDashboard,
  loadAdminSettings,
  loadDeletePlan,
  loadUserDetail,
} from '@/lib/admin/queries';
import { ACCOUNT_DISABLED_CODE, createNativeAuth } from '@/lib/auth/native/auth';
import { createAuthPool } from '@/lib/auth/native/db';
import { DATABASE_URL, selectedAdapter } from './harness';

const AUTHENTICATOR_URL =
  process.env.TEST_AUTHENTICATOR_DATABASE_URL ??
  'postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm';
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Admin-Test-9!';

describe.runIf(selectedAdapter().name === 'app')('platform admin panel', () => {
  let pool: Pool;
  let su: Client;
  let auth: ReturnType<typeof createNativeAuth>;
  const tag = randomUUID().slice(0, 8);
  const emails: string[] = [];
  let ip = 0;

  async function call(path: string, body: unknown) {
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: ORIGIN,
          'x-real-ip': `10.77.0.${++ip}`,
        },
        body: JSON.stringify(body),
      })
    );
    let json: Record<string, unknown> | null = null;
    try {
      json = await res.json();
    } catch {
      /* empty */
    }
    return { status: res.status, json };
  }

  /** Signed-up user with a verified email; returns its id. */
  async function makeUser(name: string): Promise<{ id: string; email: string }> {
    const email = `${name}.${tag}@admin.test`;
    emails.push(email);
    const up = await call('/sign-up/email', { email, password: PASSWORD, name });
    expect(up.status, JSON.stringify(up.json)).toBe(200);
    const { rows } = await su.query<{ id: string }>(
      'UPDATE auth.users SET email_verified = true WHERE email = $1 RETURNING id',
      [email]
    );
    return { id: rows[0].id, email };
  }

  beforeAll(async () => {
    pool = createAuthPool(AUTHENTICATOR_URL);
    su = new Client({ connectionString: DATABASE_URL });
    await su.connect();
    auth = createNativeAuth({
      pool,
      mailer: { send: async () => {} },
      secret: 'admin-test-secret-0123456789abcdef0123',
      baseURL: ORIGIN,
      trustedOrigins: [ORIGIN],
    });
  });

  afterAll(async () => {
    await su.query(
      "DELETE FROM auth.admin_audit_log WHERE admin_email = ANY($1) OR target_email = ANY($1)",
      [emails]
    );
    await su.query(
      'DELETE FROM accounts WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email = ANY($1))',
      [emails]
    );
    await su.query('DELETE FROM auth.users WHERE email = ANY($1)', [emails]);
    await su.end();
    await pool.end();
  });

  it('a disabled user cannot sign in; re-enabled they can', async () => {
    const u = await makeUser('disabled');
    expect((await call('/sign-in/email', { email: u.email, password: PASSWORD })).status).toBe(200);

    await su.query('UPDATE auth.users SET disabled_at = now() WHERE id = $1', [u.id]);
    const blocked = await call('/sign-in/email', { email: u.email, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.json?.code).toBe(ACCOUNT_DISABLED_CODE);

    // A wrong password still gets the normal error: the gate runs only
    // after the credentials were accepted, so it reveals nothing.
    const wrong = await call('/sign-in/email', { email: u.email, password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);

    await su.query('UPDATE auth.users SET disabled_at = NULL WHERE id = $1', [u.id]);
    expect((await call('/sign-in/email', { email: u.email, password: PASSWORD })).status).toBe(200);
  });

  it('dashboard, user list (every filter + search), detail and settings queries run', async () => {
    const u = await makeUser('detail');
    await su.query('INSERT INTO auth.platform_admins (user_id) VALUES ($1)', [u.id]);

    const dash = await loadAdminDashboard(pool);
    expect(dash.totals.users).toBeGreaterThan(0);
    expect(dash.signups).toHaveLength(30);
    expect(dash.messages).toHaveLength(30);
    expect(dash.signups.at(-1)!.count).toBeGreaterThan(0);

    for (const filter of USER_FILTERS) {
      const res = await listUsers(pool, { filter });
      expect(res.total).toBeGreaterThanOrEqual(res.rows.length);
    }
    const found = await listUsers(pool, { q: `detail.${tag}` });
    expect(found.rows.map((r) => r.id)).toEqual([u.id]);
    expect(found.rows[0].platform_admin).toBe(true);
    expect(found.rows[0].account_role).toBe('owner');
    // LIKE wildcards are literal, not "match anything".
    expect((await listUsers(pool, { q: `%_${tag}` })).total).toBe(0);

    const detail = await loadUserDetail(pool, u.id);
    expect(detail?.user.email).toBe(u.email);
    expect(detail?.workspace?.owner_user_id).toBe(u.id);
    expect(detail?.stats?.contacts).toBe(0);
    expect(detail?.messages).toHaveLength(30);
    expect(detail?.identities.map((i) => i.provider_id)).toEqual(['credential']);
    expect(await loadUserDetail(pool, randomUUID())).toBeNull();
    expect(await loadUserDetail(pool, 'not-a-uuid')).toBeNull();

    const settings = await loadAdminSettings(pool);
    expect(settings.admins.some((a) => a.user_id === u.id)).toBe(true);
    expect(settings.database.version).toMatch(/^\d+/);
  });

  it('audit log accepts writes from the service role', async () => {
    const u = await makeUser('audited');
    await pool.query(
      `INSERT INTO auth.admin_audit_log (admin_user_id, admin_email, action, target_user_id, target_email)
       VALUES ($1, $2, 'user.verify', $1, $2)`,
      [u.id, u.email]
    );
    const detail = await loadUserDetail(pool, u.id);
    expect(detail?.audit.map((a) => a.action)).toEqual(['user.verify']);
  });

  it('delete plan: sole owner deletes workspace + user; a shared workspace blocks', async () => {
    const owner = await makeUser('owner');
    const member = await makeUser('member');
    const plan = await loadDeletePlan(pool, owner.id);
    expect(plan.blockedBy).toEqual([]);
    expect(plan.deletesWorkspaces).toHaveLength(1);

    // Move `member` into owner's workspace (as the invite RPC would).
    const ws = plan.deletesWorkspaces[0].id;
    await su.query(
      `UPDATE account_members SET account_id = $1, account_role = 'agent' WHERE user_id = $2`,
      [ws, member.id]
    );
    const shared = await loadDeletePlan(pool, owner.id);
    expect(shared.blockedBy).toEqual([{ id: ws, name: expect.any(String), otherMembers: 1 }]);

    // Back to sole owner: the delete order used by deleteUser() succeeds.
    await su.query('DELETE FROM accounts WHERE owner_user_id = $1', [member.id]);
    await su.query('DELETE FROM auth.users WHERE id = $1', [member.id]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM public.accounts WHERE owner_user_id = $1', [owner.id]);
      await client.query('DELETE FROM auth.users WHERE id = $1', [owner.id]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const { rowCount } = await su.query('SELECT 1 FROM auth.users WHERE id = $1', [owner.id]);
    expect(rowCount).toBe(0);
  });
});
