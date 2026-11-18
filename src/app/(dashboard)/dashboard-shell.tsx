"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import { Rail } from "@/components/layout/rail";
import { Topbar } from "@/components/layout/topbar";
import { MobileTabs } from "@/components/layout/mobile-tabs";
import { NumberFilterProvider } from "@/components/layout/number-switcher";
import { isFillRoute } from "@/components/layout/nav-config";
import { AccountAccessAlert } from "@/components/layout/account-access-alert";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { BrowserNotificationsListener } from "@/components/notifications/browser-notifications-listener";
import { cn } from "@/lib/utils";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

/** No multi-number data yet (one number per account): switcher hidden. */
const NO_NUMBERS: [] = [];

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("DashboardShell");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <ShellFrame>{children}</ShellFrame>;
}

/** The signed-in frame: rail, top bar, main, mobile tabs. */
function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tShell = useTranslations("Shell");
  // One subscription each, shared by the rail, the tab bar and the bell.
  const unreadChats = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const fill = isFillRoute(pathname);

  return (
    <NumberFilterProvider numbers={NO_NUMBERS}>
      <div className="min-h-dvh bg-card-2 lg:pl-(--rail-w)">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {tShell("skipToContent")}
        </a>
        {/* Headless: presence heartbeat and opt-in desktop alerts. */}
        <PresenceHeartbeat />
        <BrowserNotificationsListener />
        <Rail unread={unreadChats} />
        <div className="flex min-h-dvh flex-col">
          <Topbar unreadNotifications={unreadNotifications} />
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              "min-w-0 outline-none",
              fill
                ? // Fills the viewport under the top bar (and above the
                  // mobile tab bar); the page scrolls its own panes.
                  // flex-none: as a flex-1 item it would grow to fit
                  // its content instead of keeping this height.
                  "flex flex-none h-[calc(100dvh-3.5rem-var(--tabbar-h)-env(safe-area-inset-bottom))] flex-col overflow-hidden lg:h-[calc(100dvh-var(--topbar-h))]"
                : "flex-1 px-4 pt-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:pt-6 lg:pb-8"
            )}
          >
            {/* Writes are being rejected and here's why. Renders nothing
                unless the account/role failed to resolve. */}
            <div className={fill ? "px-4 pt-4 empty:hidden sm:px-6" : undefined}>
              <AccountAccessAlert />
            </div>
            {children}
          </main>
        </div>
        <MobileTabs unreadChats={unreadChats} unreadNotifications={unreadNotifications} />
      </div>
    </NumberFilterProvider>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
