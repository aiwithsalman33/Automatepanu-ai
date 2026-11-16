// ============================================================
// GET /auth/callback — legacy landing for links the previous auth
// provider emailed (sign-up confirmation, password reset) before the
// move to native auth. Those links can't be exchanged any more, so the
// visitor is sent to /login, which explains what to do (sign in, or
// request a new reset link).
//
// Native auth links go to /api/auth/* (verify-email, reset-password)
// and never land here.
//
// `Location` is relative on purpose: behind a reverse proxy the app
// doesn't reliably know its public origin, and the browser resolves a
// relative Location against the URL it actually requested.
// ============================================================

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, {
    status: 303,
    headers: { Location: '/login?error=link_invalid' },
  });
}
