// ============================================================
// /admin — platform admin panel (operators of this deployment).
//
// Server-rendered, read-only overview of every account and user.
// Gate: a valid session whose user is in auth.platform_admins;
// everyone else gets a plain 404 (the panel's existence isn't
// advertised). Data is read with the service role.
// ============================================================
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { loadAdminOverview } from '@/lib/admin/overview';
import { isPlatformAdmin } from '@/lib/auth/native/bootstrap';
import { authPool } from '@/lib/auth/native/db';
import { getNativeSessionUser } from '@/lib/auth/native/session';
import { brand } from '@/config/brand';
import { BrandLogo } from '@/components/brand-logo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

const fmt = (d: string | Date) =>
  new Date(d).toISOString().slice(0, 16).replace('T', ' ');

export default async function AdminPage() {
  const user = await getNativeSessionUser(await headers());
  if (!user) redirect('/login');
  const pool = authPool();
  if (!(await isPlatformAdmin(pool, user.id))) notFound();

  const data = await loadAdminOverview(pool);
  const t = data.totals;
  const stats: [string, number][] = [
    ['Accounts', t.accounts],
    ['Users', t.users],
    ['Verified users', t.verifiedUsers],
    ['Connected numbers', t.connectedNumbers],
    ['Contacts', t.contacts],
    ['Conversations', t.conversations],
    ['Messages', t.messages],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <BrandLogo className="mb-3 h-10" />
          <h1 className="text-foreground text-2xl font-semibold">
            {brand.name} · Admin
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.email}. Read-only overview of every workspace on
            this server.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-primary text-sm hover:underline"
        >
          Open my workspace →
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="border-border bg-card rounded-lg border p-3"
          >
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="text-foreground text-xl font-semibold">
              {value.toLocaleString('en')}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-foreground text-lg font-medium">
          Accounts ({data.accounts.length})
        </h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Owner</th>
                <th className="p-2 text-right">Members</th>
                <th className="p-2 text-right">Contacts</th>
                <th className="p-2">WhatsApp</th>
                <th className="p-2">Created (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id} className="border-border border-t">
                  <td className="text-foreground p-2">{a.name}</td>
                  <td className="text-muted-foreground p-2">
                    {a.owner_email ?? '—'}
                  </td>
                  <td className="p-2 text-right">{a.members}</td>
                  <td className="p-2 text-right">{a.contacts}</td>
                  <td className="p-2">{a.whatsapp ?? 'not connected'}</td>
                  <td className="text-muted-foreground p-2">
                    {fmt(a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-foreground text-lg font-medium">
          Users ({data.users.length})
        </h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-left">
              <tr>
                <th className="p-2">Email</th>
                <th className="p-2">Name</th>
                <th className="p-2">Verified</th>
                <th className="p-2">Workspace</th>
                <th className="p-2">Role</th>
                <th className="p-2">Created (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-border border-t">
                  <td className="text-foreground p-2">
                    {u.email}
                    {u.platform_admin && (
                      <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs">
                        platform admin
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground p-2">{u.name ?? '—'}</td>
                  <td className="p-2">{u.email_verified ? 'yes' : 'no'}</td>
                  <td className="text-muted-foreground p-2">
                    {u.account_name ?? '—'}
                  </td>
                  <td className="p-2">{u.account_role ?? '—'}</td>
                  <td className="text-muted-foreground p-2">
                    {fmt(u.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
