import Redis from 'ioredis';
import type { SecondaryStorage } from 'better-auth';

/**
 * Redis-backed secondary storage for Better Auth, used for its rate
 * limiter so login/sign-up limits are shared across every app instance
 * (the in-memory limiter in src/lib/rate-limit.ts is per process; it
 * moves to Redis in Phase 5).
 *
 * Returns undefined without REDIS_URL. Better Auth then falls back to
 * in-memory rate limiting, which is fine for a single instance and for
 * local development.
 */

/**
 * INCR, and set the TTL only when the key was just created, atomically.
 * Later increments must never extend the window, or a client hammering
 * the endpoint would keep its own counter alive forever.
 */
export const INCREMENT_WITH_TTL_LUA = `
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return v
`;

export const AUTH_REDIS_PREFIX = 'wacrm:auth:';

/** The subset of ioredis this adapter uses (so tests can fake it). */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  getdel(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    ...args: (string | number)[]
  ): Promise<unknown>;
  del(key: string): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

export function redisStorageFrom(
  redis: RedisLike,
  prefix = AUTH_REDIS_PREFIX
): SecondaryStorage {
  return {
    get: (key) => redis.get(prefix + key),
    getAndDelete: (key) => redis.getdel(prefix + key),
    async increment(key, ttl) {
      const ttlSeconds = Math.max(1, Math.ceil(ttl));
      return Number(
        await redis.eval(INCREMENT_WITH_TTL_LUA, 1, prefix + key, ttlSeconds)
      );
    },
    async set(key, value, ttl) {
      if (ttl && ttl > 0)
        await redis.set(prefix + key, value, 'EX', Math.ceil(ttl));
      else await redis.set(prefix + key, value);
    },
    async delete(key) {
      await redis.del(prefix + key);
    },
  };
}

export function redisSecondaryStorage(
  url: string | undefined = process.env.REDIS_URL
): SecondaryStorage | undefined {
  if (!url) return undefined;
  const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  // Thin typed wrapper: ioredis' overloaded signatures don't line up
  // with the narrow interface above.
  return redisStorageFrom({
    get: (key) => r.get(key),
    getdel: (key) => r.getdel(key),
    set: (key, value, ...args) =>
      args.length === 2
        ? r.set(key, value, 'EX', Number(args[1]))
        : r.set(key, value),
    del: (key) => r.del(key),
    eval: (script, numKeys, ...args) => r.eval(script, numKeys, ...args),
  });
}
