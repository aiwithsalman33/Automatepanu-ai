// GET /api/me: the signed-in user, for AuthProvider.
// `{ user: null }` when signed out (200, so the provider can tell
// "signed out" from "server error").
//
// `platform_admin` only decides whether the sidebar shows the Admin
// panel link; /admin and every admin action check it again server-side.
import { NextResponse } from 'next/server';

import { isPlatformAdmin } from '@/lib/auth/native/bootstrap';
import { authPool } from '@/lib/auth/native/db';
import { getNativeSessionUser } from '@/lib/auth/native/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const u = await getNativeSessionUser(request.headers);
  const platformAdmin = u
    ? await isPlatformAdmin(authPool(), u.id).catch(() => false)
    : false;
  return NextResponse.json(
    {
      user: u
        ? {
            id: u.id,
            email: u.email,
            name: u.name,
            email_verified: u.emailVerified,
            created_at: u.createdAt,
            platform_admin: platformAdmin,
          }
        : null,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
