import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ButtonProps = React.ComponentProps<typeof Button>

/**
 * Square icon-only button. `label` is required: it becomes the
 * accessible name (icon buttons have no visible text). `badge` adds a
 * count or dot on the corner; put the same information in `label`
 * ("Notifications, 3 unread") because the badge itself is aria-hidden.
 */
export function IconButton({
  label,
  icon,
  size = "default",
  variant = "ghost",
  badge,
  className,
  ...props
}: Omit<ButtonProps, "size" | "children" | "aria-label"> & {
  label: string
  icon: ReactNode
  size?: "sm" | "default" | "lg"
  badge?: number | boolean
}) {
  const sizeKey = size === "default" ? "icon" : (`icon-${size}` as const)
  const count = typeof badge === "number" ? badge : 0
  return (
    <Button
      aria-label={label}
      size={sizeKey}
      variant={variant}
      className={cn("relative", className)}
      {...props}
    >
      {icon}
      {badge ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-1 right-1 flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground ring-2 ring-background",
            count > 0 ? "h-4 min-w-4 px-1 text-[10px] leading-none" : "size-2"
          )}
        >
          {count > 99 ? "99+" : count > 0 ? count : null}
        </span>
      ) : null}
    </Button>
  )
}
