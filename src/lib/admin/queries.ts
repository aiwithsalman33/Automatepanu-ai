/**
 * Read models for the platform admin panel (/admin). Service role,
 * across every tenant: only call these after requireAdminPage() passed.
 *
 * Days are UTC calendar days (the admin panel has no per-viewer zone).
 */
import type { Pool } from 'pg';

// ---------------------------------------------------------------- types

export interface DayCount {
  /** YYYY-MM-DD (UTC). */
  day: string;
  count: number;
}

export interface DayMessages {
  day: string;
  incoming: number;
  outgoing: number;
}

export interface AdminDashboard {
  totals: {
    users: number;
    verifiedUsers: number;
    pendingUsers: number;
    disabledUsers: number;
    admins: number;
    accounts: number;
    connectedNumbers: number;
    contacts: number;
    conversations: number;
    openConversations: number;
    messages: number;
    activeSessions: number;
    activeAutomations: number;
    activeFlows: number;
    broadcasts: number;
  };
  /** This week vs the week before (rolling 7 days). */
  weekly: {
    newUsers: number;
    newUsersPrev: number;
    messages: number;
    messagesPrev: number;
    newAccounts: number;
    newAccountsPrev: number;
  };
  signups: DayCount[];
  messages: DayMessages[];
  whatsapp: { status: string; count: number }[];
  topAccounts: {
    id: string;
    name: string;
    owner_email: string | null;
    messages: number;
  }[];
  recentAccounts: {
    id: string;
    name: string;
    owner_email: string | null;
    members: number;
    contacts: number;
    whatsapp: string | null;
    created_at: string;
  }[];
  latestUsers: AdminUserRow[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  email_verified: boolean;
  disabled_at: string | null;
  created_at: string;
  account_id: string | null;
  account_name: string | null;
  account_role: string | null;
  platform_admin: boolean;
  last_seen_at: string | null;
}

export const USER_FILTERS = [
  'all',
  'verified',
  'pending',
  'disabled',
  'admins',
] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export function parseUserFilter(v: string | undefined | null): UserFilter {
  return (USER_FILTERS as readonly string[]).includes(v ?? '')
    ? (v as UserFilter)
    : 'all';
}

/** WHERE fragments per filter. Fixed strings only: never user input. */
const FILTER_SQL: Record<UserFilter, string> = {
  all: 'TRUE',
  verified: 'u.email_verified AND u.disabled_at IS NULL',
  pending: 'NOT u.email_verified AND u.disabled_at IS NULL',
  disabled: 'u.disabled_at IS NOT NULL',
  admins: 'p.user_id IS NOT NULL',
};

export interface UserDetail {
  user: AdminUserRow & {
    updated_at: string;
    admin_since: string | null;
    raw_user_meta_data: Record<string, unknown>;
  };
  identities: {
    provider_id: string;
    has_password: boolean;
    created_at: string;
    updated_at: string;
  }[];
  workspace: {
    id: string;
    name: string;
    owner_user_id: string;
    owner_email: string | null;
    default_currency: string;
    created_at: string;
  } | null;
  stats: {
    contacts: number;
    conversations: number;
    openConversations: number;
    messages: number;
    broadcasts: number;
    automations: number;
    activeAutomations: number;
    flows: number;
    deals: number;
    templates: number;
  } | null;
  messages: DayMessages[];
  whatsapp: {
    id: string;
    phone_number_id: string;
    waba_id: string | null;
    status: string;
    connected_at: string | null;
    last_registration_error: string | null;
  }[];
  team: {
    user_id: string;
    full_name: string;
    email: string;
    account_role: string;
    disabled: boolean;
  }[];
  sessions: {
    id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;
    expires_at: string;
  }[];
  /** Rows this user created; they are deleted along with the user. */
  createdRows: {
    contacts: number;
    conversations: number;
    broadcasts: number;
    automations: number;
    flows: number;
  };
  deletePlan: DeletePlan;
  audit: AuditEntry[];
}

export interface DeletePlan {
  /** Workspaces this user owns that other people still belong to. */
  blockedBy: { id: string; name: string; otherMembers: number }[];
  /** Workspaces owned by this user alone: deleted with the user. */
  deletesWorkspaces: { id: string; name: string }[];
}

export interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// ------------------------------------------------------------ helpers

const DAYS = 30;

/** Series skeleton: one row per UTC day, oldest first, zero-filled. */
const DAY_SERIES = `generate_series(
    (now() AT TIME ZONE 'UTC')::date - ${DAYS - 1},
    (now() AT TIME ZONE 'UTC')::date,
    interval '1 day') AS d`;

/** Escape LIKE wildcards so a search for "a_b" matches literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const USER_COLUMNS = `u.id, u.email, u.name, u.image, u.email_verified,
  u.disabled_at, u.created_at,
  a.id AS account_id, a.name AS account_name,
  m.account_role::text AS account_role,
  (p.user_id IS NOT NULL) AS platform_admin,
  (SELECT max(s.updated_at) FROM auth.sessions s WHERE s.user_id = u.id) AS last_seen_at`;

const USER_JOINS = `FROM auth.users u
  LEFT JOIN public.account_members m ON m.user_id = u.id
  LEFT JOIN public.accounts a ON a.id = m.account_id
  LEFT JOIN auth.platform_admins p ON p.user_id = u.id`;

// ---------------------------------------------------------- dashboard

export async function loadAdminDashboard(pool: Pool): Promise<AdminDashboard> {
  const [totals, weekly, signups, messages, whatsapp, top, recent, latest] =
    await Promise.all([
      pool.query(`SELECT
        (SELECT count(*) FROM auth.users)::int AS users,
        (SELECT count(*) FROM auth.users WHERE email_verified AND disabled_at IS NULL)::int AS "verifiedUsers",
        (SELECT count(*) FROM auth.users WHERE NOT email_verified AND disabled_at IS NULL)::int AS "pendingUsers",
        (SELECT count(*) FROM auth.users WHERE disabled_at IS NOT NULL)::int AS "disabledUsers",
        (SELECT count(*) FROM auth.platform_admins)::int AS admins,
        (SELECT count(*) FROM public.accounts)::int AS accounts,
        (SELECT count(*) FROM public.whatsapp_config WHERE status = 'connected')::int AS "connectedNumbers",
        (SELECT count(*) FROM public.contacts)::int AS contacts,
        (SELECT count(*) FROM public.conversations)::int AS conversations,
        (SELECT count(*) FROM public.conversations WHERE status = 'open')::int AS "openConversations",
        (SELECT count(*) FROM public.messages)::int AS messages,
        (SELECT count(*) FROM auth.sessions WHERE expires_at > now())::int AS "activeSessions",
        (SELECT count(*) FROM public.automations WHERE is_active)::int AS "activeAutomations",
        (SELECT count(*) FROM public.flows WHERE status = 'active')::int AS "activeFlows",
        (SELECT count(*) FROM public.broadcasts)::int AS broadcasts`),
      pool.query(`SELECT
        (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days')::int AS "newUsers",
        (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '14 days'
                                           AND created_at <  now() - interval '7 days')::int AS "newUsersPrev",
        (SELECT count(*) FROM public.messages WHERE created_at >= now() - interval '7 days')::int AS messages,
        (SELECT count(*) FROM public.messages WHERE created_at >= now() - interval '14 days'
                                               AND created_at <  now() - interval '7 days')::int AS "messagesPrev",
        (SELECT count(*) FROM public.accounts WHERE created_at >= now() - interval '7 days')::int AS "newAccounts",
        (SELECT count(*) FROM public.accounts WHERE created_at >= now() - interval '14 days'
                                               AND created_at <  now() - interval '7 days')::int AS "newAccountsPrev"`),
      pool.query<DayCount>(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(c.n, 0)::int AS count
           FROM ${DAY_SERIES}
           LEFT JOIN (SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
                        FROM auth.users
                       WHERE created_at >= now() - interval '${DAYS + 1} days'
                       GROUP BY 1) c ON c.day = d::date
          ORDER BY d`
      ),
      pool.query<DayMessages>(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                coalesce(m.incoming, 0)::int AS incoming,
                coalesce(m.outgoing, 0)::int AS outgoing
           FROM ${DAY_SERIES}
           LEFT JOIN (SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
                             count(*) FILTER (WHERE sender_type = 'customer') AS incoming,
                             count(*) FILTER (WHERE sender_type <> 'customer') AS outgoing
                        FROM public.messages
                       WHERE created_at >= now() - interval '${DAYS + 1} days'
                       GROUP BY 1) m ON m.day = d::date
          ORDER BY d`
      ),
      pool.query(
        `SELECT status, count(*)::int AS count
           FROM public.whatsapp_config GROUP BY status ORDER BY count DESC`
      ),
      pool.query(
        `SELECT a.id, a.name, u.email AS owner_email, count(*)::int AS messages
           FROM public.messages msg
           JOIN public.conversations c ON c.id = msg.conversation_id
           JOIN public.accounts a ON a.id = c.account_id
           LEFT JOIN auth.users u ON u.id = a.owner_user_id
          WHERE msg.created_at >= now() - interval '${DAYS} days'
          GROUP BY a.id, a.name, u.email
          ORDER BY messages DESC
          LIMIT 5`
      ),
      pool.query(
        `SELECT a.id, a.name, u.email AS owner_email,
                (SELECT count(*) FROM public.account_members m WHERE m.account_id = a.id)::int AS members,
                (SELECT count(*) FROM public.contacts c WHERE c.account_id = a.id)::int AS contacts,
                (SELECT w.status FROM public.whatsapp_config w WHERE w.account_id = a.id
                  ORDER BY (w.status = 'connected') DESC LIMIT 1) AS whatsapp,
                a.created_at
           FROM public.accounts a
           LEFT JOIN auth.users u ON u.id = a.owner_user_id
          ORDER BY a.created_at DESC
          LIMIT 8`
      ),
      pool.query<AdminUserRow>(
        `SELECT ${USER_COLUMNS} ${USER_JOINS} ORDER BY u.created_at DESC LIMIT 6`
      ),
    ]);

  return {
    totals: totals.rows[0],
    weekly: weekly.rows[0],
    signups: signups.rows,
    messages: messages.rows,
    whatsapp: whatsapp.rows,
    topAccounts: top.rows,
    recentAccounts: recent.rows,
    latestUsers: latest.rows,
  };
}

// -------------------------------------------------------------- users

export const USERS_PAGE_SIZE = 25;

export async function listUsers(
  pool: Pool,
  opts: { q?: string; filter?: UserFilter; page?: number; pageSize?: number }
): Promise<{ rows: AdminUserRow[]; total: number; counts: Record<UserFilter, number> }> {
  const q = (opts.q ?? '').trim().slice(0, 200);
  const filter = opts.filter ?? 'all';
  const pageSize = opts.pageSize ?? USERS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const search = q
    ? `(u.email ILIKE $1 OR u.name ILIKE $1 OR a.name ILIKE $1)`
    : `($1::text IS NULL)`;
  const params = [q ? likePattern(q) : null];
  const where = `WHERE ${search} AND ${FILTER_SQL[filter]}`;

  const [rows, total, counts] = await Promise.all([
    pool.query<AdminUserRow>(
      `SELECT ${USER_COLUMNS} ${USER_JOINS} ${where}
        ORDER BY u.created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params
    ),
    pool.query<{ n: number }>(
      `SELECT count(*)::int AS n ${USER_JOINS} ${where}`,
      params
    ),
    pool.query(
      `SELECT ${USER_FILTERS.map(
        (f) => `count(*) FILTER (WHERE ${FILTER_SQL[f]})::int AS ${f}`
      ).join(', ')} ${USER_JOINS} WHERE ${search}`,
      params
    ),
  ]);
  return {
    rows: rows.rows,
    total: total.rows[0]?.n ?? 0,
    counts: counts.rows[0],
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export async function loadDeletePlan(
  pool: Pick<Pool, 'query'>,
  userId: string
): Promise<DeletePlan> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    other_members: number;
  }>(
    `SELECT a.id, a.name,
            (SELECT count(*) FROM public.account_members m
              WHERE m.account_id = a.id AND m.user_id <> $1)::int AS other_members
       FROM public.accounts a
      WHERE a.owner_user_id = $1
      ORDER BY a.created_at`,
    [userId]
  );
  return {
    blockedBy: rows
      .filter((r) => r.other_members > 0)
      .map((r) => ({ id: r.id, name: r.name, otherMembers: r.other_members })),
    deletesWorkspaces: rows
      .filter((r) => r.other_members === 0)
      .map((r) => ({ id: r.id, name: r.name })),
  };
}

export async function loadUserDetail(
  pool: Pool,
  userId: string
): Promise<UserDetail | null> {
  if (!isUuid(userId)) return null;
  const userRes = await pool.query(
    `SELECT ${USER_COLUMNS}, u.updated_at, u.raw_user_meta_data,
            p.created_at AS admin_since
       ${USER_JOINS}
      WHERE u.id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return null;
  const accountId: string | null = user.account_id;

  const [
    identities,
    workspace,
    stats,
    messages,
    whatsapp,
    team,
    sessions,
    createdRows,
    deletePlan,
    audit,
  ] = await Promise.all([
    pool.query(
      `SELECT provider_id, (password IS NOT NULL) AS has_password, created_at, updated_at
         FROM auth.identities WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    ),
    accountId
      ? pool.query(
          `SELECT a.id, a.name, a.owner_user_id, u.email AS owner_email,
                  a.default_currency, a.created_at
             FROM public.accounts a
             LEFT JOIN auth.users u ON u.id = a.owner_user_id
            WHERE a.id = $1`,
          [accountId]
        )
      : null,
    accountId
      ? pool.query(
          `SELECT
            (SELECT count(*) FROM public.contacts WHERE account_id = $1)::int AS contacts,
            (SELECT count(*) FROM public.conversations WHERE account_id = $1)::int AS conversations,
            (SELECT count(*) FROM public.conversations WHERE account_id = $1 AND status = 'open')::int AS "openConversations",
            (SELECT count(*) FROM public.messages msg
               JOIN public.conversations c ON c.id = msg.conversation_id
              WHERE c.account_id = $1)::int AS messages,
            (SELECT count(*) FROM public.broadcasts WHERE account_id = $1)::int AS broadcasts,
            (SELECT count(*) FROM public.automations WHERE account_id = $1)::int AS automations,
            (SELECT count(*) FROM public.automations WHERE account_id = $1 AND is_active)::int AS "activeAutomations",
            (SELECT count(*) FROM public.flows WHERE account_id = $1)::int AS flows,
            (SELECT count(*) FROM public.deals WHERE account_id = $1)::int AS deals,
            (SELECT count(*) FROM public.message_templates WHERE account_id = $1)::int AS templates`,
          [accountId]
        )
      : null,
    accountId
      ? pool.query<DayMessages>(
          `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  coalesce(m.incoming, 0)::int AS incoming,
                  coalesce(m.outgoing, 0)::int AS outgoing
             FROM ${DAY_SERIES}
             LEFT JOIN (SELECT (msg.created_at AT TIME ZONE 'UTC')::date AS day,
                               count(*) FILTER (WHERE msg.sender_type = 'customer') AS incoming,
                               count(*) FILTER (WHERE msg.sender_type <> 'customer') AS outgoing
                          FROM public.messages msg
                          JOIN public.conversations c ON c.id = msg.conversation_id
                         WHERE c.account_id = $1
                           AND msg.created_at >= now() - interval '${DAYS + 1} days'
                         GROUP BY 1) m ON m.day = d::date
            ORDER BY d`,
          [accountId]
        )
      : null,
    accountId
      ? pool.query(
          `SELECT id, phone_number_id, waba_id, status, connected_at, last_registration_error
             FROM public.whatsapp_config WHERE account_id = $1 ORDER BY created_at`,
          [accountId]
        )
      : null,
    accountId
      ? pool.query(
          `SELECT m.user_id, m.full_name, m.email, m.account_role::text AS account_role,
                  (u.disabled_at IS NOT NULL) AS disabled
             FROM public.account_members m
             JOIN auth.users u ON u.id = m.user_id
            WHERE m.account_id = $1
            ORDER BY (m.account_role = 'owner') DESC, m.created_at`,
          [accountId]
        )
      : null,
    pool.query(
      `SELECT id, ip_address, user_agent, created_at, updated_at, expires_at
         FROM auth.sessions
        WHERE user_id = $1 AND expires_at > now()
        ORDER BY updated_at DESC
        LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT
        (SELECT count(*) FROM public.contacts WHERE user_id = $1)::int AS contacts,
        (SELECT count(*) FROM public.conversations WHERE user_id = $1)::int AS conversations,
        (SELECT count(*) FROM public.broadcasts WHERE user_id = $1)::int AS broadcasts,
        (SELECT count(*) FROM public.automations WHERE user_id = $1)::int AS automations,
        (SELECT count(*) FROM public.flows WHERE user_id = $1)::int AS flows`,
      [userId]
    ),
    loadDeletePlan(pool, userId),
    pool.query<AuditEntry>(
      `SELECT id, admin_email, action, target_user_id, target_email, details, created_at
         FROM auth.admin_audit_log
        WHERE target_user_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [userId]
    ),
  ]);

  return {
    user,
    identities: identities.rows,
    workspace: workspace?.rows[0] ?? null,
    stats: stats?.rows[0] ?? null,
    messages: messages?.rows ?? [],
    whatsapp: whatsapp?.rows ?? [],
    team: team?.rows ?? [],
    sessions: sessions.rows,
    createdRows: createdRows.rows[0],
    deletePlan,
    audit: audit.rows,
  };
}

// ----------------------------------------------------------- settings

export interface AdminSettingsData {
  admins: {
    user_id: string;
    email: string;
    name: string;
    created_at: string;
    disabled: boolean;
  }[];
  audit: AuditEntry[];
  database: { version: string };
}

export async function loadAdminSettings(pool: Pool): Promise<AdminSettingsData> {
  const [admins, audit, version] = await Promise.all([
    pool.query(
      `SELECT p.user_id, u.email, u.name, p.created_at,
              (u.disabled_at IS NOT NULL) AS disabled
         FROM auth.platform_admins p
         JOIN auth.users u ON u.id = p.user_id
        ORDER BY p.created_at`
    ),
    pool.query<AuditEntry>(
      `SELECT id, admin_email, action, target_user_id, target_email, details, created_at
         FROM auth.admin_audit_log
        ORDER BY created_at DESC
        LIMIT 30`
    ),
    pool.query<{ server_version: string }>('SHOW server_version'),
  ]);
  return {
    admins: admins.rows,
    audit: audit.rows,
    database: { version: version.rows[0]?.server_version ?? 'unknown' },
  };
}
