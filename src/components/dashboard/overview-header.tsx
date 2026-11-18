'use client'

import { useTranslations } from 'next-intl'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import {
  OVERVIEW_RANGES,
  minutesBetween,
  needsSetup,
  type DashboardOverview,
  type OverviewRange,
} from '@/lib/dashboard/overview'
import { useFormatDuration } from './use-format-duration'
import { WhatsAppHealthChip } from './whatsapp-health-chip'

function partOfDay(date: Date): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

/**
 * Greeting, what needs attention in one line, the WhatsApp health chip
 * and the range picker (docs/design/home.png). "+ New" lives in the
 * top bar now, so the page no longer has its own.
 */
export function OverviewHeader({
  data,
  now,
  name,
  range,
  onRangeChange,
}: {
  data: DashboardOverview | null
  now: number
  name: string | null
  range: OverviewRange
  onRangeChange: (range: OverviewRange) => void
}) {
  const t = useTranslations('Dashboard.overview.header')
  const formatDuration = useFormatDuration()
  const firstName = name?.trim().split(/\s+/)[0] || null

  let context: string | null = null
  if (data) {
    const a = data.attention
    if (needsSetup(data.setup)) context = t('contextSetup')
    else if (a.waiting > 0 && a.oldestWaitingSince)
      context = t('contextWaiting', {
        count: a.waiting,
        wait: formatDuration(minutesBetween(a.oldestWaitingSince, now)),
      })
    else context = t('contextClear')
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {data ? (
          <>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {firstName
                ? t(`greeting.${partOfDay(new Date(now))}`, { name: firstName })
                : t(`greetingNoName.${partOfDay(new Date(now))}`)}
            </h2>
            <p className="mt-1 text-base text-muted-foreground">{context}</p>
          </>
        ) : (
          <div aria-busy="true">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <WhatsAppHealthChip />
        <SegmentedControl
          variant="chips"
          aria-label={t('rangeLabel')}
          value={String(range)}
          onValueChange={(v) => onRangeChange(Number(v) as OverviewRange)}
          options={OVERVIEW_RANGES.map((r) => ({ value: String(r), label: t(`range.${r}`) }))}
        />
      </div>
    </div>
  )
}
