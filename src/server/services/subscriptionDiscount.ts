// B4: abonelik ayrıcalıklarının sipariş akışına uygulanması. Aktif aboneliğin
// plan discountPercent'i, sadakat/kupon indirimlerinden SONRA kalan tutara
// uygulanır (aynı birime binmez). MVP kapsamında yüzde indirimi gerçek
// davranışa bağlanır; freeDelivery/priorityQueue/exclusiveProducts bayrakları
// fiziksel teslimat olmadığından (barda teslim) işlemsel anlamları yoktur —
// panelde görünür bilgidir.
import SubscriptionModel from "../models/Subscription";
import { SubscriptionPlanModel } from "../models/Subscription";

export type SubscriptionDiscountResult = {
  discountTotal: number;
  discountPercent: number;
  planName: string;
};

export async function applySubscriptionDiscountToOrder(
  userId: string,
  remainingAmount: number,
): Promise<SubscriptionDiscountResult> {
  const noDiscount: SubscriptionDiscountResult = {
    discountTotal: 0,
    discountPercent: 0,
    planName: "",
  };

  if (remainingAmount <= 0) {
    return noDiscount;
  }

  const subscription = await SubscriptionModel.findOne({
    userId,
    status: "active",
    endDate: { $gte: new Date().toISOString().slice(0, 10) },
  });

  if (!subscription) {
    return noDiscount;
  }

  const plan = await SubscriptionPlanModel.findById(subscription.planId);

  if (!plan || !plan.active) {
    return noDiscount;
  }

  const discountPercent = Math.min(100, Math.max(0, Number(plan.discountPercent || 0)));

  if (discountPercent <= 0) {
    return noDiscount;
  }

  const discountTotal = Number((remainingAmount * (discountPercent / 100)).toFixed(2));

  return {
    discountTotal,
    discountPercent,
    planName: subscription.planName,
  };
}
