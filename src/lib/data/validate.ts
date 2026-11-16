/**
 * Validation for /api/data requests. Pure (no I/O) so it is unit-tested
 * exhaustively. Anything not explicitly allowed is refused.
 */
import { FILTER_OPS, type DataRequest } from './protocol';
import { DATA_TABLES, PROTECTED_COLUMNS, type TableSpec } from './registry';

export class DataRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'DataRequestError';
  }
}

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_ROWS = 5000;
const MAX_IN = 1000;
const MAX_SELECT_LEN = 400;

export function tableSpec(table: string): TableSpec {
  const spec = Object.hasOwn(DATA_TABLES, table) ? DATA_TABLES[table] : null;
  if (!spec) throw new DataRequestError(`Unknown table "${table}"`, 404);
  return spec;
}

function ident(name: unknown, what: string): string {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new DataRequestError(`Invalid ${what}`);
  }
  return name;
}

/**
 * Validate a PostgREST select string:
 *   item   := '*' | column | column '::' type? | embed
 *   embed  := [alias ':'] relation ['!' hint] '(' items ')'
 * Only identifiers, no functions, casts, spreads or JSON paths. Embedded
 * relations must be listed in the root table's `embeds`, and no denied
 * column (of the root or an embedded table) may appear, including via
 * `*` on a table that has denied columns.
 */
export function validateSelect(table: string, select: string): string {
  if (select.length > MAX_SELECT_LEN) {
    throw new DataRequestError('Select too long');
  }
  const root = tableSpec(table);
  const allowedEmbeds = new Set(root.embeds ?? []);
  let i = 0;
  const s = select.replace(/\s+/g, '');

  const readIdent = () => {
    const m = /^[a-z_][a-z0-9_]*/.exec(s.slice(i));
    if (!m)
      throw new DataRequestError(`Invalid select near "${s.slice(i, i + 12)}"`);
    i += m[0].length;
    return m[0];
  };

  const checkColumn = (t: string, col: string) => {
    const deny = DATA_TABLES[t]?.deny ?? [];
    if (col === '*' && deny.length) {
      throw new DataRequestError(`Select explicit columns from ${t}`);
    }
    if (deny.includes(col)) {
      throw new DataRequestError(`Column ${t}.${col} is not readable`);
    }
  };

  const parseList = (t: string, depth: number) => {
    if (depth > 3) throw new DataRequestError('Select nested too deeply');
    for (;;) {
      if (s[i] === '*') {
        i++;
        checkColumn(t, '*');
      } else {
        let name = readIdent();
        let relation = name;
        if (s[i] === ':') {
          i++;
          relation = readIdent();
          name = relation;
        }
        if (s[i] === '!') {
          i++;
          readIdent(); // FK hint
        }
        if (s[i] === '(') {
          if (!allowedEmbeds.has(relation)) {
            throw new DataRequestError(`Embedding ${relation} is not allowed`);
          }
          i++;
          parseList(relation, depth + 1);
          if (s[i] !== ')') throw new DataRequestError('Unbalanced select');
          i++;
        } else {
          checkColumn(t, name);
        }
      }
      if (s[i] === ',') {
        i++;
        continue;
      }
      return;
    }
  };

  parseList(table, 0);
  if (i !== s.length) throw new DataRequestError('Invalid select');
  return s;
}

function scalar(v: unknown): boolean {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

function validateRows(
  spec: TableSpec,
  values: unknown,
  forUpdate: boolean
): Record<string, unknown>[] {
  const rows = Array.isArray(values) ? values : [values];
  if (rows.length === 0 || rows.length > MAX_ROWS) {
    throw new DataRequestError('Invalid number of rows');
  }
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new DataRequestError('Rows must be objects');
    }
    for (const key of Object.keys(row)) {
      ident(key, 'column');
      if (spec.deny?.includes(key)) {
        throw new DataRequestError(`Column ${key} is not writable`);
      }
      if (forUpdate) {
        if (PROTECTED_COLUMNS.has(key)) {
          throw new DataRequestError(`Column ${key} can't be changed`);
        }
        if (spec.writable && !spec.writable.includes(key)) {
          throw new DataRequestError(`Column ${key} is not writable`);
        }
      }
    }
  }
  return rows as Record<string, unknown>[];
}

/** Validate and normalise a request; throws DataRequestError. */
export function validateRequest(table: string, raw: unknown): DataRequest {
  const spec = tableSpec(table);
  if (!raw || typeof raw !== 'object')
    throw new DataRequestError('Bad request');
  const r = raw as Record<string, unknown>;
  const op = r.op as DataRequest['op'];
  if (!spec.ops.includes(op)) {
    throw new DataRequestError(`${op} is not allowed on ${table}`, 403);
  }

  const out: DataRequest = { op };
  if (r.select !== undefined) {
    if (typeof r.select !== 'string') throw new DataRequestError('Bad select');
    out.select = validateSelect(table, r.select);
  } else if (op === 'select') {
    out.select = validateSelect(table, '*');
  }
  if (r.count !== undefined) {
    if (r.count !== 'exact') throw new DataRequestError('Bad count');
    out.count = 'exact';
  }
  if (r.head !== undefined) out.head = r.head === true;

  if (r.filters !== undefined) {
    if (!Array.isArray(r.filters) || r.filters.length > 20) {
      throw new DataRequestError('Bad filters');
    }
    out.filters = r.filters.map((f) => {
      if (!Array.isArray(f) || f.length !== 3)
        throw new DataRequestError('Bad filter');
      const [fop, col, val] = f;
      if (!FILTER_OPS.includes(fop))
        throw new DataRequestError('Bad filter op');
      ident(col, 'filter column');
      if (spec.deny?.includes(col))
        throw new DataRequestError('Bad filter column');
      if (fop === 'in') {
        if (!Array.isArray(val) || val.length > MAX_IN || !val.every(scalar)) {
          throw new DataRequestError('Bad in() list');
        }
      } else if (fop === 'ilikeAnyOf') {
        if (
          !Array.isArray(val) ||
          val.length === 0 ||
          val.length > MAX_IN ||
          !val.every((v) => typeof v === 'string')
        ) {
          throw new DataRequestError('Bad ilikeAnyOf() list');
        }
      } else if (fop === 'ilike') {
        if (typeof val !== 'string') throw new DataRequestError('Bad ilike()');
      } else if (fop === 'is') {
        if (val !== null && typeof val !== 'boolean') {
          throw new DataRequestError('is() takes null/true/false');
        }
      } else if (!scalar(val)) {
        throw new DataRequestError('Bad filter value');
      }
      return [fop, col, val] as [typeof fop, string, typeof val];
    });
  }

  if (r.search !== undefined) {
    const sr = r.search as { term?: unknown; includeEmail?: unknown };
    if (!spec.search || typeof sr?.term !== 'string' || sr.term.length > 200) {
      throw new DataRequestError('Bad search');
    }
    out.search = { term: sr.term, includeEmail: sr.includeEmail === true };
  }

  if (r.order !== undefined) {
    if (!Array.isArray(r.order) || r.order.length > 4) {
      throw new DataRequestError('Bad order');
    }
    out.order = r.order.map((o) => {
      if (!Array.isArray(o)) throw new DataRequestError('Bad order');
      const opts = (o[1] ?? {}) as {
        ascending?: unknown;
        nullsFirst?: unknown;
      };
      return [
        ident(o[0], 'order column'),
        {
          ascending: opts.ascending !== false,
          ...(typeof opts.nullsFirst === 'boolean'
            ? { nullsFirst: opts.nullsFirst }
            : {}),
        },
      ];
    });
  }

  const nonNegInt = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (r.range !== undefined) {
    const rg = r.range as unknown[];
    if (
      !Array.isArray(rg) ||
      !nonNegInt(rg[0]) ||
      !nonNegInt(rg[1]) ||
      (rg[1] as number) < (rg[0] as number) ||
      (rg[1] as number) - (rg[0] as number) >= MAX_ROWS
    ) {
      throw new DataRequestError('Bad range');
    }
    out.range = [rg[0] as number, rg[1] as number];
  }
  if (r.limit !== undefined) {
    if (!nonNegInt(r.limit) || (r.limit as number) > MAX_ROWS) {
      throw new DataRequestError('Bad limit');
    }
    out.limit = r.limit as number;
  }
  if (r.single !== undefined) {
    if (r.single !== 'single' && r.single !== 'maybe') {
      throw new DataRequestError('Bad single');
    }
    out.single = r.single;
  }

  if (op === 'insert' || op === 'upsert' || op === 'update') {
    out.values =
      op === 'update'
        ? validateRows(spec, r.values, true)[0]
        : validateRows(spec, r.values, op === 'upsert');
    if (op === 'update' && Array.isArray(r.values)) {
      throw new DataRequestError('update takes one object');
    }
  }
  if (op === 'upsert' && r.onConflict !== undefined) {
    if (typeof r.onConflict !== 'string')
      throw new DataRequestError('Bad onConflict');
    r.onConflict.split(',').forEach((c) => ident(c, 'conflict column'));
    out.onConflict = r.onConflict;
  }
  if (op === 'upsert' && r.ignoreDuplicates === true)
    out.ignoreDuplicates = true;
  if ((op === 'update' || op === 'delete') && !out.filters?.length) {
    throw new DataRequestError(`${op} needs a filter`);
  }
  return out;
}
