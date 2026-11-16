/**
 * Checkpoint 1d: the browser data API (/api/data/<table>) on the
 * self-hosted stack, end to end below the HTTP layer: validateRequest →
 * executeDataRequest → private PostgREST as wacrm_app (RLS).
 *
 * Needs TEST_POSTGREST_URL / TEST_POSTGREST_JWT_SECRET (CI starts the
 * same PostgREST image as compose). Commits its fixture; removed in
 * afterAll.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { executeDataRequest } from '@/lib/data/execute';
import { validateRequest } from '@/lib/data/validate';
import { postgrestClientFor } from '@/lib/db/postgrest';
import { CONVERSATION_SELECT } from '@/lib/inbox/conversations';
import { DATABASE_URL, selectedAdapter } from './harness';

const isApp = selectedAdapter().name === 'app';
const POSTGREST_URL = process.env.TEST_POSTGREST_URL ?? '';
const POSTGREST_SECRET = process.env.TEST_POSTGREST_JWT_SECRET ?? '';

interface Tenant {
  userId: string;
  accountId: string;
  memberId: string;
  contactId: string;
  dealId: string;
}

describe.runIf(isApp && POSTGREST_URL && POSTGREST_SECRET)(
  'browser data API (registry + RLS through PostgREST)',
  () => {
    let admin: Client;
    let A: Tenant;
    let B: Tenant;

    async function tenant(label: string): Promise<Tenant> {
      const userId = randomUUID();
      await admin.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`,
        [
          userId,
          `${label}.${userId.slice(0, 8)}@data-api.test`,
          { full_name: label },
        ]
      );
      const m = await admin.query(
        'SELECT id, account_id FROM account_members WHERE user_id = $1',
        [userId]
      );
      const { id: memberId, account_id: accountId } = m.rows[0];
      const contact = await admin.query(
        `INSERT INTO contacts (user_id, account_id, name, phone)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          userId,
          accountId,
          `contact ${label}`,
          `+1555${Math.floor(Math.random() * 1e7)}`,
        ]
      );
      const contactId = contact.rows[0].id;
      const p = await admin.query(
        `INSERT INTO pipelines (user_id, account_id, name) VALUES ($1, $2, 'P') RETURNING id`,
        [userId, accountId]
      );
      const s = await admin.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, position) VALUES ($1, 'S', 0) RETURNING id`,
        [p.rows[0].id]
      );
      const d = await admin.query(
        `INSERT INTO deals (user_id, account_id, pipeline_id, stage_id, title, contact_id, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          userId,
          accountId,
          p.rows[0].id,
          s.rows[0].id,
          `deal ${label}`,
          contactId,
          memberId,
        ]
      );
      await admin.query(
        `INSERT INTO conversations (user_id, account_id, contact_id) VALUES ($1, $2, $3)`,
        [userId, accountId, contactId]
      );
      return { userId, accountId, memberId, contactId, dealId: d.rows[0].id };
    }

    const run = (who: Tenant, table: string, raw: unknown) => {
      process.env.POSTGREST_URL = POSTGREST_URL;
      process.env.POSTGREST_JWT_SECRET = POSTGREST_SECRET;
      const db = postgrestClientFor({ role: 'wacrm_app', sub: who.userId });
      return executeDataRequest(db, table, validateRequest(table, raw), {
        userId: who.userId,
        accountId: who.accountId,
      });
    };

    beforeAll(async () => {
      admin = new Client({ connectionString: DATABASE_URL });
      await admin.connect();
      A = await tenant('A');
      B = await tenant('B');
    });

    afterAll(async () => {
      if (admin && A && B) {
        const users = [A.userId, B.userId];
        await admin.query(
          'DELETE FROM accounts WHERE owner_user_id = ANY($1)',
          [users]
        );
        await admin.query('DELETE FROM auth.users WHERE id = ANY($1)', [users]);
      }
      await admin?.end();
    });

    it("lists only the caller's contacts, even with no filter", async () => {
      const res = await run(A, 'contacts', {
        op: 'select',
        select: 'id, account_id',
      });
      expect(res.error).toBeNull();
      const rows = res.data as { id: string; account_id: string }[];
      expect(rows.map((r) => r.id)).toContain(A.contactId);
      expect(rows.every((r) => r.account_id === A.accountId)).toBe(true);
    });

    it("can't read the other tenant's row by id", async () => {
      const res = await run(A, 'contacts', {
        op: 'select',
        filters: [['eq', 'id', B.contactId]],
        single: 'maybe',
      });
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
    });

    it("can't update or delete the other tenant's rows", async () => {
      const upd = await run(A, 'contacts', {
        op: 'update',
        values: { name: 'pwned' },
        filters: [['eq', 'id', B.contactId]],
        select: 'id',
      });
      expect(upd.data ?? []).toEqual([]);
      const del = await run(A, 'contacts', {
        op: 'delete',
        filters: [['eq', 'id', B.contactId]],
        select: 'id',
      });
      expect(del.data ?? []).toEqual([]);
      const { rows } = await admin.query(
        'SELECT name FROM contacts WHERE id = $1',
        [B.contactId]
      );
      expect(rows[0].name).toBe('contact B');
    });

    it("an insert naming the other tenant's account lands in the caller's (stamped)", async () => {
      const name = `planted-${randomUUID().slice(0, 6)}`;
      const res = await run(A, 'tags', {
        op: 'insert',
        values: {
          name,
          color: '#123456',
          account_id: B.accountId,
          user_id: B.userId,
        },
        select: 'id, account_id, user_id',
        single: 'single',
      });
      expect(res.error).toBeNull();
      expect(res.data).toMatchObject({
        account_id: A.accountId,
        user_id: A.userId,
      });
      const inB = await admin.query(
        'SELECT 1 FROM tags WHERE account_id = $1 AND name = $2',
        [B.accountId, name]
      );
      expect(inB.rowCount).toBe(0);
    });

    it('embeds used by the UI resolve (incl. profiles view via deals_assigned_to_fkey)', async () => {
      const deals = await run(A, 'deals', {
        op: 'select',
        select:
          '*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)',
        filters: [['eq', 'id', A.dealId]],
        single: 'single',
      });
      expect(deals.error).toBeNull();
      expect(deals.data).toMatchObject({
        id: A.dealId,
        contact: { id: A.contactId },
        assignee: { id: A.memberId },
      });

      const convs = await run(A, 'conversations', {
        op: 'select',
        select: CONVERSATION_SELECT,
      });
      expect(convs.error).toBeNull();
      const list = convs.data as { contact: { id: string } }[];
      expect(list.length).toBe(1);
      expect(list[0].contact.id).toBe(A.contactId);
    });

    it('count + head returns the exact count without rows', async () => {
      const res = await run(A, 'contacts', {
        op: 'select',
        select: 'id',
        count: 'exact',
        head: true,
      });
      expect(res.error).toBeNull();
      expect(res.count).toBe(1);
    });

    it('server-side contact search matches on name', async () => {
      const res = await run(A, 'contacts', {
        op: 'select',
        select: 'id',
        search: { term: 'contact A' },
      });
      expect((res.data as { id: string }[]).map((r) => r.id)).toEqual([
        A.contactId,
      ]);
    });
  }
);
