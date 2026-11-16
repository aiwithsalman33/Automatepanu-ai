import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /auth/callback (legacy email links)', () => {
  it('sends the visitor to /login with a relative 303', () => {
    const res = GET();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login?error=link_invalid');
  });
});
