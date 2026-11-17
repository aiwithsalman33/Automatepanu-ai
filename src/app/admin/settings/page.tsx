// /admin/settings: the signed-in admin's account, who else is an admin,
// deployment health, security policy and the admin activity log.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { ChangePasswordForm } from '@/components/admin/change-password-form';
import { DetailList, EmptyState, PageHeader, Panel, UserAvatar } from '@/components/admin/ui';
import { requireAdminPage } from '@/lib/admin/guard';
import { AUDIT_LABELS, fmtDate, fmtDateTime, fmtRelative } from '@/lib/admin/format';
import { loadAdminSettings } from '@/lib/admin/queries';
import { systemChecks, type CheckState } from '@/lib/admin/system';
import {
  AUTH_RATE_LIMITS,
  MIN_PASSWORD_LENGTH,
  SESSION_EXPIRES_IN_S,
} from '@/lib/auth/native/auth';
import { authPool } from '@/lib/auth/native/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

const CHECK_ICON: Record<CheckState, { icon: typeof Info; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-status-good', label: 'OK' },
  missing: { icon: XCircle, className: 'text-status-critical', label: 'Missing' },
  placeholder: { icon: AlertTriangle, className: 'text-status-warning', label: 'Template value' },
  info: { icon: Info, className: 'text-muted-foreground', label: 'Info' },
};

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage();
  const data = await loadAdminSettings(authPool());
  const checks = systemChecks();
  const me = data.admins.find((a) => a.user_id === admin.id);
  const problems = checks.filter((c) => c.state === 'missing' || c.state === 'placeholder').length;

  return (
    <>
      <PageHeader title="Settings" description="Your admin account, platform admins, deployment health and the audit log." />

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Your admin account">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <UserAvatar name={admin.name} email={admin.email} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">{admin.name || 'Admin'}</p>
                <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
              </div>
            </div>
            <DetailList
              items={[
                ['Admin since', fmtDate(me?.created_at)],
                ['Account created', fmtDate(admin.createdAt)],
                ['Email verified', admin.emailVerified ? 'Yes' : 'No'],
              ]}
            />
            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Change your password</h3>
              <ChangePasswordForm minLength={MIN_PASSWORD_LENGTH} />
            </div>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={`Platform admins (${data.admins.length})`}
          description="Grant or remove access from a user's page."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {data.admins.map((a) => (
              <li key={a.user_id}>
                <Link href={`/admin/users/${a.user_id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                  <UserAvatar name={a.name} email={a.email} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {a.name || a.email}
                      {a.user_id === admin.id ? <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{a.disabled ? 'disabled' : `since ${fmtDate(a.created_at)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="System status"
          description={problems ? `${problems} setting${problems === 1 ? '' : 's'} need attention` : 'All required settings are in place'}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {checks.map((c) => {
              const s = CHECK_ICON[c.state];
              return (
                <li key={c.key} className="flex items-start gap-3 px-4 py-3">
                  <s.icon className={`mt-0.5 size-4 shrink-0 ${s.className}`} aria-label={s.label} />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">{c.label}</p>
                    <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </li>
              );
            })}
            <li className="flex items-start gap-3 px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Info" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Database</p>
                <p className="text-xs text-muted-foreground">PostgreSQL {data.database.version}</p>
              </div>
            </li>
          </ul>
        </Panel>

        <Panel title="Sign-up & security policy" description="Set in code (src/lib/auth/native/auth.ts).">
          <DetailList
            items={[
              ['Email verification', 'Required before first sign-in (admins can give access directly)'],
              ['Minimum password', `${MIN_PASSWORD_LENGTH} characters`],
              ['Session lifetime', `${SESSION_EXPIRES_IN_S / 86400} days, refreshed daily`],
              ['Sign-in attempts', `${AUTH_RATE_LIMITS['/sign-in/email'].max} per ${AUTH_RATE_LIMITS['/sign-in/email'].window}s per IP`],
              ['Sign-ups', `${AUTH_RATE_LIMITS['/sign-up/email'].max} per hour per IP`],
              ['Disabled users', 'Signed out everywhere and blocked from signing in'],
            ]}
          />
        </Panel>
      </div>

      <Panel title="Admin activity" description="The last 30 changes made in this console." bodyClassName="p-0">
        {data.audit.length === 0 ? (
          <div className="p-4"><EmptyState>No admin changes yet.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">By</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.audit.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{AUDIT_LABELS[a.action] ?? a.action}</td>
                    <td className="max-w-56 truncate px-4 py-2.5">
                      {a.target_user_id ? (
                        <Link href={`/admin/users/${a.target_user_id}`} className="text-primary hover:underline">{a.target_email}</Link>
                      ) : (
                        <span className="text-muted-foreground">{a.target_email ?? '—'}</span>
                      )}
                    </td>
                    <td className="hidden max-w-56 truncate px-4 py-2.5 text-muted-foreground md:table-cell">{a.admin_email}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground" title={fmtDateTime(a.created_at)}>{fmtRelative(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
