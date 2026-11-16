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
