// /admin/users/[id]: everything about one user, plus the admin actions.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Contact,
  Handshake,
  FileText,
  MessageSquare,
  MessagesSquare,
  Monitor,
  Radio,
  Workflow,
} from 'lucide-react';

import { MessagesChart } from '@/components/admin/charts';
import {
  AdminPill,
  DetailList,
  EmptyState,
  Panel,
  RolePill,
  StatTile,
  StatusPill,
  UserAvatar,
} from '@/components/admin/ui';
import { UserActions } from '@/components/admin/user-actions';
import { requireAdminPage } from '@/lib/admin/guard';
import {
  AUDIT_LABELS,
  describeUserAgent,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  fmtRelative,
} from '@/lib/admin/format';
import { loadUserDetail } from '@/lib/admin/queries';
import { authPool } from '@/lib/auth/native/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'User' };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const d = await loadUserDetail(authPool(), id);
  if (!d) notFound();
  const u = d.user;
  const msgs30 = d.messages.reduce((s, x) => s + x.incoming + x.outgoing, 0);

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> All users
      </Link>

      {/* Profile header */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/20 via-primary/8 to-transparent" />
        <div className="relative flex flex-wrap items-end gap-4 px-5 pt-8 pb-5">
          <UserAvatar name={u.name} email={u.email} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{u.name || u.email}</h1>
              <StatusPill verified={u.email_verified} disabled={!!u.disabled_at} />
              {u.platform_admin ? <AdminPill /> : null}
              {u.id === admin.id ? <span className="text-xs text-muted-foreground">(you)</span> : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{u.email}</p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div><dt className="text-xs text-muted-foreground">Joined</dt><dd className="text-foreground">{fmtDate(u.created_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Last active</dt><dd className="text-foreground">{fmtRelative(u.last_seen_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Sessions</dt><dd className="text-foreground tabular-nums">{d.sessions.length}</dd></div>
          </dl>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Usage */}
          {d.stats ? (
            <section aria-label="Workspace usage" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Contacts" value={d.stats.contacts} icon={Contact} />
              <StatTile label="Conversations" value={d.stats.conversations} icon={MessagesSquare} hint={`${fmtNumber(d.stats.openConversations)} open`} />
              <StatTile label="Messages" value={d.stats.messages} icon={MessageSquare} />
              <StatTile label="Broadcasts" value={d.stats.broadcasts} icon={Radio} tone="neutral" />
              <StatTile label="Automations" value={d.stats.automations} icon={Bot} tone="neutral" hint={`${d.stats.activeAutomations} active`} />
              <StatTile label="Flows" value={d.stats.flows} icon={Workflow} tone="neutral" />
              <StatTile label="Deals" value={d.stats.deals} icon={Handshake} tone="neutral" />
              <StatTile label="Templates" value={d.stats.templates} icon={FileText} tone="neutral" />
            </section>
          ) : null}

          <Panel title="Message volume" description={`Their workspace, last 30 days (UTC) · ${fmtNumber(msgs30)} messages`}>
            {msgs30 === 0 ? <EmptyState>No messages in the last 30 days.</EmptyState> : <MessagesChart data={d.messages} className="h-52" />}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Profile">
              <DetailList
                items={[
                  ['Name', u.name || '—'],
                  ['Email', u.email],
                  ['Email verified', u.email_verified ? 'Yes' : 'No'],
                  ['Status', u.disabled_at ? `Disabled ${fmtDateTime(u.disabled_at)}` : 'Active'],
                  ['Platform admin', u.platform_admin ? `Yes, since ${fmtDate(u.admin_since)}` : 'No'],
                  ['Created', fmtDateTime(u.created_at)],
                  ['Updated', fmtDateTime(u.updated_at)],
                  ['User ID', <code key="id" className="text-xs break-all">{u.id}</code>],
                ]}
              />
            </Panel>
            <Panel title="Workspace">
              {d.workspace ? (
                <DetailList
                  items={[
                    ['Name', d.workspace.name],
                    ['Role', <RolePill key="r" role={u.account_role} />],
                    ['Owner', d.workspace.owner_user_id === u.id ? 'This user' : (
                      <Link key="o" className="text-primary hover:underline" href={`/admin/users/${d.workspace.owner_user_id}`}>{d.workspace.owner_email ?? 'Owner'}</Link>
                    )],
                    ['Currency', d.workspace.default_currency],
                    ['Created', fmtDate(d.workspace.created_at)],
                    ['Workspace ID', <code key="w" className="text-xs break-all">{d.workspace.id}</code>],
                  ]}
                />
              ) : (
                <EmptyState>Not a member of any workspace.</EmptyState>
              )}
            </Panel>
          </div>

          <Panel title="WhatsApp numbers" bodyClassName="p-0">
            {d.whatsapp.length === 0 ? (
              <div className="p-4"><EmptyState>No WhatsApp number connected.</EmptyState></div>
            ) : (
              <ul className="divide-y divide-border">
                {d.whatsapp.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Phone number ID <span className="font-mono">{w.phone_number_id}</span></p>
                      <p className="text-xs text-muted-foreground">WABA {w.waba_id ?? '—'} · connected {fmtDate(w.connected_at)}</p>
                      {w.last_registration_error ? <p className="mt-1 text-xs text-status-critical">{w.last_registration_error}</p> : null}
                    </div>
                    <span className={w.status === 'connected' ? 'text-status-good' : 'text-muted-foreground'}>{w.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Team (${d.team.length})`} bodyClassName="p-0">
            {d.team.length === 0 ? (
              <div className="p-4"><EmptyState>No team members.</EmptyState></div>
            ) : (
              <ul className="divide-y divide-border">
                {d.team.map((m) => (
                  <li key={m.user_id}>
                    <Link href={`/admin/users/${m.user_id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                      <UserAvatar name={m.full_name} email={m.email} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{m.full_name || m.email}{m.user_id === u.id ? ' (this user)' : ''}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                      </span>
                      {m.disabled ? <StatusPill verified disabled /> : null}
                      <RolePill role={m.account_role} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right column: actions + security */}
        <div className="space-y-4">
          <Panel title="Manage access" description="Changes take effect immediately and are logged.">
            <UserActions
              target={{
                id: u.id,
                email: u.email,
                verified: u.email_verified,
                disabled: !!u.disabled_at,
                platformAdmin: u.platform_admin,
                isSelf: u.id === admin.id,
                activeSessions: d.sessions.length,
                deletePlan: d.deletePlan,
                createdRows: d.createdRows,
              }}
            />
          </Panel>

          <Panel title="Sign-in methods">
            {d.identities.length === 0 ? (
              <EmptyState>No sign-in method. Set a password to let them sign in.</EmptyState>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.identities.map((i) => (
                  <li key={i.provider_id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{i.provider_id === 'credential' ? 'Email & password' : i.provider_id}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.provider_id === 'credential' ? (i.has_password ? `changed ${fmtRelative(i.updated_at)}` : 'no password') : `linked ${fmtDate(i.created_at)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Active sessions" bodyClassName="p-0">
            {d.sessions.length === 0 ? (
              <div className="p-4"><EmptyState>Not signed in anywhere.</EmptyState></div>
            ) : (
              <ul className="divide-y divide-border">
                {d.sessions.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                    <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">{describeUserAgent(s.user_agent)}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.ip_address ?? 'unknown IP'} · active {fmtRelative(s.updated_at)} · expires {fmtDate(s.expires_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Admin history" bodyClassName="p-0">
            {d.audit.length === 0 ? (
              <div className="p-4"><EmptyState>No admin changes yet.</EmptyState></div>
            ) : (
              <ul className="divide-y divide-border">
                {d.audit.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <p className="font-medium text-foreground">{AUDIT_LABELS[a.action] ?? a.action}</p>
                    <p className="text-xs text-muted-foreground">by {a.admin_email} · {fmtRelative(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
