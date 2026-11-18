"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/data/client";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { applyInboxFilter, type InboxFilter } from "@/lib/inbox/inbox-filters";
import { isWindowClosing } from "@/lib/inbox/inbox-filters";
import { formatShortTime, shortTime, tagChipStyle, windowLeft } from "@/lib/inbox/display";
import { cn } from "@/lib/utils";
import type { Conversation, Tag } from "@/types";
import { Inbox, Search, SlidersHorizontal, Tag as TagIcon, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconButton } from "@/components/ui/icon-button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkeletonRow } from "@/components/ui/skeleton";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
  initialFilter?: InboxFilter;
}

/** The four views shown as tabs (docs/design/inbox.png); the rest live under Filters. */
const TAB_FILTERS = ["all", "unread", "waiting", "unassigned"] as const satisfies readonly InboxFilter[];
/** Single-select status views offered in the Filters popover. */
const STATUS_FILTERS = ["expiring", "open", "pending", "closed"] as const satisfies readonly InboxFilter[];


export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  initialFilter = "all",
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  
  const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = useMemo(() => [
    { label: t("filterAll"), value: "all" },
    { label: t("filterUnread"), value: "unread" },
    { label: t("filterWaiting"), value: "waiting" },
    { label: t("filterUnassigned"), value: "unassigned" },
    { label: t("filterExpiring"), value: "expiring" },
    { label: t("filterOpen"), value: "open" },
    { label: t("filterPending"), value: "pending" },
    { label: t("filterClosed"), value: "closed" },
  ], [t]);

  const tp = useTranslations("UiPrimitives");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [loading, setLoading] = useState(true);
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering. Company is an exact match on the field.
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoadError(true);
        setLoading(false);
        return;
      }

      setLoadError(false);
      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken, reloadToken]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Company options are derived from the loaded conversations — there's no
  // separate companies table, and only companies with a live conversation
  // are worth offering as an inbox filter.
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    let result = applyInboxFilter(conversations, filter, now);

    // Contact-based filters (tags via OR logic, exact company match).
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, now, search, selectedTagIds, selectedCompany]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);


  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const labelFor = (v: InboxFilter) =>
    v === "waiting" ? t("tabWaiting") : (FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v);
  // Counts for the tab labels, from what's loaded (same rules as the filter).
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<InboxFilter, number>> = {};
    for (const v of TAB_FILTERS) {
      if (v !== "all") counts[v] = applyInboxFilter(conversations, v, now).length;
    }
    return counts;
  }, [conversations, now]);
  const statusFilterActive = (STATUS_FILTERS as readonly string[]).includes(filter);
  const activeFilterCount =
    (statusFilterActive ? 1 : 0) + selectedTagIds.length + (selectedCompany ? 1 : 0);
  const clearAllFilters = () => {
    clearContactFilters();
    if (statusFilterActive) setFilter("all");
  };
  const closeSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

  return (
    // Full width on mobile (the list is the only pane); a fixed column
    // next to the thread from lg up.
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80 xl:w-[22rem]">
      <div className="space-y-3 border-b border-border px-4 pt-3">
        {/* Search + Filters. The design's number chips go above this
            row once an account can have more than one number. */}
        <div className="flex items-center gap-2">
          {searchOpen || search ? (
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={search}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeSearch();
                }}
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                className="h-10 w-full rounded-xl border border-input bg-card pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label={t("closeSearch")}
                className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <IconButton
                label={t("searchPlaceholder")}
                icon={<Search />}
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
              />
              <div className="flex-1" />
            </>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant={activeFilterCount ? "soft" : "outline"}
                  size="sm"
                  aria-label={activeFilterCount ? t("filtersWithCount", { count: activeFilterCount }) : t("filters")}
                />
              }
            >
              <SlidersHorizontal aria-hidden />
              {t("filters")}
              {activeFilterCount ? (
                <span aria-hidden className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-[min(20rem,calc(100vw-2rem))] gap-4">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("status")}</legend>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((v) => (
                    <Chip key={v} selected={filter === v} onSelectedChange={(on) => setFilter(on ? v : "all")}>
                      {labelFor(v)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              {tags.length > 0 ? (
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("tags")}</legend>
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        selected={selectedTagIds.includes(tag.id)}
                        onSelectedChange={() => toggleTag(tag.id)}
                        icon={<span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />}
                      >
                        {tag.name}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {companies.length > 0 ? (
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("company")}</legend>
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {companies.map((co) => (
                      <Chip key={co} selected={selectedCompany === co} onSelectedChange={(on) => setSelectedCompany(on ? co : null)}>
                        {co}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {activeFilterCount ? (
                <Button variant="ghost" size="sm" className="self-start" onClick={clearAllFilters}>
                  {t("clearAll")}
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>

        {/* Views as underlined tabs with counts. Buttons with
            aria-pressed: they filter one list, they don't switch panels. */}
        <div role="group" aria-label={t("tabsLabel")} className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
          {TAB_FILTERS.map((v) => {
            const active = filter === v;
            const count = tabCounts[v];
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(v)}
                className={cn(
                  "relative shrink-0 px-2.5 pt-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-primary-soft-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {labelFor(v)}
                {count ? <span className="ml-1 tabular-nums">{count}</span> : null}
                <span
                  aria-hidden
                  className={cn("absolute inset-x-1 bottom-0 h-0.5 rounded-full", active ? "bg-primary" : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Applied filters, removable one by one. */}
      {activeFilterCount ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
          {statusFilterActive ? <Chip onRemove={() => setFilter("all")}>{labelFor(filter)}</Chip> : null}
          {selectedTagIds.map((id) => (
            <Chip key={id} icon={<TagIcon aria-hidden />} onRemove={() => toggleTag(id)}>
              {tagsById.get(id)?.name ?? t("tags")}
            </Chip>
          ))}
          {selectedCompany ? <Chip onRemove={() => setSelectedCompany(null)}>{selectedCompany}</Chip> : null}
          <Button variant="link" size="sm" onClick={clearAllFilters}>
            {t("clearAll")}
          </Button>
        </div>
      ) : null}

      {/* min-h-0 is load-bearing: without it the ScrollArea grows to fit
          every row instead of scrolling (issue #229). */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div aria-busy="true">
            <span className="sr-only">{tp("loading")}</span>
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} className="border-b border-border" />
            ))}
          </div>
        ) : loadError && conversations.length === 0 ? (
          <ErrorState
            compact
            title={t("loadFailed")}
            onRetry={() => {
              setLoading(true);
              setReloadToken((n) => n + 1);
            }}
          />
        ) : filtered.length === 0 ? (
          conversations.length === 0 ? (
            <EmptyState compact icon={Inbox} title={t("emptyTitle")} description={t("emptyDesc")} />
          ) : (
            <EmptyState
              compact
              icon={Search}
              title={t("noConversations")}
              description={t("noMatchesDesc")}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearContactFilters();
                    closeSearch();
                    setFilter("all");
                  }}
                >
                  {t("clearAll")}
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col">
            {filtered.map((conv) => (
              <li key={conv.id}>
                <ConversationItem
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onSelect={handleSelect}
                  t={t}
                  locale={locale}
                  now={now}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  now: number;
}

const MAX_ROW_TAGS = 2;

function ConversationItem({ conversation, isActive, onSelect, t, locale, now }: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t("unknown");
  const unread = conversation.unread_count > 0;
  const time = conversation.last_message_at
    ? formatShortTime(shortTime(conversation.last_message_at, now), locale, {
        now: t("justNow"),
        yesterday: t("yesterday"),
      })
    : "";

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  // Row chips in the design's order: window closing, contact tags,
  // unassigned, then pending/closed status.
  const closingMs = isWindowClosing(conversation, now) ? windowLeft(conversation.last_inbound_at, now) : null;
  const tags: Tag[] = contact?.tags ?? [];
  const unassigned = conversation.status === "open" && !conversation.assigned_agent_id;
  const hasChips = !!closingMs || tags.length > 0 || unassigned || conversation.status !== "open";

  return (
    <button
      type="button"
      data-focus-inset
      onClick={handleClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "relative flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors",
        isActive ? "bg-primary-soft/60" : "hover:bg-muted/60"
      )}
    >
      {isActive ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" /> : null}
      <PersonAvatar name={displayName} src={contact?.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-[15px] text-foreground", unread ? "font-bold" : "font-semibold")}>
            {displayName}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              unread ? "font-semibold text-primary-soft-foreground" : "text-muted-foreground"
            )}
          >
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
            {conversation.last_message_text || t("noMessagesYet")}
          </p>
          {unread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              <span aria-hidden>{conversation.unread_count}</span>
              <span className="sr-only">{t("unreadCount", { count: conversation.unread_count })}</span>
            </span>
          ) : null}
        </div>
        {hasChips ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {closingMs ? (
              <span className="rounded-md bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning">
                {closingMs >= 3_600_000
                  ? t("windowHours", { hours: Math.floor(closingMs / 3_600_000) })
                  : t("windowMinutes", { minutes: Math.max(1, Math.floor(closingMs / 60_000)) })}
              </span>
            ) : null}
            {tags.slice(0, MAX_ROW_TAGS).map((tag) => (
              <span
                key={tag.id}
                className="max-w-28 truncate rounded-md px-2 py-0.5 text-xs font-medium"
                style={tagChipStyle(tag.color)}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > MAX_ROW_TAGS ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("moreTags", { count: tags.length - MAX_ROW_TAGS })}
              </span>
            ) : null}
            {unassigned ? (
              <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">
                {t("unassignedChip")}
              </span>
            ) : null}
            {conversation.status !== "open" ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {conversation.status === "pending" ? t("filterPending") : t("filterClosed")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}
