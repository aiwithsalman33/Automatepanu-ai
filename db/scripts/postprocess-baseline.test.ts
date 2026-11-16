import { describe, expect, it } from 'vitest';
import { BaselineError, transformDump } from './postprocess-baseline.mjs';

/** Minimal dump in pg_dump's real output shape. */
function dump(extra: string[] = [], guards = 2) {
  const guardLines = [
    "     AND current_user = 'authenticated'",
    "  IF current_user <> 'authenticated' THEN",
  ].slice(0, guards);
  return [
    '--',
    '-- PostgreSQL database dump',
    '\\restrict abc123',
    'SET statement_timeout = 0;',
    "SELECT pg_catalog.set_config('search_path', '', false);",
    'CREATE SCHEMA public;',
    "COMMENT ON SCHEMA public IS 'standard public schema';",
    'CREATE TABLE public.contacts (id uuid);',
    'CREATE FUNCTION public.guard() RETURNS trigger AS $$',
    ...guardLines,
    '$$;',
    'GRANT USAGE ON SCHEMA public TO anon;',
    'GRANT ALL ON TABLE public.contacts TO anon;',
    'GRANT ALL ON TABLE public.contacts TO authenticated;',
    'GRANT ALL ON TABLE public.contacts TO service_role;',
    'GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO authenticated;',
    'GRANT UPDATE(read_at) ON TABLE public.notifications TO authenticated;',
    'REVOKE ALL ON FUNCTION public.internal(x uuid) FROM PUBLIC;',
    'GRANT ALL ON FUNCTION public.internal(x uuid) TO service_role;',
    'GRANT ALL ON FUNCTION public.open_fn(p_days integer, p_tz text) TO authenticated;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;',
    ...extra,
    '\\unrestrict abc123',
  ].join('\n');
}

describe('transformDump', () => {
  const { sql, stats } = transformDump(dump(), { migrationCount: 57 });

  it('strips psql-only and environment lines', () => {
    expect(sql).not.toMatch(/\\restrict|\\unrestrict/);
    expect(sql).not.toContain('CREATE SCHEMA public;');
    expect(sql).not.toContain('COMMENT ON SCHEMA public');
    expect(sql).not.toContain('GRANT USAGE ON SCHEMA');
    expect(sql).not.toContain('ALTER DEFAULT PRIVILEGES');
    expect(stats.droppedDefaultAcls).toBe(1);
  });

  it('makes session settings transaction-local', () => {
    expect(sql).toContain('SET LOCAL statement_timeout = 0;');
    expect(sql).toContain("set_config('search_path', '', true)");
    expect(sql).not.toMatch(/^SET (?!LOCAL)/m);
  });

  it('rewrites the guard-trigger role literals', () => {
    expect(sql).toContain("current_user = 'wacrm_app'");
    expect(sql).toContain("current_user <> 'wacrm_app'");
    expect(sql).not.toContain("'authenticated'");
    expect(stats.guardLiterals).toBe(2);
  });

  it('maps table grants to DML only, drops anon, keeps column grants', () => {
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO wacrm_app;'
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO wacrm_service;'
    );
    expect(sql).not.toMatch(/ON TABLE public\.contacts TO wacrm_anon/);
    // TRUNCATE (bypasses RLS), REFERENCES, TRIGGER, MAINTAIN are dropped.
    expect(sql).toContain(
      'GRANT SELECT, INSERT, DELETE ON TABLE public.notifications TO wacrm_app;'
    );
    expect(sql).toContain(
      'GRANT UPDATE(read_at) ON TABLE public.notifications TO wacrm_app;'
    );
    expect(sql).not.toMatch(/TRUNCATE|MAINTAIN/);
  });

  it('revokes PUBLIC from every function but keeps effective access', () => {
    // internal(): PUBLIC was revoked → only the explicit grantee.
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.internal(x uuid) FROM PUBLIC;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.internal(x uuid) TO wacrm_service;'
    );
    // open_fn(): PUBLIC never revoked → every role could execute it.
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.open_fn(p_days integer, p_tz text) FROM PUBLIC;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.open_fn(p_days integer, p_tz text) TO wacrm_anon, wacrm_app, wacrm_service;'
    );
    expect(stats.functions).toBe(2);
  });

  it('re-creates the signup trigger and is not reversible', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER on_auth_user_created\s+AFTER INSERT ON auth\.users/
    );
    expect(sql.indexOf('-- Up Migration')).toBe(0);
    expect(sql).toMatch(/-- Down Migration[\s\S]*RAISE EXCEPTION/);
  });

  it('refuses a dump with an unexpected number of guard literals', () => {
    expect(() => transformDump(dump([], 1))).toThrow(BaselineError);
    expect(() => transformDump(dump([], 1))).toThrow(
      /expected 2 current_user role literals/
    );
  });

  it('refuses leftover old role names, unknown ACL shapes and storage refs', () => {
    expect(() => transformDump(dump(["SELECT 'anon';"]))).toThrow(
      /role-name literal/
    );
    expect(() =>
      transformDump(
        dump([
          'CREATE POLICY p ON public.contacts TO authenticated USING (true);',
        ])
      )
    ).toThrow(/old role names/);
    expect(() =>
      transformDump(
        dump(['GRANT SELECT ON SEQUENCE public.s TO authenticated;'])
      )
    ).toThrow(/unhandled ACL line/);
    expect(() =>
      transformDump(dump(['GRANT ALL ON TABLE public.contacts TO mallory;']))
    ).toThrow(/unknown role/);
    expect(() =>
      transformDump(dump(['CREATE POLICY p ON storage.objects USING (true);']))
    ).toThrow(/storage/);
  });

  it('refuses a dump without the public schema header', () => {
    expect(() =>
      transformDump(dump().replace('CREATE SCHEMA public;\n', ''))
    ).toThrow(/CREATE SCHEMA public/);
  });
});
