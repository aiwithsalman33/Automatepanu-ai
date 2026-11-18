"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { UrlIntent } from "@/components/layout/url-intent";
import { createClient } from "@/lib/data/client";
import { getCurrentUser } from "@/lib/auth/client";
import type { Pipeline, PipelineStage, Deal } from "@/types";
import { PipelineBoard } from "@/components/pipelines/pipeline-board";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { DealForm } from "@/components/pipelines/deal-form";
import { PipelineAnalytics } from "@/components/pipelines/pipeline-analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Plus, Settings } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import {
  applyDrop,
  optimisticDeal,
  type DealsDb,
  type DropAction,
} from "@/lib/pipelines/board-drop";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/hooks/use-auth";
import { GatedButton } from "@/components/ui/gated-button";
import { useTranslations } from "next-intl";

// Pipeline creation is admin-class (settings-tier write under
// the new RLS); deal creation is operational and only requires
// agent+. The two CTAs gate on different `useCan` capabilities,
// not on different copy.

// Spec-defined seed — name and color per the product spec. Names are
// message keys under `Pipelines.page.defaultStages` so the seeded
// stages come out in the UI language.
const SPEC_DEFAULT_STAGES = [
  { nameKey: "newLead", color: "#3b82f6", position: 0 }, // blue
  { nameKey: "qualified", color: "#eab308", position: 1 }, // yellow
  { nameKey: "proposalSent", color: "#f97316", position: 2 }, // orange
  { nameKey: "negotiation", color: "#8b5cf6", position: 3 }, // purple
  { nameKey: "won", color: "#22c55e", position: 4 }, // green
] as const;

export default function PipelinesPage() {
  const t = useTranslations("Pipelines.page");
  const tForm = useTranslations("Pipelines.form");
  const tGate = useTranslations("GatedButton");
  const supabase = createClient();
  const canEditSettings = useCan("edit-settings");
  const canCreateDeals = useCan("send-messages");
  const { accountId } = useAuth();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  // A deal to open once its pipeline's deals are loaded (?deal=<id>
  // from the command palette).
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);

  // Dialog / sheet state
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Deal form state is lifted here so both the top-bar "Add Deal" and
  // the per-column "+" trigger the same Sheet.
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>("");

  // Guard against double-seeding (React StrictMode double-effect in dev).
  const seedAttempted = useRef(false);

  const loadPipelines = useCallback(async () => {
    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at");
    if (error) {
      console.error("Failed to load pipelines:", error.message);
      return [];
    }
    return data ?? [];
  }, [supabase]);

  const loadStages = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position");
      return data ?? [];
    },
    [supabase],
  );

  const loadDeals = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("deals")
        .select("*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Deal[];
    },
    [supabase],
  );

  const seedDefaultPipeline = useCallback(async (): Promise<Pipeline | null> => {
    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) return null;
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) return null;

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name: t("defaultPipelineName") })
      .select()
      .single();

    if (error || !pipeline) {
      console.error("Failed to seed pipeline:", error?.message);
      return null;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: t(`defaultStages.${s.nameKey}`),
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    return pipeline as Pipeline;
  }, [supabase, accountId, t]);

  // Initial load + seed-if-empty
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let list = await loadPipelines();

      if (list.length === 0 && accountId && !seedAttempted.current) {
        seedAttempted.current = true;
        const seeded = await seedDefaultPipeline();
        if (seeded) list = await loadPipelines();
      }

      if (cancelled) return;
      setPipelines(list);
      if (list.length > 0) {
        setSelectedPipelineId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id,
        );
      } else {
        setSelectedPipelineId("");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPipelines, seedDefaultPipeline, accountId]);

  // Load stages + deals whenever selected pipeline changes.
  // Clearing on no-selection is a legitimate sync with URL/prop
  // state; the load completion uses async setters inside promise
  // callbacks (not synchronous in the effect body).
  useEffect(() => {
    if (!selectedPipelineId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStages([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [s, d] = await Promise.all([
        loadStages(selectedPipelineId),
        loadDeals(selectedPipelineId),
      ]);
      if (cancelled) return;
      setStages(s);
      setDeals(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPipelineId, loadStages, loadDeals]);

  const refreshPipelines = useCallback(async () => {
    const list = await loadPipelines();
    setPipelines(list);
    if (list.length === 0) setSelectedPipelineId("");
    else if (!list.some((p) => p.id === selectedPipelineId))
      setSelectedPipelineId(list[0].id);
  }, [loadPipelines, selectedPipelineId]);

  const refreshStages = useCallback(async () => {
    if (!selectedPipelineId) return;
    setStages(await loadStages(selectedPipelineId));
  }, [loadStages, selectedPipelineId]);

  const refreshDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    setDeals(await loadDeals(selectedPipelineId));
  }, [loadDeals, selectedPipelineId]);

  // A drop on the board: move between stages, mark won/lost on the end
  // column, or reopen a closed deal onto a stage. Optimistic, rolled
  // back by a refetch on failure. The updates are the ones the board
  // and the deal drawer already ran (lib/pipelines/board-drop.ts).
  const handleDrop = useCallback(
    async (action: DropAction) => {
      setDeals((prev) => prev.map((d) => (d.id === action.dealId ? optimisticDeal(d, action) : d)));
      const ok = await applyDrop(supabase as unknown as DealsDb, action);
      if (!ok) {
        toast.error(action.kind === "move" ? t("toastFailedMoveDeal") : tForm("toastFailedStatus"));
        refreshDeals();
        return;
      }
      if (action.kind === "status") {
        toast.success(action.status === "won" ? tForm("toastMarkedWon") : tForm("toastMarkedLost"));
      } else if (action.kind === "reopen") {
        toast.success(tForm("toastReopened"));
      }
      // Pick up closed_at from the deals trigger.
      if (action.kind !== "move") refreshDeals();
    },
    [supabase, refreshDeals, t, tForm],
  );

  const handleAddDeal = useCallback(
    (stageId?: string) => {
      setEditingDeal(null);
      setDefaultStageId(stageId ?? stages[0]?.id ?? "");
      setDealFormOpen(true);
    },
    [stages],
  );

  const handleEditDeal = useCallback((deal: Deal) => {
    setEditingDeal(deal);
    setDefaultStageId(deal.stage_id);
    setDealFormOpen(true);
  }, []);

  useEffect(() => {
    if (!pendingDealId) return;
    const deal = deals.find((d) => d.id === pendingDealId);
    if (!deal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingDealId(null);
    handleEditDeal(deal);
  }, [pendingDealId, deals, handleEditDeal]);

  async function handleCreatePipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setCreating(true);

    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) {
      setCreating(false);
      return;
    }
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) {
      toast.error(t("toastNotLinkedToAccount"));
      setCreating(false);
      return;
    }

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name })
      .select()
      .single();

    if (error || !pipeline) {
      toast.error(t("toastFailedCreatePipeline"));
      setCreating(false);
      return;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: t(`defaultStages.${s.nameKey}`),
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    setNewPipelineName("");
    setNewPipelineOpen(false);
    setSelectedPipelineId(pipeline.id);
    await refreshPipelines();
    setCreating(false);
    toast.success(t("toastPipelineCreated"));
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-96 w-72 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deep links: "+ New → Deal" (?new=1) and search results
          (?pipeline=<id>&deal=<id>). */}
      <Suspense fallback={null}>
        <UrlIntent
          param="new"
          ready={canCreateDeals && !loading && !!selectedPipelineId && stages.length > 0}
          onIntent={() => handleAddDeal()}
        />
        <UrlIntent
          param="deal"
          clear={["pipeline"]}
          ready={!loading}
          onIntent={(dealId, params) => {
            const pid = params.get("pipeline");
            if (pid && pipelines.some((p) => p.id === pid)) setSelectedPipelineId(pid);
            setPendingDealId(dealId);
          }}
        />
      </Suspense>
      {/* Header (docs/design/deals.png): pipeline chips and "+ Pipeline"
          on the left; Stage settings and "+ Deal" on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
          {pipelines.length > 0 ? (
            <SegmentedControl
              variant="chips"
              aria-label={t("pipelinesLabel")}
              value={selectedPipelineId}
              onValueChange={setSelectedPipelineId}
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              className="shrink-0"
            />
          ) : null}
          <GatedButton
            variant="soft"
            size="sm"
            canAct={canEditSettings}
            gateReason={tGate("reasons.createPipelines")}
            onClick={() => setNewPipelineOpen(true)}
            className="shrink-0"
          >
            <Plus aria-hidden />
            {t("pipelineChip")}
          </GatedButton>
        </div>

        <div className="flex items-center gap-2">
          {selectedPipeline ? (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings aria-hidden />
              {t("stageSettings")}
            </Button>
          ) : null}
          <GatedButton
            canAct={canCreateDeals}
            gateReason={tGate("reasons.createDeals")}
            disabled={!selectedPipelineId || stages.length === 0}
            onClick={() => handleAddDeal()}
          >
            <Plus aria-hidden />
            {t("dealShort")}
          </GatedButton>
        </div>
      </div>

      {/* Board */}
      {pipelines.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={t("noPipelinesYet")}
          description={t("createToStartTracking")}
          action={
            <GatedButton
              canAct={canEditSettings}
              gateReason={tGate("reasons.createPipelines")}
              onClick={() => setNewPipelineOpen(true)}
            >
              <Plus aria-hidden />
              {t("createPipeline")}
            </GatedButton>
          }
        />
      ) : (
        <>
          <PipelineAnalytics stages={stages} deals={deals} />
          <PipelineBoard
            stages={stages}
            deals={deals}
            onDrop={handleDrop}
            onAddDeal={handleAddDeal}
            onEditDeal={handleEditDeal}
          />
        </>
      )}

      {/* New Pipeline Dialog */}
      <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-sm bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t("newPipeline")}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-muted-foreground">{t("pipelineName")}</Label>
            <Input
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder={t("pipelineNamePlaceholder")}
              className="mt-2 bg-muted border-border text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePipeline();
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("defaultStagesDesc")}
            </p>
          </div>
          <DialogFooter className="bg-popover/50 border-border">
            <Button
              variant="outline"
              onClick={() => setNewPipelineOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreatePipeline}
              disabled={creating || !newPipelineName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? t("creating") : t("createPipelineBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Settings */}
      {selectedPipeline && (
        <PipelineSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          pipeline={selectedPipeline}
          stages={stages}
          onPipelinesChanged={refreshPipelines}
          onStagesChanged={refreshStages}
          onCreateNewPipeline={() => {
            setSettingsOpen(false);
            setNewPipelineOpen(true);
          }}
        />
      )}

      {/* Deal Form (Sheet) */}
      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        deal={editingDeal}
        pipelineId={selectedPipelineId}
        stages={stages}
        defaultStageId={defaultStageId}
        onSaved={refreshDeals}
      />
    </div>
  );
}
