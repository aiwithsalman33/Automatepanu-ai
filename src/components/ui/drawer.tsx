"use client"

import type { ReactNode } from "react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Drawer — a side panel for detail and edit views (deal drawer,
 * contact drawer, filters on mobile). Built on the Sheet (Base UI
 * dialog): focus is trapped while open, Esc closes, focus returns to
 * the trigger. Full width on phones, `width` from sm up.
 *
 * Layout: header (title, optional description and actions), a
 * scrolling body, and an optional footer for the primary actions.
 */
export const Drawer = Sheet
export const DrawerTrigger = SheetTrigger
export const DrawerClose = SheetClose

const WIDTHS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
} as const

export function DrawerContent({
  title,
  description,
  actions,
  footer,
  children,
  side = "right",
  width = "md",
  className,
}: {
  title: ReactNode
  description?: ReactNode
  /** Extra header controls, left of the close button. */
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  side?: "right" | "left" | "bottom"
  width?: keyof typeof WIDTHS
  className?: string
}) {
  return (
    <SheetContent
      side={side}
      className={cn(
        "gap-0 p-0",
        side === "bottom"
          ? "max-h-[85dvh] rounded-t-2xl"
          : cn("data-[side=left]:w-full data-[side=right]:w-full", WIDTHS[width]),
        className
      )}
    >
      <div className="flex min-h-16 items-start gap-3 border-b border-border px-5 py-4 pr-14">
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-base font-semibold">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="mt-0.5">{description}</SheetDescription>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card-2 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </SheetContent>
  )
}
