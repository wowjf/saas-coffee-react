import { t } from "../shared/system-texts";
import type { Campaign } from "../types";

export const LOYALTY_POINTS_PER_COMPLETED_ITEM = 100;
export const LOYALTY_QR_TOKEN_TTL_SECONDS = 180;

export const POINT_REWARD_CAMPAIGN_TYPES = [
  "points_free_product",
  "points_discount_product",
  "point_reward",
] as const;

export type PointRewardCampaignType = (typeof POINT_REWARD_CAMPAIGN_TYPES)[number];

export function isPointRewardCampaignType(type: Campaign["type"] | string | undefined | null): type is PointRewardCampaignType {
  return type === "points_free_product" || type === "points_discount_product" || type === "point_reward";
}

export function getPointsForCompletedItemCount(itemCount: number) {
  return Math.max(0, itemCount) * LOYALTY_POINTS_PER_COMPLETED_ITEM;
}

export function getPointsForOrderTotal(orderTotal: number) {
  return Math.floor(Math.max(0, orderTotal) / 10);
}

export function getNormalizedPointsCost(campaign?: Pick<Campaign, "pointsCost"> | null) {
  return Math.max(0, Math.floor(campaign?.pointsCost || 0));
}
