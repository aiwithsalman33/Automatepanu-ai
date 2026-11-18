"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, MessageSquare, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { Command, CommandDialog, type CommandGroup } from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { ALL_NAV } from "./nav-config";

const MIN_QUERY = 2;
const LIMIT = 5;

interface Results {
  chats: { id: string; name: string; preview: string | null }[];
  contacts: { id: string; name: string; phone: string | null }[];
  deals: { id: string; title: string; pipeline_id: string }[];
}

const EMPTY: Results = { chats: [], contacts: [], deals: [] };

/** `%` and `_` are LIKE wildcards; a search for "50%" means the text. */
function likeLiteral(q: string) {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Global search (Ctrl/⌘K). Searches chats, contacts and deals with the
 * same data-API queries the Inbox, Contacts and Deals pages run (top 5
 * of each, RLS-scoped), plus a static list of pages. Picking a result
 * deep-links into its page: /inbox?c=<id>, /contacts?open=<id>,
 * /pipelines?pipeline=<id>&deal=<id>.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Shell");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  // Ctrl/⌘K anywhere in the user panel toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Debounced search; a newer keystroke supersedes an older request.
  const term = query.trim();
  useEffect(() => {
    if (!open || term.length < MIN_QUERY) return;
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const supabase = createClient();
        const [contactsRes, dealsRes] = await Promise.all([
          supabase
            .from("contacts")
            .select("id,name,phone")
            .search(term, { includeEmail: true })
            .limit(LIMIT),
          supabase
            .from("deals")
            .select("id,title,pipeline_id")
            .ilike("title", `%${likeLiteral(term)}%`)
            .order("updated_at", { ascending: false })
            .limit(LIMIT),
        ]);
        if (contactsRes.error || dealsRes.error) throw contactsRes.error ?? dealsRes.error;
        const contacts = (contactsRes.data ?? []) as Results["contacts"];
        let chats: Results["chats"] = [];
        if (contacts.length) {
          const convRes = await supabase
            .from("conversations")
            .select("id,contact_id,last_message_text")
            .in("contact_id", contacts.map((c) => c.id))
            .order("last_message_at", { ascending: false })
            .limit(LIMIT);
          if (convRes.error) throw convRes.error;
          const byId = new Map(contacts.map((c) => [c.id, c]));
          chats = ((convRes.data ?? []) as { id: string; contact_id: string; last_message_text: string | null }[]).map(
            (cv) => ({
              id: cv.id,
              name: byId.get(cv.contact_id)?.name || byId.get(cv.contact_id)?.phone || t("search.untitledChat"),
              preview: cv.last_message_text,
            })
          );
        }
        if (id !== seq.current) return;
        setResults({ chats, contacts, deals: (dealsRes.data ?? []) as Results["deals"] });
      } catch {
        if (id !== seq.current) return;
        setResults(EMPTY);
        setFailed(true);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [term, open, t]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  const remote = term.length >= MIN_QUERY ? results : EMPTY;
  const groups: CommandGroup[] = useMemo(() => {
    const q = term.toLowerCase();
    const pages = ALL_NAV.filter((e) => !q || t(`title.${e.title}`).toLowerCase().includes(q));
    return [
      {
        id: "chats",
        label: t("search.chats"),
        items: remote.chats.map((c) => ({
          id: `chat-${c.id}`,
          label: c.name,
          hint: c.preview ?? undefined,
          icon: <MessageSquare />,
          onSelect: () => go(`/inbox?c=${c.id}`),
        })),
      },
      {
        id: "contacts",
        label: t("search.contacts"),
        items: remote.contacts.map((c) => ({
          id: `contact-${c.id}`,
          label: c.name || c.phone || "—",
          hint: c.name ? (c.phone ?? undefined) : undefined,
          icon: <User />,
          onSelect: () => go(`/contacts?open=${c.id}`),
        })),
      },
      {
        id: "deals",
        label: t("search.deals"),
        items: remote.deals.map((d) => ({
          id: `deal-${d.id}`,
          label: d.title,
          icon: <Handshake />,
          onSelect: () => go(`/pipelines?pipeline=${d.pipeline_id}&deal=${d.id}`),
        })),
      },
      {
        id: "pages",
        label: t("search.pages"),
        items: pages.map((e) => {
          const Icon = e.icon;
          return {
            id: `page-${e.href}`,
            label: t(`title.${e.title}`),
            icon: <Icon />,
            onSelect: () => go(e.href),
          };
        }),
      },
    ];
    // go is stable enough (router + setters); listing it re-creates per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, term, t]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title={t("search.dialogTitle")}
    >
      <Command
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        loading={loading}
        placeholder={t("search.placeholder")}
        inputLabel={t("search.dialogTitle")}
        emptyText={failed ? t("search.failed") : t("search.noResults", { query: term })}
        footer={
          <>
            <span>{t("search.hintMove")}</span>
            <span>{t("search.hintOpen")}</span>
            <span>{t("search.hintClose")}</span>
          </>
        }
      />
      {failed && term.length >= MIN_QUERY ? (
        <p role="status" className="border-t border-border px-4 py-2 text-xs text-status-critical">
          {t("search.failed")}
        </p>
      ) : null}
    </CommandDialog>
  );
}
