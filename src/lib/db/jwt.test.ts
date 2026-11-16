import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { signPostgrestJwt } from './jwt';

const SECRET = 'x'.repeat(40);
const USER = '11111111-2222-4333-8444-555555555555';

function decode(token: string) {
  const [h, p, s] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(p, 'base64url').toString()),
    validSig:
      createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') ===
      s,
  };
}

describe('signPostgrestJwt', () => {
  it('signs a wacrm_app token for the user with HS256 and a short expiry', () => {
    const now = 1_700_000_000_000;
    const t = decode(
      signPostgrestJwt({ role: 'wacrm_app', sub: USER }, SECRET, { now })
    );
    expect(t.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(t.validSig).toBe(true);
    expect(t.payload).toEqual({
      role: 'wacrm_app',
      sub: USER,
      iat: 1_700_000_000,
      exp: 1_700_000_060,
    });
  });

  it('signs a service token without a user id', () => {
    const t = decode(signPostgrestJwt({ role: 'wacrm_service' }, SECRET));
    expect(t.payload.role).toBe('wacrm_service');
    expect(t.payload).not.toHaveProperty('sub');
  });

  it('refuses a user token without a valid uuid sub', () => {
    expect(() => signPostgrestJwt({ role: 'wacrm_app' }, SECRET)).toThrow();
    expect(() =>
      signPostgrestJwt({ role: 'wacrm_app', sub: "x' OR 1=1" }, SECRET)
    ).toThrow();
  });

  it('refuses a service or anon token that names a user', () => {
    expect(() =>
      signPostgrestJwt({ role: 'wacrm_service', sub: USER }, SECRET)
    ).toThrow();
    expect(() =>
      signPostgrestJwt({ role: 'wacrm_anon', sub: USER }, SECRET)
    ).toThrow();
  });

  it('refuses any other role (owner, superuser, authenticator)', () => {
    for (const role of ['wacrm_owner', 'postgres', 'wacrm_authenticator']) {
      expect(() =>
        signPostgrestJwt({ role: role as 'wacrm_app', sub: USER }, SECRET)
      ).toThrow(/Refusing/);
    }
  });

  it('refuses a short secret', () => {
    expect(() => signPostgrestJwt({ role: 'wacrm_service' }, 'short')).toThrow(
      /32/
    );
  });
});
