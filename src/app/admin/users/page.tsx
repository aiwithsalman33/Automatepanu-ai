// /admin/users: every user, searchable and filterable. Click a row for details.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight } from 'lucide-react';

import { FilterTabs, Pagination } from '@/components/admin/filter-tabs';
import { SearchBox } from '@/components/admin/search-box';
import {
  AdminPill,
  EmptyState,
  PageHeader,
  Panel,
  RolePill,
  StatusPill,
  UserAvatar,
} from '@/components/admin/ui';
import { requireAdminPage } from '@/lib/admin/guard';
import { fmtDate, fmtRelative } from '@/lib/admin/format';
import {
  USERS_PAGE_SIZE,
  listUsers,
  parseUserFilter,
  type UserFilter,
} from '@/lib/admin/queries';
import { authPool } from '@/lib/auth/native/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users' };

const LABELS: Record<UserFilter, string> = {
  all: 'All',
  verified: 'Verified',
  pending: 'Pending',
  disabled: 'Disabled',
  admins: 'Admins',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const q = one('q') ?? '';
  const filter = parseUserFilter(one('filter'));
  const page = Math.max(1, Number(one('page')) || 1);
  const { rows, total, counts } = await listUsers(authPool(), { q, filter, page });
  const params = { q: q || undefined, filter };

  return (
    <>
      <PageHeader title="Users" description="Everyone with an account on this server. Select a user to see their data and manage access." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          basePath="/admin/users"
          current={filter}
          params={params}
          options={(Object.keys(LABELS) as UserFilter[]).map((f) => ({ value: f, label: LABELS[f], count: counts[f] }))}
        />
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
      </div>

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState>{q ? `No users match “${q}”.` : 'No users in this view.'}</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Workspace</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Role</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last active</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Joined</th>
                  <th className="w-8 px-2 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((u) => (
                  <tr key={u.id} className="group relative transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} email={u.email} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="block truncate font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline"
                          >
                            {u.name || u.email}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </div>
                        {u.platform_admin ? <AdminPill /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill verified={u.email_verified} disabled={!!u.disabled_at} /></td>
                    <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground md:table-cell">{u.account_name ?? '—'}</td>
                    <td className="hidden px-4 py-3 sm:table-cell"><RolePill role={u.account_role} /></td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground lg:table-cell">{fmtRelative(u.last_seen_at)}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground lg:table-cell">{fmtDate(u.created_at)}</td>
                    <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Pagination basePath="/admin/users" page={page} pageSize={USERS_PAGE_SIZE} total={total} params={params} />
    </>
  );
}
