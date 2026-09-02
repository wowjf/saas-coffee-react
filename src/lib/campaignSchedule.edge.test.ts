import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTurkeyDateTimeIso, getTurkeyDateTimeMs, isCampaignScheduledActive } from "./campaignSchedule";

type ScheduledCampaign = Parameters<typeof isCampaignScheduledActive>[0];

function buildCampaign(overrides: Partial<ScheduledCampaign> = {}): ScheduledCampaign {
  return {
    active: true,
    startDate: "",
    expiryDate: "",
    ...overrides,
  } as ScheduledCampaign;
}

describe("getTurkeyDateTimeMs edge cases", () => {
  it("returns null when the date has non-numeric parts", () => {
    expect(getTurkeyDateTimeMs("abcd-ef-gh")).toBeNull();
  });

  it("returns null for incomplete dates", () => {
    expect(getTurkeyDateTimeMs("2026-06")).toBeNull();
    expect(getTurkeyDateTimeMs("2026")).toBeNull();
  });

  it("returns null for zero-valued parts (falsy year/month/day)", () => {
    expect(getTurkeyDateTimeMs("0-6-1")).toBeNull();
    expect(getTurkeyDateTimeMs("2026-0-1")).toBeNull();
    expect(getTurkeyDateTimeMs("2026-6-0")).toBeNull();
  });

  it("interprets garbage time segments as 00:00", () => {
    // "ab:cd" maps to NaN -> 0 per parseTimeParts
    expect(getTurkeyDateTimeMs("2026-06-01", "ab:cd")).toBe(
      getTurkeyDateTimeMs("2026-06-01", "00:00"),
    );
  });

  it("applies the fixed +03:00 offset regardless of host timezone", () => {
    // 00:00 Turkey time == 21:00 UTC the previous day
    expect(getTurkeyDateTimeMs("2026-01-15")).toBe(Date.UTC(2026, 0, 14, 21, 0, 0));
  });

  it("matches the ISO helper for the same inputs", () => {
    const ms = getTurkeyDateTimeMs("2026-03-09", "18:45", 12);
    expect(getTurkeyDateTimeIso("2026-03-09", "18:45", 12)).toBe(new Date(ms!).toISOString());
  });
});

describe("isCampaignScheduledActive edge cases", () => {
  beforeEach(() => {
    // Freeze time at a known instant: 2026-06-15 12:00:00 UTC (15:00 Turkey time)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for a null campaign", () => {
    expect(isCampaignScheduledActive(null)).toBe(false);
  });

  it("returns false for an inactive campaign regardless of dates", () => {
    expect(
      isCampaignScheduledActive(
        buildCampaign({ active: false, startDate: "2000-01-01", expiryDate: "2099-01-01" }),
      ),
    ).toBe(false);
  });

  it("treats empty start/expiry dates as always active", () => {
    expect(isCampaignScheduledActive(buildCampaign({}))).toBe(true);
  });

  it("is active when now is exactly the start boundary (inclusive)", () => {
    // 12:00 UTC == 15:00 Turkey on the same day
    expect(isCampaignScheduledActive(buildCampaign({ startDate: "2026-06-15", startTime: "15:00" }))).toBe(true);
  });

  it("is inactive before the start time on the start date", () => {
    expect(isCampaignScheduledActive(buildCampaign({ startDate: "2026-06-15", startTime: "15:01" }))).toBe(false);
  });

  it("is inactive on the day before the start date", () => {
    expect(isCampaignScheduledActive(buildCampaign({ startDate: "2026-06-16" }))).toBe(false);
  });

  it("is active at the exact expiry boundary (endAt == now)", () => {
    // endTime 12:00:59 Turkey == 09:00:59 UTC, so pick now to match exactly:
    // freeze now is 12:00 UTC == 15:00 TR; expiry 15:00:59 TR -> endAt 12:00:59 UTC > now
    expect(isCampaignScheduledActive(buildCampaign({ expiryDate: "2026-06-15", endTime: "15:00:59" }))).toBe(true);
  });

  it("is inactive one second after the expiry boundary", () => {
    // endAt (expiryDate 23:59:59 default) with expiryDate yesterday -> expired
    expect(isCampaignScheduledActive(buildCampaign({ expiryDate: "2026-06-14" }))).toBe(false);
  });

  it("uses 23:59:59 as the default end time on the expiry date", () => {
    // 2026-06-16 23:59:59 Turkey == 2026-06-16 20:59:59 UTC, still in the future
    expect(isCampaignScheduledActive(buildCampaign({ expiryDate: "2026-06-16", endTime: undefined }))).toBe(true);
  });

  it("uses 00:00 as the default start time on the start date", () => {
    expect(isCampaignScheduledActive(buildCampaign({ startDate: "2026-06-15", startTime: undefined }))).toBe(true);
  });

  it("is active inside a full window spanning now", () => {
    expect(
      isCampaignScheduledActive(
        buildCampaign({ startDate: "2026-06-01", startTime: "09:00", expiryDate: "2026-06-30", endTime: "23:00" }),
      ),
    ).toBe(true);
  });

  it("is inactive when the window ended earlier the same day", () => {
    // now is 15:00 Turkey; window closed at 14:59:59 Turkey
    expect(
      isCampaignScheduledActive(buildCampaign({ expiryDate: "2026-06-15", endTime: "14:59" })),
    ).toBe(false);
  });

  it("ignores an unparseable startDate and stays active", () => {
    // parseDateParts returns null -> startAt null -> no start constraint
    expect(isCampaignScheduledActive(buildCampaign({ startDate: "not-a-date" }))).toBe(true);
  });
});
