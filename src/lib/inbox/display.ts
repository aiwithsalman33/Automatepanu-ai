import type { CSSProperties } from "react";

/**
 * Presentation helpers for the inbox (no data access): compact times,
 * the 24-hour reply window, tag chip colours.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const REPLY_WINDOW_MS = DAY;

export type ShortTime =
  | { kind: "now" }
  | { kind: "minutes"; value: number }
  | { kind: "hours"; value: number }
  | { kind: "yesterday" }
  | { kind: "date"; date: Date };

/** "now", "14m", "3h", "Yesterday", or a date: the list row's time. */
export function shortTime(iso: string, now: number): ShortTime {
  const at = new Date(iso);
  const diff = Math.max(0, now - at.getTime());
  if (diff < MINUTE) return { kind: "now" };
  if (diff < HOUR) return { kind: "minutes", value: Math.floor(diff / MINUTE) };
  const today = new Date(now);
  const sameDay = at.toDateString() === today.toDateString();
  if (sameDay || diff < 6 * HOUR) return { kind: "hours", value: Math.floor(diff / HOUR) };
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return { kind: "yesterday" };
  return { kind: "date", date: at };
}

export function formatShortTime(
  value: ShortTime,
  locale: string,
  labels: { now: string; yesterday: string },
): string {
  switch (value.kind) {
    case "now":
      return labels.now;
    case "minutes":
      return new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "narrow" }).format(value.value);
    case "hours":
      return new Intl.NumberFormat(locale, { style: "unit", unit: "hour", unitDisplay: "narrow" }).format(value.value);
    case "yesterday":
      return labels.yesterday;
    case "date":
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(value.date);
  }
}

/** Time left in the 24h window from the last customer message, or null if closed. */
export function windowLeft(lastInboundIso: string | null | undefined, now: number): number | null {
  if (!lastInboundIso) return null;
  const left = new Date(lastInboundIso).getTime() + REPLY_WINDOW_MS - now;
  return left > 0 ? left : null;
}

/** "18h 24m" / "45m" (narrow units in the user's locale). */
export function formatWindowLeft(ms: number, locale: string): string {
  const totalMinutes = Math.max(1, Math.floor(ms / MINUTE));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const fmt = (n: number, unit: "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(n);
  return h > 0 ? `${fmt(h, "hour")} ${fmt(m, "minute")}` : fmt(m, "minute");
}

/**
 * Chip colours from a tag's hex colour: a light tint for the fill and a
 * darkened shade for the text, so any tag colour stays readable on
 * white (the raw colour on its own tint often fails AA).
 */
export function tagChipStyle(color: string | null | undefined): CSSProperties {
  const c = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#7c3aed";
  return {
    backgroundColor: `color-mix(in oklab, ${c} 14%, white)`,
    color: `color-mix(in oklab, ${c} 55%, black)`,
  };
}
