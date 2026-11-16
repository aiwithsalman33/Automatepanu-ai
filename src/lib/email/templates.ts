/**
 * Auth email templates (plain text + minimal HTML). English, matching the
 * Supabase default templates these replace; localisation follows the UI
 * catalogue work in a later checkpoint.
 */
import { brand } from '@/config/brand';
import type { EmailMessage } from './mailer';

const APP_NAME = brand.name;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(
  title: string,
  body: string,
  cta: { label: string; url: string }
) {
  const url = escapeHtml(cta.url);
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
<p>${body}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(cta.label)}</a></p>
<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${url}</p>
<p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email.</p>
</body></html>`;
}

const greet = (name?: string | null) =>
  name?.trim() ? `Hi ${name.trim()},` : 'Hi,';

export function verifyEmailMessage(
  to: string,
  url: string,
  name?: string | null
): EmailMessage {
  return {
    to,
    subject: `Confirm your email for ${APP_NAME}`,
    text: `${greet(name)}\n\nConfirm your email address to finish creating your ${APP_NAME} account:\n${url}\n\nIf you didn't sign up, ignore this email.`,
    html: layout(
      'Confirm your email',
      `${escapeHtml(greet(name))} confirm your email address to finish creating your ${APP_NAME} account.`,
      { label: 'Confirm email', url }
    ),
  };
}

export function resetPasswordMessage(
  to: string,
  url: string,
  name?: string | null
): EmailMessage {
  return {
    to,
    subject: `Reset your ${APP_NAME} password`,
    text: `${greet(name)}\n\nReset your password with this link (it expires in 1 hour):\n${url}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
    html: layout(
      'Reset your password',
      `${escapeHtml(greet(name))} use the button below to choose a new password. The link expires in 1 hour.`,
      { label: 'Reset password', url }
    ),
  };
}

export function inviteMessage(
  to: string,
  url: string,
  opts: { accountName: string; inviterName?: string | null; role: string; expiresInDays: number }
): EmailMessage {
  const who = opts.inviterName?.trim() || 'A teammate';
  const days = `${opts.expiresInDays} day${opts.expiresInDays === 1 ? '' : 's'}`;
  return {
    to,
    subject: `${who} invited you to ${opts.accountName} on ${APP_NAME}`,
    text: `Hi,\n\n${who} invited you to join ${opts.accountName} on ${APP_NAME} as ${opts.role}.\n\nAccept the invitation (the link expires in ${days}):\n${url}\n\nIf you weren't expecting this, ignore this email.`,
    html: layout(
      `Join ${opts.accountName}`,
      `${escapeHtml(who)} invited you to join <strong>${escapeHtml(opts.accountName)}</strong> on ${escapeHtml(APP_NAME)} as <strong>${escapeHtml(opts.role)}</strong>. The link expires in ${days}.`,
      { label: 'Accept invitation', url }
    ),
  };
}

export function changeEmailMessage(
  to: string,
  url: string,
  newEmail: string
): EmailMessage {
  return {
    to,
    subject: `Confirm your new email for ${APP_NAME}`,
    text: `Confirm changing your ${APP_NAME} sign-in email to ${newEmail}:\n${url}\n\nIf you didn't ask for this, ignore this email.`,
    html: layout(
      'Confirm your new email',
      `Confirm changing your ${APP_NAME} sign-in email to <strong>${escapeHtml(newEmail)}</strong>.`,
      { label: 'Confirm change', url }
    ),
  };
}
