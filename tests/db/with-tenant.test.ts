/**
 * Checkpoint 1c: the server data layer on the self-hosted schema
 * (adapter "app").
 *
 * Exercises the real helpers in src/lib/db, connected exactly like the
 * app: logged in as wacrm_authenticator (TEST_AUTHENTICATOR_DATABASE_URL).
 *
 *   withTenant(userId)  cross-tenant reads and writes fail
 *   withService()       sees every tenant (BYPASSRLS), so callers filter
 *   roles               the app role is neither owner nor superuser, has
 *                       no BYPASSRLS, and RLS is on for every table
 *   PostgREST           (when TEST_POSTGREST_URL is set) the same
 *                       isolation through the HTTP path the routes use,
 *                       plus forged / unsigned tokens are refused
 *
 * Unlike the rolled-back isolation suites, withTenant commits its own
 * transactions, so the fixture is committed and removed in afterAll.
 */
import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withService, withTenant } from '@/lib/db/pool';
import { postgrestClientFor } from '@/lib/db/postgrest';
import { signPostgrestJwt } from '@/lib/db/jwt';
import { DATABASE_URL, selectedAdapter } from './harness';

const isApp = selectedAdapter().name === 'app';
const AUTHENTICATOR_URL =
  process.env.TEST_AUTHENTICATOR_DATABASE_URL ??
  'postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm';
const POSTGREST_URL = process.env.TEST_POSTGREST_URL ?? '';
const POSTGREST_SECRET = process.env.TEST_POSTGREST_JWT_SECRET ?? '';

interface Tenant {
  userId: string;
  accountId: string;
  contactId: string;
  email: string;
}

describe.runIf(isApp)('server data layer (withTenant / withService)', () => {
  let admin: Client;
  let pool: Pool;
  let A: Tenant;
  let B: Tenant;

  async function tenant(label: string): Promise<Tenant> {
    const userId = randomUUID();
    const email = `${label}.${userId.slice(0, 8)}@with-tenant.test`;
    await admin.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`,
      [userId, email, { full_name: label }]
    );
    const { rows } = await admin.query(
      'SELECT account_id FROM account_members WHERE user_id = $1',
      [userId]
    );
    if (rows.length !== 1)
      throw new Error(`signup trigger did not run for ${label}`);
    const accountId = rows[0].account_id as string;
    const c = await admin.query(
      `INSERT INTO contacts (user_id, account_id, name, phone)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        userId,
        accountId,
        `contact ${label}`,
        `+1555${Date.now() % 1e7}`.slice(0, 12),
      ]
    );
    return { userId, accountId, contactId: c.rows[0].id, email };
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: DATABASE_URL });
    await admin.connect();
    pool = new Pool({ connectionString: AUTHENTICATOR_URL, max: 3 });
    A = await tenant('A');
    B = await tenant('B');
  });

  afterAll(async () => {
    if (admin && A && B) {
      const users = [A.userId, B.userId];
      // accounts.owner_user_id is ON DELETE RESTRICT: drop tenants first.
      await admin.query('DELETE FROM accounts WHERE owner_user_id = ANY($1)', [
        users,
      ]);
      await admin.query('DELETE FROM auth.users WHERE id = ANY($1)', [users]);
    }
    await admin?.end();
    await pool?.end();
  });

  // ---------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------

  it('withTenant runs as wacrm_app with app.user_id set, never as the login role', async () => {
    const r = await withTenant(
      A.userId,
      async (c) =>
        (
          await c.query(
            `SELECT current_user AS cu, session_user AS su,
                    current_setting('app.user_id', true) AS uid,
                    auth.uid()::text AS shim`
          )
        ).rows[0],
      pool
    );
    expect(r).toEqual({
      cu: 'wacrm_app',
      su: 'wacrm_authenticator',
      uid: A.userId,
      shim: A.userId,
    });
  });

  it('the role and user id do not leak to the next borrower of the connection', async () => {
    await withTenant(A.userId, async () => {}, pool);
    // Same pool, plain query: must be back to the privilege-less login role.
    const { rows } = await pool.query(
      "SELECT current_user AS cu, coalesce(current_setting('app.user_id', true), '') AS uid"
    );
    expect(rows[0]).toEqual({ cu: 'wacrm_authenticator', uid: '' });
  });

  it('the login role itself can read no tenant data', async () => {
    // Schema-qualified: the login role has no USAGE on public at all, so
    // an unqualified name doesn't even resolve.
    await expect(
      pool.query('SELECT id FROM public.contacts LIMIT 1')
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('wacrm_app is neither superuser, owner, nor BYPASSRLS; RLS is on everywhere', async () => {
    const { rows: roles } = await admin.query(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
         FROM pg_roles WHERE rolname IN ('wacrm_app', 'wacrm_authenticator')`
    );
    for (const r of roles) {
      expect(r, r.rolname).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
      });
    }
    expect(roles).toHaveLength(2);

    // Not the owner of any table/view/sequence/function in the app schemas.
    const { rows: owned } = await admin.query(
      `SELECT c.relname FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public', 'auth')
          AND pg_get_userbyid(c.relowner) IN ('wacrm_app', 'wacrm_authenticator')
       UNION ALL
       SELECT p.proname FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'auth')
          AND pg_get_userbyid(p.proowner) IN ('wacrm_app', 'wacrm_authenticator')`
    );
    expect(owned).toEqual([]);

    // Not a member of the owner role (would inherit ownership).
    const { rows: member } = await admin.query(
      `SELECT pg_has_role('wacrm_app', 'wacrm_owner', 'MEMBER') AS app_owner,
              pg_has_role('wacrm_app', 'wacrm_service', 'MEMBER') AS app_service`
    );
    expect(member[0]).toEqual({ app_owner: false, app_service: false });

    // Every public table has RLS enabled (owner bypass is irrelevant
    // because the app never connects as the owner).
    const { rows: noRls } = await admin.query(
      `SELECT c.relname FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND NOT c.relrowsecurity`
    );
    expect(noRls).toEqual([]);
  });

  // ---------------------------------------------------------------
  // Cross-tenant reads and writes through withTenant
  // ---------------------------------------------------------------

  it("a tenant reads its own contacts and none of the other tenant's", async () => {
    const rows = await withTenant(
      A.userId,
      async (c) => (await c.query('SELECT id, account_id FROM contacts')).rows,
      pool
    );
    expect(rows.map((r) => r.id)).toContain(A.contactId);
    expect(rows.every((r) => r.account_id === A.accountId)).toBe(true);

    const direct = await withTenant(
      A.userId,
      async (c) =>
        (await c.query('SELECT id FROM contacts WHERE id = $1', [B.contactId]))
          .rowCount,
      pool
    );
    expect(direct).toBe(0);
  });

  it("a tenant cannot update or delete the other tenant's rows", async () => {
    const [upd, del] = await withTenant(
      A.userId,
      async (c) => [
        (
          await c.query("UPDATE contacts SET name = 'pwned' WHERE id = $1", [
            B.contactId,
          ])
        ).rowCount,
        (await c.query('DELETE FROM contacts WHERE id = $1', [B.contactId]))
          .rowCount,
      ],
      pool
    );
    expect([upd, del]).toEqual([0, 0]);
    const { rows } = await admin.query(
      'SELECT name FROM contacts WHERE id = $1',
      [B.contactId]
    );
    expect(rows[0].name).toBe('contact B');
  });

  it("a tenant cannot insert into the other tenant's account", async () => {
    await expect(
      withTenant(
        A.userId,
        (c) =>
          c.query(
            `INSERT INTO contacts (user_id, account_id, name, phone)
             VALUES ($1, $2, 'planted', '+15550000001')`,
            [A.userId, B.accountId]
          ),
        pool
      )
    ).rejects.toMatchObject({ code: '42501' });
    const { rowCount } = await admin.query(
      "SELECT 1 FROM contacts WHERE account_id = $1 AND name = 'planted'",
      [B.accountId]
    );
    expect(rowCount).toBe(0);
  });

  it('a failed unit of work rolls back completely', async () => {
    await expect(
      withTenant(
        A.userId,
        async (c) => {
          await c.query("UPDATE contacts SET name = 'half' WHERE id = $1", [
            A.contactId,
          ]);
          throw new Error('boom');
        },
        pool
      )
    ).rejects.toThrow('boom');
    const { rows } = await admin.query(
      'SELECT name FROM contacts WHERE id = $1',
      [A.contactId]
    );
    expect(rows[0].name).toBe('contact A');
  });

  it('withTenant refuses a non-uuid user id before touching the database', async () => {
    await expect(
      withTenant("' OR 1=1 --", async () => 1, pool)
    ).rejects.toThrow(/uuid/);
  });

  it('withService sees every tenant (so service code must filter by account_id)', async () => {
    const r = await withService(
      async (c) => ({
        cu: (await c.query('SELECT current_user AS cu')).rows[0].cu,
        ids: (
          await c.query('SELECT id FROM contacts WHERE id = ANY($1)', [
            [A.contactId, B.contactId],
          ])
        ).rows.map((x) => x.id),
        scoped: (
          await c.query('SELECT id FROM contacts WHERE account_id = $1', [
            A.accountId,
          ])
        ).rows.map((x) => x.id),
      }),
      pool
    );
    expect(r.cu).toBe('wacrm_service');
    expect(r.ids.sort()).toEqual([A.contactId, B.contactId].sort());
    expect(r.scoped).toEqual([A.contactId]);
  });

  // ---------------------------------------------------------------
  // The PostgREST path the route handlers use
  // ---------------------------------------------------------------

  describe.runIf(POSTGREST_URL && POSTGREST_SECRET)(
    'through private PostgREST',
    () => {
      const env = () => {
        process.env.POSTGREST_URL = POSTGREST_URL;
        process.env.POSTGREST_JWT_SECRET = POSTGREST_SECRET;
      };

      it("a user client reads only its own tenant's contacts", async () => {
        env();
        const db = postgrestClientFor({ role: 'wacrm_app', sub: A.userId });
        const { data, error } = await db
          .from('contacts')
          .select('id, account_id');
        expect(error).toBeNull();
        const ids = (data ?? []).map((r) => r.id);
        expect(ids).toContain(A.contactId);
        expect(ids).not.toContain(B.contactId);
      });

      it("a user client cannot update the other tenant's row", async () => {
        env();
        const db = postgrestClientFor({ role: 'wacrm_app', sub: A.userId });
        const { data } = await db
          .from('contacts')
          .update({ name: 'pwned' })
          .eq('id', B.contactId)
          .select('id');
        expect(data ?? []).toEqual([]);
        const { rows } = await admin.query(
          'SELECT name FROM contacts WHERE id = $1',
          [B.contactId]
        );
        expect(rows[0].name).toBe('contact B');
      });

      it("a user client cannot insert into the other tenant's account", async () => {
        env();
        const db = postgrestClientFor({ role: 'wacrm_app', sub: A.userId });
        const { error } = await db.from('contacts').insert({
          user_id: A.userId,
          account_id: B.accountId,
          name: 'planted-rest',
          phone: '+15550000002',
        });
        expect(error?.code).toBe('42501');
      });

      it('a service client sees both tenants', async () => {
        env();
        const db = postgrestClientFor({ role: 'wacrm_service' });
        const { data } = await db
          .from('contacts')
          .select('id')
          .in('id', [A.contactId, B.contactId]);
        expect((data ?? []).length).toBe(2);
      });

      const raw = (token: string | null) =>
        fetch(`${POSTGREST_URL}/contacts?select=id&id=eq.${B.contactId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

      it('a token signed with the wrong secret is refused', async () => {
        const forged = signPostgrestJwt(
          { role: 'wacrm_service' },
          'f'.repeat(40)
        );
        expect((await raw(forged)).status).toBe(401);
      });

      it('a token claiming the owner role is refused', async () => {
        // Hand-sign (the app's signer refuses this role on purpose).
        const { createHmac } = await import('node:crypto');
        const b = (o: object) =>
          Buffer.from(JSON.stringify(o)).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const h = b({ alg: 'HS256', typ: 'JWT' });
        const p = b({ role: 'wacrm_owner', iat: now, exp: now + 60 });
        const s = createHmac('sha256', POSTGREST_SECRET)
          .update(`${h}.${p}`)
          .digest('base64url');
        const res = await raw(`${h}.${p}.${s}`);
        // wacrm_authenticator is not a member of wacrm_owner: SET ROLE fails.
        expect(res.status).not.toBe(200);
      });

      it('no token means wacrm_anon, which reads no tenant data', async () => {
        const res = await raw(null);
        if (res.status === 200) {
          expect(await res.json()).toEqual([]);
        } else {
          expect([401, 403]).toContain(res.status);
        }
      });
    }
  );
});
