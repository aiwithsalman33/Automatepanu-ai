/**
 * Presentational building blocks for the admin panel. No hooks, so they
 * render in server components.
 */
import type { ComponentType, ReactNode } from 'react';
import { ArrowDown, ArrowUp, BadgeCheck, Ban, Clock, Minus, ShieldCheck } from 'lucide-react';

import { weekChange, fmtNumber, initials } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-border bg-card text-card-foreground',
        className
      )}
    >
      {title || action ? (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

type Tone = 'primary' | 'good' | 'warning' | 'critical' | 'neutral';

const ICON_TONE: Record<Tone, string> = {
  primary: 'bg-primary/12 text-primary',
  good: 'bg-status-good/12 text-status-good',
  warning: 'bg-status-warning/15 text-status-warning',
  critical: 'bg-status-critical/12 text-status-critical',
  neutral: 'bg-muted text-muted-foreground',
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  change,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  hint?: ReactNode;
  /** Rolling 7 days vs the 7 before. */
  change?: { current: number; previous: number };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', ICON_TONE[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
        {typeof value === 'number' ? fmtNumber(value) : value}
      </p>
      {change || hint ? (
        <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
          {change ? <ChangeBadge {...change} /> : null}
          {hint ? <span className="truncate">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  const c = weekChange(current, previous);
  const Icon = c.trend === 'up' ? ArrowUp : c.trend === 'down' ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums',
        c.trend === 'up'
          ? 'bg-status-good/12 text-status-good'
          : c.trend === 'down'
            ? 'bg-status-critical/12 text-status-critical'
            : 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="size-3" aria-hidden />
      {c.percent == null ? (c.trend === 'up' ? 'new' : '0') : `${Math.abs(c.percent)}%`}
      <span className="sr-only">
        {c.trend === 'up' ? 'up' : c.trend === 'down' ? 'down' : 'unchanged'} vs previous 7 days
      </span>
    </span>
  );
}

const PILL = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap';

export function StatusPill({
  verified,
  disabled,
}: {
  verified: boolean;
  disabled: boolean;
}) {
  if (disabled)
    return (
      <span className={cn(PILL, 'border-status-critical/30 bg-status-critical/10 text-status-critical')}>
        <Ban className="size-3" /> Disabled
      </span>
    );
  if (verified)
    return (
      <span className={cn(PILL, 'border-status-good/30 bg-status-good/10 text-status-good')}>
        <BadgeCheck className="size-3" /> Verified
      </span>
    );
  return (
    <span className={cn(PILL, 'border-status-warning/30 bg-status-warning/10 text-status-warning')}>
      <Clock className="size-3" /> Pending
    </span>
  );
}

export function AdminPill() {
  return (
    <span className={cn(PILL, 'border-primary/30 bg-primary/10 text-primary')}>
      <ShieldCheck className="size-3" /> Admin
    </span>
  );
}

export function RolePill({ role }: { role: string | null }) {
  if (!role) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(PILL, 'border-border bg-muted/60 text-foreground capitalize')}>{role}</span>
  );
}

export function UserAvatar({
  name,
  email,
  size = 'md',
}: {
  name: string | null;
  email: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 font-semibold text-primary ring-1 ring-primary/20',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-9 text-xs',
        size === 'lg' && 'size-14 text-lg'
      )}
    >
      {initials(name, email)}
    </span>
  );
}

/** Label/value rows for detail cards. */
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
