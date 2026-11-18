"use client";

import type { Deal, PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

/** "Fri" within the coming week, otherwise "Nov 20" (or "Nov 20, 2027"). */
function closeDateLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = (date.getTime() - now.getTime()) / 86_400_000;
  if (days >= -1 && days < 6) return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

/**
 * A deal on the board (docs/design/deals.png): title, contact, then
 * value · expected close day. Closed deals end with "· Closed" (won,
 * green) or "· Lost" (red). Assignee initials on the right.
 */
export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const locale = useLocale();
  const contactLabel = deal.contact?.name || deal.contact?.phone || t("noContact");
  const assigneeLabel = deal.assignee?.full_name || null;
  const won = deal.status === "won";
  const lost = deal.status === "lost";

  return (
    <button
      type="button"
      onClick={(e) => {
        // A plain tap still clicks: the PointerSensor needs 5px of
        // movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={cn(
        // relative: keeps the sr-only stage label inside the card, so it
        // can't escape the board's scroll box and widen the page.
        "group relative w-full cursor-pointer rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-shadow",
        isOverlay ? "rotate-1 shadow-pop" : "shadow-xs hover:shadow-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold break-words text-foreground">
          {deal.title}
        </h4>
        {assigneeLabel ? (
          <span
            title={assigneeLabel}
            aria-label={assigneeLabel}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-soft-foreground"
          >
            {assigneeLabel.charAt(0).toUpperCase()}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">{contactLabel}</p>
      <p
        className={cn(
          "mt-2 text-sm font-medium tabular-nums",
          won ? "text-status-good-text" : lost ? "text-status-critical" : "text-foreground",
        )}
      >
        {formatCurrency(deal.value, deal.currency)}
        {won ? ` · ${t("closedWon")}` : lost ? ` · ${t("lost")}` : null}
        {!won && !lost && deal.expected_close_date ? (
          <span className="text-muted-foreground"> · {closeDateLabel(deal.expected_close_date, locale)}</span>
        ) : null}
      </p>
      {/* Stage name for screen readers (the column says it visually). */}
      {stage ? <span className="sr-only">{stage.name}</span> : null}
    </button>
  );
}
