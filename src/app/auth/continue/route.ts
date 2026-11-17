// ============================================================
// GET /auth/continue — post-sign-in landing.
//
// Decides where a signed-in user starts: platform admins go to the
// admin panel (/admin), everyone else to their workspace (/dashboard).
// No session → /login. The login page and the proxy's "already signed
// in" redirects both send the browser here, so the role check lives in
// one place.
//
// `Location` is relative on purpose (see /auth/callback): behind a
// reverse proxy the app doesn't reliably know its public origin.
// ============================================================
import { isPlatformAdmin } from '@/lib/auth/native/bootstrap';
import { authPool } from '@/lib/auth/native/db';
import { getNativeSessionUser } from '@/lib/auth/native/session';

export const dynamic = 'force-dynamic';

const go = (location: string) =>
  new Response(null, { status: 303, headers: { Location: location } });

export async function GET(request: Request) {
  const user = await getNativeSessionUser(request.headers).catch(() => null);
  if (!user) return go('/login');

  const admin = await isPlatformAdmin(authPool(), user.id).catch((err) => {
    // A failed lookup must not lock anyone out: fall back to the workspace.
    console.error('[auth/continue] platform admin check failed:', err);
    return false;
  });
  return go(admin ? '/admin' : '/dashboard');
}
