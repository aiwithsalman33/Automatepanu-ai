"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "@/components/dashboard/initials"
import { cn } from "@/lib/utils"

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const

const PRESENCE = {
  online: "bg-status-good",
  away: "bg-status-warning",
  offline: "bg-muted-foreground/50",
} as const

/**
 * A person or contact: photo when there is one, otherwise initials on
 * the soft purple tint. `presence` adds a status dot; its meaning must
 * also be in text nearby (the dot is decorative).
 */
export function PersonAvatar({
  name,
  src,
  size = "md",
  presence,
  className,
}: {
  name: string | null | undefined
  src?: string | null
  size?: keyof typeof SIZES
  presence?: keyof typeof PRESENCE
  className?: string
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className={cn("after:hidden", SIZES[size])}>
        {src ? <AvatarImage src={src} alt="" /> : null}
        <AvatarFallback className="bg-primary-soft font-semibold text-primary-soft-foreground">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      {presence ? (
        <span
          aria-hidden
          className={cn(
            "absolute right-0 bottom-0 rounded-full ring-2 ring-background",
            size === "xs" || size === "sm" ? "size-2.5" : "size-3",
            PRESENCE[presence]
          )}
        />
      ) : null}
    </span>
  )
}
