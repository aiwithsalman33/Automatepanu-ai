'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { setupSteps, type OverviewSetup } from '@/lib/dashboard/overview'
import { cn } from '@/lib/utils'

function ProgressBar({ done, total, label, className }: { done: number; total: number; label: string; className?: string }) {
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-primary-soft-2', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
    </div>
  )
}

/**
 * Slim "Finish setup · 2 of 4" bar above the dashboard
 * (docs/design/home.png): progress, the steps still open, and Continue
 * to the next one. Renders nothing once every step is done.
 */
export function SetupBar({ setup }: { setup: OverviewSetup }) {
  const t = useTranslations('Dashboard.overview.setup')
  const steps = setupSteps(setup)
  const done = steps.filter((s) => s.done).length
  const open = steps.filter((s) => !s.done)
  if (open.length === 0) return null
  const title = t('barTitle', { done, total: steps.length })

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary-soft/60 px-5 py-4 lg:flex-row lg:items-center lg:gap-6"
    >
      <p className="shrink-0 text-sm font-semibold text-foreground">{title}</p>
      <ProgressBar done={done} total={steps.length} label={title} className="min-w-32 flex-1" />
      <p className="text-sm text-muted-foreground lg:max-w-md lg:truncate">
        {open.map((s) => t(`steps.${s.id}.title`)).join(' · ')}
      </p>
      <Link
        href={open[0].href}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 self-start bg-card text-primary-soft-foreground lg:self-auto')}
      >
        {t('continue')}
      </Link>
    </section>
  )
}

/** First-run view (no conversations yet): the full checklist and what Home will show. */
export function SetupChecklist({ setup }: { setup: OverviewSetup }) {
  const t = useTranslations('Dashboard.overview.setup')
  const steps = setupSteps(setup)
  const done = steps.filter((s) => s.done).length
  const nextId = steps.find((s) => !s.done)?.id

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-semibold">{t('title')}</CardTitle>
          <CardDescription>{t('progress', { done, total: steps.length })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ProgressBar done={done} total={steps.length} label={t('progress', { done, total: steps.length })} className="mb-3" />
          <ol className="divide-y divide-border">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border',
                    s.done ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )}
                >
                  {s.done ? <Check className="size-3.5" aria-hidden /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', s.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {t(`steps.${s.id}.title`)}
                    <span className="sr-only"> {s.done ? t('doneLabel') : t('todoLabel')}</span>
                  </p>
                  {!s.done ? <p className="text-xs text-muted-foreground">{t(`steps.${s.id}.description`)}</p> : null}
                </div>
                {!s.done ? (
                  <Link
                    href={s.href}
                    className={buttonVariants({ variant: s.id === nextId ? 'default' : 'outline', size: 'sm' })}
                  >
                    {t(`steps.${s.id}.action`)}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="justify-center rounded-2xl bg-card-2">
        <CardContent className="py-8 text-center">
          <p className="text-sm font-semibold text-foreground">{t('previewTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t('previewHint')}</p>
          <Link href="/inbox" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}>
            {t('previewAction')}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
