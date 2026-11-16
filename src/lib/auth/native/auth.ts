/**
 * Native authentication (Better Auth), checkpoint 1b, decision D2.
 *
 * Replaces Supabase Auth: email + password, email verification, password
 * reset, change email (old and new address both confirm), DB-backed
 * revocable sessions ("sign out of all devices"), and a Redis-backed
 * login/sign-up rate limit. Users live in auth.users; the existing
 * signup trigger turns every new user into a personal account + owner
 * profile, exactly as on Supabase.
 *
 * Wiring: GET/POST /api/auth/* (src/app/api/auth/[...all]/route.ts).
 * The UI still signs in through Supabase until the checkpoint 1d
 * cut-over; this module is inert unless isNativeAuthConfigured().
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import type { Pool } from 'pg';
import { mailer as defaultMailer, type Mailer } from '@/lib/email/mailer';
import {
  changeEmailMessage,
  resetPasswordMessage,
  verifyEmailMessage,
} from '@/lib/email/templates';
import { authPool } from './db';
import { hashPassword, needsRehash, verifyPassword } from './password';
import { redisSecondaryStorage } from './secondary-storage';

export const SESSION_EXPIRES_IN_S = 60 * 60 * 24 * 30; // 30 days
export const SESSION_UPDATE_AGE_S = 60 * 60 * 24; // token refreshed daily
export const MIN_PASSWORD_LENGTH = 6; // Supabase's default; imported users keep working
export const MAX_PASSWORD_LENGTH = 128;

/** Auth rate limits (per IP, per window in seconds). */
export const AUTH_RATE_LIMITS = {
  '/sign-in/email': { window: 60, max: 5 },
  '/sign-up/email': { window: 60 * 60, max: 10 },
  '/request-password-reset': { window: 60 * 60, max: 5 },
  '/send-verification-email': { window: 60 * 60, max: 5 },
  '/change-email': { window: 60 * 60, max: 5 },
} as const;

export function isNativeAuthConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    !!env.DATABASE_URL && !!env.AUTH_SECRET && env.AUTH_SECRET.length >= 32
  );
}

/**
 * Upgrade migrated bcrypt hashes to scrypt after a successful password
 * sign-in. Runs after Better Auth verified the password, so the
 * plaintext is known-good. Failures are logged and never block sign-in.
 */
export const rehashAfterSignIn = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/sign-in/email') return;
  const session = ctx.context.newSession;
  const password = (ctx.body as { password?: unknown } | undefined)?.password;
  if (!session || typeof password !== 'string') return;
  try {
    const credential = await ctx.context.internalAdapter.findCredentialAccount(
      session.user.id
    );
    if (credential?.password && needsRehash(credential.password)) {
      await ctx.context.internalAdapter.updatePassword(
        session.user.id,
        await hashPassword(password)
      );
    }
  } catch (err) {
    console.error('[auth] password rehash failed (sign-in unaffected):', err);
  }
});

export interface NativeAuthDeps {
  pool: Pool;
  mailer: Mailer;
  secret: string;
  baseURL?: string;
  secondaryStorage?: BetterAuthOptions['secondaryStorage'];
  production?: boolean;
}

export function nativeAuthOptions(deps: NativeAuthDeps) {
  const ts = { createdAt: 'created_at', updatedAt: 'updated_at' } as const;
  return {
    appName: 'wacrm',
    basePath: '/api/auth',
    baseURL: deps.baseURL,
    secret: deps.secret,
    database: deps.pool,
    secondaryStorage: deps.secondaryStorage,
    // Never phone home.
    telemetry: { enabled: false },

    user: {
      modelName: 'users',
      fields: { emailVerified: 'email_verified', ...ts },
      changeEmail: {
        enabled: true,
        // Old address confirms first; the new address then gets the
        // normal verification email (same as Supabase's double confirm).
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await deps.mailer.send(changeEmailMessage(user.email, url, newEmail));
        },
      },
    },
    session: {
      modelName: 'sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        ...ts,
      },
      expiresIn: SESSION_EXPIRES_IN_S,
      updateAge: SESSION_UPDATE_AGE_S,
      // Sessions stay in Postgres (revocable, durable) even though Redis
      // is configured; Redis only backs the rate limiter.
      storeSessionInDatabase: true,
    },
    account: {
      modelName: 'identities',
      fields: {
        userId: 'user_id',
        providerId: 'provider_id',
        accountId: 'account_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        ...ts,
      },
    },
    verification: {
      modelName: 'verifications',
      fields: { expiresAt: 'expires_at', ...ts },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await deps.mailer.send(
          resetPasswordMessage(user.email, url, user.name)
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.mailer.send(verifyEmailMessage(user.email, url, user.name));
      },
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: AUTH_RATE_LIMITS,
      storage: deps.secondaryStorage ? 'secondary-storage' : 'memory',
    },

    advanced: {
      // Better Auth silently turns its origin/CSRF check OFF when it
      // detects a test environment unless this is set explicitly. Pin it
      // on, so the check can never be disabled implicitly (e.g. a stray
      // NODE_ENV=test in a deployment) and the tests exercise the real one.
      disableOriginCheck: false,
      database: { generateId: 'uuid' },
      cookiePrefix: 'wacrm',
      useSecureCookies: deps.production ?? false,
      ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
    },

    hooks: { after: rehashAfterSignIn },

    // Must stay last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  } satisfies BetterAuthOptions;
}

export function createNativeAuth(deps: NativeAuthDeps) {
  return betterAuth(nativeAuthOptions(deps));
}

type NativeAuth = ReturnType<typeof createNativeAuth>;
let instance: NativeAuth | null = null;

/** The app's auth instance (lazy: env is read on first use, not at import). */
export function nativeAuth(): NativeAuth {
  if (instance) return instance;
  if (!isNativeAuthConfigured()) {
    throw new Error(
      'native auth is not configured (DATABASE_URL and AUTH_SECRET ≥ 32 chars)'
    );
  }
  instance = createNativeAuth({
    pool: authPool(),
    mailer: defaultMailer(),
    secret: process.env.AUTH_SECRET!,
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    secondaryStorage: redisSecondaryStorage(),
    production: process.env.NODE_ENV === 'production',
  });
  return instance;
}
