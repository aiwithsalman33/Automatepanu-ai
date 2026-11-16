import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isBcryptHash,
  needsRehash,
  verifyPassword,
} from './password';

/**
 * A REAL hash produced by Supabase Auth (GoTrue v2.195.0, image
 * public.ecr.aws/supabase/gotrue:v2.195.0) for the password below, via
 * `POST /auth/v1/signup` against `supabase start` and read back from
 * auth.users.encrypted_password. Test-only credentials.
 */
const GOTRUE_PASSWORD = 'Correct-Horse-9!';
const GOTRUE_HASH =
  '$2a$10$ja3mLLA8a17PXyM3QhkSo.6qreWwM8hLyiWPFoiCNCpYId0u237Z6';

describe('migrated Supabase (GoTrue bcrypt) hashes', () => {
  it('recognises the GoTrue format', () => {
    expect(isBcryptHash(GOTRUE_HASH)).toBe(true);
    expect(needsRehash(GOTRUE_HASH)).toBe(true);
  });

  it('verifies the right password and rejects wrong ones', async () => {
    expect(
      await verifyPassword({ hash: GOTRUE_HASH, password: GOTRUE_PASSWORD })
    ).toBe(true);
    expect(
      await verifyPassword({ hash: GOTRUE_HASH, password: 'correct-horse-9!' })
    ).toBe(false);
    expect(await verifyPassword({ hash: GOTRUE_HASH, password: '' })).toBe(
      false
    );
  });
});

/**
 * Migrated hashes with OTHER cost factors and prefixes (users imported
 * from older systems, or re-hashed by pgcrypto). Fixtures generated once:
 *   cost 4:  Postgres pgcrypto  crypt('Migrated-Pass-1', gen_salt('bf', 4))
 *   cost 12: bcryptjs           hashSync('Migrated-Pass-1', 12)
 */
const MIGRATED_PASSWORD = 'Migrated-Pass-1';
const PGCRYPTO_COST4 =
  '$2a$04$x8FND429ow6RDG8ViwABjujVqUucdboA/IXESpAXj6pPcTgwfFbZm';
const BCRYPTJS_COST12 =
  '$2b$12$H6RIS1jksZC.e.ocx1s2LObieL/4cQ8bYu6CUo6BD9YCLDorrJ32.';

describe('migrated bcrypt hashes with different cost factors / prefixes', () => {
  it.each([
    ['$2a$ cost 4 (pgcrypto)', PGCRYPTO_COST4],
    ['$2b$ cost 12 (bcryptjs)', BCRYPTJS_COST12],
    ['$2y$ cost 12 (PHP-style prefix)', '$2y$' + BCRYPTJS_COST12.slice(4)],
  ])(
    '%s: right password verifies, wrong ones do not, flagged for rehash',
    async (_l, hash) => {
      expect(isBcryptHash(hash)).toBe(true);
      expect(needsRehash(hash)).toBe(true);
      expect(await verifyPassword({ hash, password: MIGRATED_PASSWORD })).toBe(
        true
      );
      expect(await verifyPassword({ hash, password: 'migrated-pass-1' })).toBe(
        false
      );
      expect(
        await verifyPassword({ hash, password: MIGRATED_PASSWORD + ' ' })
      ).toBe(false);
      expect(await verifyPassword({ hash, password: GOTRUE_PASSWORD })).toBe(
        false
      );
    }
  );

  it('the GoTrue password does not verify against an unrelated migrated hash', async () => {
    expect(
      await verifyPassword({ hash: BCRYPTJS_COST12, password: GOTRUE_PASSWORD })
    ).toBe(false);
  });

  it('the buggy $2x$ variant is not accepted (fails closed, never throws)', async () => {
    const x = '$2x$' + BCRYPTJS_COST12.slice(4);
    expect(isBcryptHash(x)).toBe(false);
    expect(await verifyPassword({ hash: x, password: MIGRATED_PASSWORD })).toBe(
      false
    );
  });
});

describe('native (scrypt) hashes', () => {
  it('round-trips and is not flagged for rehash', async () => {
    const hash = await hashPassword('n3w-Passw0rd');
    expect(isBcryptHash(hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
    expect(await verifyPassword({ hash, password: 'n3w-Passw0rd' })).toBe(true);
    expect(await verifyPassword({ hash, password: 'n3w-passw0rd' })).toBe(
      false
    );
  });

  it('salts: the same password hashes differently each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});

describe('fails closed', () => {
  it.each([
    ['empty hash', ''],
    ['garbage', 'not-a-hash'],
    ['truncated bcrypt', GOTRUE_HASH.slice(0, 40)],
    ['plaintext stored by mistake', GOTRUE_PASSWORD],
    ['md5-crypt', '$1$abcdefgh$0123456789abcdefghijkl'],
  ])('%s never verifies', async (_label, hash) => {
    expect(await verifyPassword({ hash, password: GOTRUE_PASSWORD })).toBe(
      false
    );
  });

  it('needsRehash ignores missing hashes', () => {
    expect(needsRehash(null)).toBe(false);
    expect(needsRehash(undefined)).toBe(false);
    expect(needsRehash('')).toBe(false);
  });
});
