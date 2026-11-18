/**
 * Deals board: what a drop means, and the updates it runs.
 *
 * Won and lost are deal statuses, not stages. The board shows them in
 * an end column driven by status (with a Won | Lost toggle), so:
 *   - open deal  → a stage           : move (stage_id), as before
 *   - open deal  → the closed column : mark won or lost (whichever side
 *                                      the column shows), the same
 *                                      update the deal drawer runs
 *   - won/lost   → a stage           : reopen (status open), then move
 *                                      if the stage changed: the same
 *                                      two updates as Reopen + a move
 *   - anything else                  : nothing
 * The database trigger keeps closed_at in step with status.
 */
import type { Deal, DealStatus } from "@/types";

/** Droppable id of the Won | Lost column (never a stage id: those are uuids). */
export const CLOSED_COLUMN_ID = "deals-closed-column";

export type ClosedSide = "won" | "lost";

export type DropAction =
  | { kind: "move"; dealId: string; stageId: string }
  | { kind: "status"; dealId: string; status: ClosedSide }
  | { kind: "reopen"; dealId: string; stageId: string; moveStage: boolean };

export function isClosed(deal: Pick<Deal, "status">): boolean {
  return deal.status === "won" || deal.status === "lost";
}

export function resolveDrop({
  deal,
  overId,
  stageIds,
  closedSide,
}: {
  deal: Pick<Deal, "id" | "stage_id" | "status"> | undefined;
  overId: string | null | undefined;
  stageIds: readonly string[];
  closedSide: ClosedSide;
}): DropAction | null {
  if (!deal || !overId) return null;

  if (overId === CLOSED_COLUMN_ID) {
    if (deal.status === closedSide) return null;
    // A deal already closed the other way is changed in the drawer, not by drag.
    if (isClosed(deal)) return null;
    return { kind: "status", dealId: deal.id, status: closedSide };
  }

  if (!stageIds.includes(overId)) return null;

  if (isClosed(deal)) {
    return { kind: "reopen", dealId: deal.id, stageId: overId, moveStage: overId !== deal.stage_id };
  }
  if (overId === deal.stage_id) return null;
  return { kind: "move", dealId: deal.id, stageId: overId };
}

/** Minimal shape of the data client used for the updates. */
export interface DealsDb {
  from(table: "deals"): {
    update(values: { status?: DealStatus; stage_id?: string }): {
      eq(column: "id", value: string): PromiseLike<{ error: unknown }>;
    };
  };
}

/** Runs the action's updates; returns false if any failed. */
export async function applyDrop(db: DealsDb, action: DropAction): Promise<boolean> {
  const update = (values: { status?: DealStatus; stage_id?: string }) =>
    db.from("deals").update(values).eq("id", action.dealId);

  switch (action.kind) {
    case "move":
      return !(await update({ stage_id: action.stageId })).error;
    case "status":
      return !(await update({ status: action.status })).error;
    case "reopen": {
      if ((await update({ status: "open" })).error) return false;
      if (!action.moveStage) return true;
      return !(await update({ stage_id: action.stageId })).error;
    }
  }
}

/** The deal as it will look after the action (for the optimistic update). */
export function optimisticDeal<T extends Deal>(deal: T, action: DropAction, now = new Date().toISOString()): T {
  switch (action.kind) {
    case "move":
      return { ...deal, stage_id: action.stageId };
    case "status":
      return { ...deal, status: action.status, closed_at: now };
    case "reopen":
      return { ...deal, status: "open", closed_at: null, stage_id: action.stageId };
  }
}

export const RECENT_CLOSED_DAYS = 30;

/** Closed deals on one side, newest first; only the last 30 days unless `all`. */
export function closedDeals<T extends Deal>(deals: T[], side: ClosedSide, now: number, all = false): T[] {
  const since = now - RECENT_CLOSED_DAYS * 24 * 60 * 60 * 1000;
  const closedAt = (d: T) => d.closed_at ?? d.updated_at ?? d.created_at;
  return deals
    .filter((d) => d.status === side && (all || new Date(closedAt(d)).getTime() >= since))
    .sort((a, b) => (closedAt(a) < closedAt(b) ? 1 : closedAt(a) > closedAt(b) ? -1 : 0));
}
