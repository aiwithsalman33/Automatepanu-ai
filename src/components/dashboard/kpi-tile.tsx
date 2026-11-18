'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { StatTile, type StatDelta } from '@/components/ui/stat-tile'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Change } from '@/lib/dashboard/overview'
import { cn } from '@/lib/utils'

/** The overview's Change (percent, trend, tone) as a kit StatDelta. */
function useDelta(change: Change): StatDelta {
  const t = useTranslations('Dashboard.overview.kpi')
  const label =
    change.percent == null
      ? change.trend === 'flat'
        ? t('noComparison')
        : t('new')
      : `${Math.abs(change.percent)}%`
  return {
    label,
    direction: change.trend,
    tone: change.tone,
    srLabel: change.tone === 'good' ? t('better') : change.tone === 'bad' ? t('worse') : t('unchanged'),
  }
}

/**
 * One Home KPI on the kit StatTile: label with an info tooltip, value,
 * change vs the previous period, and a footer (sparkline, target bar
 * or a note).
 */
export function KpiTile({
  title,
  info,
  value,
  unit,
  change,
  comparisonLabel,
  footer,
}: {
  title: string
  info: string
  value: ReactNode
  unit?: ReactNode
  change: Change
  comparisonLabel: string
  footer: ReactNode
}) {
  const delta = useDelta(change)
  return (
    <StatTile
      label={title}
      info={
        <Tooltip>
          <TooltipTrigger
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            aria-label={info}
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{info}</TooltipContent>
        </Tooltip>
      }
      value={value}
      unit={unit}
      delta={delta}
      comparison={comparisonLabel}
      footer={footer}
    />
  )
}

export function KpiTileSkeleton() {
  return <StatTile label="" value="" loading spark={[]} />
}

/** Median first reply against the account's target (left half = on target). */
export function TargetBar({ value, target }: { value: number | null; target: number }) {
  const t = useTranslations('Dashboard.overview.kpi')
  const max = target * 2
  const fill = value == null ? 0 : Math.min(100, (value / max) * 100)
  const onTarget = value != null && value <= target
  return (
    <div className="pt-1.5" role="img" aria-label={t('target', { minutes: target })}>
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', onTarget ? 'bg-status-good' : 'bg-status-serious')}
          style={{ width: `${fill}%` }}
        />
        <div className="absolute -inset-y-1 left-1/2 w-0.5 rounded-full bg-foreground/70" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>0</span>
        <span>{t('target', { minutes: target })}</span>
        <span>{t('targetMax', { minutes: max })}</span>
      </div>
    </div>
  )
}
