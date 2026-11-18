"use client"

import type { ReactNode } from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

/**
 * Segmented control — one choice out of a few, shown side by side
 * (range pickers, Playground | Setup | Usage). A radio group under the
 * hood: Tab moves into the group, arrow keys change the selection.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "default",
  variant = "segmented",
  ...aria
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentOption<T>[]
  className?: string
  size?: "sm" | "default"
  /**
   * "segmented": one track, the selected segment raised (default).
   * "chips": separate soft chips, the selected one solid primary
   * (the Home range picker in docs/design/home.png).
   */
  variant?: "segmented" | "chips"
} & ({ "aria-label": string } | { "aria-labelledby": string })) {
  const chips = variant === "chips"
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "inline-flex w-fit items-center",
        chips ? "gap-1.5" : "gap-0.5 rounded-xl bg-muted p-1",
        className
      )}
      {...aria}
    >
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
            chips
              ? "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft-2 data-checked:bg-primary data-checked:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm",
            size === "sm"
              ? "h-(--control-h-sm) min-h-7"
              : chips
                ? "h-(--control-h-sm)"
                : "h-[calc(var(--control-h)-0.5rem)]"
          )}
        >
          {o.icon}
          {o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
