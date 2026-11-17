import type { ComponentType, ReactNode } from "react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Empty state — what a list, table or chart shows when there is
 * nothing to show yet. Says what is missing and, when there is one,
 * offers the next step (`action`).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Smaller, borderless version for inside cards and panes. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "gap-2 px-4 py-8"
          : "min-h-48 gap-3 rounded-2xl border border-dashed border-border bg-card-2 px-6 py-10",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground",
          compact ? "size-10" : "size-12"
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
