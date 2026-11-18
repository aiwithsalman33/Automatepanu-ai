'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardOverview } from '@/lib/dashboard/overview'
import { minutesBetween } from '@/lib/dashboard/overview'
import { cn } from '@/lib/utils'
import { FailedMessagesDialog } from './failed-messages-dialog'
import { useFormatDuration } from './use-format-duration'

type Tone = 'critical' | 'serious' | 'calm'

/** Meta-line colour: what needs acting on reads orange/red, the rest muted. */
const META_TONE: Record<Tone, string> = {
  critical: 'text-status-critical',
  serious: 'text-status-serious',
  calm: 'text-muted-foreground',
}

const CARD_CLASS =
  'group flex w-full flex-col rounded-2xl border border-border bg-card px-4 py-3.5 text-left sm:px-5 sm:py-4 shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/30'

function CardBody({ label, value, meta, tone }: { label: string; value: number; meta: ReactNode; tone: Tone }) {
  return (
    <>
      <span className="line-clamp-2 text-sm text-muted-foreground">{label}</span>
      <span className="mt-1 text-3xl leading-tight font-bold text-foreground tabular-nums">{value}</span>
      <span className={cn('mt-1 truncate text-sm font-medium', META_TONE[tone])}>{meta}</span>
    </>
  )
}

/**
 * The four "needs attention" cards (docs/design/home.png): waiting for a
 * reply, unassigned, reply windows closing, failed messages. Each opens
 * the matching inbox view; Failed opens the error-code dialog.
 */
export function AttentionRow({
  data,
  now,
  onlineCount,
}: {
  data: DashboardOverview | null
  now: number
  onlineCount: number
}) {
  const t = useTranslations('Dashboard.overview.attention')
  const formatDuration = useFormatDuration()
  const [failedOpen, setFailedOpen] = useState(false)

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-2xl bg-card" />
        ))}
      </div>
    )
  }

  const a = data.attention
  const oldest = a.oldestWaitingSince ? formatDuration(minutesBetween(a.oldestWaitingSince, now)) : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Link href="/inbox?filter=waiting" className={CARD_CLASS}>
        <CardBody
          label={t('waiting')}
          value={a.waiting}
          tone={a.waitingOverTarget > 0 ? 'critical' : a.waiting > 0 ? 'serious' : 'calm'}
          meta={oldest ? t('waitingMeta', { wait: oldest, count: a.waitingOverTarget }) : t('waitingNone')}
        />
      </Link>
      <Link href="/inbox?filter=unassigned" className={CARD_CLASS}>
        <CardBody label={t('unassigned')} value={a.unassigned} tone="calm" meta={t('onlineNow', { count: onlineCount })} />
      </Link>
      <Link href="/inbox?filter=expiring" className={CARD_CLASS}>
        <CardBody
          label={t('closing')}
          value={a.windowsClosing}
          tone={a.windowsClosing > 0 ? 'serious' : 'calm'}
          meta={t('closingMeta')}
        />
      </Link>
      <button type="button" className={CARD_CLASS} onClick={() => setFailedOpen(true)} aria-haspopup="dialog">
        <CardBody
          label={t('failed')}
          value={a.failed}
          tone={a.failed > 0 ? 'critical' : 'calm'}
          meta={t('failedMeta')}
        />
      </button>
      <FailedMessagesDialog
        open={failedOpen}
        onOpenChange={setFailedOpen}
        messages={a.failedMessages}
        total={a.failed}
      />
    </div>
  )
}
