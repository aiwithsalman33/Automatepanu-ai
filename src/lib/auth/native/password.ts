/**
 * Password hashing for the native (Better Auth) stack — decision D2.
 *
 * New passwords use Better Auth's scrypt format (`<salt hex>:<key hex>`).
 * Users imported from Supabase (checkpoint 1g) arrive with GoTrue's
 * bcrypt hashes (`$2a$10$…`); those still verify, and are re-hashed to
 * scrypt the first time the user signs in successfully (see
 * `rehashAfterSignIn` in ./auth.ts), so no migrated user ever needs a
 * password reset and bcrypt hashes die out naturally.
 */
import bcrypt from 'bcryptjs';
import {
  hashPassword as scryptHash,
  verifyPassword as scryptVerify,
} from 'better-auth/crypto';

/** GoTrue / bcrypt modular-crypt prefix: $2a$, $2b$ or $2y$ + 2-digit cost. */
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isBcryptHash(hash: string): boolean {
  return BCRYPT_RE.test(hash);
}

/** Hash a new password (always scrypt). */
export function hashPassword(password: string): Promise<string> {
  return scryptHash(password);
}

/**
 * Verify against either format. Anything that is neither well-formed
 * bcrypt nor scrypt fails closed (returns false, never throws), so a
 * corrupt or empty stored hash can't be used to sign in.
 */
export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    if (isBcryptHash(hash)) return await bcrypt.compare(password, hash);
    if (!/^[0-9a-f]+:[0-9a-f]+$/i.test(hash)) return false;
    return await scryptVerify({ hash, password });
  } catch {
    return false;
  }
}

/** True for hashes that should be upgraded on the next successful sign-in. */
export function needsRehash(hash: string | null | undefined): boolean {
  return !!hash && isBcryptHash(hash);
}
