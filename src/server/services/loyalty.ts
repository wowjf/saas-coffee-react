import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import type { Campaign, LoyaltyRewardCampaign, LoyaltySummary } from "../../types";
import {
  getNormalizedPointsCost,
  getPointsForCompletedItemCount,
  isPointRewardCampaignType,
  LOYALTY_QR_TOKEN_TTL_SECONDS,
  POINT_REWARD_CAMPAIGN_TYPES,
} from "../../lib/loyalty";
import { isCampaignScheduledActive } from "../../lib/campaignSchedule";
import CampaignModel from "../models/Campaign";
import OrderModel, { type OrderDocument } from "../models/Order";
import ProductModel, { type ProductDocument } from "../models/Product";
import UserModel, { type UserDocument } from "../models/User";
import { serializeDocument } from "../utils";
import { getSystemText } from "./systemTexts";

type LoyaltyQrTokenPayload = {
  purpose: "loyalty";
  userId: string;
};

function getLoyaltyJwtSecret() {
  return process.env.JWT_SECRET!;
}

export function isCampaignActive(campaign: Campaign | null) {
  return isCampaignScheduledActive(campaign);
}

function isPointRewardCampaign(campaign: Campaign | null): campaign is Campaign {
  return (
    !!campaign &&
    (campaign.category === "loyalty" || isPointRewardCampaignType(campaign.type)) &&
    isCampaignActive(campaign)
  );
}

function getCampaignUsageLimit(campaign: Pick<Campaign, "usageLimit">) {
  return Math.max(1, Math.floor(campaign.usageLimit || 1));
}

function getCampaignValidityHours(campaign: Pick<Campaign, "validityHours">) {
  return Math.max(1, Math.floor(campaign.validityHours || 24));
}

export function getValidActivePointReward(user: Pick<UserDocument, "activePointReward">) {
  const reward = user.activePointReward;

  if (!reward || !reward.expiresAt) {
    return null;
  }

  return new Date(reward.expiresAt).getTime() > Date.now() ? reward : null;
}

export async function clearExpiredActivePointReward(user: UserDocument) {
  if (!user.activePointReward) {
    return false;
  }

  if (getValidActivePointReward(user)) {
    return false;
  }

  user.activePointReward = null;
  await user.save();
  return true;
}

async function getActivePointRewardCampaigns() {
  const campaignDocuments = await CampaignModel.find({
    active: true,
    $or: [
      { category: "loyalty" },
      { type: { $in: Array.from(POINT_REWARD_CAMPAIGN_TYPES) } },
    ],
  }).sort({ createdAt: 1 });

  return campaignDocuments
    .map((document) => serializeDocument(document) as Campaign)
    .filter((campaign) => isPointRewardCampaign(campaign) && getNormalizedPointsCost(campaign) > 0);
}

async function buildRewardCampaigns(
  campaigns: Campaign[],
  pointsBalance: number,
  activePointReward: ReturnType<typeof getValidActivePointReward>,
): Promise<LoyaltyRewardCampaign[]> {
  const productIds = [...new Set(campaigns.map((campaign) => campaign.targetProductId).filter(Boolean))];
  const productMap = new Map<string, string>();

  if (productIds.length > 0) {
    const products = await ProductModel.find({ _id: { $in: productIds } }).select({ name: 1 });

    products.forEach((product) => {
      productMap.set(product._id.toString(), product.name);
    });
  }

  return campaigns.map((campaign) => {
    const pointsCost = getNormalizedPointsCost(campaign);
    const remainingPoints = Math.max(0, pointsCost - pointsBalance);
    const targetCategory = campaign.targetCategory || undefined;
    const targetProductId = campaign.targetProductId || undefined;
    const targetProductName = targetProductId ? productMap.get(targetProductId) : undefined;
    const rewardType = (campaign.type === "points_discount_product" || (campaign.value && campaign.value > 0 && campaign.value < 100)) ? "discount_product" : "free_product";
    const discountPercent = rewardType === "discount_product" ? Math.max(0, campaign.value || 0) : undefined;
    const rewardLabel =
      rewardType === "discount_product"
        ? `${discountPercent || 0}% indirim${
            targetProductName ? ` - ${targetProductName}` : targetCategory ? ` - ${targetCategory} kategorisi` : ""
          }`
        : `${targetProductName || "Secili urun"} ucretsiz`;

    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      campaignDescription: campaign.description,
      rewardType,
      rewardLabel,
      pointsCost,
      remainingPoints,
      isEligible: remainingPoints === 0 && !activePointReward,
      usageLimit: getCampaignUsageLimit(campaign),
      validityHours: getCampaignValidityHours(campaign),
      targetCategory,
      targetProductId,
      targetProductName,
      discountPercent,
    };
  });
}

export async function buildLoyaltySummary(
  user: Pick<UserDocument, "points" | "activePointReward">,
): Promise<LoyaltySummary> {
  const pointsBalance = Math.max(0, user.points || 0);
  const campaigns = await getActivePointRewardCampaigns();
  const activePointReward = getValidActivePointReward(user);

  return {
    pointsBalance,
    availableRewards: await buildRewardCampaigns(campaigns, pointsBalance, activePointReward),
    activePointReward,
  };
}

export function createLoyaltyQrToken(userId: string) {
  const expiresIn = LOYALTY_QR_TOKEN_TTL_SECONDS;
  const token = jwt.sign({ purpose: "loyalty", userId } satisfies LoyaltyQrTokenPayload, getLoyaltyJwtSecret(), {
    expiresIn,
  });

  return {
    token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function resolveLoyaltyToken(token: string) {
  // MP-1.5: algoritma sabitlenir — token başlığındaki "alg" claim'ine güvenilmez.
  const decoded = jwt.verify(token, getLoyaltyJwtSecret(), {
    algorithms: ["HS256"],
  }) as LoyaltyQrTokenPayload;

  if (decoded.purpose !== "loyalty") {
    throw new Error(await getSystemText("gecersiz-sadakat-qr-kodu"));
  }

  const user = await UserModel.findById(decoded.userId);

  if (!user) {
    throw new Error(await getSystemText("musteri-bulunamadi"));
  }

  if (user.role !== "customer") {
    throw new Error(await getSystemText("bu-qr-kodu-bir-musteri-hesabina-ait-degil"));
  }

  return user;
}

export async function applyCompletedOrderLoyalty(order: OrderDocument) {
  if (order.loyaltyProcessed) {
    return {
      pointsAwarded: order.loyaltyPointsAwarded || 0,
    };
  }

  const user = await UserModel.findById(order.userId);

  if (!user || user.role !== "customer") {
    return {
      pointsAwarded: 0,
    };
  }

  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const pointsAwarded = Math.max(
    getPointsForCompletedItemCount(itemCount),
    Math.floor(Math.max(0, order.total || 0) / 10)
  );

  if (pointsAwarded > 0) {
    user.points = Math.max(0, (user.points || 0) + pointsAwarded);
    await user.save();
  }

  order.loyaltyProcessed = true;
  order.loyaltyPointsAwarded = pointsAwarded;
  await order.save();

  return {
    pointsAwarded,
  };
}

export async function buildLoyaltyScanResult(user: UserDocument) {
  await clearExpiredActivePointReward(user);

  return {
    customer: {
      id: user._id.toString(),
      name: `${user.name} ${user.surname}`.trim(),
      email: user.email,
    },
    summary: await buildLoyaltySummary(user),
    scannedAt: new Date().toISOString(),
  };
}

export async function applyActivePointRewardToOrder(
  user: UserDocument,
  items: Array<{
    product: {
      id: string;
      price: number;
      category: string;
    };
    quantity: number;
  }>,
) {
  await clearExpiredActivePointReward(user);

  const activePointReward = getValidActivePointReward(user);

  if (
    !activePointReward ||
    activePointReward.campaignType !== "points_discount_product" ||
    (!activePointReward.targetProductId && !activePointReward.targetCategory) ||
    activePointReward.remainingUses < 1
  ) {
    return {
      discountTotal: 0,
      appliedCampaign: undefined,
    };
  }

  const clampedDiscountPercent = Math.min(100, Math.max(0, activePointReward.discountPercent || 0));

  if (clampedDiscountPercent <= 0) {
    return {
      discountTotal: 0,
      appliedCampaign: undefined,
    };
  }

  let discountTotal = 0;
  let appliedQuantity = 0;
  let remainingUses = activePointReward.remainingUses;

  items.forEach((item) => {
    const matchesProduct = !!activePointReward.targetProductId && item.product.id === activePointReward.targetProductId;
    const matchesCategory = !!activePointReward.targetCategory && item.product.category === activePointReward.targetCategory;

    if ((!matchesProduct && !matchesCategory) || remainingUses < 1) {
      return;
    }

    const discountedQuantity = Math.min(item.quantity, remainingUses);
    const unitDiscount = Number((item.product.price * (clampedDiscountPercent / 100)).toFixed(2));
    discountTotal += unitDiscount * discountedQuantity;
    appliedQuantity += discountedQuantity;
    remainingUses -= discountedQuantity;
  });

  if (appliedQuantity < 1) {
    return {
      discountTotal: 0,
      appliedCampaign: undefined,
    };
  }

  user.activePointReward = {
    ...activePointReward,
    remainingUses,
  };
  user.markModified("activePointReward");

  return {
    discountTotal: Number(discountTotal.toFixed(2)),
    appliedCampaign: {
      campaignId: activePointReward.campaignId,
      campaignTitle: activePointReward.campaignTitle,
      campaignType: activePointReward.campaignType,
      discountAmount: Number(discountTotal.toFixed(2)),
      discountPercent: clampedDiscountPercent,
      appliedQuantity,
      expiresAt: activePointReward.expiresAt,
    },
  };
}

export async function redeemPointCampaign(user: UserDocument, campaignId: string) {
  if (!isValidObjectId(campaignId)) {
    throw new Error(await getSystemText("gecerli-bir-puan-kampanyasi-secilmedi"));
  }

  await clearExpiredActivePointReward(user);

  const activePointReward = getValidActivePointReward(user);

  if (activePointReward) {
    throw new Error(
      `${activePointReward.campaignTitle} kampanyasi ${
        new Date(activePointReward.expiresAt).toLocaleString("tr-TR")
      } tarihine kadar aktif. Bu sure dolmadan yeni kampanya kullanilamaz.`,
    );
  }

  const selectedCampaign = user.selectedCampaign;
  const isPreSelected = !!(selectedCampaign && selectedCampaign.campaignId === campaignId);

  if (isPreSelected && selectedCampaign && new Date(selectedCampaign.expiresAt).getTime() <= Date.now()) {
    throw new Error(await getSystemText("secili-kampanyanin-suresi-dolmus"));
  }

  const campaignDocument = await CampaignModel.findById(campaignId);

  if (!campaignDocument) {
    throw new Error(await getSystemText("puan-kampanyasi-bulunamadi"));
  }

  const campaign = serializeDocument(campaignDocument) as Campaign;

  if (!isPointRewardCampaign(campaign)) {
    throw new Error(await getSystemText("secilen-puan-kampanyasi-aktif-degil"));
  }

  const pointsCost = getNormalizedPointsCost(campaign);

  if (pointsCost <= 0) {
    throw new Error(await getSystemText("secilen-puan-kampanyasinin-puan-bedeli-tanimli-degil"));
  }

  if ((user.points || 0) < pointsCost) {
    throw new Error(await getSystemText("bu-kampanya-icin-yeterli-puan-yok"));
  }

  if (!campaign.targetProductId || !isValidObjectId(campaign.targetProductId)) {
    if (campaign.type === "points_free_product") {
      throw new Error(await getSystemText("ucretsiz-urun-kampanyasinda-hedef-urun-secilmelidir"));
    }
  }

  let product: ProductDocument | null = null;

  if (campaign.targetProductId && isValidObjectId(campaign.targetProductId)) {
    product = await ProductModel.findById(campaign.targetProductId);

    if (!product) {
      throw new Error(await getSystemText("kampanya-urunu-bulunamadi"));
    }

    if (!product.inStock) {
      throw new Error(await getSystemText("kampanya-urunu-su-an-stokta-degil"));
    }
  }

  const usageLimit = getCampaignUsageLimit(campaign);
  const validityHours = getCampaignValidityHours(campaign);
  const redeemedAt = new Date();
  const expiresAt = new Date(redeemedAt.getTime() + validityHours * 60 * 60 * 1000).toISOString();
  const campaignType = campaign.type === "points_discount_product" ? "points_discount_product" : "points_free_product";
  const discountPercent =
    campaignType === "points_discount_product" ? Math.min(100, Math.max(0, campaign.value || 0)) : 100;

  user.points = Math.max(0, (user.points || 0) - pointsCost);

  let order: OrderDocument | null = null;
  let remainingUses = usageLimit;

  if (campaign.type === "points_free_product") {
    if (!product) {
      throw new Error(await getSystemText("ucretsiz-urun-kampanyasi-icin-hedef-urun-bulunamadi"));
    }

    order = await OrderModel.create({
      userId: user._id.toString(),
      userName: `${user.name} ${user.surname}`.trim(),
      items: [
        {
          product: {
            id: product._id.toString(),
            name: product.name,
            price: product.price,
            category: product.category,
            image: product.image,
            ingredients: product.ingredients,
            inStock: product.inStock,
          },
          quantity: usageLimit,
        },
      ],
      total: 0,
      status: "preparing",
      timestamp: redeemedAt,
      note: `${campaign.title} kampanyasi otomatik hazirlaniyor.`,
      cancelReason: "",
      appliedCampaign: {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        campaignType,
        discountAmount: Number((product.price * usageLimit).toFixed(2)),
        discountPercent: 100,
        appliedQuantity: usageLimit,
        expiresAt,
      },
      loyaltyProcessed: true,
      loyaltyPointsAwarded: 0,
    });

    remainingUses = 0;
  }

  user.activePointReward = {
    redemptionId: randomUUID(),
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    campaignType,
    targetCategory: campaign.targetCategory || "",
    targetProductId: product?._id.toString() || "",
    targetProductName: product?.name || "",
    pointsCost,
    discountPercent,
    usageLimit,
    remainingUses,
    redeemedAt: redeemedAt.toISOString(),
    expiresAt,
    autoOrderId: order?._id.toString() || "",
  };

  if (isPreSelected) {
    user.selectedCampaign = null;
  }

  await user.save();

  return {
    campaign,
    order,
    activePointReward: user.activePointReward,
  };
}
