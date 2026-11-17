import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkline } from "@/components/ui/sparkline"
import { cn } from "@/lib/utils"

export interface StatDelta {
  /** Shown text, e.g. "12%" or "New". */
  label: string
  direction: "up" | "down" | "flat"
  /** Whether the change is good news (green), bad (red) or neither. */
  tone: "good" | "bad" | "neutral"
  /** Read by screen readers after the label, e.g. "better than last week". */
  srLabel?: string
}

const TONE = {
  good: "bg-status-good/12 text-status-good-text",
  bad: "bg-status-critical/10 text-status-critical",
  neutral: "bg-muted text-muted-foreground",
} as const

export function DeltaPill({ delta }: { delta: StatDelta }) {
  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        TONE[delta.tone]
      )}
    >
      <Icon className="size-3" aria-hidden />
      {delta.label}
      {delta.srLabel ? <span className="sr-only">, {delta.srLabel}</span> : null}
    </span>
  )
}

/**
 * Stat tile — one KPI: label, value, change vs the previous period,
 * and an optional sparkline or footer. `info` is an extra control next
 * to the label (e.g. a tooltip trigger explaining the metric).
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  comparison,
  spark,
  info,
  footer,
  loading = false,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  delta?: StatDelta
  /** e.g. "vs previous 7 days" */
  comparison?: ReactNode
  spark?: (number | null)[]
  info?: ReactNode
  footer?: ReactNode
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <Card size="sm" className={cn("gap-3 rounded-2xl px-4", className)} aria-busy="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-4 w-28" />
        {spark ? <Skeleton className="h-9 w-full" /> : null}
      </Card>
    )
  }
  return (
    <Card size="sm" className={cn("gap-2 rounded-2xl px-4", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {info}
      </div>
      <p className="text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </p>
      {delta || comparison ? (
        <div className="flex min-w-0 items-center gap-2">
          {delta ? <DeltaPill delta={delta} /> : null}
          {comparison ? (
            <span className="truncate text-xs text-muted-foreground">{comparison}</span>
          ) : null}
        </div>
      ) : null}
      {spark ? <Sparkline values={spark} /> : null}
      {footer}
    </Card>
  )
}
