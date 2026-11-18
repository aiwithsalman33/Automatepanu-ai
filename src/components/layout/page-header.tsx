import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The row under the top bar on list and detail pages: an optional
 * title (sub-pages such as a broadcast's name; list pages rely on the
 * top bar's h1), a one-line description, and the page's actions on the
 * right. Wraps on small screens.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A back link/button shown before the title (detail pages). */
  back?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {back}
        <div className="min-w-0">
          {title ? <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h2> : null}
          {description ? (
            <p className={cn("text-sm text-muted-foreground", title && "mt-0.5")}>{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
