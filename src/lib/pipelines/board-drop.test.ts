import { describe, expect, it } from "vitest";

import type { Deal } from "@/types";
import {
  CLOSED_COLUMN_ID,
  applyDrop,
  closedDeals,
  optimisticDeal,
  resolveDrop,
  type DealsDb,
} from "./board-drop";

const STAGES = ["s-new", "s-qualified", "s-proposal"];
const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: "d1",
    user_id: "u",
    pipeline_id: "p",
    stage_id: "s-qualified",
    contact_id: null,
    title: "Linen cover set",
    value: 2499,
    status: "open",
    created_at: "2026-11-01T10:00:00Z",
    ...over,
  }) as Deal;

/** Records every update the board runs. */
function fakeDb(failOn?: "status" | "stage_id") {
  const calls: { values: Record<string, unknown>; id: string }[] = [];
  const db: DealsDb = {
    from: () => ({
      update: (values) => ({
        eq: (_col, id) => {
          calls.push({ values, id });
          const fail = failOn && failOn in values;
          return Promise.resolve({ error: fail ? new Error("nope") : null });
        },
      }),
    }),
  };
  return { db, calls };
}

describe("drop on the Won column", () => {
  it("marks an open deal won with the same update the drawer runs", async () => {
    const action = resolveDrop({ deal: deal(), overId: CLOSED_COLUMN_ID, stageIds: STAGES, closedSide: "won" });
    expect(action).toEqual({ kind: "status", dealId: "d1", status: "won" });

    const { db, calls } = fakeDb();
    expect(await applyDrop(db, action!)).toBe(true);
    expect(calls).toEqual([{ values: { status: "won" }, id: "d1" }]);
  });

  it("marks lost when the column shows Lost", () => {
    expect(resolveDrop({ deal: deal(), overId: CLOSED_COLUMN_ID, stageIds: STAGES, closedSide: "lost" })).toEqual({
      kind: "status",
      dealId: "d1",
      status: "lost",
    });
  });

  it("does nothing for a deal already on that side, or closed the other way", () => {
    expect(resolveDrop({ deal: deal({ status: "won" }), overId: CLOSED_COLUMN_ID, stageIds: STAGES, closedSide: "won" })).toBeNull();
    expect(resolveDrop({ deal: deal({ status: "lost" }), overId: CLOSED_COLUMN_ID, stageIds: STAGES, closedSide: "won" })).toBeNull();
  });

  it("reports failure so the board can roll back", async () => {
    const { db } = fakeDb("status");
    expect(await applyDrop(db, { kind: "status", dealId: "d1", status: "won" })).toBe(false);
  });
});

describe("reopen by dragging a closed deal onto a stage", () => {
  it("reopens, then moves to the new stage (Reopen + a move)", async () => {
    const action = resolveDrop({
      deal: deal({ status: "won" }),
      overId: "s-new",
      stageIds: STAGES,
      closedSide: "won",
    });
    expect(action).toEqual({ kind: "reopen", dealId: "d1", stageId: "s-new", moveStage: true });

    const { db, calls } = fakeDb();
    expect(await applyDrop(db, action!)).toBe(true);
    expect(calls).toEqual([
      { values: { status: "open" }, id: "d1" },
      { values: { stage_id: "s-new" }, id: "d1" },
    ]);
  });

  it("only reopens when dropped on its own stage", async () => {
    const action = resolveDrop({ deal: deal({ status: "lost" }), overId: "s-qualified", stageIds: STAGES, closedSide: "lost" });
    expect(action).toEqual({ kind: "reopen", dealId: "d1", stageId: "s-qualified", moveStage: false });
    const { db, calls } = fakeDb();
    await applyDrop(db, action!);
    expect(calls).toEqual([{ values: { status: "open" }, id: "d1" }]);
  });

  it("stops after a failed reopen (no stage write)", async () => {
    const { db, calls } = fakeDb("status");
    expect(await applyDrop(db, { kind: "reopen", dealId: "d1", stageId: "s-new", moveStage: true })).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("optimistic state clears closed_at and sets the stage", () => {
    const next = optimisticDeal(deal({ status: "won", closed_at: "2026-11-10T00:00:00Z" }), {
      kind: "reopen",
      dealId: "d1",
      stageId: "s-new",
      moveStage: true,
    });
    expect(next).toMatchObject({ status: "open", closed_at: null, stage_id: "s-new" });
  });
});

describe("open deals between stages (unchanged)", () => {
  it("moves to another stage; same stage or unknown target is a no-op", async () => {
    expect(resolveDrop({ deal: deal(), overId: "s-proposal", stageIds: STAGES, closedSide: "won" })).toEqual({
      kind: "move",
      dealId: "d1",
      stageId: "s-proposal",
    });
    expect(resolveDrop({ deal: deal(), overId: "s-qualified", stageIds: STAGES, closedSide: "won" })).toBeNull();
    expect(resolveDrop({ deal: deal(), overId: "elsewhere", stageIds: STAGES, closedSide: "won" })).toBeNull();
    expect(resolveDrop({ deal: deal(), overId: null, stageIds: STAGES, closedSide: "won" })).toBeNull();
  });
});

describe("closedDeals", () => {
  const now = new Date("2026-11-18T12:00:00Z").getTime();
  const deals = [
    deal({ id: "recent-won", status: "won", closed_at: "2026-11-15T00:00:00Z" }),
    deal({ id: "old-won", status: "won", closed_at: "2026-09-01T00:00:00Z" }),
    deal({ id: "newest-won", status: "won", closed_at: "2026-11-17T00:00:00Z" }),
    deal({ id: "lost", status: "lost", closed_at: "2026-11-16T00:00:00Z" }),
    deal({ id: "open" }),
  ];
  it("shows one side, last 30 days, newest first", () => {
    expect(closedDeals(deals, "won", now).map((d) => d.id)).toEqual(["newest-won", "recent-won"]);
    expect(closedDeals(deals, "lost", now).map((d) => d.id)).toEqual(["lost"]);
  });
  it("View all includes older ones", () => {
    expect(closedDeals(deals, "won", now, true).map((d) => d.id)).toEqual(["newest-won", "recent-won", "old-won"]);
  });
});
