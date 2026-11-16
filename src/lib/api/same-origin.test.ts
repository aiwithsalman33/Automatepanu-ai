import { describe, expect, it } from 'vitest';

import { isSameOrigin } from './same-origin';

const req = (headers: Record<string, string>) =>
  new Request('http://app:3000/api/data/tags', { method: 'POST', headers });

describe('isSameOrigin', () => {
  it('accepts an Origin matching the forwarded host (behind Traefik)', () => {
    expect(
      isSameOrigin(
        req({
          origin: 'https://chat.axxeler.in',
          'x-forwarded-host': 'chat.axxeler.in',
          host: 'app:3000',
        })
      )
    ).toBe(true);
  });

  it('accepts an Origin matching Host (no proxy)', () => {
    expect(
      isSameOrigin(
        req({ origin: 'http://localhost:3000', host: 'localhost:3000' })
      )
    ).toBe(true);
  });

  it('refuses another site, the marketing domain, null and a missing Origin', () => {
    for (const origin of [
      'https://evil.example',
      'https://automatepanuai.axxeler.in',
      'null',
      '',
    ]) {
      expect(
        isSameOrigin(
          req({ ...(origin ? { origin } : {}), host: 'chat.axxeler.in' })
        ),
        origin
      ).toBe(false);
    }
  });
});
