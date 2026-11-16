// GET /api/me: the signed-in user, for AuthProvider.
// `{ user: null }` when signed out (200, so the provider can tell
// "signed out" from "server error").
import { NextResponse } from 'next/server';

import { getNativeSessionUser } from '@/lib/auth/native/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const u = await getNativeSessionUser(request.headers);
  return NextResponse.json(
    {
      user: u
        ? {
            id: u.id,
            email: u.email,
            name: u.name,
            email_verified: u.emailVerified,
            created_at: u.createdAt,
          }
        : null,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
