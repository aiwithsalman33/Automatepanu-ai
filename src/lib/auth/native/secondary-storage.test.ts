import { describe, expect, it } from 'vitest';
import {
  AUTH_REDIS_PREFIX,
  INCREMENT_WITH_TTL_LUA,
  redisSecondaryStorage,
  redisStorageFrom,
  type RedisLike,
} from './secondary-storage';

/** Minimal in-memory Redis that also interprets the INCR+EXPIRE script. */
function fakeRedis() {
  const data = new Map<string, string>();
  const ttl = new Map<string, number>();
  const calls: string[] = [];
  const redis: RedisLike = {
    get: async (k) => data.get(k) ?? null,
    getdel: async (k) => {
      const v = data.get(k) ?? null;
      data.delete(k);
      return v;
    },
    set: async (k, v, ...args) => {
      data.set(k, v);
      if (args[0] === 'EX') ttl.set(k, Number(args[1]));
      calls.push(`set ${k} ${args.join(' ')}`.trim());
      return 'OK';
    },
    del: async (k) => (data.delete(k) ? 1 : 0),
    eval: async (script, _n, key, seconds) => {
      expect(script).toBe(INCREMENT_WITH_TTL_LUA);
      const v = Number(data.get(String(key)) ?? 0) + 1;
      data.set(String(key), String(v));
      if (v === 1) ttl.set(String(key), Number(seconds));
      return v;
    },
  };
  return { redis, data, ttl, calls };
}

describe('redisStorageFrom', () => {
  it('namespaces every key', async () => {
    const { redis, data } = fakeRedis();
    const s = redisStorageFrom(redis);
    await s.set('a', '1');
    expect([...data.keys()]).toEqual([`${AUTH_REDIS_PREFIX}a`]);
  });

  it('set with ttl uses EX (rounded up), without ttl does not expire', async () => {
    const { redis, calls } = fakeRedis();
    const s = redisStorageFrom(redis);
    await s.set('k1', 'v', 1.2);
    await s.set('k2', 'v');
    expect(calls).toEqual([
      `set ${AUTH_REDIS_PREFIX}k1 EX 2`,
      `set ${AUTH_REDIS_PREFIX}k2`,
    ]);
  });

  it('getAndDelete returns the value once', async () => {
    const { redis } = fakeRedis();
    const s = redisStorageFrom(redis);
    await s.set('once', 'x');
    expect(await s.getAndDelete('once')).toBe('x');
    expect(await s.getAndDelete('once')).toBeNull();
  });

  it('increment counts and sets the TTL only on creation (window never extends)', async () => {
    const { redis, ttl } = fakeRedis();
    const s = redisStorageFrom(redis);
    expect(await s.increment('rl', 60)).toBe(1);
    expect(ttl.get(`${AUTH_REDIS_PREFIX}rl`)).toBe(60);
    ttl.set(`${AUTH_REDIS_PREFIX}rl`, 5); // time passes
    expect(await s.increment('rl', 60)).toBe(2);
    expect(await s.increment('rl', 60)).toBe(3);
    expect(ttl.get(`${AUTH_REDIS_PREFIX}rl`)).toBe(5);
  });

  it('the Lua script only sets EXPIRE when INCR created the key', () => {
    expect(INCREMENT_WITH_TTL_LUA).toMatch(/INCR/);
    expect(INCREMENT_WITH_TTL_LUA).toMatch(
      /if v == 1 then redis\.call\('EXPIRE'/
    );
  });

  it('is disabled without REDIS_URL', () => {
    expect(redisSecondaryStorage(undefined)).toBeUndefined();
    expect(redisSecondaryStorage('')).toBeUndefined();
  });
});
