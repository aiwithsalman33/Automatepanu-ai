/**
 * Wire format between the browser data client (./client.ts) and
 * /api/data/<table>. Shared by both sides; the server validates every
 * field (./validate.ts) before anything reaches the database.
 */
import type { DataOp } from './registry';

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'is'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'ilike'
  | 'ilikeAnyOf';
export const FILTER_OPS: readonly FilterOp[] = [
  'eq',
  'neq',
  'in',
  'is',
  'gt',
  'gte',
  'lt',
  'lte',
  'ilike',
  'ilikeAnyOf',
];

export type FilterValue = string | number | boolean | null;

export interface DataRequest {
  op: DataOp;
  /** Select string (PostgREST syntax, validated); also the RETURNING list. */
  select?: string;
  count?: 'exact';
  head?: boolean;
  filters?: [FilterOp, string, FilterValue | FilterValue[]][];
  /** Server-side search (tables with `search` in the registry). */
  search?: { term: string; includeEmail?: boolean };
  order?: [string, { ascending?: boolean; nullsFirst?: boolean }][];
  range?: [number, number];
  limit?: number;
  single?: 'single' | 'maybe';
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

/** Same shape as a PostgrestError, so callers' error handling is unchanged. */
export interface DataError {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
}

export interface DataResponse<T = unknown> {
  data: T | null;
  error: DataError | null;
  count: number | null;
  status: number;
}
