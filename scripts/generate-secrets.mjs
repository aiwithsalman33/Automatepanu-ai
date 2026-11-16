#!/usr/bin/env node
// Print a fresh set of secrets in .env format (hex: URL-safe).
//
//   node scripts/generate-secrets.mjs            print to the terminal
//   node scripts/generate-secrets.mjs --file .env
//        write a complete env file from .env.example with every secret
//        filled in (refuses to overwrite an existing file)
//
// Rotate by generating a new set. NEVER rotate ENCRYPTION_KEY on a live
// install (stored WhatsApp/AI tokens are encrypted with it), and know
// that a new AUTH_SECRET signs everyone out.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hex = (bytes) => randomBytes(bytes).toString('hex');

export const SECRETS = {
  POSTGRES_PASSWORD: () => hex(24),
  WACRM_OWNER_PASSWORD: () => hex(24),
  WACRM_AUTHENTICATOR_PASSWORD: () => hex(24),
  POSTGREST_JWT_SECRET: () => hex(32),
  REDIS_PASSWORD: () => hex(24),
  MINIO_ROOT_PASSWORD: () => hex(24),
  AUTH_SECRET: () => hex(32),
  ENCRYPTION_KEY: () => hex(32),
  AUTOMATION_CRON_SECRET: () => hex(24),
};

const values = Object.fromEntries(
  Object.entries(SECRETS).map(([k, f]) => [k, f()])
);

const fileArg = process.argv.indexOf('--file');
if (fileArg === -1) {
  for (const [k, v] of Object.entries(values)) console.log(`${k}=${v}`);
  process.exit(0);
}

const target = process.argv[fileArg + 1];
if (!target) {
  console.error('usage: node scripts/generate-secrets.mjs --file <path>');
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`${target} already exists; not overwriting. Remove it first.`);
  process.exit(1);
}
const example = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '.env.example'),
  'utf8'
);
const out = example.replace(/^([A-Z_0-9]+)=.*$/gm, (line, key) =>
  key in values ? `${key}=${values[key]}` : line
);
writeFileSync(target, out, { mode: 0o600 });
console.log(
  `Wrote ${target} with fresh secrets. Still to fill in: SMTP_*, META_APP_SECRET.`
);
