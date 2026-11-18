"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Deal, PipelineStage } from "@/types";
import { DealCard } from "./deal-card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  CLOSED_COLUMN_ID,
  RECENT_CLOSED_DAYS,
  closedDeals,
  isClosed,
  resolveDrop,
  type ClosedSide,
  type DropAction,
} from "@/lib/pipelines/board-drop";

interface PipelineBoardProps {
  stages: PipelineStage[];
  deals: Deal[];
  /** A drop resolved to an action (move / mark won or lost / reopen). */
  onDrop: (action: DropAction) => void;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
}

const COLUMN =
  "flex w-[85vw] min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl p-3 lg:w-auto lg:min-w-[220px] lg:max-w-none lg:flex-1 lg:basis-[240px] lg:shrink lg:snap-none";

/**
 * Kanban (docs/design/deals.png): one column per stage with the open
 * deals, then a Won | Lost column driven by status (not a stage) with
 * the deals closed in the last 30 days. Drag a card onto a stage to
 * move it, onto the end column to mark it won or lost, or a closed card
 * onto a stage to reopen it there. Pointer and keyboard (Space to pick
 * up, arrows to move, Space to drop, Escape to cancel).
 */
export function PipelineBoard({ stages, deals, onDrop, onAddDeal, onEditDeal }: PipelineBoardProps) {
  const { defaultCurrency } = useAuth();
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [closedSide, setClosedSide] = useState<ClosedSide>("won");
  const [showAllClosed, setShowAllClosed] = useState(false);
  const [now] = useState(() => Date.now());

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const stageIds = useMemo(() => sortedStages.map((s) => s.id), [sortedStages]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of sortedStages) map.set(stage.id, []);
    for (const deal of deals) {
      if (isClosed(deal)) continue;
      map.get(deal.stage_id)?.push(deal);
    }
    return map;
  }, [sortedStages, deals]);

  const closed = useMemo(
    () => closedDeals(deals, closedSide, now, showAllClosed),
    [deals, closedSide, now, showAllClosed],
  );
  const recentCounts = useMemo(
    () => ({ won: closedDeals(deals, "won", now).length, lost: closedDeals(deals, "lost", now).length }),
    [deals, now],
  );
  const allClosedCount = useMemo(() => deals.filter((d) => d.status === closedSide).length, [deals, closedSide]);

  const sensors = useSensors(
    // 5px activation distance avoids clicks being read as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeDeal = activeDealId ? (deals.find((d) => d.id === activeDealId) ?? null) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null);
    const action = resolveDrop({
      deal: deals.find((d) => d.id === String(event.active.id)),
      overId: event.over ? String(event.over.id) : null,
      stageIds,
      closedSide,
    });
    if (action) onDrop(action);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDealId(null)}
    >
      {/* Swipe-snaps one column at a time on phones; a thin scrollbar on
          desktop once many stages overflow. */}
      <div className="pipeline-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 lg:snap-none">
        {sortedStages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? [];
          return (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={stageDeals}
              totalValue={stageDeals.reduce((s, d) => s + Number(d.value || 0), 0)}
              currency={defaultCurrency}
              onAddDeal={onAddDeal}
              onEditDeal={onEditDeal}
            />
          );
        })}
        <ClosedColumn
          side={closedSide}
          onSideChange={setClosedSide}
          deals={closed}
          counts={recentCounts}
          showAll={showAllClosed}
          onShowAllChange={setShowAllClosed}
          allCount={allClosedCount}
          stages={sortedStages}
          onEditDeal={onEditDeal}
        />
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeDeal ? (
          <DealCard
            deal={activeDeal}
            stage={sortedStages.find((s) => s.id === activeDeal.stage_id) ?? null}
            onEdit={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      <style jsx>{`
        .pipeline-scroll {
          scroll-behavior: smooth;
        }
        @media (hover: none), (pointer: coarse) {
          .pipeline-scroll::-webkit-scrollbar {
            height: 0;
            display: none;
          }
          .pipeline-scroll {
            scrollbar-width: none;
          }
        }
        @media (hover: hover) and (pointer: fine) {
          .pipeline-scroll {
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
          }
        }
      `}</style>
    </DndContext>
  );
}

function StageColumn({
  stage,
  deals,
  totalValue,
  currency,
  onAddDeal,
  onEditDeal,
}: {
  stage: PipelineStage;
  deals: Deal[];
  totalValue: number;
  currency: string;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
}) {
  const t = useTranslations("Pipelines.board");
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section aria-label={stage.name} className={cn(COLUMN, "bg-muted")}>
      <div className="flex items-center gap-2 px-1 pt-1">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-foreground">
          {stage.name}
          <span className="font-medium text-muted-foreground"> · {deals.length}</span>
        </h3>
      </div>
      <p className="px-1 text-xs text-muted-foreground tabular-nums">{formatCurrency(totalValue, currency)}</p>

      {/* Only the card area is the drop target, so hovering the header
          doesn't light up the whole column. */}
      <div
        ref={setNodeRef}
        className={cn(
          "mt-3 flex flex-1 flex-col gap-2.5 rounded-xl transition-colors",
          isOver && "bg-primary-soft outline-2 outline-offset-2 outline-primary outline-dashed",
        )}
      >
        {deals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-input/50 py-10 text-xs text-muted-foreground">
            {t("dropDealHere")}
          </div>
        ) : (
          deals.map((deal) => <DraggableDealCard key={deal.id} deal={deal} stage={stage} onEdit={onEditDeal} />)
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAddDeal(stage.id)}
        className="mt-3 w-full justify-start text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <Plus aria-hidden />
        {t("addDeal")}
      </Button>
    </section>
  );
}

function ClosedColumn({
  side,
  onSideChange,
  deals,
  counts,
  showAll,
  onShowAllChange,
  allCount,
  stages,
  onEditDeal,
}: {
  side: ClosedSide;
  onSideChange: (side: ClosedSide) => void;
  deals: Deal[];
  counts: { won: number; lost: number };
  showAll: boolean;
  onShowAllChange: (all: boolean) => void;
  allCount: number;
  stages: PipelineStage[];
  onEditDeal: (deal: Deal) => void;
}) {
  const t = useTranslations("Pipelines.board");
  const { setNodeRef, isOver } = useDroppable({ id: CLOSED_COLUMN_ID });

  return (
    <section aria-label={t("closedColumn")} className={cn(COLUMN, "bg-primary-soft")}>
      <SegmentedControl
        size="sm"
        aria-label={t("closedColumn")}
        value={side}
        onValueChange={onSideChange}
        className="w-full bg-card/70 *:flex-1"
        options={[
          { value: "won", label: `${t("won")} · ${counts.won}` },
          { value: "lost", label: `${t("lost")} · ${counts.lost}` },
        ]}
      />
      <p className="mt-1.5 px-1 text-xs text-muted-foreground">
        {showAll ? t("closedAll") : t("closedRecent", { days: RECENT_CLOSED_DAYS })}
      </p>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-3 flex flex-1 flex-col gap-2.5 rounded-xl transition-colors",
          isOver && "bg-card/70 outline-2 outline-offset-2 outline-primary outline-dashed",
        )}
      >
        {deals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-primary/25 px-4 py-10 text-center text-xs text-primary-soft-foreground">
            {side === "won" ? t("dropToWin") : t("dropToLose")}
          </div>
        ) : (
          deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              stage={stages.find((s) => s.id === deal.stage_id) ?? null}
              onEdit={onEditDeal}
            />
          ))
        )}
      </div>

      {allCount > counts[side] || showAll ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShowAllChange(!showAll)}
          className="mt-3 w-full text-primary-soft-foreground hover:bg-card"
        >
          {showAll ? t("showRecent", { days: RECENT_CLOSED_DAYS }) : t("viewAllClosed", { count: allCount })}
        </Button>
      ) : null}
    </section>
  );
}

function DraggableDealCard({
  deal,
  stage,
  onEdit,
}: {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="rounded-2xl"
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: "none" }}
    >
      <DealCard deal={deal} stage={stage} onEdit={onEdit} />
    </div>
  );
}
