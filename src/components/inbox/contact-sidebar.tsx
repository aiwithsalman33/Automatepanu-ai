"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/data/client";
import { getCurrentUser } from "@/lib/auth/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, Deal, ContactNote, Tag } from "@/types";
import {
  Building2,
  Check,
  CircleDollarSign,
  Copy,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { tagChipStyle } from "@/lib/inbox/display";

interface ContactSidebarProps {
  contact: Contact | null;
  /** The open conversation, for the Activity tab (started / closed). */
  conversation?: Conversation | null;
  /** "panel": the inbox's right column. "drawer": inside a Drawer below xl. */
  variant?: "panel" | "drawer";
}

type TaggedTag = Tag & { contact_tag_id: string };

function money(value: number, currency: string | null | undefined, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? ""} ${value.toLocaleString(locale)}`.trim();
  }
}

/**
 * The contact panel (design/Inbox.png): avatar, name and handle, then
 * Details / Deals / Notes / Activity. Reads the same three things it
 * always did (deals, notes, tags) and adds notes the same way. The
 * Activity tab is a timeline of what's already loaded: no extra queries.
 */
export function ContactSidebar({ contact, conversation = null, variant = "panel" }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");
  const tp = useTranslations("UiPrimitives");
  const locale = useLocale();

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<TaggedTag[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const fetchContactData = useCallback(async () => {
    if (!contact) return;
    setStatus("loading");
    const supabase = createClient();

    // Deals, notes and tags in parallel.
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.error || notesRes.error || tagsRes.error) {
      setStatus("error");
      return;
    }
    setDeals(dealsRes.data ?? []);
    setNotes(notesRes.data ?? []);
    setTags(
      (tagsRes.data ?? [])
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        })),
    );
    setStatus("ready");
  }, [contact]);

  // Load on contact change; the setters run after the awaited queries.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    // Copies whatever the row displays: a BSUID-only contact has no
    // phone number, but its @username still identifies them.
    const handle = contact ? contactHandle(contact) : "";
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await getCurrentUser();

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  // Timeline from loaded data, newest first.
  const activity = useMemo(() => {
    if (!contact) return [];
    const items: { id: string; at: string; text: string; icon: typeof Plus }[] = [];
    if (contact.created_at) {
      items.push({ id: "contact", at: contact.created_at, text: tSidebar("activityContactAdded"), icon: UserPlus });
    }
    if (conversation?.created_at) {
      items.push({ id: "conv-start", at: conversation.created_at, text: tSidebar("activityConversationStarted"), icon: MessageSquare });
    }
    if (conversation?.closed_at) {
      items.push({ id: "conv-closed", at: conversation.closed_at, text: tSidebar("activityConversationClosed"), icon: Check });
    }
    for (const d of deals) {
      items.push({ id: `deal-${d.id}`, at: d.created_at, text: tSidebar("activityDealCreated", { title: d.title }), icon: CircleDollarSign });
      // deals.closed_at exists in the schema (select * returns it) but
      // isn't on the Deal type yet; updated_at is the fallback.
      const closedAt = (d as Deal & { closed_at?: string | null }).closed_at ?? d.updated_at;
      if ((d.status === "won" || d.status === "lost") && closedAt) {
        items.push({
          id: `deal-${d.id}-${d.status}`,
          at: closedAt,
          text: tSidebar(d.status === "won" ? "activityDealWon" : "activityDealLost", { title: d.title }),
          icon: CircleDollarSign,
        });
      }
    }
    for (const n of notes) {
      items.push({ id: `note-${n.id}`, at: n.created_at, text: tSidebar("activityNote"), icon: StickyNote });
    }
    return items.filter((i) => i.at).sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));
  }, [contact, conversation, deals, notes, tSidebar]);

  const shell = cn(
    "flex h-full flex-col bg-card",
    variant === "panel" ? "w-80 border-l border-border" : "w-full",
  );

  if (!contact) {
    return (
      <div className={cn(shell, "items-center justify-center")}>
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const handle = contactHandle(contact);
  const openDeal = deals.find((d) => (d.status ?? "open") === "open");
  const latestNote = notes[0];

  const sectionLabel = "mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase";
  const card = "rounded-2xl border border-border bg-card px-4 py-3";

  const body =
    status === "loading" ? (
      <div className="space-y-4 p-5" aria-busy="true">
        <span className="sr-only">{tp("loading")}</span>
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <SkeletonText lines={2} />
      </div>
    ) : status === "error" ? (
      <ErrorState compact title={tSidebar("loadFailed")} onRetry={fetchContactData} />
    ) : (
      <Tabs key={contact.id} defaultValue="details" className="gap-0">
        <div className="sticky top-0 z-10 bg-card px-5 pt-1">
          <TabsList variant="line" aria-label={tSidebar("tabsLabel")} className="w-full justify-start gap-3 border-b border-border">
            <TabsTrigger value="details" className="flex-none px-1">{tSidebar("tabDetails")}</TabsTrigger>
            <TabsTrigger value="deals" className="flex-none px-1">{tSidebar("deals")}</TabsTrigger>
            <TabsTrigger value="notes" className="flex-none px-1">{tSidebar("notes")}</TabsTrigger>
            <TabsTrigger value="activity" className="flex-none px-1">{tSidebar("tabActivity")}</TabsTrigger>
          </TabsList>
        </div>

        {/* Details */}
        <TabsContent value="details" className="space-y-5 p-5">
          <section>
            <div className="flex items-center justify-between">
              <h4 className={sectionLabel}>{tSidebar("tags")}</h4>
              <Link
                href={`/contacts?open=${contact.id}`}
                className="-mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary-soft-foreground hover:bg-primary-soft"
              >
                <Pencil className="size-3" aria-hidden />
                {tSidebar("editTags")}
              </Link>
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tSidebar("noTags")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-md px-2 py-0.5 text-xs font-medium"
                    style={tagChipStyle(tag.color)}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          {openDeal ? (
            <section className={card}>
              <p className="text-xs text-muted-foreground">{tSidebar("openDeal")}</p>
              <p className="mt-0.5 font-semibold text-foreground">{openDeal.title}</p>
              <p className="text-sm text-muted-foreground">
                {money(openDeal.value, openDeal.currency, locale)}
                {openDeal.stage ? ` · ${openDeal.stage.name}` : ""}
              </p>
            </section>
          ) : null}

          {latestNote ? (
            <section className={card}>
              <p className="text-xs text-muted-foreground">{tSidebar("internalNote")}</p>
              <p className="mt-0.5 line-clamp-4 text-sm whitespace-pre-wrap text-foreground">{latestNote.note_text}</p>
            </section>
          ) : null}

          <section>
            <h4 className={sectionLabel}>{tSidebar("contactInfo")}</h4>
            <ul className="space-y-1 text-sm">
              <li>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  aria-label={tSidebar("copyPhone", { handle })}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-foreground hover:bg-muted"
                >
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate">{handle}</span>
                  {copied ? (
                    <Check className="size-3.5 text-status-good-text" aria-hidden />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" aria-hidden />
                  )}
                </button>
              </li>
              {contact.email ? (
                <li className="flex min-h-10 items-center gap-2.5 px-2 text-foreground">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">{contact.email}</span>
                </li>
              ) : null}
              {contact.company ? (
                <li className="flex min-h-10 items-center gap-2.5 px-2 text-foreground">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">{contact.company}</span>
                </li>
              ) : null}
            </ul>
          </section>
        </TabsContent>

        {/* Deals */}
        <TabsContent value="deals" className="space-y-2.5 p-5">
          {deals.length === 0 ? (
            <EmptyState compact icon={CircleDollarSign} title={tSidebar("noDeals")} />
          ) : (
            deals.map((deal) => (
              <div key={deal.id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{deal.title}</p>
                  {deal.status === "won" || deal.status === "lost" ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                        deal.status === "won"
                          ? "bg-status-good/12 text-status-good-text"
                          : "bg-status-critical/10 text-status-critical",
                      )}
                    >
                      {tSidebar(deal.status === "won" ? "statusWon" : "statusLost")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {money(deal.value, deal.currency, locale)}
                  {deal.stage ? ` · ${deal.stage.name}` : ""}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="space-y-3 p-5">
          <div className="space-y-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={tSidebar("addNotePlaceholder")}
              aria-label={tSidebar("addNotePlaceholder")}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring"
            />
            <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim() || addingNote}>
              <Plus aria-hidden />
              {tSidebar("addNote")}
            </Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState compact icon={StickyNote} title={tSidebar("noNotes")} />
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className={card}>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{note.note_text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="p-5">
          {activity.length === 0 ? (
            <EmptyState compact title={tSidebar("noActivity")} />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {activity.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className="relative">
                    <span className="absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground ring-4 ring-card">
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <p className="text-sm text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={item.at}>{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</time>
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    );

  return (
    <div className={shell}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col items-center px-5 pt-6 pb-4 text-center">
          <PersonAvatar name={displayName} src={contact.avatar_url} size="lg" className="[&>[data-slot=avatar]]:size-16 [&>[data-slot=avatar]]:text-xl" />
          <h3 className="mt-3 text-base font-semibold text-foreground">{displayName}</h3>
          <p className="text-sm text-muted-foreground">
            {handle}
            {contact.company ? ` · ${contact.company}` : ""}
          </p>
        </div>
        {body}
      </ScrollArea>
    </div>
  );
}
