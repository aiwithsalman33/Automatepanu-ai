"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SETTINGS_NAV, isActive, type NavEntry } from "./nav-config";
import { ProfileMenu } from "./profile-menu";

function RailLink({ entry, pathname, badge }: { entry: NavEntry; pathname: string; badge?: number }) {
  const t = useTranslations("Shell");
  const active = isActive(entry.href, pathname);
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className="group flex w-full flex-col items-center gap-1 rounded-xl py-1.5 text-center"
    >
      <span
        className={cn(
          "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary-soft text-primary-soft-foreground"
            : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
        {badge ? (
          <span
            aria-hidden
            className="absolute -top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground ring-2 ring-sidebar"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate px-1 text-[11px] leading-tight",
          active ? "font-semibold text-primary-soft-foreground" : "font-medium text-muted-foreground group-hover:text-foreground"
        )}
      >
        {t(`nav.${entry.nav}`)}
      </span>
      {badge ? <span className="sr-only">{t("unreadChats", { count: badge })}</span> : null}
    </Link>
  );
}

/**
 * Desktop navigation (lg+): a slim 88px rail. Logo mark, the eight
 * sections with their labels under the icons, then Settings and the
 * profile menu at the bottom. The active section gets the soft purple
 * pill. Hidden below lg, where the bottom tab bar takes over.
 * `unread` (chats) comes from the shell, which subscribes once.
 */
export function Rail({ unread }: { unread: number }) {
  const t = useTranslations("Shell");
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-(--rail-w) flex-col items-center border-r border-sidebar-border bg-sidebar py-3 lg:flex">
      <Link
        href="/dashboard"
        aria-label={t("homeLink")}
        className="mb-2 flex size-12 shrink-0 items-center justify-center rounded-xl hover:bg-muted"
      >
        <BrandMark className="size-9" />
      </Link>
      <nav aria-label={t("primaryNav")} className="flex min-h-0 w-full flex-1 flex-col">
        <ul className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto px-2 py-1">
          {PRIMARY_NAV.map((entry) => (
            <li key={entry.href} className="w-full">
              <RailLink
                entry={entry}
                pathname={pathname}
                badge={entry.href === "/inbox" ? unread : undefined}
              />
            </li>
          ))}
        </ul>
        <ul className="flex w-full flex-col items-center gap-1 border-t border-sidebar-border px-2 pt-2">
          <li className="w-full">
            <RailLink entry={SETTINGS_NAV} pathname={pathname} />
          </li>
          <li>
            <ProfileMenu />
          </li>
        </ul>
      </nav>
    </aside>
  );
}
