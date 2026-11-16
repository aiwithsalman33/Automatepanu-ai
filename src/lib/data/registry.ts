/**
 * What the browser may ask of each table through /api/data/<table>.
 *
 * Every request still runs as the signed-in user (wacrm_app, RLS), so
 * this registry is a second fence, not the only one:
 *   - only listed tables and operations
 *   - selects are parsed: plain identifiers, `*`, and embeds of listed
 *     relations only; denied columns can't be read (and `*` is refused
 *     on tables that have any)
 *   - tenant columns (`account_id`, `user_id`) on inserts are stamped
 *     from the session, never taken from the browser
 *   - update/delete need at least one filter; `writable` (when set)
 *     limits which columns an update may touch
 *
 * Keep entries to what the UI actually uses (see the 1d table in
 * docs/saas-migration-plan.md).
 */
export type DataOp = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export interface TableSpec {
  ops: readonly DataOp[];
  /** Relations this table's selects may embed (by table/view name). */
  embeds?: readonly string[];
  /** Columns the browser may never read. */
  deny?: readonly string[];
  /** Columns an update/upsert may set (all non-protected when absent). */
  writable?: readonly string[];
  /** Tenant columns stamped from the session on insert/upsert. */
  stamp?: { account?: boolean; user?: boolean };
  /** Server-side search: turns a term into a PostgREST `or` filter. */
  search?: 'contacts';
}

/** Never settable from the browser on update. */
export const PROTECTED_COLUMNS = new Set([
  'account_id',
  'user_id',
  'created_at',
]);

const stampBoth = { account: true, user: true } as const;

export const DATA_TABLES: Record<string, TableSpec> = {
  accounts: {
    ops: ['select', 'update'],
    writable: ['default_currency', 'reply_target_minutes'],
  },
  automations: { ops: ['select'] },
  automation_logs: { ops: ['select'], embeds: ['contacts'] },
  broadcasts: {
    ops: ['select', 'insert', 'update', 'delete'],
    stamp: stampBoth,
  },
  broadcast_recipients: {
    ops: ['select', 'insert', 'update'],
    embeds: ['contacts'],
  },
  contacts: {
    ops: ['select', 'insert', 'update', 'delete'],
    embeds: ['contact_tags', 'tags'],
    stamp: stampBoth,
    search: 'contacts',
  },
  contact_tags: {
    ops: ['select', 'insert', 'upsert', 'delete'],
    embeds: ['tags'],
  },
  contact_custom_values: { ops: ['select', 'upsert', 'delete'] },
  contact_notes: { ops: ['select', 'insert', 'delete'], stamp: stampBoth },
  conversations: {
    ops: ['select', 'update'],
    embeds: ['contacts', 'contact_tags', 'tags'],
    writable: ['unread_count', 'status', 'assigned_agent_id'],
  },
  custom_fields: {
    ops: ['select', 'insert', 'update', 'delete'],
    stamp: stampBoth,
  },
  deals: {
    ops: ['select', 'insert', 'update', 'delete'],
    embeds: ['pipeline_stages', 'contacts', 'profiles'],
    stamp: stampBoth,
  },
  member_presence: { ops: ['select'] },
  message_reactions: { ops: ['select'] },
  message_templates: { ops: ['select'] },
  messages: { ops: ['select'] },
  notifications: { ops: ['select', 'update'], writable: ['read_at'] },
  pipelines: {
    ops: ['select', 'insert', 'update', 'delete'],
    stamp: stampBoth,
  },
  pipeline_stages: { ops: ['select', 'insert', 'upsert', 'delete'] },
  profiles: {
    ops: ['select', 'update'],
    writable: ['full_name', 'avatar_url'],
  },
  tags: { ops: ['select', 'insert', 'update', 'delete'], stamp: stampBoth },
  whatsapp_config: {
    ops: ['select', 'update'],
    // Encrypted Meta token: only the server ever needs it.
    deny: ['access_token'],
    writable: ['mirror_inbound_media'],
  },
};

/** RPCs the browser may call, with the argument names each accepts. */
export const DATA_RPCS: Record<string, readonly string[]> = {
  filter_contacts_by_tags: ['p_tag_ids', 'p_search', 'p_limit', 'p_offset'],
  touch_presence: ['p_status'],
  dashboard_overview: ['p_days', 'p_tz'],
  acquire_broadcast_delivery_lease: ['p_broadcast_id'],
  renew_broadcast_delivery_lease: ['p_broadcast_id', 'p_held'],
  broadcast_delivery_in_flight: ['p_broadcast_id'],
};
