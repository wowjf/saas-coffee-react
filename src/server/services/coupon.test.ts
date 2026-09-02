import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "./coupon";

describe("calculateCouponDiscount", () => {
  it("applies a percentage discount", () => {
    expect(calculateCouponDiscount({ type: "percentage", value: 10 }, 200)).toBe(20);
  });

  it("caps a percentage discount at maxDiscount", () => {
    expect(
      calculateCouponDiscount({ type: "percentage", value: 50, maxDiscount: 30 }, 200),
    ).toBe(30);
  });

  it("applies a fixed discount", () => {
    expect(calculateCouponDiscount({ type: "fixed", value: 25 }, 200)).toBe(25);
  });

  it("never exceeds the order total", () => {
    expect(calculateCouponDiscount({ type: "fixed", value: 500 }, 120)).toBe(120);
  });

  it("returns 0 for invalid order totals", () => {
    expect(calculateCouponDiscount({ type: "percentage", value: 10 }, -5)).toBe(0);
    expect(calculateCouponDiscount({ type: "percentage", value: 10 }, Number.NaN)).toBe(0);
  });

  it("rounds to two decimals", () => {
    expect(calculateCouponDiscount({ type: "percentage", value: 33 }, 99.99)).toBe(33);
  });

  it("returns 0 for unknown coupon types", () => {
    expect(calculateCouponDiscount({ type: "mystery", value: 10 }, 200)).toBe(0);
  });
});
