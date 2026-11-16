// GET /api/health — liveness + dependency check for the container
// healthcheck and uptime monitors. 200 when the app can reach its
// database (through the private PostgREST); 503 otherwise. Reveals no
// details beyond up/down.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.POSTGREST_URL;
  let db = false;
  if (url) {
    try {
      // PostgREST answers its root with 200 (or 4xx when OpenAPI is
      // disabled) once it is connected; a 5xx/timeout means no database.
      const res = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        cache: 'no-store',
      });
      db = res.status < 500;
    } catch {
      db = false;
    }
  }
  return NextResponse.json(
    { ok: db },
    { status: db ? 200 : 503, headers: { 'cache-control': 'no-store' } }
  );
}
