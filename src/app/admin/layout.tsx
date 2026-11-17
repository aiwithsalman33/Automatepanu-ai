// ============================================================
// /admin layout: platform admin console (operators of this deployment).
//
// Gate: a valid session whose user is in auth.platform_admins; everyone
// else gets a plain 404 (the console's existence isn't advertised).
// Each page and every server action checks again (src/lib/admin/guard.ts):
// this layout is the first fence, not the only one.
// ============================================================
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { IntlProvider } from '@/components/intl-provider';
import { requireAdminPage } from '@/lib/admin/guard';
import { authPool } from '@/lib/auth/native/db';
import { brand } from '@/config/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: `Admin · ${brand.name}`, template: `%s · Admin · ${brand.name}` },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  const { rows } = await authPool().query<{ n: number }>(
    'SELECT count(*)::int AS n FROM auth.users WHERE NOT email_verified AND disabled_at IS NULL'
  );
  return (
    <IntlProvider>
      <AdminShell user={{ name: user.name, email: user.email }} pendingCount={rows[0]?.n ?? 0}>
        {children}
      </AdminShell>
    </IntlProvider>
  );
}
