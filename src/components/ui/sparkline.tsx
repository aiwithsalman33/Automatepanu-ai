import { useId } from "react"

import { cn } from "@/lib/utils"

/**
 * Sparkline — a tiny trend line for a stat tile. Plain SVG (nothing
 * to measure, so it renders identically on the server and the client).
 * Decorative: the tile states the number and the change in text.
 * Null values are gaps in the data and are skipped.
 */
export function Sparkline({
  values,
  className,
}: {
  values: (number | null)[]
  className?: string
}) {
  const gradientId = useId()
  const points = values
    .map((v, i) => (v == null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null)
  const hasData = points.length > 1 && points.some((p) => p.v > 0)

  if (!hasData) {
    return (
      <div aria-hidden className={cn("flex h-9 w-full items-end", className)}>
        <div className="h-px w-full bg-border" />
      </div>
    )
  }

  const W = 100
  const H = 32
  const pad = 2
  const min = Math.min(...points.map((p) => p.v))
  const max = Math.max(...points.map((p) => p.v))
  const span = max - min || 1
  const last = Math.max(values.length - 1, 1)
  const xy = points.map((p) => [
    (p.i / last) * W,
    H - pad - ((p.v - min) / span) * (H - pad * 2),
  ])
  const line = xy
    .map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ")
  const first = xy[0][0].toFixed(2)
  const end = xy[xy.length - 1][0].toFixed(2)
  const area = `${line} L${end},${H} L${first},${H} Z`

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
