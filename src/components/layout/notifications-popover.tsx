"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SkeletonRow } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LIMIT = 8;
const TYPE_ICON: Record<Notification["type"], typeof Bell> = {
  conversation_assigned: UserPlus,
};

/**
 * The bell: unread count on the icon, the latest notifications in a
 * popover. Same queries and click behaviour as the Notifications page
 * (open → mark read → go to the conversation), plus "Mark all as read"
 * and a link to the full page. Loads when opened, so it is always fresh.
 */
export function NotificationsPopover({ unread }: { unread: number }) {
  const t = useTranslations("Shell");
  const tn = useTranslations("Notifications");
  const tp = useTranslations("UiPrimitives");
  const router = useRouter();
  const { accountId } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(false);
    const { data, error: err } = await createClient()
      .from("notifications")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (err) {
      setError(true);
      return;
    }
    setItems((data ?? []) as Notification[]);
  }, [accountId]);

  const markRead = async (id: string) => {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) ?? prev);
    const { error: err } = await createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (err) toast.error(tn("markReadFailed"));
  };

  const markAll = async () => {
    if (!accountId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev);
    const { error: err } = await createClient()
      .from("notifications")
      .update({ read_at: now })
      .eq("account_id", accountId)
      .is("read_at", null);
    if (err) {
      toast.error(tn("markAllFailed"));
      void load();
    }
  };

  const openItem = (n: Notification) => {
    if (!n.read_at) void markRead(n.id);
    setOpen(false);
    if (n.conversation_id) router.push(`/inbox?c=${n.conversation_id}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            label={unread > 0 ? t("bell.labelUnread", { count: unread }) : t("bell.label")}
            icon={<Bell />}
            badge={unread > 0 ? unread : undefined}
          />
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{tn("title")}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAll}
            disabled={!items?.some((n) => !n.read_at)}
          >
            <CheckCheck aria-hidden /> {tn("markAllRead")}
          </Button>
        </div>
        <div className="max-h-[min(60vh,24rem)] overflow-y-auto" aria-busy={items === null && !error}>
          {error ? (
            <ErrorState compact onRetry={load} />
          ) : items === null ? (
            <>
              <span className="sr-only">{tp("loading")}</span>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : items.length === 0 ? (
            <EmptyState compact icon={Bell} title={tn("emptyTitle")} description={tn("emptyDesc")} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      data-focus-inset
                      onClick={() => openItem(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                        !n.read_at && "bg-primary-soft/40"
                      )}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{n.title}</span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                        ) : null}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </span>
                      {!n.read_at ? (
                        <>
                          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                          <span className="sr-only">{tn("unread")}</span>
                        </>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
          >
            {t("bell.viewAll")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
