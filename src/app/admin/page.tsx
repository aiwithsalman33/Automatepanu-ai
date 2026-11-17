// /admin: platform dashboard. KPIs and 30-day trends across every workspace.
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  Ban,
  Bot,
  Building2,
  Clock,
  Contact,
  MessageSquare,
  MessagesSquare,
  Phone,
  Radio,
  Users,
} from 'lucide-react';

import { MessagesChart, SignupsChart } from '@/components/admin/charts';
import {
  EmptyState,
  PageHeader,
  Panel,
  StatTile,
  StatusPill,
  UserAvatar,
} from '@/components/admin/ui';
import { requireAdminPage } from '@/lib/admin/guard';
import { fmtDate, fmtNumber, fmtRelative } from '@/lib/admin/format';
import { loadAdminDashboard } from '@/lib/admin/queries';
import { authPool } from '@/lib/auth/native/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();
  const d = await loadAdminDashboard(authPool());
  const t = d.totals;
  const w = d.weekly;
  const signups30 = d.signups.reduce((s, x) => s + x.count, 0);
  const msgs30 = d.messages.reduce((s, x) => s + x.incoming + x.outgoing, 0);
  const verifiedPct = t.users ? Math.round((t.verifiedUsers / t.users) * 100) : 0;
  const waTotal = d.whatsapp.reduce((s, x) => s + x.count, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back${admin.name ? `, ${admin.name.split(' ')[0]}` : ''}`}
        description="Everything happening across every workspace on this server."
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Total users"
          value={t.users}
          icon={Users}
          change={{ current: w.newUsers, previous: w.newUsersPrev }}
          hint={`+${fmtNumber(w.newUsers)} this week`}
        />
        <StatTile
          label="Verified"
          value={t.verifiedUsers}
          icon={BadgeCheck}
          tone="good"
          hint={`${verifiedPct}% of users`}
        />
        <StatTile
          label="Pending"
          value={t.pendingUsers}
          icon={Clock}
          tone="warning"
          hint={t.pendingUsers ? <Link className="text-primary hover:underline" href="/admin/verification">Review →</Link> : 'All clear'}
        />
        <StatTile label="Disabled" value={t.disabledUsers} icon={Ban} tone="critical" hint={`${t.admins} platform admin${t.admins === 1 ? '' : 's'}`} />
        <StatTile
          label="Workspaces"
          value={t.accounts}
          icon={Building2}
          change={{ current: w.newAccounts, previous: w.newAccountsPrev }}
          hint="vs last week"
        />
        <StatTile label="Active sessions" value={t.activeSessions} icon={Activity} tone="neutral" hint="signed-in devices" />
        <StatTile
          label="Messages"
          value={t.messages}
          icon={MessageSquare}
          change={{ current: w.messages, previous: w.messagesPrev }}
          hint={`${fmtNumber(w.messages)} this week`}
        />
        <StatTile label="Conversations" value={t.conversations} icon={MessagesSquare} tone="neutral" hint={`${fmtNumber(t.openConversations)} open`} />
        <StatTile label="Contacts" value={t.contacts} icon={Contact} tone="neutral" />
        <StatTile label="Live numbers" value={t.connectedNumbers} icon={Phone} tone="good" hint="WhatsApp" />
        <StatTile label="Broadcasts" value={t.broadcasts} icon={Radio} tone="neutral" />
        <StatTile label="Automations" value={t.activeAutomations + t.activeFlows} icon={Bot} tone="neutral" hint={`live: ${t.activeAutomations} rules, ${t.activeFlows} flows`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Message volume"
          description={`Last 30 days (UTC) · ${fmtNumber(msgs30)} messages`}
        >
          {msgs30 === 0 ? <EmptyState>No messages in the last 30 days.</EmptyState> : <MessagesChart data={d.messages} />}
        </Panel>
        <Panel
          className="xl:col-span-2"
          title="New users"
          description={`Last 30 days (UTC) · ${fmtNumber(signups30)} sign-ups`}
        >
          {signups30 === 0 ? <EmptyState>No sign-ups in the last 30 days.</EmptyState> : <SignupsChart data={d.signups} />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Account health" description="Verification and WhatsApp status">
          <div className="space-y-5">
            <Meter
              label="Users"
              total={t.users}
              parts={[
                { label: 'Verified', value: t.verifiedUsers, className: 'bg-status-good' },
                { label: 'Pending', value: t.pendingUsers, className: 'bg-status-warning' },
                { label: 'Disabled', value: t.disabledUsers, className: 'bg-status-critical' },
              ]}
            />
            <Meter
              label="WhatsApp numbers"
              total={waTotal}
              parts={d.whatsapp.map((s) => ({
                label: s.status,
                value: s.count,
                className: s.status === 'connected' ? 'bg-status-good' : s.status === 'error' ? 'bg-status-critical' : 'bg-muted-foreground/50',
              }))}
            />
          </div>
        </Panel>

        <Panel title="Most active workspaces" description="Messages, last 30 days">
          {d.topAccounts.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {d.topAccounts.map((a, i) => {
                const max = d.topAccounts[0].messages || 1;
                return (
                  <li key={a.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                        <span className="font-medium text-foreground">{a.name}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{fmtNumber(a.messages)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (a.messages / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel
          title="Latest sign-ups"
          action={<Link href="/admin/users" className="text-xs font-medium text-primary hover:underline">All users →</Link>}
          bodyClassName="p-0"
        >
          {d.latestUsers.length === 0 ? (
            <div className="p-4"><EmptyState>No users yet.</EmptyState></div>
          ) : (
            <ul className="divide-y divide-border">
              {d.latestUsers.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
                    <UserAvatar name={u.name} email={u.email} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{u.name || u.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fmtRelative(u.created_at)}</span>
                    </span>
                    <StatusPill verified={u.email_verified} disabled={!!u.disabled_at} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Newest workspaces" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Workspace</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 text-right font-medium">Members</th>
                <th className="px-4 py-2 text-right font-medium">Contacts</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.recentAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{a.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.owner_email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.members}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(a.contacts)}</td>
                  <td className="px-4 py-2.5">
                    <span className={a.whatsapp === 'connected' ? 'text-status-good' : 'text-muted-foreground'}>
                      {a.whatsapp ?? 'not connected'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** Part-to-whole bar with a labelled legend (identity never by color alone). */
function Meter({
  label,
  total,
  parts,
}: {
  label: string;
  total: number;
  parts: { label: string; value: number; className: string }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">{fmtNumber(total)}</span>
      </div>
      {total === 0 ? (
        <div className="h-2.5 rounded-full bg-muted" />
      ) : (
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
          {parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />
          ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 capitalize">
            <span className={`size-2 rounded-full ${p.className}`} aria-hidden />
            {p.label} <span className="text-foreground tabular-nums">{fmtNumber(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
