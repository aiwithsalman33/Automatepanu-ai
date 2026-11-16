import { isNativeAuthConfigured, nativeAuth } from './auth';

export interface NativeSessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * The signed-in user for a request, from the native session cookie, or
 * null. Checkpoint 1c makes getCurrentAccount() resolve the user through
 * this (instead of supabase.auth.getUser()) when native auth is on.
 */
export async function getNativeSessionUser(
  headers: Headers
): Promise<NativeSessionUser | null> {
  if (!isNativeAuthConfigured()) return null;
  const result = await nativeAuth().api.getSession({ headers });
  if (!result?.user) return null;
  const u = result.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified,
  };
}
