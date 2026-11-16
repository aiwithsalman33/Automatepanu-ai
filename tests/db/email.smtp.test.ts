/**
 * Email over real SMTP (decision D8): verification, password reset and
 * team-invite emails leave through the production mailer (nodemailer)
 * and arrive at a Mailpit server, read back through its HTTP API.
 *
 * Runs when TEST_SMTP_HOST / TEST_SMTP_PORT / TEST_MAILPIT_URL are set
 * (CI starts Mailpit; locally:
 *   docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.27.0).
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createNativeAuth } from '@/lib/auth/native/auth';
import { createAuthPool } from '@/lib/auth/native/db';
import { createMailer } from '@/lib/email/mailer';
import { inviteMessage } from '@/lib/email/templates';
import { DATABASE_URL, selectedAdapter } from './harness';

const SMTP_HOST = process.env.TEST_SMTP_HOST ?? '';
const SMTP_PORT = process.env.TEST_SMTP_PORT ?? '1025';
const MAILPIT = (process.env.TEST_MAILPIT_URL ?? '').replace(/\/+$/, '');
const AUTHENTICATOR_URL =
  process.env.TEST_AUTHENTICATOR_DATABASE_URL ??
  'postgresql://wacrm_authenticator:authpw@127.0.0.1:54330/wacrm';
const ORIGIN = 'http://localhost:3000';

interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

async function waitForMail(to: string, subjectRe: RegExp): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
    );
    const body = (await res.json()) as { messages: MailpitMessage[] };
    const hit = body.messages.find((m) => subjectRe.test(m.Subject));
    if (hit) {
      const full = (await (
        await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)
      ).json()) as {
        Text: string;
      };
      return full.Text;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no email matching ${subjectRe} reached ${to}`);
}

describe.runIf(selectedAdapter().name === 'app' && SMTP_HOST && MAILPIT)(
  'auth + invite email over SMTP',
  () => {
    const smtpEnv = {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_FROM: 'Automate Panu AI <no-reply@test.local>',
      NODE_ENV: 'production', // the production path: must really send
    } as unknown as NodeJS.ProcessEnv;
    const mailer = createMailer(smtpEnv);
    const pool = createAuthPool(AUTHENTICATOR_URL);
    const admin = new Client({ connectionString: DATABASE_URL });
    const emails: string[] = [];
    let ip = 0;
    const auth = createNativeAuth({
      pool,
      mailer,
      secret: 'test-secret-test-secret-test-secret-0123',
      baseURL: ORIGIN,
      trustedOrigins: [ORIGIN],
    });
    const call = (path: string, body: unknown) =>
      auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: ORIGIN,
            'x-real-ip': `10.8.0.${++ip}`,
          },
          body: JSON.stringify(body),
        })
      );

    beforeAll(() => admin.connect());
    afterAll(async () => {
      if (emails.length) {
        await admin.query(
          'DELETE FROM accounts WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email = ANY($1))',
          [emails]
        );
        await admin.query('DELETE FROM auth.users WHERE email = ANY($1)', [
          emails,
        ]);
      }
      await admin.end();
      await pool.end();
    });

    it('sign-up sends a verification email with a working link', async () => {
      const addr = `verify.${randomUUID().slice(0, 8)}@smtp.test`;
      emails.push(addr);
      const res = await call('/sign-up/email', {
        email: addr,
        password: 'S3cure-pass',
        name: 'V',
      });
      expect(res.status).toBe(200);
      const text = await waitForMail(addr, /Confirm your email/);
      const link = new URL(text.match(/https?:\/\/\S+/)![0]);
      expect(link.origin).toBe(ORIGIN);
      expect(link.pathname).toBe('/api/auth/verify-email');
      const verify = await auth.handler(
        new Request(link, { headers: { 'x-real-ip': '10.8.1.1' } })
      );
      expect([200, 302]).toContain(verify.status);
      const { rows } = await admin.query(
        'SELECT email_verified FROM auth.users WHERE email = $1',
        [addr]
      );
      expect(rows[0].email_verified).toBe(true);
    });

    it('password reset sends a reset email', async () => {
      const addr = `reset.${randomUUID().slice(0, 8)}@smtp.test`;
      emails.push(addr);
      await call('/sign-up/email', {
        email: addr,
        password: 'S3cure-pass',
        name: 'R',
      });
      const res = await call('/request-password-reset', {
        email: addr,
        redirectTo: '/reset-password',
      });
      expect(res.status).toBe(200);
      const text = await waitForMail(addr, /Reset your .* password/);
      expect(text).toMatch(/\/api\/auth\/reset-password\//);
    });

    it('team invites are emailed with the join link', async () => {
      const addr = `invite.${randomUUID().slice(0, 8)}@smtp.test`;
      const url = `${ORIGIN}/join/tok_${randomUUID()}`;
      await mailer.send(
        inviteMessage(addr, url, {
          accountName: 'Acme',
          role: 'agent',
          expiresInDays: 7,
        })
      );
      const text = await waitForMail(addr, /invited you to Acme/);
      expect(text).toContain(url);
      expect(text).toContain('7 days');
    });
  }
);
