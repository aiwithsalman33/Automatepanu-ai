import { beforeEach, describe, expect, it, vi } from 'vitest';

let sessionUser: { id: string } | null = null;
let admin: boolean | Error = false;

vi.mock('@/lib/auth/native/session', () => ({
  getNativeSessionUser: async () => sessionUser,
}));
vi.mock('@/lib/auth/native/db', () => ({ authPool: () => ({}) }));
vi.mock('@/lib/auth/native/bootstrap', () => ({
  isPlatformAdmin: async () => {
    if (admin instanceof Error) throw admin;
    return admin;
  },
}));

const { GET } = await import('./route');
const call = () => GET(new Request('https://app.test/auth/continue'));

beforeEach(() => {
  sessionUser = null;
  admin = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /auth/continue', () => {
  it('sends a signed-out visitor to /login', async () => {
    const res = await call();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('sends a platform admin to /admin', async () => {
    sessionUser = { id: 'admin-1' };
    admin = true;
    expect((await call()).headers.get('location')).toBe('/admin');
  });

  it('sends a normal user to /dashboard', async () => {
    sessionUser = { id: 'user-1' };
    expect((await call()).headers.get('location')).toBe('/dashboard');
  });

  it('falls back to /dashboard when the admin lookup fails', async () => {
    sessionUser = { id: 'user-1' };
    admin = new Error('db down');
    expect((await call()).headers.get('location')).toBe('/dashboard');
  });
});
