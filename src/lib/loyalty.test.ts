import { describe, expect, it } from "vitest";
import {
  getNormalizedPointsCost,
  getPointsForCompletedItemCount,
  getPointsForOrderTotal,
  isPointRewardCampaignType,
  LOYALTY_POINTS_PER_COMPLETED_ITEM,
  POINT_REWARD_CAMPAIGN_TYPES,
} from "./loyalty";

describe("getPointsForCompletedItemCount", () => {
  it("awards 100 points per completed item", () => {
    expect(getPointsForCompletedItemCount(1)).toBe(LOYALTY_POINTS_PER_COMPLETED_ITEM);
    expect(getPointsForCompletedItemCount(3)).toBe(300);
    expect(getPointsForCompletedItemCount(10)).toBe(1000);
  });

  it("returns 0 for zero items", () => {
    expect(getPointsForCompletedItemCount(0)).toBe(0);
  });

  it("clamps negative item counts to 0", () => {
    expect(getPointsForCompletedItemCount(-5)).toBe(0);
  });

  it("scales linearly with item count", () => {
    const first = getPointsForCompletedItemCount(7);
    const second = getPointsForCompletedItemCount(14);
    expect(second).toBe(first * 2);
  });
});

describe("getPointsForOrderTotal", () => {
  it("awards 1 point per 10 currency units", () => {
    expect(getPointsForOrderTotal(10)).toBe(1);
    expect(getPointsForOrderTotal(100)).toBe(10);
    expect(getPointsForOrderTotal(255)).toBe(25);
  });

  it("floors fractional totals instead of rounding up", () => {
    // 19.99 => floor(1.999) => 1
    expect(getPointsForOrderTotal(19.99)).toBe(1);
    // 9.99 => floor(0.999) => 0
    expect(getPointsForOrderTotal(9.99)).toBe(0);
  });

  it("returns 0 for a zero total", () => {
    expect(getPointsForOrderTotal(0)).toBe(0);
  });

  it("clamps negative totals to 0", () => {
    expect(getPointsForOrderTotal(-50)).toBe(0);
    expect(getPointsForOrderTotal(-0.01)).toBe(0);
  });
});

describe("getNormalizedPointsCost", () => {
  it("returns the campaign pointsCost when set", () => {
    expect(getNormalizedPointsCost({ pointsCost: 250 })).toBe(250);
  });

  it("floors fractional costs", () => {
    expect(getNormalizedPointsCost({ pointsCost: 99.9 })).toBe(99);
  });

  it("treats missing campaign as cost 0", () => {
    expect(getNormalizedPointsCost(undefined)).toBe(0);
    expect(getNormalizedPointsCost(null)).toBe(0);
  });

  it("treats missing or NaN-ish pointsCost as 0", () => {
    expect(getNormalizedPointsCost({})).toBe(0);
    expect(getNormalizedPointsCost({ pointsCost: 0 })).toBe(0);
  });

  it("clamps negative costs to 0", () => {
    expect(getNormalizedPointsCost({ pointsCost: -10 })).toBe(0);
  });
});

describe("isPointRewardCampaignType", () => {
  it("accepts every point reward campaign type", () => {
    for (const type of POINT_REWARD_CAMPAIGN_TYPES) {
      expect(isPointRewardCampaignType(type)).toBe(true);
    }
  });

  it("rejects non point-reward campaign types", () => {
    expect(isPointRewardCampaignType("percentage")).toBe(false);
    expect(isPointRewardCampaignType("free_shipping")).toBe(false);
    expect(isPointRewardCampaignType("")).toBe(false);
  });

  it("rejects nullish and undefined values", () => {
    expect(isPointRewardCampaignType(undefined)).toBe(false);
    expect(isPointRewardCampaignType(null)).toBe(false);
  });
});
