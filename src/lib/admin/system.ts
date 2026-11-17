/**
 * Deployment health for /admin/settings: which required settings are in
 * place. Reports only "set / missing / placeholder", never a value, so
 * the page can't leak a secret even to an admin's screen share.
 */

export type CheckState = 'ok' | 'missing' | 'placeholder' | 'info';

export interface SystemCheck {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
}

/** Values from .env.example that mean "never filled in". */
const PLACEHOLDER_RE = /^(change-me|your-|local-|smtp\.example\.com$)/i;

function secret(
  env: NodeJS.ProcessEnv,
  key: string,
  label: string,
  why: string
): SystemCheck {
  const v = env[key]?.trim();
  if (!v) return { key, label, state: 'missing', detail: `${key} is not set. ${why}` };
  if (PLACEHOLDER_RE.test(v))
    return {
      key,
      label,
      state: 'placeholder',
      detail: `${key} still has the template value. ${why}`,
    };
  return { key, label, state: 'ok', detail: `${key} is set.` };
}

export function systemChecks(env: NodeJS.ProcessEnv = process.env): SystemCheck[] {
  const production = env.NODE_ENV === 'production';
  return [
    {
      key: 'NEXT_PUBLIC_APP_URL',
      label: 'App URL',
      state: env.NEXT_PUBLIC_APP_URL ? 'info' : 'missing',
      detail: env.NEXT_PUBLIC_APP_URL ?? 'NEXT_PUBLIC_APP_URL is not set.',
    },
    {
      key: 'NODE_ENV',
      label: 'Environment',
      state: 'info',
      detail: production ? 'production' : (env.NODE_ENV ?? 'development'),
    },
    secret(env, 'AUTH_SECRET', 'Sign-in secret', 'Sessions cannot be signed.'),
    secret(
      env,
      'ENCRYPTION_KEY',
      'Token encryption key',
      'Stored WhatsApp/AI tokens cannot be encrypted.'
    ),
    secret(
      env,
      'META_APP_SECRET',
      'Meta app secret',
      'Incoming WhatsApp webhooks are rejected.'
    ),
    secret(
      env,
      'SMTP_HOST',
      'Email (SMTP)',
      'Verification and password-reset emails are not delivered.'
    ),
    secret(
      env,
      'AUTOMATION_CRON_SECRET',
      'Scheduler secret',
      'Scheduled automations and flows do not run.'
    ),
    {
      key: 'REDIS_URL',
      label: 'Shared rate limits (Redis)',
      state: env.REDIS_URL ? 'ok' : production ? 'missing' : 'info',
      detail: env.REDIS_URL
        ? 'REDIS_URL is set.'
        : 'REDIS_URL is not set: rate limits are per process (fine for one instance).',
    },
  ];
}
