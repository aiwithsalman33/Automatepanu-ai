"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isToday } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SkeletonRow } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notificationsAccountFilter } from "@/lib/notifications/unread-count";
import type { Notification } from "@/types";
import { Bell, CheckCheck, Loader2, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Icon per notification type. Only one type exists today
// (conversation_assigned) but this keeps future types a one-line add.
const TYPE_ICON: Record<Notification["type"], typeof Bell> = {
  conversation_assigned: UserPlus,
};

export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const { accountId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [view, setView] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }
    setNotifications((data ?? []) as Notification[]);
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Realtime — new assignments appear without a refresh, and a
  // "mark all read" fired from another tab/device stays in sync here.
  useEffect(() => {
    if (!accountId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: notificationsAccountFilter(accountId),
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notification;
            setNotifications((prev) => {
              if (!prev) return [row];
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Notification;
            setNotifications((prev) =>
              prev?.map((n) => (n.id === row.id ? { ...n, ...row } : n)) ??
              prev,
            );
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Notification>;
            setNotifications(
              (prev) => prev?.filter((n) => n.id !== oldRow.id) ?? prev,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic — the row is already visually "read" by the time the
      // request lands, so the UI doesn't wait on the round-trip.
      setNotifications(
        (prev) =>
          prev?.map((n) =>
            n.id === id && !n.read_at
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? prev,
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (updateErr) {
        toast.error(t("markReadFailed"));
        load();
      }
    },
    [load, t],
  );

  const handleClick = useCallback(
    (n: Notification) => {
      if (!n.read_at) markRead(n.id);
      if (n.conversation_id) {
        router.push(`/inbox?c=${n.conversation_id}`);
      }
    },
    [markRead, router],
  );

  const unreadIds = notifications?.filter((n) => !n.read_at).map((n) => n.id) ?? [];

  const markAllRead = useCallback(async () => {
    if (unreadIds.length === 0 || !accountId) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(
      (prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev,
    );
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("account_id", accountId)
      .is("read_at", null);
    setMarkingAll(false);
    if (updateErr) {
      toast.error(t("markAllFailed"));
      load();
    }
  }, [unreadIds.length, accountId, load, t]);

  // Visible rows (All / Unread), grouped Today / Earlier.
  const groups = useMemo(() => {
    const rows = (notifications ?? []).filter((n) => view === "all" || !n.read_at);
    const today = rows.filter((n) => isToday(new Date(n.created_at)));
    const earlier = rows.filter((n) => !isToday(new Date(n.created_at)));
    return [
      { id: "today", label: t("groupToday"), rows: today },
      { id: "earlier", label: t("groupEarlier"), rows: earlier },
    ].filter((g) => g.rows.length > 0);
  }, [notifications, view, t]);

  if (error) {
    return <ErrorState title={t("loadFailed")} description={error} onRetry={() => { setError(null); load(); }} />;
  }

  if (notifications === null) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-busy="true">
        <span className="sr-only">{t("title")}</span>
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonRow key={i} className="border-b border-border last:border-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        description={t("description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={unreadIds.length === 0 || markingAll}
            onClick={markAllRead}
          >
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            {t("markAllRead")}
          </Button>
        }
      />

      {notifications.length > 0 ? (
        <SegmentedControl
          aria-label={t("filterLabel")}
          value={view}
          onValueChange={setView}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "unread", label: `${t("unread")} · ${unreadIds.length}` },
          ]}
        />
      ) : null}

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t("emptyTitle")} description={t("emptyDesc")} />
      ) : groups.length === 0 ? (
        <EmptyState icon={CheckCheck} title={t("allCaughtUp")} />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`notif-${group.id}`}>
              <h2
                id={`notif-${group.id}`}
                className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {group.label}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {group.rows.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell;
                  const isUnread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        data-focus-inset
                        onClick={() => handleClick(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60",
                          isUnread && "bg-primary-soft/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-full",
                            isUnread ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn("truncate text-sm", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                              {n.title}
                            </span>
                            {isUnread ? (
                              <>
                                <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
                                <span className="sr-only">{t("unread")}</span>
                              </>
                            ) : null}
                          </span>
                          {n.body ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{n.body}</span> : null}
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
