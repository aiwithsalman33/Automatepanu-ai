"use client"

import type { ReactNode } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Error state — a list or chart failed to load. Says so plainly and
 * offers a retry when the caller can refetch. role="alert" so a screen
 * reader hears it when it replaces the loading skeleton.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  compact = false,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  compact?: boolean
  className?: string
}) {
  const t = useTranslations("UiPrimitives")
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "gap-2 px-4 py-8"
          : "min-h-48 gap-3 rounded-2xl border border-status-critical/25 bg-status-critical/5 px-6 py-10",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-status-critical/10 text-status-critical">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">{title ?? t("errorTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {description ?? t("errorDescription")}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw aria-hidden /> {t("retry")}
        </Button>
      ) : null}
    </div>
  )
}
