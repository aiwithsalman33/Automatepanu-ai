import { cn } from "@/lib/utils"

/**
 * Loading placeholders. Decorative (aria-hidden): the container that
 * holds them should carry aria-busy="true" and a visually hidden
 * "Loading…" so assistive tech knows something is on its way.
 * The pulse stops under prefers-reduced-motion (globals.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-muted", className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  )
}

/** A list row: avatar + two lines (conversation, contact, notification). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-8 w-full" />
    </div>
  )
}
