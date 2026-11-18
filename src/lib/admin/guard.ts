/**
 * Platform-admin gate for /admin pages and admin server actions.
 *
 * Every admin page AND every admin action calls one of these: a layout
 * check alone is not enough (layouts are not re-run on every navigation,
 * and server actions are reachable by POST without rendering a page).
 * The lookup is memoised per request with React's cache().
 */
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { isPlatformAdmin } from '@/lib/auth/native/bootstrap';
import { authPool } from '@/lib/auth/native/db';
import {
  getNativeSessionUser,
  type NativeSessionUser,
} from '@/lib/auth/native/session';

export const getAdminSession = cache(
  async (): Promise<{ user: NativeSessionUser | null; admin: boolean }> => {
    const user = await getNativeSessionUser(await headers()).catch(() => null);
    if (!user) return { user: null, admin: false };
    return { user, admin: await isPlatformAdmin(authPool(), user.id) };
  }
);

/** For pages: no session → /login; not an admin → plain 404. */
export async function requireAdminPage(): Promise<NativeSessionUser> {
  const { user, admin } = await getAdminSession();
  if (!user) redirect('/login');
  if (!admin) notFound();
  return user;
}

export class AdminForbiddenError extends Error {
  constructor() {
    super('Only platform admins can do this.');
  }
}

/** For server actions: throws unless the caller is a platform admin. */
export async function requireAdminAction(): Promise<NativeSessionUser> {
  const { user, admin } = await getAdminSession();
  if (!user || !admin) throw new AdminForbiddenError();
  return user;
}
