import { toNextJsHandler } from 'better-auth/next-js';
import { isNativeAuthConfigured, nativeAuth } from '@/lib/auth/native/auth';

// Native auth endpoints (Better Auth): sign-up, sign-in, sign-out,
// verify-email, request-password-reset, reset-password, change-email,
// change-password, list/revoke sessions, get-session.
//
// Inert (404) until native auth is configured (DATABASE_URL + AUTH_SECRET).
// While the UI still signs in through Supabase (until the checkpoint 1d
// cut-over), a Supabase-mode deployment therefore exposes no second,
// parallel sign-up endpoint.
export const dynamic = 'force-dynamic';

const notConfigured = () =>
  Response.json(
    { error: { code: 'not_found', message: 'Not found' } },
    { status: 404 }
  );

function handlers() {
  return toNextJsHandler(nativeAuth());
}

export async function GET(request: Request) {
  if (!isNativeAuthConfigured()) return notConfigured();
  return handlers().GET(request);
}

export async function POST(request: Request) {
  if (!isNativeAuthConfigured()) return notConfigured();
  return handlers().POST(request);
}
