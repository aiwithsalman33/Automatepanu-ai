import Link from 'next/link';

import { fmtNumber } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

/** Server-rendered filter chips that keep the other query params. */
export function FilterTabs<T extends string>({
  basePath,
  current,
  options,
  params,
}: {
  basePath: string;
  current: T;
  options: { value: T; label: string; count?: number }[];
  params: Record<string, string | undefined>;
}) {
  const href = (value: T) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'filter' && k !== 'page') next.set(k, v);
    next.set('filter', value);
    return `${basePath}?${next.toString()}`;
  };
  return (
    <nav aria-label="Filter" className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={href(o.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {o.label}
            {o.count != null ? (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-primary/15' : 'bg-muted')}>
                {fmtNumber(o.count)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') next.set(k, v);
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted';
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {fmtNumber(from)}–{fmtNumber(to)} of {fmtNumber(total)}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={btn} href={href(page - 1)}>Previous</Link> : null}
        {page < pages ? <Link className={btn} href={href(page + 1)}>Next</Link> : null}
      </div>
    </div>
  );
}
