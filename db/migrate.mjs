#!/usr/bin/env node
// Database migrator: `node db/migrate.mjs [up | down [count] | bootstrap]`
// (the `migrate` container runs `up` before app/worker start;
// `bootstrap` alone prepares an empty database for pg_restore).
//
// 1. Bootstrap (only when DATABASE_ADMIN_URL is set): as a superuser,
//    idempotently create the roles, schemas and extensions the migrations
//    need. This is the only step that needs superuser.
//
//    wacrm_owner          LOGIN   owns every schema object; runs migrations.
//    wacrm_authenticator  LOGIN   NOINHERIT; what the app and PostgREST log
//                                 in as. Holds no privileges of its own:
//                                 it must SET ROLE to one of:
//      wacrm_app          RLS-bound tenant role (withTenant / JWT role)
//      wacrm_service      BYPASSRLS; webhook, engines, public API, worker
//      wacrm_anon         unauthenticated; invitation peek only
//
//    None of the login roles is a superuser, and the app never logs in
//    as the owner (decision D1).
//
// 2. Migrations: node-pg-migrate over db/migrations/*.sql as wacrm_owner,
//    tracked in migrations.pgmigrations, each file in its own transaction.
//
// Env:
//   DATABASE_URL                 wacrm_owner connection (required)
//   DATABASE_ADMIN_URL           superuser connection (bootstrap; optional)
//   WACRM_OWNER_PASSWORD         set/rotate wacrm_owner's password (bootstrap)
//   WACRM_AUTHENTICATOR_PASSWORD set/rotate wacrm_authenticator's password
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runner } from 'node-pg-migrate';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, 'migrations');

const NOLOGIN_ROLES = {
  wacrm_app: 'NOLOGIN NOBYPASSRLS',
  wacrm_service: 'NOLOGIN BYPASSRLS',
  wacrm_anon: 'NOLOGIN NOBYPASSRLS',
};

function databaseName(url) {
  return (
    decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || 'postgres'
  );
}

export async function bootstrap(
  adminUrl,
  { ownerPassword, authenticatorPassword, database }
) {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  const lit = (s) => c.escapeLiteral(s);
  const ident = (s) => c.escapeIdentifier(s);
  try {
    const roleExists = async (name) =>
      (await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]))
        .rowCount > 0;

    for (const [name, attrs] of Object.entries(NOLOGIN_ROLES)) {
      if (!(await roleExists(name)))
        await c.query(`CREATE ROLE ${name} ${attrs}`);
      else await c.query(`ALTER ROLE ${name} ${attrs}`);
    }
    for (const name of ['wacrm_owner', 'wacrm_authenticator']) {
      const attrs =
        name === 'wacrm_authenticator'
          ? 'LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
          : 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
      if (!(await roleExists(name)))
        await c.query(`CREATE ROLE ${name} ${attrs}`);
      else await c.query(`ALTER ROLE ${name} ${attrs}`);
    }
    if (ownerPassword)
      await c.query(`ALTER ROLE wacrm_owner PASSWORD ${lit(ownerPassword)}`);
    if (authenticatorPassword) {
      await c.query(
        `ALTER ROLE wacrm_authenticator PASSWORD ${lit(authenticatorPassword)}`
      );
    }

    await c.query(
      'GRANT wacrm_app, wacrm_service, wacrm_anon TO wacrm_authenticator'
    );

    const db = ident(database);
    await c.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
    await c.query(
      `GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO wacrm_owner, wacrm_authenticator`
    );

    await c.query('ALTER SCHEMA public OWNER TO wacrm_owner');
    await c.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await c.query('CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION wacrm_owner');
    await c.query('ALTER SCHEMA auth OWNER TO wacrm_owner');
    await c.query('REVOKE ALL ON SCHEMA auth FROM PUBLIC');
    await c.query(
      'GRANT USAGE ON SCHEMA public, auth TO wacrm_app, wacrm_service, wacrm_anon'
    );
    // Migration bookkeeping lives outside `public`, invisible to app roles
    // (public's invariant: every table has RLS and an isolation spec).
    await c.query(
      'CREATE SCHEMA IF NOT EXISTS migrations AUTHORIZATION wacrm_owner'
    );
    await c.query('REVOKE ALL ON SCHEMA migrations FROM PUBLIC');

    // Extensions need superuser (pgvector is not a trusted extension).
    await c.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public'
    );
    await c.query('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public');
  } finally {
    await c.end();
  }
}

export async function migrate({
  databaseUrl,
  direction = 'up',
  count,
  log = console.log,
}) {
  return runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction,
    count: count ?? (direction === 'up' ? Infinity : 1),
    migrationsTable: 'pgmigrations',
    migrationsSchema: 'migrations',
    checkOrder: true,
    // verbose would echo every statement (the baseline alone is ~6k lines)
    verbose: process.env.MIGRATE_VERBOSE === '1',
    log,
  });
}

async function main() {
  const [direction = 'up', countArg] = process.argv.slice(2);
  if (!['up', 'down', 'bootstrap'].includes(direction)) {
    console.error('usage: node db/migrate.mjs [up|down [count]|bootstrap]');
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL (the wacrm_owner connection) is required');
    process.exit(2);
  }
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (adminUrl) {
    console.log('→ bootstrap (roles, schemas, extensions)');
    await bootstrap(adminUrl, {
      ownerPassword: process.env.WACRM_OWNER_PASSWORD,
      authenticatorPassword: process.env.WACRM_AUTHENTICATOR_PASSWORD,
      database: databaseName(databaseUrl),
    });
  }
  // `bootstrap` alone prepares roles/schemas/extensions without running
  // migrations, e.g. before pg_restore into an empty database.
  if (direction === 'bootstrap') {
    if (!adminUrl) {
      console.error('bootstrap needs DATABASE_ADMIN_URL');
      process.exit(2);
    }
    console.log('✓ bootstrap done (no migrations run)');
    return;
  }
  console.log(`→ migrations ${direction}`);
  const ran = await migrate({
    databaseUrl,
    direction,
    count: countArg ? Number(countArg) : undefined,
  });
  console.log(
    `✓ ${ran.length} migration(s) ${direction === 'up' ? 'applied' : 'reverted'}`
  );
}

// Run main() only when executed directly (not when imported by tests).
// Compare resolved paths case-insensitively: Windows drive letters vary.
const self = fileURLToPath(import.meta.url).toLowerCase();
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === self) {
  main().catch((err) => {
    console.error('✗ migration failed:', err?.message ?? err);
    process.exit(1);
  });
}
