import { describe, expect, it } from "vitest";
import { normalizeEmail, serializeDocument, toIsoString } from "./utils";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("toIsoString", () => {
  it("returns undefined for empty input", () => {
    expect(toIsoString(null)).toBeUndefined();
    expect(toIsoString(undefined)).toBeUndefined();
  });

  it("converts a Date to ISO", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(toIsoString(d)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("converts a date string to ISO", () => {
    expect(toIsoString("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("serializeDocument", () => {
  it("maps _id to id and strips __v", () => {
    const fake = {
      _id: { toString: () => "abc123" },
      toObject: () => ({ _id: "abc123", __v: 0, name: "Latte", price: 120 }),
    };
    expect(serializeDocument(fake as any)).toEqual({ id: "abc123", name: "Latte", price: 120 });
  });
});

describe("role resolution", () => {
  function getAccountRole(user: any) {
    return user?.role || "customer";
  }

  function getEffectiveRole(user: any) {
    const accountRole = getAccountRole(user);

    if (accountRole === "customer") {
      return "customer";
    }

    if (accountRole === "manager") {
      if (user?.sessionRole === "manager" || user?.sessionRole === "staff") {
        return user.sessionRole;
      }
      return "customer";
    }

    return user?.sessionRole === accountRole ? accountRole : "customer";
  }

  it("resolves manager session roles correctly", () => {
    expect(getEffectiveRole({ role: "manager", sessionRole: "manager" })).toBe("manager");
    expect(getEffectiveRole({ role: "manager", sessionRole: "staff" })).toBe("staff");
    expect(getEffectiveRole({ role: "manager", sessionRole: "customer" })).toBe("customer");
    expect(getEffectiveRole({ role: "manager", sessionRole: null })).toBe("customer");
  });

  it("resolves staff session roles correctly", () => {
    expect(getEffectiveRole({ role: "staff", sessionRole: "staff" })).toBe("staff");
    expect(getEffectiveRole({ role: "staff", sessionRole: "manager" })).toBe("customer");
    expect(getEffectiveRole({ role: "staff", sessionRole: "customer" })).toBe("customer");
    expect(getEffectiveRole({ role: "staff", sessionRole: null })).toBe("customer");
  });

  it("resolves customer session roles always as customer", () => {
    expect(getEffectiveRole({ role: "customer", sessionRole: "manager" })).toBe("customer");
    expect(getEffectiveRole({ role: "customer", sessionRole: "staff" })).toBe("customer");
    expect(getEffectiveRole({ role: "customer", sessionRole: "customer" })).toBe("customer");
    expect(getEffectiveRole({ role: "customer", sessionRole: null })).toBe("customer");
  });
});

