/** Formatting for the admin panel (English, UTC: the panel is operator-only). */

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});
const DAY_SHORT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const NUMBER = new Intl.NumberFormat('en');

export const fmtNumber = (n: number) => NUMBER.format(n);

export function fmtDate(v: string | Date | null | undefined): string {
  return v ? DATE.format(new Date(v)) : '—';
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  return v ? `${DATE_TIME.format(new Date(v))} UTC` : '—';
}

/** "17 Nov" from a YYYY-MM-DD series key. */
export function fmtDay(day: string): string {
  return DAY_SHORT.format(new Date(`${day}T00:00:00Z`));
}

/** "just now", "5 min ago", "3 h ago", "12 days ago", else a date. */
export function fmtRelative(
  v: string | Date | null | undefined,
  now: number = Date.now()
): string {
  if (!v) return 'never';
  const s = Math.round((now - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) {
    const d = Math.floor(s / 86400);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  return fmtDate(v);
}

/** Week-over-week change: percent, or null when there's no baseline. */
export function weekChange(
  current: number,
  previous: number
): { percent: number | null; trend: 'up' | 'down' | 'flat' } {
  if (current === previous) return { percent: previous ? 0 : null, trend: 'flat' };
  if (!previous) return { percent: null, trend: current > 0 ? 'up' : 'flat' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { percent, trend: current > previous ? 'up' : 'down' };
}

/** Short, readable browser + OS from a user agent string. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : /curl|node|undici/i.test(ua) ? 'Script'
    : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}

/** Human label for an audit-log action key. */
export const AUDIT_LABELS: Record<string, string> = {
  'password.set': 'Set password',
  'password.change_own': 'Changed own password',
  'user.disable': 'Disabled user',
  'user.enable': 'Enabled user',
  'user.verify': 'Verified email',
  'user.resend_verification': 'Resent verification email',
  'user.sign_out_everywhere': 'Signed user out everywhere',
  'user.delete': 'Deleted user',
  'admin.grant': 'Granted admin',
  'admin.revoke': 'Revoked admin',
};

export function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}
