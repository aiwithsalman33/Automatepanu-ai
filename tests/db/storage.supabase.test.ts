/**
 * Storage isolation baseline (Supabase Storage policies on storage.objects).
 *
 * Supabase-only: checkpoint 1f replaces Storage with MinIO/S3 and moves
 * these rules into the upload/download routes, where they get their own
 * tests. This file records what those routes must preserve:
 *
 *   chat-media / flow-media   key prefix  account-<account_id>/…
 *     read   any member of that account
 *     write  agent and up, own account prefix only
 *   avatars                   key prefix  <user_id>/…   (own folder only)
 *
 * DELETE is not probed: Supabase's protect_objects_delete trigger refuses
 * every direct SQL delete on storage.objects regardless of policy.
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
import { seedFixture, type Fixture, type Member } from './fixture';

const isSupabase = selectedAdapter().name === 'supabase';

let c: Client;
let fx: Fixture;
const objects: Record<string, string> = {};
const user = (m: Member): Principal => ({
  kind: 'user',
  userId: m.userId,
  label: m.label,
});

async function putObject(bucket: string, name: string) {
  const { rows } = await c.query(
    'INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2) RETURNING id',
    [bucket, name]
  );
  return rows[0].id as string;
}

const readObject = (cc: Client, id: string) =>
  attempt(cc, 'SELECT id FROM storage.objects WHERE id = $1', [id]);
const insertObject = (cc: Client, bucket: string, name: string) =>
  attempt(cc, 'INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2)', [
    bucket,
    name,
  ]);

describe.runIf(isSupabase)('storage.objects (Supabase baseline)', () => {
  beforeAll(async () => {
    c = await openTestTransaction();
    fx = await seedFixture(c);
    for (const t of [fx.A, fx.B]) {
      objects[`chat-${t.name}`] = await putObject(
        'chat-media',
        `account-${t.accountId}/a.png`
      );
      objects[`flow-${t.name}`] = await putObject(
        'flow-media',
        `account-${t.accountId}/a.png`
      );
      objects[`avatar-${t.name}`] = await putObject(
        'avatars',
        `${t.ownerId}/avatar.png`
      );
    }
  });

  afterAll(async () => {
    await closeTestTransaction(c);
  });

  it.each(['chat', 'flow'])(
    "%s-media: every A member reads A's object, none reads B's",
    async (b) => {
      for (const m of Object.values(fx.A.members)) {
        await asPrincipal(c, user(m), async (cc) => {
          const own = await readObject(cc, objects[`${b}-A`]);
          expect(
            own.status === 'ok' && own.rowCount === 1,
            `${m.label} own: ${describeOutcome(own)}`
          ).toBe(true);
          const other = await readObject(cc, objects[`${b}-B`]);
          expect(
            isBlocked(other),
            `${m.label} B: ${describeOutcome(other)}`
          ).toBe(true);
        });
      }
    }
  );

  it.each(['chat-media', 'flow-media'])(
    '%s: agent+ may upload to own prefix only; viewer may not upload',
    async (bucket) => {
      for (const m of Object.values(fx.A.members)) {
        await asPrincipal(c, user(m), async (cc) => {
          const own = await insertObject(
            cc,
            bucket,
            `account-${fx.A.accountId}/${m.role}-new.png`
          );
          const shouldWrite = m.role !== 'viewer';
          expect(
            shouldWrite ? isPermitted(own) : isBlocked(own),
            `${m.label} own prefix: ${describeOutcome(own)}`
          ).toBe(true);
          const other = await insertObject(
            cc,
            bucket,
            `account-${fx.B.accountId}/${m.role}-evil.png`
          );
          expect(
            isBlocked(other),
            `${m.label} B prefix: ${describeOutcome(other)}`
          ).toBe(true);
        });
      }
    }
  );

  it('avatars: users read/write only their own folder', async () => {
    await asPrincipal(c, user(fx.A.members.owner), async (cc) => {
      expect((await readObject(cc, objects['avatar-A'])).status).toBe('ok');
      expect(isBlocked(await readObject(cc, objects['avatar-B']))).toBe(true);
      expect(
        isPermitted(
          await insertObject(cc, 'avatars', `${fx.A.ownerId}/new.png`)
        )
      ).toBe(true);
      expect(
        isBlocked(await insertObject(cc, 'avatars', `${fx.B.ownerId}/evil.png`))
      ).toBe(true);
    });
  });

  it("a WHERE-less UPDATE by an A agent does not touch B's objects", async () => {
    const xmin = async (cc: Client, id: string) =>
      (
        await cc.query(
          'SELECT xmin::text AS x FROM storage.objects WHERE id = $1',
          [id]
        )
      ).rows[0].x;
    const before = await xmin(c, objects['chat-B']);
    await asPrincipal(c, user(fx.A.members.agent), async (cc) => {
      await attempt(cc, 'UPDATE storage.objects SET metadata = $1', [
        { touched: true },
      ]);
      await cc.query('RESET ROLE');
      expect(await xmin(cc, objects['chat-B'])).toBe(before);
    });
  });

  it('anon can read no tenant objects', async () => {
    await asPrincipal(c, { kind: 'anon' }, async (cc) => {
      for (const id of Object.values(objects)) {
        expect(isBlocked(await readObject(cc, id))).toBe(true);
      }
    });
  });
});
