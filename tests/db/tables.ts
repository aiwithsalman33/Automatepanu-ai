/**
 * Per-table isolation spec for every table in `public`.
 *
 * The tiers below are the *current* enforced behaviour, read from
 * pg_policies on a database built from supabase/migrations 001–059
 * (see tests/db/README.md). They are the baseline the Supabase → own
 * Postgres migration must preserve. If a migration intentionally changes
 * a tier, change it here in the same PR and say why.
 *
 * Tier semantics (minimum account role that may do it, own account only):
 *   member  any member (viewer and up)
 *   agent   agent and up
 *   admin   admin and up
 *   self    only the row's own user (notifications, own profile)
 *   none    no client role may do it (service role / RPCs only)
 */
import { randomUUID } from 'node:crypto';

export type Tier = 'member' | 'agent' | 'admin' | 'self' | 'none';

export interface AccountCtx {
  accountId: string;
  ownerId: string;
  /** Seeded primary-key value per table, for this account. */
  ids: Record<string, string>;
}

export interface TableSpec {
  table: string;
  pk: string;
  read: Tier;
  insert: Tier;
  update: Tier;
  delete: Tier;
  /** Column used for the no-op UPDATE probe (defaults to pk = pk). */
  touch?: string;
  /**
   * Non-unique column for the WHERE-less "blind" UPDATE probe, which
   * assigns a parameter (reading a column in SET would make Postgres
   * apply SELECT policies and mask the leak). Defaults to created_at.
   */
  blindColumn?: string;
  /** Re-parenting probe: column that ties the row to a tenant. */
  tenantColumn?: { column: string; idFrom: (ctx: AccountCtx) => string };
  /** Build a fresh row for `ctx`, written by `actorId`. */
  row: (ctx: AccountCtx, actorId: string) => Record<string, unknown>;
  /** Seed this table? (accounts/profiles come from the signup trigger.) */
  seeded?: false;
}

const r = () => randomUUID().replace(/-/g, '').slice(0, 12);
const acct = (column = 'account_id') => ({
  column,
  idFrom: (ctx: AccountCtx) => ctx.accountId,
});
const parent = (column: string, table: string) => ({
  column,
  idFrom: (ctx: AccountCtx) => ctx.ids[table],
});

/** Dependency order: parents before children. */
export const TABLES: TableSpec[] = [
  {
    table: 'accounts',
    pk: 'id',
    read: 'member',
    insert: 'none',
    update: 'admin',
    delete: 'none',
    // created_at is guarded by enforce_account_identity_columns
    touch: 'name',
    blindColumn: 'name',
    row: (ctx, actor) => ({
      id: randomUUID(),
      name: `x-${r()}`,
      owner_user_id: actor,
    }),
    seeded: false,
  },
  {
    table: 'profiles',
    pk: 'id',
    read: 'member',
    insert: 'none',
    update: 'self',
    delete: 'none',
    touch: 'full_name',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      full_name: 'x',
      email: `${r()}@t.test`,
      account_id: ctx.accountId,
      account_role: 'viewer',
    }),
    seeded: false,
  },
  {
    table: 'account_invitations',
    pk: 'id',
    read: 'admin',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      account_id: ctx.accountId,
      token_hash: r() + r(),
      role: 'agent',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_by_user_id: actor,
    }),
  },
  {
    table: 'member_presence',
    pk: 'user_id',
    read: 'member',
    insert: 'none',
    update: 'none',
    delete: 'none',
    blindColumn: 'last_seen_at',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      status: 'online',
    }),
  },
  {
    table: 'tags',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `tag-${r()}`,
    }),
  },
  {
    table: 'contacts',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: 'c',
      phone: `+1555${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    }),
  },
  {
    table: 'contact_tags',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('contact_id', 'contacts'),
    row: (ctx) => ({ contact_id: ctx.ids.contacts, tag_id: ctx.ids.tags }),
  },
  {
    table: 'custom_fields',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      field_name: `f-${r()}`,
      field_type: 'text',
    }),
  },
  {
    table: 'contact_custom_values',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('contact_id', 'contacts'),
    row: (ctx) => ({
      contact_id: ctx.ids.contacts,
      custom_field_id: ctx.ids.custom_fields,
      value: 'v',
    }),
  },
  {
    table: 'contact_notes',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      contact_id: ctx.ids.contacts,
      user_id: actor,
      account_id: ctx.accountId,
      note_text: 'n',
    }),
  },
  {
    table: 'conversations',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      contact_id: ctx.ids.contacts,
    }),
  },
  {
    table: 'messages',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('conversation_id', 'conversations'),
    row: (ctx) => ({
      conversation_id: ctx.ids.conversations,
      sender_type: 'customer',
      content_type: 'text',
      content_text: 'hello',
      message_id: `wamid.${r()}`,
    }),
  },
  {
    table: 'message_reactions',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('message_id', 'messages'),
    row: (ctx) => ({
      message_id: ctx.ids.messages,
      conversation_id: ctx.ids.conversations,
      actor_type: 'customer',
      actor_id: randomUUID(),
      emoji: '👍',
    }),
  },
  {
    table: 'quick_replies',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      account_id: ctx.accountId,
      user_id: actor,
      title: `qr-${r()}`,
      kind: 'text',
      content_text: 'hi',
    }),
  },
  {
    table: 'pending_message_statuses',
    pk: 'id',
    read: 'none',
    insert: 'none',
    update: 'none',
    delete: 'none',
    tenantColumn: acct(),
    row: (ctx) => ({
      account_id: ctx.accountId,
      wamid: `wamid.${r()}`,
      status: 'delivered',
    }),
  },
  {
    table: 'whatsapp_config',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      phone_number_id: `${Math.floor(Math.random() * 1e15)}`,
      access_token: 'ciphertext',
    }),
  },
  {
    table: 'message_templates',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `tpl_${r()}`,
      language: 'en_US',
      category: 'Utility',
      body_text: 'Hi {{1}}',
      status: 'APPROVED',
    }),
  },
  {
    table: 'pipelines',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `p-${r()}`,
    }),
  },
  {
    table: 'pipeline_stages',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: parent('pipeline_id', 'pipelines'),
    row: (ctx) => ({
      pipeline_id: ctx.ids.pipelines,
      name: `s-${r()}`,
      position: 0,
    }),
  },
  {
    table: 'deals',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      pipeline_id: ctx.ids.pipelines,
      stage_id: ctx.ids.pipeline_stages,
      contact_id: ctx.ids.contacts,
      title: `d-${r()}`,
    }),
  },
  {
    table: 'broadcasts',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `b-${r()}`,
      template_name: 'tpl',
    }),
  },
  {
    table: 'broadcast_recipients',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('broadcast_id', 'broadcasts'),
    row: (ctx) => ({
      broadcast_id: ctx.ids.broadcasts,
      contact_id: ctx.ids.contacts,
    }),
  },
  {
    table: 'automations',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `a-${r()}`,
      trigger_type: 'new_message_received',
    }),
  },
  {
    table: 'automation_steps',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('automation_id', 'automations'),
    row: (ctx) => ({
      automation_id: ctx.ids.automations,
      step_type: 'send_message',
      position: 0,
    }),
  },
  {
    table: 'automation_logs',
    pk: 'id',
    read: 'member',
    insert: 'none',
    update: 'none',
    delete: 'none',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      automation_id: ctx.ids.automations,
      user_id: actor,
      account_id: ctx.accountId,
      trigger_event: 't',
      status: 'success',
    }),
  },
  {
    table: 'automation_pending_executions',
    pk: 'id',
    read: 'none',
    insert: 'none',
    update: 'none',
    delete: 'none',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      automation_id: ctx.ids.automations,
      user_id: actor,
      account_id: ctx.accountId,
      next_step_position: 0,
      run_at: new Date().toISOString(),
    }),
  },
  {
    table: 'flows',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      user_id: actor,
      account_id: ctx.accountId,
      name: `f-${r()}`,
      trigger_type: 'manual',
    }),
  },
  {
    table: 'flow_nodes',
    pk: 'id',
    read: 'member',
    insert: 'agent',
    update: 'agent',
    delete: 'agent',
    tenantColumn: parent('flow_id', 'flows'),
    row: (ctx) => ({
      flow_id: ctx.ids.flows,
      node_key: `n_${r()}`,
      node_type: 'end',
    }),
  },
  {
    table: 'flow_runs',
    pk: 'id',
    read: 'member',
    insert: 'none',
    update: 'none',
    delete: 'none',
    blindColumn: 'started_at',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      flow_id: ctx.ids.flows,
      user_id: actor,
      account_id: ctx.accountId,
      contact_id: ctx.ids.contacts,
      status: 'completed',
    }),
  },
  {
    table: 'flow_run_events',
    pk: 'id',
    read: 'member',
    insert: 'none',
    update: 'none',
    delete: 'none',
    tenantColumn: parent('flow_run_id', 'flow_runs'),
    row: (ctx) => ({ flow_run_id: ctx.ids.flow_runs, event_type: 'started' }),
  },
  {
    table: 'ai_configs',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx) => ({
      account_id: ctx.accountId,
      provider: 'openai',
      model: 'm',
      api_key: 'ciphertext',
    }),
  },
  {
    table: 'ai_knowledge_documents',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx) => ({
      account_id: ctx.accountId,
      title: 'Refunds',
      content: 'isolationmarker refund policy',
    }),
  },
  {
    table: 'ai_knowledge_chunks',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx) => ({
      document_id: ctx.ids.ai_knowledge_documents,
      account_id: ctx.accountId,
      chunk_index: 0,
      content: 'isolationmarker refund policy',
    }),
  },
  {
    table: 'ai_usage_log',
    pk: 'id',
    read: 'admin',
    insert: 'none',
    update: 'none',
    delete: 'none',
    tenantColumn: acct(),
    row: (ctx) => ({
      account_id: ctx.accountId,
      mode: 'draft',
      provider: 'openai',
      model: 'm',
    }),
  },
  {
    table: 'api_keys',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx, actor) => ({
      account_id: ctx.accountId,
      created_by: actor,
      name: 'k',
      key_prefix: 'wacrm_live_x',
      key_hash: r() + r() + r(),
    }),
  },
  {
    table: 'webhook_endpoints',
    pk: 'id',
    read: 'member',
    insert: 'admin',
    update: 'admin',
    delete: 'admin',
    tenantColumn: acct(),
    row: (ctx) => ({
      account_id: ctx.accountId,
      url: 'https://example.com/hook',
      secret: 'ciphertext',
    }),
  },
  {
    table: 'notifications',
    pk: 'id',
    read: 'self',
    insert: 'none',
    update: 'self',
    delete: 'none',
    // authenticated holds UPDATE on read_at only (migration 027)
    touch: 'read_at',
    blindColumn: 'read_at',
    row: (ctx) => ({
      account_id: ctx.accountId,
      user_id: ctx.ownerId,
      title: 'Assigned',
      type: 'conversation_assigned',
    }),
  },
];

export const SPEC_BY_TABLE = new Map(TABLES.map((t) => [t.table, t]));
