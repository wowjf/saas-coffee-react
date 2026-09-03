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
  // MP-2.1 uyumu: sadakat QR'ı da oturum JWT'si gibi tokenVersion taşır;
  // parola değişimi/logout/rol düşürme aktif QR'yı da düşürer.
  tokenVersion?: number;
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

async function getActiveStampCampaign(): Promise<Campaign | null> {
  const documents = await CampaignModel.find({ active: true, type: "stamp_card" }).sort({ createdAt: 1 });

  for (const document of documents) {
    const campaign = serializeDocument(document) as Campaign;

    if (isCampaignActive(campaign)) {
      return campaign;
    }
  }

  return null;
}

function getStampRequiredQuantity(campaign: Pick<Campaign, "requiredQuantity">) {
  return Math.max(1, Math.floor(campaign.requiredQuantity || 1));
}

export async function buildLoyaltySummary(
  user: Pick<UserDocument, "points" | "activePointReward"> & {
    loyaltyStampProgress?: number;
    loyaltyRewardCredits?: number;
  },
): Promise<LoyaltySummary> {
  const pointsBalance = Math.max(0, user.points || 0);
  const campaigns = await getActivePointRewardCampaigns();
  const activePointReward = getValidActivePointReward(user);

  const stampCampaign = await getActiveStampCampaign();
  const stampStatus = stampCampaign
    ? (() => {
        const requiredQuantity = getStampRequiredQuantity(stampCampaign);
        const currentProgress = Math.max(0, Math.floor(user.loyaltyStampProgress || 0));
        const rewardCredits = Math.max(0, Math.floor(user.loyaltyRewardCredits || 0));

        return {
          campaignId: stampCampaign.id,
          campaignTitle: stampCampaign.title,
          requiredQuantity,
          currentProgress: Math.min(currentProgress, requiredQuantity),
          remainingToReward: Math.max(0, requiredQuantity - currentProgress),
          rewardCredits,
          targetProductId: stampCampaign.targetProductId || undefined,
        };
      })()
    : null;

  return {
    pointsBalance,
    availableRewards: await buildRewardCampaigns(campaigns, pointsBalance, activePointReward),
    activePointReward,
    stampStatus,
    // pointsRewardCredits: aktif damga kampanyasindan kazanilan hazir haklar.
    pointsRewardCredits: stampStatus ? stampStatus.rewardCredits : 0,
  };
}

export function createLoyaltyQrToken(userId: string, tokenVersion = 0) {
  const expiresIn = LOYALTY_QR_TOKEN_TTL_SECONDS;
  const token = jwt.sign(
    { purpose: "loyalty", userId, tokenVersion } satisfies LoyaltyQrTokenPayload,
    getLoyaltyJwtSecret(),
    { expiresIn },
  );

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

  // MP-2.1: token iptal edilmişse (parola değişimi/logout) sadakat QR'ı da
  // reddedilir. Versiyonsuz eski token'lar 0 kabul edilerek geriye dönük
  // uyumludur — JWT doğrulamasındaki desenle aynı.
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new Error(await getSystemText("gecersiz-sadakat-qr-kodu"));
  }

  return user;
}

async function awardStampsForOrder(order: OrderDocument) {
  const stampCampaign = await getActiveStampCampaign();

  if (!stampCampaign) {
    return { stampCountAwarded: 0, rewardCreditsEarned: 0 };
  }

  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const requiredQuantity = getStampRequiredQuantity(stampCampaign);
  const stampCountAwarded = Math.max(0, itemCount);

  if (stampCountAwarded < 1) {
    return { stampCountAwarded: 0, rewardCreditsEarned: 0 };
  }

  // Damga ekleme atomik $inc ile yapilir; esik kontrolu ve hak verişi
  // ayri bir kosullu update'te — esige ulasan her turda progress
  // requiredQuantity kadar dusurulur ve hak +1 artar.
  await UserModel.updateOne({ _id: order.userId }, { $inc: { loyaltyStampProgress: stampCountAwarded } });

  const stampUser = await UserModel.findById(order.userId);

  if (!stampUser) {
    return { stampCountAwarded, rewardCreditsEarned: 0 };
  }

  let rewardCreditsEarned = 0;
  let progress = Math.max(0, stampUser.loyaltyStampProgress || 0);

  while (progress >= requiredQuantity) {
    const cycled = await UserModel.findOneAndUpdate(
      { _id: order.userId, loyaltyStampProgress: { $gte: requiredQuantity } },
      {
        $inc: {
          loyaltyStampProgress: -requiredQuantity,
          loyaltyRewardCredits: 1,
        },
      },
      { new: true },
    );

    if (!cycled) {
      break;
    }

    rewardCreditsEarned += 1;
    progress = Math.max(0, cycled.loyaltyStampProgress || 0);
  }

  return { stampCountAwarded, rewardCreditsEarned };
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

  // MP-2.15: isaretleme tek kosullu atomik update'te — iki eszamanli
  // tamamlama istegi puani/damgayi iki kez veremez (guard sorgunun
  // kendisinde). Damga (stamp) kazanimi da ayni guard'in arkasindadir.
  const markedOrder = await OrderModel.findOneAndUpdate(
    { _id: order._id, loyaltyProcessed: { $ne: true } },
    { $set: { loyaltyProcessed: true, loyaltyPointsAwarded: pointsAwarded } },
    { new: true },
  );

  if (!markedOrder) {
    return {
      pointsAwarded: order.loyaltyPointsAwarded || 0,
    };
  }

  if (pointsAwarded > 0) {
    await UserModel.updateOne({ _id: order.userId }, { $inc: { points: pointsAwarded } });
  }

  const stampResult = await awardStampsForOrder(order);

  order.loyaltyProcessed = true;
  order.loyaltyPointsAwarded = pointsAwarded;
  order.loyaltyStampCountAwarded = stampResult.stampCountAwarded;
  await order.save();

  return {
    pointsAwarded,
    stampCountAwarded: stampResult.stampCountAwarded,
    rewardCreditsEarned: stampResult.rewardCreditsEarned,
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

  // MP-2.15: remainingUses read-modify-write save() yerine koşullu atomik
  // findOneAndUpdate ile düşürülür — sorgudaki guard, iki eşzamanlı siparişin
  // aynı hak üzerinde çift harcama yapmasını (lost-update) engeller.
  const atomicallyUpdatedUser = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      "activePointReward.redemptionId": activePointReward.redemptionId,
      "activePointReward.remainingUses": activePointReward.remainingUses,
    },
    { $set: { "activePointReward.remainingUses": remainingUses } },
    { new: true },
  );

  if (!atomicallyUpdatedUser) {
    // Hak arada değişti (süresi doldu / başka sipariş tüketti) — indirim
    // uygulanmaz, sipariş kampanyasız devam eder.
    return {
      discountTotal: 0,
      appliedCampaign: undefined,
    };
  }

  user.activePointReward = atomicallyUpdatedUser.activePointReward;

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

export async function applyStampRewardCreditsToOrder(
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
  const credits = Math.max(0, Math.floor(user.loyaltyRewardCredits || 0));

  if (credits < 1) {
    return { discountTotal: 0, creditsUsed: 0 };
  }

  const stampCampaign = await getActiveStampCampaign();

  if (!stampCampaign) {
    return { discountTotal: 0, creditsUsed: 0 };
  }

  const targetProductId = stampCampaign.targetProductId || "";
  const targetCategory = stampCampaign.targetCategory || "";
  const hasTarget = !!(targetProductId || targetCategory);

  if (!hasTarget) {
    // Hedef tanimsizsa hak harcanamaz — kampanya yanlis yapilandirilmis;
    // musterinin hakki yanmamasi icin sessizce atlanir.
    return { discountTotal: 0, creditsUsed: 0 };
  }

  let creditsAvailable = credits;
  let discountTotal = 0;
  let creditsUsed = 0;

  // En ucuz eslesen urunden baslanir — ayni hak sayisiyla musterinin
  // avantaji maksimum indirimde degil, hak verimliliginde tutulur: her hak
  // tek birim urunu bedavalarken once ucuz birimler bedavalanir (pahali
  // birimler odemede kalir, toplam indirim minimize edilmez — isletme
  // tarafinda guvenli yon).
  const matchingUnits = items
    .flatMap((item) => {
      const matchesProduct = !!targetProductId && item.product.id === targetProductId;
      const matchesCategory = !!targetCategory && item.product.category === targetCategory;
      const matches = targetProductId ? matchesProduct : matchesCategory;

      return matches
        ? Array.from({ length: item.quantity }, () => item.product.price)
        : [];
    })
    .sort((a, b) => a - b);

  for (const unitPrice of matchingUnits) {
    if (creditsAvailable < 1) {
      break;
    }

    discountTotal += unitPrice;
    creditsUsed += 1;
    creditsAvailable -= 1;
  }

  if (creditsUsed < 1) {
    return { discountTotal: 0, creditsUsed: 0 };
  }

  // MP-2.15 deseni: hak dusme kosullu atomik — baska bir eszamanli siparis
  // ayni haklari ikinci kez harcayamaz (guard sorguda).
  const spentUser = await UserModel.findOneAndUpdate(
    { _id: user._id, loyaltyRewardCredits: { $gte: creditsUsed } },
    { $inc: { loyaltyRewardCredits: -creditsUsed } },
    { new: true },
  );

  if (!spentUser) {
    return { discountTotal: 0, creditsUsed: 0 };
  }

  user.loyaltyRewardCredits = spentUser.loyaltyRewardCredits;

  return {
    discountTotal: Number(discountTotal.toFixed(2)),
    creditsUsed,
    stampCampaignId: stampCampaign.id,
    stampCampaignTitle: stampCampaign.title,
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

  const nextActivePointReward = {
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

  // MP-2.15: puan düşme + aktif hak yazma tek koşullu atomik update'te
  // birleşir. Guard'lar: puan hâlâ yeterli VEYA hak zaten bu kullanıcıda
  // yok (yarışta ikinci istek reddedilir, puan iki kez düşmez).
  const redeemSet: Record<string, unknown> = {
    activePointReward: nextActivePointReward,
  };
  if (isPreSelected) {
    redeemSet.selectedCampaign = null;
  }
  const redeemUpdate: Record<string, unknown> = {
    $set: redeemSet,
  };

  const redeemedUser = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      points: { $gte: pointsCost },
      $or: [
        { activePointReward: null },
        { activePointReward: { $exists: false } },
        { "activePointReward.expiresAt": { $lte: new Date().toISOString() } },
      ],
    },
    {
      ...redeemUpdate,
      // Puan 0'ın altına düşmez; negatif $inc guard'ın $gte koşuluyla imkânsız.
      $inc: { points: -pointsCost },
    },
    { new: true },
  );

  if (!redeemedUser) {
    throw new Error(await getSystemText("bu-kampanya-icin-yeterli-puan-yok"));
  }

  user.points = redeemedUser.points;
  user.activePointReward = redeemedUser.activePointReward;
  user.selectedCampaign = redeemedUser.selectedCampaign;

  return {
    campaign,
    order,
    activePointReward: user.activePointReward,
  };
}
