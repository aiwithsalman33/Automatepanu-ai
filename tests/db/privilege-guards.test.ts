/**
 * Privilege-escalation guards and RPC tenant isolation (baseline).
 *
 * rls-isolation.test.ts covers plain table access. This file covers what
 * RLS alone doesn't: guard triggers on identity columns, column grants,
 * and the SECURITY DEFINER / INVOKER RPCs, which run their own checks.
 */
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asPrincipal,
  attempt,
  closeTestTransaction,
  describeOutcome,
  isBlocked,
  openTestTransaction,
  PRIVILEGE_ERROR,
  selectedAdapter,
  type Principal,
} from './harness';
import { seedFixture, type Fixture, type Member } from './fixture';

let c: Client;
let fx: Fixture;
const user = (m: Member): Principal => ({
  kind: 'user',
  userId: m.userId,
  label: m.label,
});

/** As the fixture role (BYPASSRLS): ground truth after a probe. */
async function roleOf(userId: string) {
  const { rows } = await c.query(
    'SELECT account_id, account_role FROM profiles WHERE user_id = $1',
    [userId]
  );
  return rows[0] as { account_id: string; account_role: string };
}

beforeAll(async () => {
  c = await openTestTransaction();
  fx = await seedFixture(c);
});

afterAll(async () => {
  await closeTestTransaction(c);
});

describe('identity-column guards', () => {
  it('a member cannot raise their own account_role', async () => {
    for (const m of [
      fx.A.members.agent,
      fx.A.members.viewer,
      fx.A.members.admin,
    ]) {
      const o = await asPrincipal(c, user(m), (cc) =>
        attempt(
          cc,
          "UPDATE profiles SET account_role = 'owner' WHERE user_id = $1",
          [m.userId]
        )
      );
      expect(
        o.status === 'error' && o.code === PRIVILEGE_ERROR,
        `${m.label}: ${describeOutcome(o)}`
      ).toBe(true);
    }
  });

  it('a member cannot move their own profile into another account', async () => {
    const m = fx.A.members.agent;
    const o = await asPrincipal(c, user(m), (cc) =>
      attempt(cc, 'UPDATE profiles SET account_id = $2 WHERE user_id = $1', [
        m.userId,
        fx.B.accountId,
      ])
    );
    expect(isBlocked(o), describeOutcome(o)).toBe(true);
  });

  it("a member cannot edit a teammate's profile", async () => {
    const o = await asPrincipal(c, user(fx.A.members.admin), (cc) =>
      attempt(
        cc,
        "UPDATE profiles SET full_name = 'pwned' WHERE user_id = $1",
        [fx.A.ownerId]
      )
    );
    expect(isBlocked(o), describeOutcome(o)).toBe(true);
  });

  it("an admin cannot take over the account's owner_user_id", async () => {
    const m = fx.A.members.admin;
    const o = await asPrincipal(c, user(m), (cc) =>
      attempt(cc, 'UPDATE accounts SET owner_user_id = $2 WHERE id = $1', [
        fx.A.accountId,
        m.userId,
      ])
    );
    expect(
      o.status === 'error' && o.code === PRIVILEGE_ERROR,
      describeOutcome(o)
    ).toBe(true);
  });

  it('an admin cannot create an owner-role invitation', async () => {
    const o = await asPrincipal(c, user(fx.A.members.admin), (cc) =>
      attempt(
        cc,
        "UPDATE account_invitations SET role = 'owner' WHERE id = $1",
        [fx.A.ids.account_invitations]
      )
    );
    expect(o.status, describeOutcome(o)).toBe('error');
  });

  it('notifications: the recipient may only change read_at', async () => {
    const o = await asPrincipal(c, user(fx.A.members.owner), (cc) =>
      attempt(cc, "UPDATE notifications SET title = 'forged' WHERE id = $1", [
        fx.A.ids.notifications,
      ])
    );
    expect(
      o.status === 'error' && o.code === PRIVILEGE_ERROR,
      describeOutcome(o)
    ).toBe(true);
  });

  it('a conversation cannot be assigned to a user outside the account', async () => {
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      await attempt(
        cc,
        'UPDATE conversations SET assigned_agent_id = $2 WHERE id = $1',
        [fx.A.ids.conversations, fx.B.members.agent.userId]
      );
      await cc.query('RESET ROLE');
      const { rows } = await cc.query(
        'SELECT assigned_agent_id FROM conversations WHERE id = $1',
        [fx.A.ids.conversations]
      );
      expect(rows[0].assigned_agent_id).not.toBe(fx.B.members.agent.userId);
    });
  });
});

describe('member-management RPCs cannot reach another tenant', () => {
  it('set_member_role on a B member fails and changes nothing', async () => {
    const target = fx.B.members.agent;
    const o = await asPrincipal(c, user(fx.A.members.admin), (cc) =>
      attempt(cc, "SELECT set_member_role($1, 'viewer')", [target.userId])
    );
    expect(o.status, describeOutcome(o)).toBe('error');
    expect((await roleOf(target.userId)).account_role).toBe('agent');
  });

  it('remove_account_member on a B member fails and changes nothing', async () => {
    const target = fx.B.members.agent;
    const o = await asPrincipal(c, user(fx.A.members.admin), (cc) =>
      attempt(cc, 'SELECT remove_account_member($1)', [target.userId])
    );
    expect(o.status, describeOutcome(o)).toBe('error');
    expect((await roleOf(target.userId)).account_id).toBe(fx.B.accountId);
  });

  it('transfer_account_ownership to a B member fails and changes nothing', async () => {
    const o = await asPrincipal(c, user(fx.A.members.owner), (cc) =>
      attempt(cc, 'SELECT transfer_account_ownership($1)', [
        fx.B.members.agent.userId,
      ])
    );
    expect(o.status, describeOutcome(o)).toBe('error');
    const { rows } = await c.query(
      'SELECT owner_user_id FROM accounts WHERE id = $1',
      [fx.A.accountId]
    );
    expect(rows[0].owner_user_id).toBe(fx.A.ownerId);
  });

  // Supabase: anon may EXECUTE these, but each refuses without a user.
  // New stack: anon lacks EXECUTE entirely (0003_hardening). Either way:
  // every call errors and nothing changes.
  it('anon calling the member RPCs is refused', async () => {
    const calls: [string, unknown[]][] = [
      ["SELECT set_member_role($1, 'admin')", [fx.A.members.agent.userId]],
      ['SELECT remove_account_member($1)', [fx.A.members.agent.userId]],
      ['SELECT transfer_account_ownership($1)', [fx.A.members.agent.userId]],
      ["SELECT redeem_invitation('nope')", []],
      ["SELECT touch_presence('online')", []],
    ];
    await asPrincipal(c, { kind: 'anon' }, async (cc) => {
      for (const [sql, params] of calls) {
        const o = await attempt(cc, sql, params);
        expect(o.status, `${sql}: ${describeOutcome(o)}`).toBe('error');
      }
    });
    expect((await roleOf(fx.A.members.agent.userId)).account_role).toBe(
      'agent'
    );
  });
});

describe("data RPCs are scoped to the caller's account", () => {
  it("filter_contacts_by_tags ignores another tenant's tag", async () => {
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      // Returns TABLE(contact contacts, total_count bigint).
      const q =
        'SELECT (contact).id AS id, total_count FROM filter_contacts_by_tags($1, NULL, 50, 0)';
      const own = await cc.query(q, [[fx.A.ids.tags]]);
      expect(own.rows.map((r) => r.id)).toContain(fx.A.ids.contacts);
      const other = await cc.query(q, [[fx.B.ids.tags]]);
      expect(other.rows.map((r) => r.id)).not.toContain(fx.B.ids.contacts);
      expect(other.rows.every((r) => Number(r.total_count) === 0)).toBe(true);
    });
  });

  it("match_ai_knowledge_fts returns nothing for another tenant's account id", async () => {
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      const own = await cc.query(
        "SELECT * FROM match_ai_knowledge_fts($1, 'isolationmarker', 5)",
        [fx.A.accountId]
      );
      expect(own.rowCount).toBeGreaterThan(0);
      const other = await cc.query(
        "SELECT * FROM match_ai_knowledge_fts($1, 'isolationmarker', 5)",
        [fx.B.accountId]
      );
      expect(other.rowCount).toBe(0);
    });
  });

  it("match_ai_knowledge_semantic returns nothing for another tenant's account id", async () => {
    const vec = `[${Array.from({ length: 1536 }, () => '0.01').join(',')}]`;
    await c.query(
      'UPDATE ai_knowledge_chunks SET embedding = $1::vector WHERE id = ANY($2)',
      [vec, [fx.A.ids.ai_knowledge_chunks, fx.B.ids.ai_knowledge_chunks]]
    );
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      const own = await cc.query(
        'SELECT * FROM match_ai_knowledge_semantic($1, $2, 5)',
        [fx.A.accountId, vec]
      );
      expect(own.rowCount).toBeGreaterThan(0);
      const other = await cc.query(
        'SELECT * FROM match_ai_knowledge_semantic($1, $2, 5)',
        [fx.B.accountId, vec]
      );
      expect(other.rowCount).toBe(0);
    });
  });

  it("dashboard_overview for A is unaffected by B's activity (and B's is)", async () => {
    const overview = (m: Member) =>
      asPrincipal(c, user(m), async (cc) => {
        const { rows } = await cc.query(
          "SELECT dashboard_overview(7, 'UTC') AS o"
        );
        return JSON.stringify(rows[0].o);
      });
    const aBefore = await overview(fx.A.members.owner);
    const bBefore = await overview(fx.B.members.owner);

    // Extra B-only activity, written as the fixture role.
    for (let i = 0; i < 3; i++) {
      const { rows: ct } = await c.query(
        `INSERT INTO contacts (user_id, account_id, phone, name)
         VALUES ($1, $2, $3, 'extra') RETURNING id`,
        [
          fx.B.ownerId,
          fx.B.accountId,
          `+1666${String(Date.now() + i).slice(-7)}`,
        ]
      );
      const { rows: cv } = await c.query(
        `INSERT INTO conversations (user_id, account_id, contact_id) VALUES ($1, $2, $3) RETURNING id`,
        [fx.B.ownerId, fx.B.accountId, ct[0].id]
      );
      await c.query(
        `INSERT INTO messages (conversation_id, sender_type, content_type, content_text)
         VALUES ($1, 'customer', 'text', 'extra')`,
        [cv[0].id]
      );
    }

    expect(await overview(fx.A.members.owner)).toBe(aBefore);
    expect(await overview(fx.B.members.owner)).not.toBe(bBefore);
  });

  it("broadcast delivery lease cannot be taken on another tenant's broadcast", async () => {
    const before = await c.query(
      'SELECT delivery_lease_until FROM broadcasts WHERE id = $1',
      [fx.B.ids.broadcasts]
    );
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      const o = await attempt(
        cc,
        'SELECT acquire_broadcast_delivery_lease($1) AS l',
        [fx.B.ids.broadcasts]
      );
      const leased =
        o.status === 'ok' && o.rows[0]?.l != null && o.rows[0].l !== false;
      expect(leased, describeOutcome(o)).toBe(false);
    });
    const after = await c.query(
      'SELECT delivery_lease_until FROM broadcasts WHERE id = $1',
      [fx.B.ids.broadcasts]
    );
    expect(after.rows[0].delivery_lease_until).toEqual(
      before.rows[0].delivery_lease_until
    );
  });

  it("replace_flow_nodes / replace_flow_graph cannot rewrite another tenant's flow", async () => {
    const count = async () =>
      (
        await c.query(
          'SELECT count(*)::int AS n FROM flow_nodes WHERE flow_id = $1',
          [fx.B.ids.flows]
        )
      ).rows[0].n;
    const before = await count();
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      const a = await attempt(
        cc,
        "SELECT replace_flow_nodes($1, '[]'::jsonb)",
        [fx.B.ids.flows]
      );
      expect(a.status, describeOutcome(a)).toBe('error');
      const b = await attempt(
        cc,
        "SELECT replace_flow_graph($1, '[]'::jsonb, '{}'::jsonb)",
        [fx.B.ids.flows]
      );
      expect(b.status, describeOutcome(b)).toBe('error');
    });
    expect(await count()).toBe(before);
  });

  it("touch_presence writes only the caller's own row in the caller's account", async () => {
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      await cc.query("SELECT touch_presence('away')");
      await cc.query('RESET ROLE');
      const { rows } = await cc.query(
        'SELECT account_id, status FROM member_presence WHERE user_id = $1',
        [fx.A.members.agent.userId]
      );
      expect(rows[0]).toMatchObject({
        account_id: fx.A.accountId,
        status: 'away',
      });
    });
  });
});

describe('internal SECURITY DEFINER functions are service-role only', () => {
  const SERVICE_ONLY = [
    '_bcast_bump',
    'bump_conversation_on_inbound',
    'claim_ai_reply_slot',
    'create_broadcast_with_recipients',
    'increment_automation_execution_count',
    'increment_flow_execution_count',
    'list_timed_out_flow_runs',
    'merge_duplicate_contacts',
    'merge_duplicate_conversations',
    'recompute_broadcast_counts',
    'record_webhook_failure',
  ];

  const { roles, anonDefinerAllowlist } = selectedAdapter();

  it.each(SERVICE_ONLY)(
    '%s is not executable by the anon or app role',
    async (fn) => {
      const { rows } = await c.query(
        `SELECT p.oid::regprocedure::text AS sig,
              has_function_privilege($2, p.oid, 'EXECUTE') AS anon,
              has_function_privilege($3, p.oid, 'EXECUTE') AS auth
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`,
        [fn, roles.anon, roles.app]
      );
      expect(rows.length, `${fn} not found`).toBeGreaterThan(0);
      for (const r of rows) {
        expect({ sig: r.sig, anon: r.anon, auth: r.auth }).toEqual({
          sig: r.sig,
          anon: false,
          auth: false,
        });
      }
    }
  );

  it('every anon-executable SECURITY DEFINER function is on the reviewed allowlist', async () => {
    const { rows } = await c.query(
      `SELECT DISTINCT p.proname FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
         AND p.prorettype <> 'trigger'::regtype
         AND has_function_privilege($1, p.oid, 'EXECUTE')
       ORDER BY 1`,
      [roles.anon]
    );
    expect(rows.map((r) => r.proname)).toEqual(anonDefinerAllowlist);
  });
});
