import { describe, expect, it } from "vitest";
import { getTurkeyDateTimeIso } from "./campaignSchedule";

describe("getTurkeyDateTimeIso", () => {
  it("returns null for empty date", () => {
    expect(getTurkeyDateTimeIso("", "12:00")).toBeNull();
  });

  it("returns null for malformed date", () => {
    expect(getTurkeyDateTimeIso("not-a-date", "12:00")).toBeNull();
  });

  it("converts Turkey local time to UTC (offset -3h)", () => {
    // 12:00 in Turkey (UTC+3) is 09:00 UTC
    expect(getTurkeyDateTimeIso("2026-06-01", "12:00")).toBe("2026-06-01T09:00:00.000Z");
  });

  it("honours the seconds argument", () => {
    expect(getTurkeyDateTimeIso("2026-06-01", "23:59", 59)).toBe("2026-06-01T20:59:59.000Z");
  });

  it("defaults empty time to midnight", () => {
    expect(getTurkeyDateTimeIso("2026-06-01", "")).toBe("2026-05-31T21:00:00.000Z");
  });
});
