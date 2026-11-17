// /admin/verification: who has confirmed their email, who is waiting, and
// one-click "give access" (marks the email verified so they can sign in).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BadgeCheck, Clock, Hourglass, Percent } from 'lucide-react';

import { FilterTabs, Pagination } from '@/components/admin/filter-tabs';
import { SearchBox } from '@/components/admin/search-box';
import { EmptyState, PageHeader, Panel, StatTile } from '@/components/admin/ui';
import { VerificationTable } from '@/components/admin/verification-table';
import { requireAdminPage } from '@/lib/admin/guard';
import { fmtRelative } from '@/lib/admin/format';
import { USERS_PAGE_SIZE, listUsers } from '@/lib/admin/queries';
import { authPool } from '@/lib/auth/native/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Verification' };

const TABS = ['pending', 'verified', 'all'] as const;
type Tab = (typeof TABS)[number];

export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const raw = one('filter');
  const filter: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'pending';
  const q = one('q') ?? '';
  const page = Math.max(1, Number(one('page')) || 1);

  const pool = authPool();
  const [{ rows, total, counts }, summary] = await Promise.all([
    listUsers(pool, { q, filter, page }),
    pool.query<{ verified_today: number; oldest_pending: string | null }>(
      `SELECT
         (SELECT count(*) FROM auth.admin_audit_log
           WHERE action = 'user.verify' AND created_at >= date_trunc('day', now()))::int AS verified_today,
         (SELECT min(created_at) FROM auth.users
           WHERE NOT email_verified AND disabled_at IS NULL) AS oldest_pending`
    ),
  ]);
  const s = summary.rows[0];
  const rate = counts.all ? Math.round((counts.verified / counts.all) * 100) : 0;
  const params = { q: q || undefined, filter };

  return (
    <>
      <PageHeader
        title="Verification"
        description="New accounts must confirm their email before they can sign in. Give access here to skip the email step."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Waiting for access" value={counts.pending} icon={Clock} tone="warning" />
        <StatTile label="Verified users" value={counts.verified} icon={BadgeCheck} tone="good" />
        <StatTile label="Verification rate" value={`${rate}%`} icon={Percent} tone="neutral" hint="of all users" />
        <StatTile
          label="Oldest request"
          value={s?.oldest_pending ? fmtRelative(s.oldest_pending) : '—'}
          icon={Hourglass}
          tone="neutral"
          hint={`${s?.verified_today ?? 0} approved by admins today`}
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          basePath="/admin/verification"
          current={filter}
          params={params}
          options={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'verified', label: 'Verified', count: counts.verified },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <Suspense fallback={null}>
          <SearchBox placeholder="Search by name or email" />
        </Suspense>
      </div>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState>
              {filter === 'pending' && !q ? 'Nobody is waiting. Every account is verified.' : 'No users in this view.'}
            </EmptyState>
          </div>
        ) : (
          <VerificationTable
            rows={rows.map((r) => ({
              id: r.id,
              email: r.email,
              name: r.name,
              email_verified: r.email_verified,
              disabled: !!r.disabled_at,
              created_at: new Date(r.created_at).toISOString(),
              account_name: r.account_name,
            }))}
          />
        )}
      </Panel>

      <Pagination basePath="/admin/verification" page={page} pageSize={USERS_PAGE_SIZE} total={total} params={params} />
    </>
  );
}
