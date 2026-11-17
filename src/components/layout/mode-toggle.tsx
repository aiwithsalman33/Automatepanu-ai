"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { DEFAULT_MODE } from "@/lib/themes";
import { cn } from "@/lib/utils";

import { useTranslations } from "next-intl";

const noopSubscribe = () => () => {};

/**
 * Light/dark mode toggle — a single icon button that flips the app
 * between the two modes. Sun shows in light mode (click → go dark),
 * moon shows in dark mode (click → go light); the label always names
 * the destination so screen-reader users hear what the click does.
 *
 * Hydration-safe: the server renders DEFAULT_MODE, but the client's
 * ThemeProvider starts from the saved mode, so anything that depends on
 * `mode` differs on the first client render. In a server-rendered tree
 * (e.g. /admin) that mismatch made React re-render the whole root,
 * which reset <html data-mode> to the server default. So: both icons
 * are rendered and CSS picks one from <html data-mode>, and the label
 * uses the server value until hydration is done.
 *
 * 40×40 hit target to match the header's other touch controls.
 */
export function ModeToggle({ className }: { className?: string }) {
  const t = useTranslations("ModeToggle");
  const { mode, toggleMode } = useTheme();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const current = hydrated ? mode : DEFAULT_MODE;
  const goingTo = current === "dark" ? "light" : "dark";
  const switchLabel = t("switchMode", { mode: goingTo });

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={switchLabel}
      title={switchLabel}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Moon className="h-5 w-5 [html[data-mode=light]_&]:hidden" aria-hidden />
      <Sun className="hidden h-5 w-5 [html[data-mode=light]_&]:block" aria-hidden />
    </button>
  );
}
