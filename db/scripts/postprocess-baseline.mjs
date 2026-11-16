#!/usr/bin/env node
// Turn a `pg_dump --schema=public` of the replayed Supabase migrations
// into db/migrations/0002_baseline.sql for plain Postgres.
//
//   node postprocess-baseline.mjs <raw-dump.sql> <out.sql> <migration-count>
//
// Transformations (each one asserted, so a changed dump fails loudly):
//  1. psql-only / environment lines removed: \restrict, CREATE/COMMENT
//     SCHEMA public, the sandbox's ALTER DEFAULT PRIVILEGES, schema
//     USAGE grants; session SETs → SET LOCAL (the migrator wraps each
//     file in a transaction, so nothing leaks into later migrations).
//  2. Roles mapped: authenticated → wacrm_app, service_role →
//     wacrm_service, anon → wacrm_anon. The guard triggers compare
//     `current_user` with a role-name *literal*; those are rewritten too
//     (exactly EXPECTED_GUARD_LITERALS). Missing one would silently
//     disable a privilege guard.
//  3. Table ACLs: explicit GRANTs only, reduced to SELECT/INSERT/UPDATE/
//     DELETE (no TRUNCATE: it bypasses RLS). Column grants kept.
//     wacrm_anon gets no table access (it has no policies anyway).
//  4. Function ACLs: EXECUTE is revoked from PUBLIC on every function,
//     and the *effective* access each role had in production (explicit
//     grant, or PUBLIC never revoked) is granted explicitly. Behaviour is
//     unchanged; intentional changes live in 0003_hardening.sql.
//  5. The signup trigger on auth.users (outside the dumped schema) is
//     re-created.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROLE_MAP = {
  authenticated: 'wacrm_app',
  service_role: 'wacrm_service',
  anon: 'wacrm_anon',
};
const TABLE_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
export const EXPECTED_GUARD_LITERALS = 2;

export class BaselineError extends Error {}

function fail(msg) {
  throw new BaselineError(msg);
}

/**
 * @param {string} raw   pg_dump output
 * @param {{ migrationCount?: string|number, expectedGuardLiterals?: number }} [opts]
 * @returns {{ sql: string, stats: { functions: number, tableGrants: number, guardLiterals: number, droppedDefaultAcls: number } }}
 */
export function transformDump(raw, opts = {}) {
  const migrationCount = opts.migrationCount ?? '?';
  const expectedLiterals =
    opts.expectedGuardLiterals ?? EXPECTED_GUARD_LITERALS;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  const body = [];
  const fnAcl = new Map(); // signature → { publicRevoked, grantees:Set }
  let tableGrants = 0;
  let sawCreateSchema = false;
  let droppedDefaultAcls = 0;

  for (const line of lines) {
    // 1. environment / psql-only lines
    if (/^\\(restrict|unrestrict)\b/.test(line)) continue;
    // Server/pg_dump version comments change with patch releases of the
    // build image; dropping them keeps the generated file reproducible.
    if (/^-- Dumped (from database|by pg_dump) version /.test(line)) continue;
    if (line === 'CREATE SCHEMA public;') {
      sawCreateSchema = true;
      continue;
    }
    if (/^COMMENT ON SCHEMA public IS /.test(line)) continue;
    if (/^GRANT USAGE ON SCHEMA public TO /.test(line)) continue;
    // The build sandbox's *classic default privileges* must never ship:
    // relying on environment defaults is exactly finding F1. Every object
    // gets explicit grants instead.
    if (/^ALTER DEFAULT PRIVILEGES /.test(line)) {
      droppedDefaultAcls++;
      continue;
    }
    if (/^SET [a-z_]+ = .*;$/.test(line)) {
      body.push(line.replace(/^SET /, 'SET LOCAL '));
      continue;
    }
    if (line === "SELECT pg_catalog.set_config('search_path', '', false);") {
      body.push("SELECT pg_catalog.set_config('search_path', '', true);");
      continue;
    }

    // 4. function ACLs → collected, re-emitted at the end
    let m = line.match(
      /^(GRANT|REVOKE) ALL ON FUNCTION (public\..+\)) (TO|FROM) ([A-Za-z_]+);$/
    );
    if (m) {
      const [, verb, sig, , role] = m;
      const acl = fnAcl.get(sig) ?? {
        publicRevoked: false,
        grantees: new Set(),
      };
      if (verb === 'REVOKE' && role === 'PUBLIC') acl.publicRevoked = true;
      else if (verb === 'GRANT') acl.grantees.add(role);
      else fail(`unexpected function ACL line: ${line}`);
      fnAcl.set(sig, acl);
      continue;
    }
    if (/^(GRANT|REVOKE) .* ON FUNCTION /.test(line)) {
      fail(`unhandled function ACL shape: ${line}`);
    }

    // 3. table ACLs
    m = line.match(/^GRANT (.+?) ON TABLE (public\.[a-z_]+) TO ([A-Za-z_]+);$/);
    if (m) {
      const [, privs, table, role] = m;
      if (role === 'postgres') continue;
      if (!(role in ROLE_MAP)) fail(`table grant to unknown role: ${line}`);
      if (role === 'anon') continue; // no table access for anon
      const mapped = ROLE_MAP[role];
      const col = privs.match(/^([A-Z]+)\((.+)\)$/);
      let grant = null;
      if (col) {
        grant = `GRANT ${col[1]}(${col[2]}) ON TABLE ${table} TO ${mapped};`;
      } else {
        const list =
          privs === 'ALL'
            ? TABLE_PRIVS
            : privs.split(',').filter((p) => TABLE_PRIVS.includes(p));
        if (list.length)
          grant = `GRANT ${list.join(', ')} ON TABLE ${table} TO ${mapped};`;
      }
      if (grant) {
        tableGrants++;
        body.push(grant);
      }
      continue;
    }
    if (/^(GRANT|REVOKE) /.test(line)) fail(`unhandled ACL line: ${line}`);

    body.push(line);
  }

  if (!sawCreateSchema)
    fail('expected the dump to contain CREATE SCHEMA public');

  // 2. guard-trigger role literals
  let sql = body.join('\n');
  let literalHits = 0;
  sql = sql.replace(/current_user (=|<>) 'authenticated'/g, (_, op) => {
    literalHits++;
    return `current_user ${op} 'wacrm_app'`;
  });
  if (literalHits !== expectedLiterals) {
    fail(
      `expected ${expectedLiterals} current_user role literals, rewrote ${literalHits} — review the guards`
    );
  }
  const leftover = sql.match(/'(authenticated|anon|service_role)'/g);
  if (leftover)
    fail(`role-name literal(s) left in the dump: ${leftover.join(', ')}`);
  const leftoverRoles = sql
    .split('\n')
    .filter(
      (l) =>
        !/^\s*--/.test(l) && /\b(anon|authenticated|service_role)\b/.test(l)
    );
  if (leftoverRoles.length) {
    fail(
      `old role names still referenced:\n  ${leftoverRoles.slice(0, 5).join('\n  ')}`
    );
  }
  if (/\bstorage\./.test(sql.replace(/--.*$/gm, ''))) {
    fail('dump still references storage.* (should be dropped for 1f)');
  }

  // 4. function ACL block
  const fnLines = [];
  for (const [sig, acl] of [...fnAcl.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const effective = new Set(acl.grantees);
    if (!acl.publicRevoked)
      Object.keys(ROLE_MAP).forEach((r) => effective.add(r));
    fnLines.push(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC;`);
    const roles = [...effective]
      .filter((r) => r !== 'postgres')
      .map(
        (r) =>
          ROLE_MAP[r] ?? fail(`function grant to unknown role ${r} on ${sig}`)
      )
      .sort();
    if (roles.length)
      fnLines.push(`GRANT EXECUTE ON FUNCTION ${sig} TO ${roles.join(', ')};`);
  }

  const header = `-- Up Migration
--
-- GENERATED by db/scripts/build-baseline.sh from supabase/migrations
-- (${migrationCount} files, 001–059). Do not edit by hand: change the
-- generator or add a new migration. See docs/saas-migration-plan.md §2.8.
--
-- Requires (bootstrap + 0001_auth_schema.sql): roles wacrm_app /
-- wacrm_service / wacrm_anon, extensions uuid-ossp + vector in public,
-- auth.users and the auth.uid() shim.
`;

  const footer = `
--
-- Function privileges (generated): PUBLIC loses EXECUTE everywhere; each
-- role keeps exactly the effective access it had on Supabase.
--
${fnLines.join('\n')}

--
-- Signup bootstrap (lived on auth.users in Supabase, outside the dump).
--
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Down Migration
DO $$ BEGIN
  RAISE EXCEPTION 'the baseline cannot be rolled back; restore from backup';
END $$;
`;

  return {
    sql: header + sql.trimEnd() + '\n' + footer,
    stats: {
      functions: fnAcl.size,
      tableGrants,
      guardLiterals: literalHits,
      droppedDefaultAcls,
    },
  };
}

function main() {
  const [, , rawPath, outPath, migrationCount = '?'] = process.argv;
  if (!rawPath || !outPath) {
    console.error('usage: postprocess-baseline.mjs <raw> <out> [count]');
    process.exit(2);
  }
  try {
    const { sql, stats } = transformDump(readFileSync(rawPath, 'utf8'), {
      migrationCount,
    });
    writeFileSync(outPath, sql);
    console.log(
      `postprocess: ${stats.functions} functions, ${stats.tableGrants} table grants, ` +
        `${stats.guardLiterals} guard literals rewritten, ` +
        `${stats.droppedDefaultAcls} sandbox default ACLs dropped`
    );
  } catch (err) {
    console.error(`✗ postprocess: ${err.message}`);
    process.exit(1);
  }
}

const self = fileURLToPath(import.meta.url).toLowerCase();
if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === self) main();
