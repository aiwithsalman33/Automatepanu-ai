/**
 * Cross-tenant isolation baseline: for EVERY table in `public`, prove
 * that a member of account A cannot read, update, delete, insert into, or
 * re-parent rows into account B, and that within account A each role
 * gets exactly the access its tier allows (tables.ts).
 *
 * Runs against a real Postgres; see tests/db/README.md.
 */
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asPrincipal,
  attempt,
  closeTestTransaction,
  describeOutcome,
  isBlocked,
  isPermitted,
  openTestTransaction,
  selectedAdapter,
  type Principal,
} from './harness';
import { seedFixture, type Fixture, type Member, type Tenant } from './fixture';
import { physicalTable, TABLES, type TableSpec, type Tier } from './tables';

/** The physical table for this adapter (e.g. profiles → account_members). */
const ADAPTER_NAME = selectedAdapter().name;
const T = (s: TableSpec) => physicalTable(s, ADAPTER_NAME);

const RANK: Record<Member['role'], number> = {
  viewer: 1,
  agent: 2,
  admin: 3,
  owner: 4,
};

function tierAllows(tier: Tier, m: Member, rowOwnerId: string): boolean {
  switch (tier) {
    case 'member':
      return RANK[m.role] >= 1;
    case 'agent':
      return RANK[m.role] >= 2;
    case 'admin':
      return RANK[m.role] >= 3;
    case 'self':
      return m.userId === rowOwnerId;
    case 'none':
      return false;
  }
}

const user = (m: Member): Principal => ({
  kind: 'user',
  userId: m.userId,
  label: m.label,
});

let c: Client;
let fx: Fixture;

beforeAll(async () => {
  c = await openTestTransaction();
  fx = await seedFixture(c);
});

afterAll(async () => {
  await closeTestTransaction(c);
});

function insertSql(spec: TableSpec, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  return {
    sql: `INSERT INTO ${T(spec)} (${cols.join(', ')}) VALUES (${cols
      .map((_, i) => `$${i + 1}`)
      .join(', ')})`,
    params: Object.values(row),
  };
}

const probe = {
  select: (s: TableSpec) => `SELECT ${s.pk} FROM ${T(s)} WHERE ${s.pk} = $1`,
  update: (s: TableSpec) => {
    const col = s.touch ?? s.pk;
    return `UPDATE ${T(s)} SET ${col} = ${col} WHERE ${s.pk} = $1`;
  },
  delete: (s: TableSpec) => `DELETE FROM ${T(s)} WHERE ${s.pk} = $1`,
};

/**
 * Blind write probes. An UPDATE/DELETE with a WHERE clause is also
 * filtered by the SELECT policy, so a leaky UPDATE/DELETE policy hides
 * behind a strict SELECT policy. An attacker doesn't need a WHERE: a bare
 * `UPDATE t SET c = c` hits every row the UPDATE policy admits. These run
 * the statement with no WHERE, drop back to the fixture role (RESET ROLE;
 * the outer savepoint still rolls everything back) and check whether the
 * target row was touched: an update always writes a new tuple (new xmin),
 * a delete removes it.
 */
async function xminOf(
  cc: Client,
  spec: TableSpec,
  id: string
): Promise<string | null> {
  const { rows } = await cc.query(
    `SELECT xmin::text AS x FROM ${T(spec)} WHERE ${spec.pk} = $1`,
    [id]
  );
  return rows[0]?.x ?? null;
}

async function blindUpdateTouched(
  m: Member,
  spec: TableSpec,
  targetId: string
) {
  const col = spec.blindColumn ?? 'created_at';
  const before = await xminOf(c, spec, targetId);
  // Assign the target's own current value as a *parameter*, so the SET
  // clause reads no column (which would pull in the SELECT policy).
  const { rows } = await c.query(
    `SELECT ${col} AS v FROM ${T(spec)} WHERE ${spec.pk} = $1`,
    [targetId]
  );
  return asPrincipal(c, user(m), async (cc) => {
    await attempt(cc, `UPDATE ${T(spec)} SET ${col} = $1`, [rows[0].v]);
    await cc.query('RESET ROLE');
    return (await xminOf(cc, spec, targetId)) !== before;
  });
}

async function blindDeleteRemoved(
  m: Member,
  spec: TableSpec,
  targetId: string
) {
  return asPrincipal(c, user(m), async (cc) => {
    await attempt(cc, `DELETE FROM ${T(spec)}`);
    await cc.query('RESET ROLE');
    return (await xminOf(cc, spec, targetId)) === null;
  });
}

/** Collect one line per violation so a failure names every leak at once. */
async function forEachMember(
  tenant: Tenant,
  check: (m: Member) => Promise<string | null>
): Promise<string[]> {
  const failures: string[] = [];
  for (const m of Object.values(tenant.members)) {
    const f = await check(m);
    if (f) failures.push(f);
  }
  return failures;
}

describe('coverage', () => {
  it('every table in public has an isolation spec', async () => {
    const { rows } = await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1"
    );
    const actual = rows.map((r) => r.tablename as string).sort();
    const specced = TABLES.map((t) => T(t)).sort();
    expect(specced).toEqual(actual);
  });

  it('RLS is enabled on every table in public', async () => {
    const { rows } = await c.query(
      `SELECT relname FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity`
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  // Mutation self-tests: DDL is transactional, so plant a leaky policy in
  // a savepoint, prove the probes notice, and roll it back. Without these
  // an all-green run could just mean the probes can't see anything.
  async function withPlantedPolicy(ddl: string, fn: () => Promise<void>) {
    await c.query('SAVEPOINT planted');
    try {
      await c.query(ddl);
      await fn();
    } finally {
      await c.query('ROLLBACK TO SAVEPOINT planted');
    }
  }

  it('detects a planted cross-tenant READ leak', async () => {
    const spec = TABLES.find((t) => t.table === 'contacts')!;
    await withPlantedPolicy(
      'CREATE POLICY zz_leak ON contacts FOR SELECT USING (true)',
      () =>
        asPrincipal(c, user(fx.A.members.agent), async (cc) => {
          const o = await attempt(cc, probe.select(spec), [fx.B.ids.contacts]);
          expect(isBlocked(o)).toBe(false);
        })
    );
  });

  it('detects a planted cross-tenant UPDATE leak hidden behind a strict SELECT policy', async () => {
    const spec = TABLES.find((t) => t.table === 'messages')!;
    await withPlantedPolicy(
      'CREATE POLICY zz_leak ON messages FOR UPDATE USING (true) WITH CHECK (true)',
      async () => {
        expect(
          await blindUpdateTouched(fx.A.members.agent, spec, fx.B.ids.messages)
        ).toBe(true);
      }
    );
  });

  it('detects a planted cross-tenant DELETE leak hidden behind a strict SELECT policy', async () => {
    const spec = TABLES.find((t) => t.table === 'contacts')!;
    await withPlantedPolicy(
      'CREATE POLICY zz_leak ON contacts FOR DELETE USING (true)',
      async () => {
        expect(
          await blindDeleteRemoved(fx.A.members.agent, spec, fx.B.ids.contacts)
        ).toBe(true);
      }
    );
  });

  it('detects a planted role-tier leak (viewer writing settings)', async () => {
    const spec = TABLES.find((t) => t.table === 'whatsapp_config')!;
    await withPlantedPolicy(
      'CREATE POLICY zz_leak ON whatsapp_config FOR UPDATE USING (is_account_member(account_id))',
      () =>
        asPrincipal(c, user(fx.A.members.viewer), async (cc) => {
          const o = await attempt(cc, probe.update(spec), [
            fx.A.ids.whatsapp_config,
          ]);
          expect(isPermitted(o)).toBe(true);
        })
    );
  });

  it('savepoint-scoped identity does not leak back to the fixture role', async () => {
    const before = await c.query('SELECT current_user AS u');
    await asPrincipal(c, user(fx.A.members.viewer), async (cc) => {
      const inside = await cc.query(
        'SELECT current_user AS u, auth.uid() AS uid'
      );
      expect(inside.rows[0].uid).toBe(fx.A.members.viewer.userId);
    });
    const after = await c.query('SELECT current_user AS u');
    expect(after.rows[0].u).toBe(before.rows[0].u);
  });
});

describe.each(TABLES)('$table', (spec) => {
  // ---------------- cross-tenant: A → B ----------------
  it("A members cannot SELECT B's row", async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.select(spec), [fx.B.ids[spec.table]]);
        return isBlocked(o)
          ? null
          : `${m.label} sees B row: ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it("A members cannot UPDATE B's row", async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.update(spec), [fx.B.ids[spec.table]]);
        return isBlocked(o)
          ? null
          : `${m.label} updated B row: ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it("A members cannot DELETE B's row", async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.delete(spec), [fx.B.ids[spec.table]]);
        return isBlocked(o)
          ? null
          : `${m.label} deleted B row: ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it("A members' WHERE-less UPDATE does not touch B's row", async () => {
    const failures: string[] = [];
    for (const m of Object.values(fx.A.members)) {
      if (await blindUpdateTouched(m, spec, fx.B.ids[spec.table])) {
        failures.push(`${m.label} blind UPDATE touched B row`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("A members' WHERE-less DELETE does not remove B's row", async () => {
    const failures: string[] = [];
    for (const m of Object.values(fx.A.members)) {
      if (await blindDeleteRemoved(m, spec, fx.B.ids[spec.table])) {
        failures.push(`${m.label} blind DELETE removed B row`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('A members cannot INSERT a row into B', async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const { sql, params } = insertSql(spec, spec.row(fx.B, m.userId));
        const o = await attempt(cc, sql, params);
        return isBlocked(o)
          ? null
          : `${m.label} inserted into B: ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it.runIf(!!spec.tenantColumn)(
    'A members cannot re-parent an A row into B',
    async () => {
      const tc = spec.tenantColumn!;
      const failures = await forEachMember(fx.A, (m) =>
        asPrincipal(c, user(m), async (cc) => {
          const o = await attempt(
            cc,
            `UPDATE ${T(spec)} SET ${tc.column} = $2 WHERE ${spec.pk} = $1`,
            [fx.A.ids[spec.table], tc.idFrom(fx.B)]
          );
          return isBlocked(o)
            ? null
            : `${m.label} moved A row into B via ${tc.column}: ${describeOutcome(o)}`;
        })
      );
      expect(failures).toEqual([]);
    }
  );

  // ---------------- own account: role tiers ----------------
  it(`own account SELECT matches tier "${spec.read}"`, async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.select(spec), [fx.A.ids[spec.table]]);
        const want = tierAllows(spec.read, m, fx.A.ownerId);
        const got = o.status === 'ok' && o.rowCount === 1;
        return want === got
          ? null
          : `${m.label} read: want ${want}, got ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it(`own account UPDATE matches tier "${spec.update}"`, async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.update(spec), [fx.A.ids[spec.table]]);
        const want = tierAllows(spec.update, m, fx.A.ownerId);
        const ok = want ? isPermitted(o) : isBlocked(o);
        return ok
          ? null
          : `${m.label} update: want ${want}, got ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it(`own account DELETE matches tier "${spec.delete}"`, async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const o = await attempt(cc, probe.delete(spec), [fx.A.ids[spec.table]]);
        const want = tierAllows(spec.delete, m, fx.A.ownerId);
        const ok = want ? isPermitted(o) : isBlocked(o);
        return ok
          ? null
          : `${m.label} delete: want ${want}, got ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  it(`own account INSERT matches tier "${spec.insert}"`, async () => {
    const failures = await forEachMember(fx.A, (m) =>
      asPrincipal(c, user(m), async (cc) => {
        const { sql, params } = insertSql(spec, spec.row(fx.A, m.userId));
        const o = await attempt(cc, sql, params);
        const want = tierAllows(spec.insert, m, fx.A.ownerId);
        const ok = want ? isPermitted(o) : isBlocked(o);
        return ok
          ? null
          : `${m.label} insert: want ${want}, got ${describeOutcome(o)}`;
      })
    );
    expect(failures).toEqual([]);
  });

  // ---------------- anon + service ----------------
  it("anon cannot read either tenant's row", async () => {
    await asPrincipal(c, { kind: 'anon' }, async (cc) => {
      for (const t of [fx.A, fx.B]) {
        const o = await attempt(cc, probe.select(spec), [t.ids[spec.table]]);
        expect(isBlocked(o), `anon read ${t.name}: ${describeOutcome(o)}`).toBe(
          true
        );
      }
    });
  });

  it('anon cannot insert', async () => {
    await asPrincipal(c, { kind: 'anon' }, async (cc) => {
      const { sql, params } = insertSql(spec, spec.row(fx.A, fx.A.ownerId));
      const o = await attempt(cc, sql, params);
      expect(isBlocked(o), `anon insert: ${describeOutcome(o)}`).toBe(true);
    });
  });

  it('service role bypasses RLS (so server paths MUST filter by account_id)', async () => {
    await asPrincipal(c, { kind: 'service' }, async (cc) => {
      const o = await attempt(cc, probe.select(spec), [fx.B.ids[spec.table]]);
      expect(o.status === 'ok' && o.rowCount === 1, describeOutcome(o)).toBe(
        true
      );
    });
  });
});
