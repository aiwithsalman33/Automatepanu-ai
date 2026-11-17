"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const base =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:h-10 [&_svg]:size-3.5 [&_svg]:shrink-0"

/**
 * Chip — a compact pill.
 *   - toggle: pass `selected` + `onSelectedChange` (a button with
 *     aria-pressed; selected = soft purple pill), e.g. number chips and
 *     quick filters;
 *   - removable: pass `onRemove` (an applied filter or tag);
 *   - static: neither (a read-only label).
 */
export function Chip({
  children,
  icon,
  count,
  selected,
  onSelectedChange,
  onRemove,
  removeLabel,
  disabled,
  className,
}: {
  children: ReactNode
  icon?: ReactNode
  count?: number
  selected?: boolean
  onSelectedChange?: (next: boolean) => void
  onRemove?: () => void
  /** Accessible name of the remove button; defaults to "Remove <children>". */
  removeLabel?: string
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations("UiPrimitives")
  const tone = selected
    ? "border-transparent bg-primary-soft text-primary-soft-foreground"
    : "border-border bg-card text-foreground hover:bg-muted"
  const body = (
    <>
      {icon}
      <span className="truncate">{children}</span>
      {count != null ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-xs tabular-nums",
            selected ? "bg-background/70" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </>
  )

  if (onSelectedChange) {
    return (
      <button
        type="button"
        aria-pressed={!!selected}
        disabled={disabled}
        onClick={() => onSelectedChange(!selected)}
        className={cn(base, "px-3 disabled:opacity-50", tone, className)}
      >
        {body}
      </button>
    )
  }

  return (
    <span className={cn(base, "px-3", onRemove && "pr-1", tone, className)}>
      {body}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel ?? t("removeItem", { item: typeof children === "string" ? children : "" })}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground pointer-coarse:size-8"
        >
          <X aria-hidden />
        </button>
      ) : null}
    </span>
  )
}
