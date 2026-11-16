#!/usr/bin/env node
// Runtime preflight for the app container (Dockerfile CMD).
// Exits 1, listing every problem at once, when a required variable is
// missing, too short, or still a placeholder; so a bad deploy fails in a
// second with a readable message instead of erroring per request.

const REQUIRED = {
  DATABASE_URL: (v) =>
    /^postgres(ql)?:\/\//.test(v) || 'must be a postgresql:// URL',
  POSTGREST_URL: (v) => /^https?:\/\//.test(v) || 'must be an http(s) URL',
  POSTGREST_JWT_SECRET: (v) =>
    v.length >= 32 || 'must be at least 32 characters',
  AUTH_SECRET: (v) => v.length >= 32 || 'must be at least 32 characters',
  ENCRYPTION_KEY: (v) =>
    /^[0-9a-f]{64}$/i.test(v) || 'must be 64 hex characters',
  META_APP_SECRET: (v) => v.length >= 8 || 'looks too short',
  AUTOMATION_CRON_SECRET: (v) =>
    v.length >= 16 || 'must be at least 16 characters',
  SMTP_HOST: (v) => v.length > 0 || 'is required to send sign-up emails',
  REDIS_URL: (v) => /^rediss?:\/\//.test(v) || 'must be a redis:// URL',
};

const PLACEHOLDER = /FILL|change-me|your-|example\.com|<[^>]+>/i;

const problems = [];
for (const [key, check] of Object.entries(REQUIRED)) {
  const v = (process.env[key] ?? '').trim();
  if (!v) {
    problems.push(`${key} is not set`);
    continue;
  }
  if (PLACEHOLDER.test(v) && key !== 'DATABASE_URL') {
    problems.push(`${key} is still a placeholder`);
    continue;
  }
  const ok = check(v);
  if (ok !== true) problems.push(`${key} ${ok}`);
}
if (process.env.SMTP_HOST && !process.env.SMTP_FROM) {
  problems.push(
    'SMTP_FROM is not set (e.g. "Automate Panu AI <no-reply@your-domain>")'
  );
}

if (problems.length) {
  console.error(
    `\n  x Not starting: ${problems.length} configuration problem(s)\n` +
      problems.map((p) => `    - ${p}`).join('\n') +
      '\n    Fix them in Dokploy -> Environment (or .env), then redeploy.\n'
  );
  process.exit(1);
}
