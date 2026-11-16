/**
 * Data for the platform admin panel (/admin). Read-only, service role,
 * across every tenant: only call it after isPlatformAdmin() passed.
 */
import type { Pool } from 'pg';

export interface AdminOverview {
  totals: {
    accounts: number;
    users: number;
    verifiedUsers: number;
    contacts: number;
    conversations: number;
    messages: number;
    connectedNumbers: number;
  };
  accounts: {
    id: string;
    name: string;
    owner_email: string | null;
    members: number;
    contacts: number;
    whatsapp: string | null;
    created_at: string;
  }[];
  users: {
    id: string;
    email: string;
    name: string | null;
    email_verified: boolean;
    account_name: string | null;
    account_role: string | null;
    platform_admin: boolean;
    created_at: string;
  }[];
}

const LIMIT = 200;

export async function loadAdminOverview(pool: Pool): Promise<AdminOverview> {
  const [totals, accounts, users] = await Promise.all([
    pool.query(`SELECT
        (SELECT count(*) FROM public.accounts)::int AS accounts,
        (SELECT count(*) FROM auth.users)::int AS users,
        (SELECT count(*) FROM auth.users WHERE email_verified)::int AS "verifiedUsers",
        (SELECT count(*) FROM public.contacts)::int AS contacts,
        (SELECT count(*) FROM public.conversations)::int AS conversations,
        (SELECT count(*) FROM public.messages)::int AS messages,
        (SELECT count(*) FROM public.whatsapp_config WHERE status = 'connected')::int AS "connectedNumbers"`),
    pool.query(
      `SELECT a.id, a.name, u.email AS owner_email,
              (SELECT count(*) FROM public.account_members m WHERE m.account_id = a.id)::int AS members,
              (SELECT count(*) FROM public.contacts c WHERE c.account_id = a.id)::int AS contacts,
              (SELECT w.status FROM public.whatsapp_config w WHERE w.account_id = a.id LIMIT 1) AS whatsapp,
              a.created_at
         FROM public.accounts a
         LEFT JOIN auth.users u ON u.id = a.owner_user_id
        ORDER BY a.created_at DESC
        LIMIT $1`,
      [LIMIT]
    ),
    pool.query(
      `SELECT u.id, u.email, u.name, u.email_verified,
              a.name AS account_name, m.account_role::text AS account_role,
              (p.user_id IS NOT NULL) AS platform_admin, u.created_at
         FROM auth.users u
         LEFT JOIN public.account_members m ON m.user_id = u.id
         LEFT JOIN public.accounts a ON a.id = m.account_id
         LEFT JOIN auth.platform_admins p ON p.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT $1`,
      [LIMIT]
    ),
  ]);
  return {
    totals: totals.rows[0],
    accounts: accounts.rows,
    users: users.rows,
  };
}
