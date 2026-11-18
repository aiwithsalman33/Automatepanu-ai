import {
  Bell,
  Kanban,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Route,
  Settings,
  Sparkle,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The user panel's navigation, in one place: the desktop rail, the
 * mobile tab bar + "More" sheet, the top bar title and the command
 * palette's "Pages" group all read from here.
 *
 * `nav` keys live under Shell.nav (short labels that fit the 88px
 * rail); `title` keys under Shell.title (the top bar heading).
 */
export interface NavEntry {
  href: string;
  nav: string;
  title: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavEntry[] = [
  { href: "/dashboard", nav: "home", title: "home", icon: LayoutGrid },
  { href: "/inbox", nav: "inbox", title: "inbox", icon: MessageSquare },
  { href: "/contacts", nav: "contacts", title: "contacts", icon: User },
  { href: "/pipelines", nav: "deals", title: "deals", icon: Kanban },
  { href: "/broadcasts", nav: "broadcasts", title: "broadcasts", icon: Megaphone },
  { href: "/automations", nav: "automate", title: "automations", icon: Zap },
  { href: "/flows", nav: "flows", title: "flows", icon: Route },
  { href: "/agents", nav: "aiAgent", title: "aiAgent", icon: Sparkle },
];

export const SETTINGS_NAV: NavEntry = {
  href: "/settings",
  nav: "settings",
  title: "settings",
  icon: Settings,
};

/** Reached from the bell (desktop) or the More sheet (mobile). */
export const NOTIFICATIONS_NAV: NavEntry = {
  href: "/notifications",
  nav: "notifications",
  title: "notifications",
  icon: Bell,
};

/** Mobile bottom tabs, in order; everything else lives under "More". */
export const MOBILE_TABS = ["/dashboard", "/inbox", "/contacts", "/pipelines"] as const;

export const ALL_NAV: NavEntry[] = [...PRIMARY_NAV, NOTIFICATIONS_NAV, SETTINGS_NAV];

export function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** The entry whose section the path is in (for the top bar title). */
export function entryFor(pathname: string): NavEntry | undefined {
  return ALL_NAV.find((e) => isActive(e.href, pathname));
}

/**
 * Pages that fill the viewport below the top bar and manage their own
 * scrolling (three-pane inbox, the flow canvas). Everything else
 * scrolls with the document.
 */
export function isFillRoute(pathname: string): boolean {
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return true;
  // /flows/<id> is the editor; /flows/<id>/runs is a normal page.
  return /^\/flows\/[^/]+\/?$/.test(pathname);
}
