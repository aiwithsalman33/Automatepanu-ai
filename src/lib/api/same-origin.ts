/**
 * CSRF guard for cookie-authenticated JSON endpoints.
 *
 * Session cookies are SameSite=Lax, so a cross-site POST already arrives
 * without them; this is the second fence. A state-changing request must
 * carry an Origin header whose host is the host the request was made to
 * (behind Traefik: X-Forwarded-Host). Browsers always send Origin on
 * fetch() POSTs, so a missing one is refused too.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const host = (
    request.headers.get('x-forwarded-host')?.split(',')[0] ??
    request.headers.get('host') ??
    new URL(request.url).host
  )
    .trim()
    .toLowerCase();
  return originHost === host;
}
