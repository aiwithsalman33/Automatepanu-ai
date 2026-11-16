import { isNativeAuthConfigured, nativeAuth } from './auth';

export interface NativeSessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

/**
 * The signed-in user for a request, from the session cookie, or null.
 * Validated against the sessions table (revoked or expired sessions
 * return null).
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
    createdAt: new Date(u.createdAt).toISOString(),
  };
}
