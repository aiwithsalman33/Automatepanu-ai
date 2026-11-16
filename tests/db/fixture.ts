/**
 * Two-tenant fixture, seeded inside the caller's open transaction as
 * `postgres` (BYPASSRLS), so it is never committed.
 *
 *   Account A: owner, admin, agent, viewer
 *   Account B: owner, agent
 *
 * Users are created through auth.users so the real signup trigger
 * (handle_new_user) builds each personal account + owner profile. The
 * teammates are then moved into their team account the way
 * redeem_invitation would, and their empty personal accounts removed.
 *
 * Phase 1b replaces auth.users with the app's own users table; only
 * `createUser` needs to change then.
 */
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { TABLES, type AccountCtx } from './tables';

export type Role = 'owner' | 'admin' | 'agent' | 'viewer';

export interface Member {
  userId: string;
  role: Role;
  label: string;
}

export interface Tenant extends AccountCtx {
  name: 'A' | 'B';
  members: Record<string, Member>;
}

export interface Fixture {
  A: Tenant;
  B: Tenant;
}

async function createUser(
  c: Client,
  label: string
): Promise<{ userId: string; accountId: string }> {
  const userId = randomUUID();
  await c.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
     VALUES ($1, $2, $3, 'authenticated', 'authenticated')`,
    [
      userId,
      `${label}.${userId.slice(0, 8)}@isolation.test`,
      { full_name: label },
    ]
  );
  const { rows } = await c.query(
    'SELECT account_id, account_role FROM profiles WHERE user_id = $1',
    [userId]
  );
  // handle_new_user swallows its own errors (RAISE WARNING), so assert
  // it actually ran instead of discovering it three tests later.
  if (rows.length !== 1 || rows[0].account_role !== 'owner') {
    throw new Error(`signup trigger did not bootstrap ${label}`);
  }
  return { userId, accountId: rows[0].account_id };
}

async function joinAccount(
  c: Client,
  userId: string,
  accountId: string,
  role: Role
) {
  const { rows } = await c.query(
    'SELECT account_id FROM profiles WHERE user_id = $1',
    [userId]
  );
  const personal = rows[0].account_id as string;
  await c.query(
    'UPDATE profiles SET account_id = $2, account_role = $3 WHERE user_id = $1',
    [userId, accountId, role]
  );
  await c.query('DELETE FROM accounts WHERE id = $1', [personal]);
}

async function insertRow(
  c: Client,
  table: string,
  pk: string,
  row: Record<string, unknown>
) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(', ')})
               VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
               RETURNING ${pk} AS pk`;
  const { rows } = await c.query(sql, Object.values(row));
  return rows[0].pk as string;
}

async function seedTenant(
  c: Client,
  name: 'A' | 'B',
  roles: Role[]
): Promise<Tenant> {
  const owner = await createUser(c, `${name}-owner`);
  const members: Record<string, Member> = {
    owner: { userId: owner.userId, role: 'owner', label: `${name}.owner` },
  };
  for (const role of roles.filter((r) => r !== 'owner')) {
    const u = await createUser(c, `${name}-${role}`);
    await joinAccount(c, u.userId, owner.accountId, role);
    members[role] = { userId: u.userId, role, label: `${name}.${role}` };
  }

  const ctx: Tenant = {
    name,
    accountId: owner.accountId,
    ownerId: owner.userId,
    ids: {},
    members,
  };

  const prof = await c.query('SELECT id FROM profiles WHERE user_id = $1', [
    owner.userId,
  ]);
  ctx.ids.accounts = owner.accountId;
  ctx.ids.profiles = prof.rows[0].id;

  for (const spec of TABLES) {
    if (spec.seeded === false) continue;
    ctx.ids[spec.table] = await insertRow(
      c,
      spec.table,
      spec.pk,
      spec.row(ctx, owner.userId)
    );
  }
  return ctx;
}

export async function seedFixture(c: Client): Promise<Fixture> {
  const A = await seedTenant(c, 'A', ['owner', 'admin', 'agent', 'viewer']);
  const B = await seedTenant(c, 'B', ['owner', 'agent']);
  return { A, B };
}
