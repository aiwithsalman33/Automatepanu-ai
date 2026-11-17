/**
 * Outbound email over SMTP (decision D8), used by the native auth flows
 * (verify email, reset password, change email).
 *
 * Config (env; Phase 4 adds an admin-editable override in platform
 * settings):
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for 465),
 *   SMTP_USER, SMTP_PASSWORD, SMTP_FROM ("Name <address>"; defaults to
 *   the brand name + brand.contact.email)
 *
 * Without SMTP_HOST:
 *   - development/test: the message is logged (with its links) instead of
 *     sent, so sign-up works locally with no mail server;
 *   - production: sending throws, so a misconfigured deployment surfaces
 *     the problem instead of silently dropping verification emails.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { brand } from '@/config/brand';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Where replies go, when not the From address (e.g. a website visitor). */
  replyTo?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export class MailerNotConfiguredError extends Error {
  constructor() {
    super(
      'SMTP is not configured (set SMTP_HOST, SMTP_FROM, …); cannot send email in production'
    );
  }
}

function smtpConfig(env: NodeJS.ProcessEnv) {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    secure: env.SMTP_SECURE === 'true' || port === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' }
      : undefined,
    from: env.SMTP_FROM?.trim() || `${brand.name} <${brand.contact.email}>`,
  };
}

export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  const cfg = smtpConfig(env);
  if (!cfg) {
    return {
      async send(message) {
        if (env.NODE_ENV === 'production') throw new MailerNotConfiguredError();
        console.info(
          `[mailer] SMTP not configured — not sending.\n  to: ${message.to}\n  subject: ${message.subject}\n${message.text}`
        );
      },
    };
  }
  let transport: Transporter | null = null;
  return {
    async send(message) {
      transport ??= nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth,
      });
      await transport.sendMail({ from: cfg.from, ...message });
    },
  };
}

let defaultMailer: Mailer | null = null;
export function mailer(): Mailer {
  defaultMailer ??= createMailer();
  return defaultMailer;
}
