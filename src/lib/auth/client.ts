'use client';

/**
 * Browser auth client (Better Auth, served at /api/auth on this origin).
 * Sign-in, sign-up, sign-out, password reset, change email/password and
 * session management all go through it.
 */
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({ basePath: '/api/auth' });

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  created_at: string;
}

/**
 * The signed-in user from GET /api/me (validated server-side against
 * the sessions table), or null. Shaped `{ data: { user } }` so it drops
 * in where pages used to read the user from the auth client.
 */
export async function getCurrentUser(): Promise<{
  data: { user: CurrentUser | null };
}> {
  const res = await fetch('/api/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`/api/me failed (${res.status})`);
  const body = (await res.json()) as { user: CurrentUser | null };
  return { data: { user: body.user ?? null } };
}

/** Error text from a Better Auth client result, for toasts. */
export function authErrorMessage(
  error:
    { message?: string; code?: string; status?: number } | null | undefined,
  fallback: string
): string {
  return error?.message?.trim() || fallback;
}
