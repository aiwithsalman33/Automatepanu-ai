'use server';

/**
 * Platform admin mutations (/admin). Every action:
 *   1. re-checks that the caller is a platform admin (requireAdminAction),
 *   2. refuses to lock the caller out (no disabling, deleting, demoting
 *      or force-signing-out yourself),
 *   3. writes a row to auth.admin_audit_log,
 *   4. returns { ok, message | error } for a toast. It never throws to
 *      the client.
 *
 * Sessions and passwords go through Better Auth's internal adapter, so
 * the Redis session cache (when configured) is cleared together with
 * Postgres. A plain DELETE on auth.sessions would leave cached sessions
 * valid.
 */
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import type { PoolClient } from 'pg';

import { AdminForbiddenError, requireAdminAction } from '@/lib/admin/guard';
import { isUuid, loadDeletePlan } from '@/lib/admin/queries';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  nativeAuth,
} from '@/lib/auth/native/auth';
import { authPool } from '@/lib/auth/native/db';
import { hashPassword } from '@/lib/auth/native/password';
import type { NativeSessionUser } from '@/lib/auth/native/session';

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

class UserFacingError extends Error {}

function fail(message: string): never {
  throw new UserFacingError(message);
}

async function run(
  name: string,
  fn: (admin: NativeSessionUser) => Promise<string>
): Promise<ActionResult> {
  try {
    const admin = await requireAdminAction();
    const message = await fn(admin);
    revalidatePath('/admin', 'layout');
    return { ok: true, message };
  } catch (err) {
    if (err instanceof UserFacingError || err instanceof AdminForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error(`[admin] ${name} failed:`, err);
    return { ok: false, error: 'Something went wrong. Check the server logs.' };
  }
}

interface Target {
  id: string;
  email: string;
  email_verified: boolean;
  disabled_at: string | null;
}

async function loadTarget(userId: unknown): Promise<Target> {
  if (typeof userId !== 'string' || !isUuid(userId)) fail('Unknown user.');
  const { rows } = await authPool().query<Target>(
    'SELECT id, email, email_verified, disabled_at FROM auth.users WHERE id = $1',
    [userId]
  );
  return rows[0] ?? fail('This user no longer exists.');
}

function notSelf(admin: NativeSessionUser, target: Target, what: string) {
  if (admin.id === target.id) fail(`You can't ${what} your own account.`);
}

async function audit(
  db: Pick<PoolClient, 'query'>,
  admin: NativeSessionUser,
  action: string,
  target: { id: string | null; email: string | null },
  details: Record<string, unknown> = {}
) {
  await db.query(
    `INSERT INTO auth.admin_audit_log
       (admin_user_id, admin_email, action, target_user_id, target_email, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [admin.id, admin.email, action, target.id, target.email, JSON.stringify(details)]
  );
}

async function authInternals() {
  return (await nativeAuth().$context).internalAdapter;
}

function checkPassword(password: unknown): string {
  if (typeof password !== 'string') fail('Enter a password.');
  const p = password as string;
  if (p.length < MIN_PASSWORD_LENGTH)
    fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (p.length > MAX_PASSWORD_LENGTH)
    fail(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  return p;
}

// ------------------------------------------------------------- users

/** Set a new password for any user (no current password needed). */
export async function setUserPassword(
  userId: string,
  password: string,
  signOutEverywhere: boolean
): Promise<ActionResult> {
  return run('setUserPassword', async (admin) => {
    const target = await loadTarget(userId);
    const hash = await hashPassword(checkPassword(password));
    const adapter = await authInternals();
    const credential = await adapter.findCredentialAccount(target.id);
    if (credential) {
      await adapter.updatePassword(target.id, hash);
    } else {
      // Signed up without a password (or imported): give them one.
      await adapter.linkAccount({
        userId: target.id,
        providerId: 'credential',
        accountId: target.id,
        password: hash,
      });
    }
    const signedOut = signOutEverywhere && target.id !== admin.id;
    if (signedOut) await adapter.deleteUserSessions(target.id);
    await audit(authPool(), admin, 'password.set', target, { signedOut });
    return signedOut
      ? `Password updated for ${target.email} and they were signed out everywhere.`
      : `Password updated for ${target.email}.`;
  });
}

/** Disable (block sign-in, end all sessions) or re-enable a user. */
export async function setUserDisabled(
  userId: string,
  disabled: boolean
): Promise<ActionResult> {
  return run('setUserDisabled', async (admin) => {
    const target = await loadTarget(userId);
    notSelf(admin, target, 'disable');
    await authPool().query(
      `UPDATE auth.users
          SET disabled_at = CASE WHEN $2 THEN coalesce(disabled_at, now()) ELSE NULL END,
              updated_at = now()
        WHERE id = $1`,
      [target.id, disabled]
    );
    if (disabled) await (await authInternals()).deleteUserSessions(target.id);
    await audit(authPool(), admin, disabled ? 'user.disable' : 'user.enable', target);
    return disabled
      ? `${target.email} is disabled and was signed out everywhere.`
      : `${target.email} can sign in again.`;
  });
}

/** Mark users' email as verified so they can sign in ("give access"). */
export async function verifyUsers(userIds: string[]): Promise<ActionResult> {
  return run('verifyUsers', async (admin) => {
    const ids = Array.isArray(userIds) ? userIds.filter((id) => isUuid(id)) : [];
    if (ids.length === 0) fail('Select at least one user.');
    if (ids.length > 500) fail('Verify at most 500 users at a time.');
    // Unverified users have no sessions (sign-in requires verification),
    // so there is no cached session to refresh: SQL is enough.
    const { rows } = await authPool().query<{ id: string; email: string }>(
      `UPDATE auth.users SET email_verified = true, updated_at = now()
        WHERE id = ANY($1::uuid[]) AND NOT email_verified
        RETURNING id, email`,
      [ids]
    );
    for (const r of rows) await audit(authPool(), admin, 'user.verify', r);
    if (rows.length === 0) return 'Already verified.';
    return rows.length === 1
      ? `${rows[0].email} is verified and can sign in now.`
      : `${rows.length} users verified.`;
  });
}

/** Send the verification email again. */
export async function resendVerification(userId: string): Promise<ActionResult> {
  return run('resendVerification', async (admin) => {
    const target = await loadTarget(userId);
    if (target.email_verified) fail(`${target.email} is already verified.`);
    await nativeAuth().api.sendVerificationEmail({
      body: { email: target.email, callbackURL: '/dashboard' },
    });
    await audit(authPool(), admin, 'user.resend_verification', target);
    return `Verification email sent to ${target.email}.`;
  });
}

/** End every session of a user (they must sign in again). */
export async function revokeUserSessions(userId: string): Promise<ActionResult> {
  return run('revokeUserSessions', async (admin) => {
    const target = await loadTarget(userId);
    notSelf(admin, target, 'force sign-out');
    await (await authInternals()).deleteUserSessions(target.id);
    await audit(authPool(), admin, 'user.sign_out_everywhere', target);
    return `${target.email} was signed out on every device.`;
  });
}

/** Grant or revoke platform admin (access to /admin). */
export async function setPlatformAdmin(
  userId: string,
  makeAdmin: boolean
): Promise<ActionResult> {
  return run('setPlatformAdmin', async (admin) => {
    const target = await loadTarget(userId);
    if (makeAdmin) {
      if (target.disabled_at) fail('Enable this user before making them an admin.');
      await authPool().query(
        `INSERT INTO auth.platform_admins (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [target.id]
      );
    } else {
      notSelf(admin, target, 'remove admin access from');
      await authPool().query('DELETE FROM auth.platform_admins WHERE user_id = $1', [
        target.id,
      ]);
    }
    await audit(authPool(), admin, makeAdmin ? 'admin.grant' : 'admin.revoke', target);
    return makeAdmin
      ? `${target.email} is now a platform admin.`
      : `${target.email} is no longer a platform admin.`;
  });
}

/**
 * Permanently delete a user. Workspaces they own alone are deleted with
 * them (with everything in them). A workspace that still has other
 * members blocks the delete: removing it would cut those people off.
 * `confirmEmail` must repeat the user's email (typed by the admin).
 */
export async function deleteUser(
  userId: string,
  confirmEmail: string
): Promise<ActionResult> {
  return run('deleteUser', async (admin) => {
    const target = await loadTarget(userId);
    notSelf(admin, target, 'delete');
    if (
      typeof confirmEmail !== 'string' ||
      confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()
    ) {
      fail('The email you typed does not match this user.');
    }

    const pool = authPool();
    const plan = await loadDeletePlan(pool, target.id);
    if (plan.blockedBy.length > 0) {
      fail(
        `${target.email} owns ${plan.blockedBy
          .map((w) => `"${w.name}" (${w.otherMembers} other member${w.otherMembers === 1 ? '' : 's'})`)
          .join(', ')}. Remove those members first, or disable the user instead.`
      );
    }

    // End sessions first: this also clears the Redis copies, which the
    // ON DELETE CASCADE below can't reach.
    await (await authInternals()).deleteUserSessions(target.id);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM auth.users WHERE id = $1 FOR UPDATE', [target.id]);
      // Re-check inside the transaction: someone may have joined since.
      const locked = await loadDeletePlan(client, target.id);
      if (locked.blockedBy.length > 0) fail('Someone joined a workspace this user owns. Try again.');
      const workspaces = await client.query<{ name: string }>(
        'DELETE FROM public.accounts WHERE owner_user_id = $1 RETURNING name',
        [target.id]
      );
      await client.query('DELETE FROM auth.users WHERE id = $1', [target.id]);
      await audit(
        client,
        admin,
        'user.delete',
        { id: null, email: target.email },
        { deletedUserId: target.id, deletedWorkspaces: workspaces.rows.map((w) => w.name) }
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if ((err as { code?: string }).code === '23503') {
        fail(
          'Other data in a shared workspace still points at records this user created (for example a deal linked to their conversation). Disable the user instead.'
        );
      }
      throw err;
    } finally {
      client.release();
    }
    return `${target.email} was deleted.`;
  });
}

// ---------------------------------------------------------- settings

/** The signed-in admin changes their own password (current one required). */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  return run('changeOwnPassword', async (admin) => {
    if (typeof currentPassword !== 'string' || !currentPassword)
      fail('Enter your current password.');
    const next = checkPassword(newPassword);
    try {
      await nativeAuth().api.changePassword({
        body: { currentPassword, newPassword: next, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (err) {
      const status = (err as { statusCode?: number; status?: number | string }).statusCode;
      if (status === 400 || status === 401) fail('Your current password is not correct.');
      throw err;
    }
    await audit(authPool(), admin, 'password.change_own', admin);
    return 'Your password was changed. Other devices were signed out.';
  });
}
