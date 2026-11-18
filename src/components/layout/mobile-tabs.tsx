"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { cn } from "@/lib/utils";
import {
  MOBILE_TABS,
  NOTIFICATIONS_NAV,
  PRIMARY_NAV,
  SETTINGS_NAV,
  isActive,
  type NavEntry,
} from "./nav-config";
import { WorkspaceLine } from "./profile-menu";

const tabEntries = MOBILE_TABS.map((href) => PRIMARY_NAV.find((e) => e.href === href)!);
const moreEntries: NavEntry[] = [
  ...PRIMARY_NAV.filter((e) => !(MOBILE_TABS as readonly string[]).includes(e.href)),
  NOTIFICATIONS_NAV,
  SETTINGS_NAV,
];

const tabClass =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-tight";

/**
 * Mobile navigation (below lg): a bottom tab bar with Home, Inbox,
 * Contacts, Deals and More. "More" opens a bottom sheet with the other
 * sections, notifications, settings, the admin link and sign out.
 */
export function MobileTabs({ unreadChats, unreadNotifications }: { unreadChats: number; unreadNotifications: number }) {
  const t = useTranslations("Shell");
  const ts = useTranslations("Sidebar");
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreEntries.some((e) => isActive(e.href, pathname));
  const name = profile?.full_name ?? user?.name ?? ts("defaultUser");

  return (
    <>
      <nav
        aria-label={t("mobileNav")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex h-(--tabbar-h) items-stretch px-1">
          {tabEntries.map((e) => {
            const active = isActive(e.href, pathname);
            const Icon = e.icon;
            const badge = e.href === "/inbox" ? unreadChats : 0;
            return (
              <li key={e.href} className="flex min-w-0 flex-1">
                <Link href={e.href} aria-current={active ? "page" : undefined} className={tabClass}>
                  <span
                    className={cn(
                      "relative flex h-8 w-14 items-center justify-center rounded-full",
                      active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {badge ? (
                      <span
                        aria-hidden
                        className="absolute -top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground ring-2 ring-background"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("max-w-full truncate px-0.5", active ? "font-semibold text-primary-soft-foreground" : "font-medium text-muted-foreground")}>
                    {t(`nav.${e.nav}`)}
                  </span>
                  {badge ? <span className="sr-only">{t("unreadChats", { count: badge })}</span> : null}
                </Link>
              </li>
            );
          })}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tabClass}
            >
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full",
                  moreActive ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground"
                )}
              >
                <MoreHorizontal className="size-5" aria-hidden />
                {unreadNotifications > 0 ? (
                  <span aria-hidden className="absolute top-0 right-3 size-2 rounded-full bg-primary ring-2 ring-background" />
                ) : null}
              </span>
              <span className={cn("max-w-full truncate px-0.5", moreActive ? "font-semibold text-primary-soft-foreground" : "font-medium text-muted-foreground")}>
                {t("nav.more")}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent side="bottom" title={t("more.title")}>
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-card-2 p-3">
            <PersonAvatar name={name} src={profile?.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
              <div className="mt-1">
                <WorkspaceLine />
              </div>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {moreEntries.map((e) => {
              const active = isActive(e.href, pathname);
              const Icon = e.icon;
              const showDot = e.href === NOTIFICATIONS_NAV.href && unreadNotifications > 0;
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-medium",
                      active
                        ? "border-transparent bg-primary-soft text-primary-soft-foreground"
                        : "border-border text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    <span className="max-w-full truncate">{t(`nav.${e.nav}`)}</span>
                    {showDot ? (
                      <>
                        <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary" />
                        <span className="sr-only">{t("bell.labelUnread", { count: unreadNotifications })}</span>
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
            {user?.platform_admin ? (
              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted"
              >
                <ShieldCheck className="size-4" aria-hidden />
                {ts("adminPanel")}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                void signOut();
              }}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogOut className="size-4" aria-hidden />
              {ts("menuSignOut")}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
