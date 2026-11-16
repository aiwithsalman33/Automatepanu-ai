/**
 * Native auth (Better Auth) end to end, against the self-hosted schema
 * (db/migrations, adapter "app"). Drives the real HTTP handler, so
 * cookies, the CSRF origin check and rate limiting are all exercised.
 *
 * Unlike the isolation suites this commits rows (Better Auth uses its
 * own pool); every user it creates is removed in afterAll.
 */
import { randomUUID } from 'node:crypto';
import { Client, type Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SecondaryStorage } from 'better-auth';
import type { EmailMessage, Mailer } from '@/lib/email/mailer';
import { AUTH_RATE_LIMITS, createNativeAuth } from '@/lib/auth/native/auth';
import { createAuthPool } from '@/lib/auth/native/db';
import { isBcryptHash } from '@/lib/auth/native/password';
import { DATABASE_URL, selectedAdapter } from './harness';

/** The response fields these tests read (Better Auth JSON bodies). */
type AuthJson = { user?: { email?: string } } & Record<string, unknown>;

const isApp = selectedAdapter().name === 'app';
const ORIGIN = 'http://localhost:3000';
const AUTHENTICATOR_URL =
  process.env.TEST_AUTHENTICATOR_DATABASE_URL ??
  'postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm';

/** Real GoTrue v2.195.0 hash (see src/lib/auth/native/password.test.ts). */
const GOTRUE_PASSWORD = 'Correct-Horse-9!';
const GOTRUE_HASH =
  '$2a$10$ja3mLLA8a17PXyM3QhkSo.6qreWwM8hLyiWPFoiCNCpYId0u237Z6';

/** In-memory SecondaryStorage with the same contract as the Redis one. */
function memoryStorage(): SecondaryStorage {
  const m = new Map<string, { v: string; exp: number | null }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp !== null && e.exp < Date.now()) m.delete(k);
    return m.get(k);
  };
  return {
    get: (k) => live(k)?.v ?? null,
    getAndDelete: (k) => {
      const v = live(k)?.v ?? null;
      m.delete(k);
      return v;
    },
    increment: (k, ttl) => {
      const e = live(k);
      const n = e ? Number(e.v) + 1 : 1;
      m.set(k, { v: String(n), exp: e ? e.exp : Date.now() + ttl * 1000 });
      return n;
    },
    set: (k, v, ttl) =>
      void m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : null }),
    delete: (k) => void m.delete(k),
  };
}

describe.runIf(isApp)(
  'native auth (Better Auth) on the self-hosted schema',
  () => {
    let pool: Pool;
    let admin: Client;
    let auth: ReturnType<typeof createNativeAuth>;
    const outbox: EmailMessage[] = [];
    const createdEmails: string[] = [];
    let ipSeq = 0;

    const mailer: Mailer = { send: async (m) => void outbox.push(m) };
    const email = (tag: string) => {
      const e = `${tag}.${randomUUID().slice(0, 8)}@auth.test`;
      createdEmails.push(e);
      return e;
    };
    /** Each logical client gets its own IP so rate limits don't bleed. */
    const newIp = () => `10.9.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

    async function call(
      path: string,
      {
        body,
        cookie,
        ip,
        origin = ORIGIN,
        method = body ? 'POST' : 'GET',
      }: {
        body?: unknown;
        cookie?: string;
        ip?: string;
        origin?: string | null;
        method?: string;
      } = {}
    ) {
      const headers = new Headers({ 'x-real-ip': ip ?? newIp() });
      if (body) headers.set('content-type', 'application/json');
      if (origin) headers.set('origin', origin);
      if (cookie) headers.set('cookie', cookie);
      const res = await auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
      );
      const setCookie = res.headers.getSetCookie?.() ?? [];
      const sessionCookie = setCookie
        .map((c) => c.split(';')[0])
        .filter((c) => c.includes('session_token'))
        .join('; ');
      let json: unknown = null;
      try {
        json = await res.clone().json();
      } catch {
        /* not JSON */
      }
      return {
        status: res.status,
        json: json as AuthJson | null,
        cookie: sessionCookie,
        rawSetCookie: setCookie,
      };
    }

    const lastLinkTo = (to: string) => {
      const msg = [...outbox].reverse().find((m) => m.to === to);
      const url = msg?.text.match(/https?:\/\/\S+/)?.[0];
      if (!url) throw new Error(`no email with a link sent to ${to}`);
      return new URL(url);
    };

    async function signUpAndVerify(tag: string, password = 'S3cure-pass') {
      const addr = email(tag);
      const up = await call('/sign-up/email', {
        body: { email: addr, password, name: tag },
      });
      expect(up.status, JSON.stringify(up.json)).toBe(200);
      const link = lastLinkTo(addr);
      const verified = await call(
        `${link.pathname.replace(/^\/api\/auth/, '')}${link.search}`,
        {
          method: 'GET',
        }
      );
      expect([200, 302]).toContain(verified.status);
      return addr;
    }

    beforeAll(async () => {
      pool = createAuthPool(AUTHENTICATOR_URL);
      admin = new Client({ connectionString: DATABASE_URL });
      await admin.connect();
      auth = createNativeAuth({
        pool,
        mailer,
        secret: 'test-secret-test-secret-test-secret-0123',
        baseURL: ORIGIN,
        trustedOrigins: [ORIGIN],
        secondaryStorage: memoryStorage(),
      });
    });

    afterAll(async () => {
      if (admin && createdEmails.length) {
        // accounts.owner_user_id is ON DELETE RESTRICT: drop tenants first.
        await admin.query(
          `DELETE FROM accounts WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email = ANY($1))`,
          [createdEmails]
        );
        await admin.query('DELETE FROM auth.users WHERE email = ANY($1)', [
          createdEmails,
        ]);
      }
      await admin?.end();
      await pool?.end();
    });

    it('the auth pool runs as wacrm_service on the auth schema, never as the login role', async () => {
      const { rows } = await pool.query(
        'SELECT current_user AS u, current_setting($1) AS sp',
        ['search_path']
      );
      expect(rows[0].u).toBe('wacrm_service');
      expect(rows[0].sp.replace(/\s+/g, '')).toBe('auth,public');
    });

    it('sign-up creates the user, a scrypt credential, and (via the trigger) an owner account', async () => {
      const addr = email('signup');
      const res = await call('/sign-up/email', {
        body: { email: addr, password: 'S3cure-pass', name: 'Ada' },
      });
      expect(res.status, JSON.stringify(res.json)).toBe(200);
      expect(res.cookie).toBe(''); // no session before the email is verified

      const { rows } = await admin.query(
        `SELECT u.email_verified, u.name, i.provider_id, i.password, p.account_role, a.name AS account_name
         FROM auth.users u
         JOIN auth.identities i ON i.user_id = u.id
         JOIN profiles p ON p.user_id = u.id
         JOIN accounts a ON a.id = p.account_id AND a.owner_user_id = u.id
        WHERE u.email = $1`,
        [addr]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        email_verified: false,
        name: 'Ada',
        provider_id: 'credential',
        account_role: 'owner',
        account_name: 'Ada',
      });
      expect(isBcryptHash(rows[0].password)).toBe(false);
      expect(rows[0].password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      expect(
        outbox.some(
          (m) => m.to === addr && /Confirm your email/.test(m.subject)
        )
      ).toBe(true);
    });

    it('sign-in is refused until the email is verified, then succeeds and creates a DB session', async () => {
      const addr = email('verify');
      await call('/sign-up/email', {
        body: { email: addr, password: 'S3cure-pass', name: 'V' },
      });

      const early = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      expect(early.status).toBe(403);

      const link = lastLinkTo(addr);
      await call(`${link.pathname.replace(/^\/api\/auth/, '')}${link.search}`, {
        method: 'GET',
      });

      const ok = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      expect(ok.status, JSON.stringify(ok.json)).toBe(200);
      expect(ok.cookie).toMatch(/^wacrm\.session_token=/);
      // Host-only cookie: no Domain attribute, so it is never sent to the
      // marketing site or any other *.axxeler.in host. HttpOnly, SameSite.
      const raw = ok.rawSetCookie.find((c) => c.includes('session_token'))!;
      expect(raw).not.toMatch(/;\s*domain=/i);
      expect(raw).toMatch(/;\s*httponly/i);
      expect(raw).toMatch(/;\s*samesite=lax/i);

      const me = await call('/get-session', { cookie: ok.cookie });
      expect(me.json?.user?.email).toBe(addr);
      // The session behind the sign-in cookie is a real DB row. (Opening the
      // verify link also signs the user in, autoSignInAfterVerification, so
      // there are two rows; that's intended.)
      const token = decodeURIComponent(ok.cookie.split('=')[1]).split('.')[0];
      const { rows } = await admin.query(
        'SELECT u.email FROM auth.sessions s JOIN auth.users u ON u.id = s.user_id WHERE s.token = $1',
        [token]
      );
      expect(rows.map((r) => r.email)).toEqual([addr]);
    });

    it.each([
      [
        'cost 4 (pgcrypto)',
        '$2a$04$x8FND429ow6RDG8ViwABjujVqUucdboA/IXESpAXj6pPcTgwfFbZm',
      ],
      [
        'cost 12 (bcryptjs)',
        '$2b$12$H6RIS1jksZC.e.ocx1s2LObieL/4cQ8bYu6CUo6BD9YCLDorrJ32.',
      ],
    ])(
      'a migrated user with a bcrypt %s hash: wrong password refused, right one signs in and rehashes',
      async (_label, hash) => {
        const addr = email('migrated-cost');
        const { rows } = await admin.query(
          `INSERT INTO auth.users (email, name, email_verified) VALUES ($1, 'Migrated', true) RETURNING id`,
          [addr]
        );
        const userId = rows[0].id;
        await admin.query(
          `INSERT INTO auth.identities (id, user_id, provider_id, account_id, password)
         VALUES ($1, $2::uuid, 'credential', $2::text, $3)`,
          [randomUUID(), userId, hash]
        );
        const stored = async () =>
          (
            await admin.query(
              'SELECT password FROM auth.identities WHERE user_id = $1',
              [userId]
            )
          ).rows[0].password;

        for (const wrong of ['migrated-pass-1', 'Migrated-Pass-2', '']) {
          const r = await call('/sign-in/email', {
            body: { email: addr, password: wrong },
          });
          expect(r.status, `wrong password "${wrong}"`).toBeGreaterThanOrEqual(
            400
          );
        }
        expect(await stored()).toBe(hash); // never rehashed on failure

        const ok = await call('/sign-in/email', {
          body: { email: addr, password: 'Migrated-Pass-1' },
        });
        expect(ok.status, JSON.stringify(ok.json)).toBe(200);
        expect(isBcryptHash(await stored())).toBe(false);
      }
    );

    it('an imported Supabase user signs in with their GoTrue bcrypt password, which is then upgraded to scrypt', async () => {
      const addr = email('imported');
      const { rows } = await admin.query(
        `INSERT INTO auth.users (email, name, email_verified) VALUES ($1, 'Imported', true) RETURNING id`,
        [addr]
      );
      const userId = rows[0].id;
      await admin.query(
        `INSERT INTO auth.identities (id, user_id, provider_id, account_id, password)
       VALUES ($1, $2::uuid, 'credential', $2::text, $3)`,
        [randomUUID(), userId, GOTRUE_HASH]
      );

      const wrong = await call('/sign-in/email', {
        body: { email: addr, password: 'not-it' },
      });
      expect(wrong.status).toBe(401);
      const stillBcrypt = await admin.query(
        'SELECT password FROM auth.identities WHERE user_id = $1',
        [userId]
      );
      expect(stillBcrypt.rows[0].password).toBe(GOTRUE_HASH); // failed sign-in never rehashes

      const ok = await call('/sign-in/email', {
        body: { email: addr, password: GOTRUE_PASSWORD },
      });
      expect(ok.status, JSON.stringify(ok.json)).toBe(200);

      const after = await admin.query(
        'SELECT password FROM auth.identities WHERE user_id = $1',
        [userId]
      );
      expect(isBcryptHash(after.rows[0].password)).toBe(false);
      expect(after.rows[0].password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

      // and the same password still works against the new hash
      const again = await call('/sign-in/email', {
        body: { email: addr, password: GOTRUE_PASSWORD },
      });
      expect(again.status).toBe(200);
    });

    it('rate-limits password sign-in per IP', async () => {
      const addr = await signUpAndVerify('ratelimit');
      const ip = newIp();
      const { max } = AUTH_RATE_LIMITS['/sign-in/email'];
      const statuses: number[] = [];
      for (let i = 0; i < max + 1; i++) {
        statuses.push(
          (
            await call('/sign-in/email', {
              ip,
              body: { email: addr, password: 'wrong-pass' },
            })
          ).status
        );
      }
      expect(statuses.slice(0, max).every((s) => s === 401)).toBe(true);
      expect(statuses[max]).toBe(429);
      // A different client is unaffected.
      expect(
        (
          await call('/sign-in/email', {
            body: { email: addr, password: 'S3cure-pass' },
          })
        ).status
      ).toBe(200);
    });

    it('session cookie flags: HttpOnly + SameSite=Lax always, Secure (+ __Secure- prefix) in production, host-only', async () => {
      const addr = await signUpAndVerify('cookieflags');
      const attrs = (raw: string[]) => {
        const c = raw.find((x) => x.includes('session_token'));
        expect(c, raw.join(' | ')).toBeDefined();
        return c!.split(';').map((p) => p.trim().toLowerCase());
      };

      // Development instance (http://localhost): no Secure, but HttpOnly + Lax.
      const dev = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      expect(dev.status).toBe(200);
      const d = attrs(dev.rawSetCookie);
      expect(d).toContain('httponly');
      expect(d).toContain('samesite=lax');
      expect(d.some((p) => p.startsWith('domain='))).toBe(false);

      // Production instance on the real https origin.
      const PROD = 'https://chat.axxeler.in';
      const prod = createNativeAuth({
        pool,
        mailer,
        secret: 'test-secret-test-secret-test-secret-0123',
        baseURL: PROD,
        trustedOrigins: [PROD],
        secondaryStorage: memoryStorage(),
        production: true,
      });
      const res = await prod.handler(
        new Request(`${PROD}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: PROD,
            'x-real-ip': newIp(),
          },
          body: JSON.stringify({ email: addr, password: 'S3cure-pass' }),
        })
      );
      expect(res.status).toBe(200);
      const raw = res.headers.getSetCookie();
      const p = attrs(raw);
      expect(raw.find((x) => x.includes('session_token'))).toMatch(
        /^__Secure-wacrm\.session_token=/
      );
      expect(p).toContain('secure');
      expect(p).toContain('httponly');
      expect(p).toContain('samesite=lax');
      expect(p.some((x) => x.startsWith('domain='))).toBe(false);
    });

    // CSRF needs a victim's session cookie to ride on, so that is the case
    // that must be refused. (Cookie-less requests like sign-up carry no
    // ambient authority, and Better Auth deliberately doesn't origin-check
    // them.)
    it('rejects cookie-authenticated state changes from a foreign origin (CSRF)', async () => {
      const addr = await signUpAndVerify('csrf');
      const victim = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });

      // The marketing domain is a sibling *.axxeler.in host, but it is NOT
      // a trusted origin: it must not be able to act with the app session.
      for (const origin of [
        'https://evil.example',
        'null',
        'https://automatepanuai.axxeler.in',
      ]) {
        const attack = await call('/revoke-sessions', {
          cookie: victim.cookie,
          origin,
          body: {},
        });
        expect(attack.status, `origin ${origin}`).toBe(403);
      }
      // The victim's session survived both attempts.
      expect(
        (await call('/get-session', { cookie: victim.cookie })).json?.user
          ?.email
      ).toBe(addr);

      // The same request from the app's own origin works.
      expect(
        (await call('/revoke-sessions', { cookie: victim.cookie, body: {} }))
          .status
      ).toBe(200);
    });

    it('"sign out of all devices" revokes every session', async () => {
      const addr = await signUpAndVerify('revoke');
      const a = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      const b = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      expect(
        (await call('/get-session', { cookie: b.cookie })).json?.user?.email
      ).toBe(addr);

      const revoked = await call('/revoke-sessions', {
        cookie: a.cookie,
        body: {},
      });
      expect(revoked.status, JSON.stringify(revoked.json)).toBe(200);

      expect(
        (await call('/get-session', { cookie: a.cookie })).json
      ).toBeNull();
      expect(
        (await call('/get-session', { cookie: b.cookie })).json
      ).toBeNull();
      const { rows } = await admin.query(
        'SELECT count(*)::int AS n FROM auth.sessions s JOIN auth.users u ON u.id = s.user_id WHERE u.email = $1',
        [addr]
      );
      expect(rows[0].n).toBe(0);
    });

    it('password reset: emailed token sets a new password and revokes existing sessions', async () => {
      const addr = await signUpAndVerify('reset');
      const before = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });

      const req = await call('/request-password-reset', {
        body: { email: addr, redirectTo: `${ORIGIN}/reset-password` },
      });
      expect(req.status, JSON.stringify(req.json)).toBe(200);
      const link = lastLinkTo(addr);
      // Better Auth emails /reset-password/<token>?callbackURL=… (a GET that
      // redirects to the app page with ?token=); the token is the last path part.
      const token = link.pathname.split('/').pop()!;

      const reset = await call('/reset-password', {
        body: { newPassword: 'Brand-new-9', token },
      });
      expect(reset.status, JSON.stringify(reset.json)).toBe(200);

      expect(
        (await call('/get-session', { cookie: before.cookie })).json
      ).toBeNull();
      expect(
        (
          await call('/sign-in/email', {
            body: { email: addr, password: 'S3cure-pass' },
          })
        ).status
      ).toBe(401);
      expect(
        (
          await call('/sign-in/email', {
            body: { email: addr, password: 'Brand-new-9' },
          })
        ).status
      ).toBe(200);

      // single use
      const replay = await call('/reset-password', {
        body: { newPassword: 'Another-9x', token },
      });
      expect(replay.status).toBeGreaterThanOrEqual(400);
    });

    it('password reset does not reveal whether an email is registered', async () => {
      const unknown = await call('/request-password-reset', {
        body: {
          email: `nobody.${randomUUID()}@auth.test`,
          redirectTo: `${ORIGIN}/reset-password`,
        },
      });
      expect(unknown.status).toBe(200);
    });

    it('change email asks the OLD address to confirm first', async () => {
      const addr = await signUpAndVerify('chg');
      const s = await call('/sign-in/email', {
        body: { email: addr, password: 'S3cure-pass' },
      });
      const newAddr = email('chg-new');
      const res = await call('/change-email', {
        cookie: s.cookie,
        body: { newEmail: newAddr, callbackURL: '/settings' },
      });
      expect(res.status, JSON.stringify(res.json)).toBe(200);
      const msg = [...outbox].reverse().find((m) => m.to === addr);
      expect(msg?.subject).toMatch(/Confirm your new email/);
      expect(msg?.text).toContain(newAddr);
      // nothing changes until confirmed
      const { rows } = await admin.query(
        'SELECT 1 FROM auth.users WHERE email = $1',
        [addr]
      );
      expect(rows).toHaveLength(1);
    });

    it('a native user can only see their own tenant through wacrm_app', async () => {
      const a = await signUpAndVerify('tenant-a');
      const b = await signUpAndVerify('tenant-b');
      const ids = await admin.query(
        'SELECT u.email, u.id, p.account_id FROM auth.users u JOIN profiles p ON p.user_id = u.id WHERE u.email = ANY($1)',
        [[a, b]]
      );
      const byEmail = Object.fromEntries(ids.rows.map((r) => [r.email, r]));
      expect(byEmail[a].account_id).not.toBe(byEmail[b].account_id);

      await admin.query('BEGIN');
      try {
        await admin.query('SET LOCAL ROLE wacrm_app');
        await admin.query("SELECT set_config('app.user_id', $1, true)", [
          byEmail[a].id,
        ]);
        const { rows } = await admin.query('SELECT id FROM accounts');
        expect(rows.map((r) => r.id)).toEqual([byEmail[a].account_id]);
      } finally {
        await admin.query('ROLLBACK');
      }
    });
  }
);
