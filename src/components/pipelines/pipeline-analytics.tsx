"use client";

import { useMemo } from "react";
import type { Deal, PipelineStage } from "@/types";
import { Info } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[],
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const t = useTranslations("Pipelines.analytics");
  const { defaultCurrency } = useAuth();
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== "lost");
    const openDeals = active.filter((d) => d.status !== "won");

    const totalCount = active.length;
    const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const wonThisMonth = deals.filter(
      (d) => d.status === "won" && thisMonth(d),
    ).length;
    const lostThisMonth = deals.filter(
      (d) => d.status === "lost" && thisMonth(d),
    ).length;

    return {
      totalCount,
      totalValue,
      avgValue,
      weightedValue,
      wonThisMonth,
      lostThisMonth,
    };
  }, [deals, sortedStages]);

  const info = (label: string, tooltip: string) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={t("howCalculated", { label })}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );

  // Five tiles as in docs/design/deals.png. Same numbers as before; won
  // and lost this month share one tile.
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label={t("totalDeals")}
          info={info(t("totalDeals"), t("totalDealsTooltip"))}
          value={String(stats.totalCount)}
        />
        <StatTile
          label={t("pipelineValue")}
          info={info(t("pipelineValue"), t("pipelineValueTooltip"))}
          value={formatCurrency(stats.totalValue, defaultCurrency)}
        />
        <StatTile
          label={t("avgDealSize")}
          info={info(t("avgDealSize"), t("avgDealSizeTooltip"))}
          value={formatCurrency(stats.avgValue, defaultCurrency)}
        />
        <StatTile
          label={t("weightedValue")}
          info={info(t("weightedValue"), t("weightedValueTooltip"))}
          value={formatCurrency(stats.weightedValue, defaultCurrency)}
        />
        <StatTile
          label={t("wonLost")}
          info={info(t("wonLost"), `${t("wonThisMonthTooltip")} ${t("lostThisMonthTooltip")}`)}
          value={
            <>
              <span className="text-status-good-text">{stats.wonThisMonth}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-status-critical">{stats.lostThisMonth}</span>
            </>
          }
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </TooltipProvider>
  );
}
