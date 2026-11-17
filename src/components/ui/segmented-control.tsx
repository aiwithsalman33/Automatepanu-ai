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
  ...aria
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentOption<T>[]
  className?: string
  size?: "sm" | "default"
} & ({ "aria-label": string } | { "aria-labelledby": string })) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-xl bg-muted p-1",
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
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm [&_svg]:size-4 [&_svg]:shrink-0",
            size === "sm" ? "h-(--control-h-sm) min-h-7" : "h-[calc(var(--control-h)-0.5rem)]"
          )}
        >
          {o.icon}
          {o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
