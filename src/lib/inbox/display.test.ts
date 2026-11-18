import { describe, expect, it } from "vitest";

import { formatShortTime, formatWindowLeft, shortTime, tagChipStyle, windowLeft } from "./display";

const labels = { now: "now", yesterday: "Yesterday" };
const at = (d: Date) => d.toISOString();

describe("shortTime", () => {
  const now = new Date("2026-11-18T15:00:00").getTime();
  const fmt = (iso: string) => formatShortTime(shortTime(iso, now), "en", labels);

  it("reads like the list design: now, minutes, hours, Yesterday, date", () => {
    expect(fmt(at(new Date(now - 20_000)))).toBe("now");
    expect(fmt(at(new Date(now - 14 * 60_000)))).toBe("14m");
    expect(fmt(at(new Date(now - 3 * 3_600_000)))).toBe("3h");
    expect(fmt(at(new Date("2026-11-17T09:00:00")))).toBe("Yesterday");
    expect(fmt(at(new Date("2026-11-10T09:00:00")))).toBe("Nov 10");
  });

  it("treats a future timestamp (clock skew) as now", () => {
    expect(fmt(at(new Date(now + 60_000)))).toBe("now");
  });
});

describe("reply window", () => {
  const now = new Date("2026-11-18T15:00:00Z").getTime();

  it("counts down 24h from the last customer message", () => {
    const left = windowLeft(new Date(now - (5 * 3_600_000 + 36 * 60_000)).toISOString(), now);
    expect(left).toBe(18 * 3_600_000 + 24 * 60_000);
    expect(formatWindowLeft(left!, "en")).toBe("18h 24m");
  });

  it("is null once closed or without a customer message", () => {
    expect(windowLeft(new Date(now - 25 * 3_600_000).toISOString(), now)).toBeNull();
    expect(windowLeft(null, now)).toBeNull();
  });

  it("shows minutes alone in the last hour, never 0m", () => {
    expect(formatWindowLeft(45 * 60_000, "en")).toBe("45m");
    expect(formatWindowLeft(10_000, "en")).toBe("1m");
  });
});

describe("tagChipStyle", () => {
  it("tints from the tag colour and falls back to primary for junk", () => {
    expect(tagChipStyle("#16a34a").backgroundColor).toContain("#16a34a");
    expect(tagChipStyle("javascript:alert(1)").color).toContain("#7c3aed");
  });
});
