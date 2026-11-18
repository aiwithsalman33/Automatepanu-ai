"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/brand-logo";
import { IconButton } from "@/components/ui/icon-button";
import { CommandPalette } from "./command-palette";
import { entryFor } from "./nav-config";
import { NewMenu } from "./new-menu";
import { NotificationsPopover } from "./notifications-popover";
import { ConnectedNumberSwitcher } from "./number-switcher";

const noopSubscribe = () => () => {};
/** "⌘K" on Apple platforms, "Ctrl K" elsewhere (and on the server). */
function useShortcutLabel() {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K"
  );
}

/**
 * The 64px top bar: page title, global search (button + Ctrl/⌘K
 * palette), WhatsApp number switcher (only with 2+ numbers), the
 * notifications bell and "+ New". Below lg it collapses to 56px: logo
 * mark, title, and icon-only search / bell / new.
 */
export function Topbar({ unreadNotifications }: { unreadNotifications: number }) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shortcut = useShortcutLabel();
  const entry = entryFor(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6 lg:h-(--topbar-h)">
      <Link
        href="/dashboard"
        aria-label={t("homeLink")}
        className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-xl lg:hidden"
      >
        <BrandMark className="size-8" />
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground lg:text-lg">
        {entry ? t(`title.${entry.title}`) : ""}
      </h1>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-card-2 px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground md:flex xl:w-80"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{t("search.open")}</span>
        <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      </button>
      <IconButton
        label={t("search.open")}
        icon={<Search />}
        onClick={() => setPaletteOpen(true)}
        className="md:hidden"
        aria-haspopup="dialog"
      />

      <ConnectedNumberSwitcher />
      <NotificationsPopover unread={unreadNotifications} />
      <div className="hidden sm:block">
        <NewMenu />
      </div>
      <div className="sm:hidden">
        <NewMenu compact />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
