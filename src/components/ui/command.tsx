"use client"

import { useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { Loader2, Search } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface CommandItem {
  id: string
  label: string
  /** Secondary text on the right (phone number, stage, shortcut…). */
  hint?: string
  icon?: ReactNode
  onSelect: () => void
}

export interface CommandGroup {
  id: string
  label: string
  items: CommandItem[]
}

/**
 * Command list — a search box over grouped results, the WAI-ARIA
 * combobox + listbox pattern: focus stays in the input, ↑/↓ move the
 * active option (announced through aria-activedescendant), Enter runs
 * it, the mouse can hover and click. Filtering is the caller's job
 * (it may be async), so `groups` is whatever matches `query` now.
 */
export function Command({
  query,
  onQueryChange,
  groups,
  loading = false,
  placeholder,
  inputLabel,
  emptyText,
  footer,
  className,
}: {
  query: string
  onQueryChange: (q: string) => void
  groups: CommandGroup[]
  loading?: boolean
  placeholder: string
  /** Accessible name of the search input. */
  inputLabel: string
  emptyText: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const base = useId()
  const listId = `${base}-list`
  const visible = useMemo(() => groups.filter((g) => g.items.length > 0), [groups])
  const flat = useMemo(() => visible.flatMap((g) => g.items), [visible])
  const [active, setActive] = useState(0)

  // New results → back to the first option.
  const [prevFlat, setPrevFlat] = useState(flat)
  if (prevFlat !== flat) {
    setPrevFlat(flat)
    setActive(0)
  }

  const optionId = (i: number) => `${base}-opt-${i}`
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((activeIndex + 1) % flat.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((activeIndex - 1 + flat.length) % flat.length)
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      flat[activeIndex].onSelect()
    }
  }

  let index = -1
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 focus-within:shadow-[inset_0_-2px_0_var(--ring)]">
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label={inputLabel}
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          // Focus is shown by the row's 2px primary underline
          // (focus-within above); an outline would sit on the dialog edge.
          style={{ outline: "none" }}
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={inputLabel}
        aria-busy={loading || undefined}
        className="max-h-[min(60vh,26rem)] min-h-0 overflow-y-auto p-2"
      >
        {flat.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground" role="presentation">
            {emptyText}
          </div>
        ) : (
          visible.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${base}-g-${g.id}`} className="py-1">
              <div
                id={`${base}-g-${g.id}`}
                className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {g.label}
              </div>
              {g.items.map((item) => {
                index += 1
                const i = index
                const selected = i === activeIndex
                return (
                  <div
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => active !== i && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => item.onSelect()}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground",
                      selected && "bg-primary-soft text-primary-soft-foreground"
                    )}
                  >
                    {item.icon ? (
                      <span className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-4" aria-hidden>
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? (
                      <span
                        className={cn(
                          "shrink-0 truncate text-xs",
                          selected ? "text-primary-soft-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {item.hint}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
      {footer ? (
        <div className="flex items-center gap-4 border-t border-border bg-card-2 px-4 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

/** The command list in a top-anchored modal (the Ctrl/⌘K palette). */
export function CommandDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dialog name for assistive tech (visually hidden). */
  title: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10vh] flex max-h-[80vh] -translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-pop sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
