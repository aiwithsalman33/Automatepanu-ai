import { createHmac } from 'node:crypto';

/**
 * Minimal HS256 JWT signer for the private PostgREST.
 *
 * PostgREST verifies the token with PGRST_JWT_SECRET, runs
 * `SET LOCAL ROLE <role claim>` inside its per-request transaction and
 * exposes the claims as `request.jwt.claims`, which the auth.uid() shim
 * reads. The tokens never leave the server (PostgREST is not published),
 * so they are short-lived and minted per request.
 */

/** The only roles the app ever asks PostgREST to assume. */
export type PostgrestRole = 'wacrm_app' | 'wacrm_service' | 'wacrm_anon';

const ROLES: ReadonlySet<string> = new Set([
  'wacrm_app',
  'wacrm_service',
  'wacrm_anon',
]);

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_TTL_SECONDS = 60;

const b64url = (input: string) => Buffer.from(input).toString('base64url');

export interface PostgrestClaims {
  role: PostgrestRole;
  /** The signed-in user. Required for wacrm_app, forbidden otherwise. */
  sub?: string;
}

export function signPostgrestJwt(
  claims: PostgrestClaims,
  secret: string,
  { ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now() } = {}
): string {
  if (!secret || secret.length < 32) {
    throw new Error('POSTGREST_JWT_SECRET must be at least 32 characters');
  }
  if (!ROLES.has(claims.role)) {
    throw new Error(
      `Refusing to sign a PostgREST token for role "${claims.role}"`
    );
  }
  if (claims.role === 'wacrm_app') {
    if (!claims.sub || !UUID_RE.test(claims.sub)) {
      throw new Error('A wacrm_app token needs the user id (uuid) as sub');
    }
  } else if (claims.sub !== undefined) {
    throw new Error(`A ${claims.role} token must not carry a user id`);
  }
  const iat = Math.floor(now / 1000);
  const payload: Record<string, unknown> = {
    role: claims.role,
    iat,
    exp: iat + ttlSeconds,
  };
  if (claims.sub) payload.sub = claims.sub;
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${sig}`;
}
