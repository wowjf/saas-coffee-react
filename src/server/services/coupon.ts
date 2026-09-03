import CouponModel from "../models/Coupon";
import OrderModel from "../models/Order";
import { getSystemText } from "./systemTexts";

export type CouponType = "percentage" | "fixed";

export interface CouponDiscountInput {
  type: CouponType | string;
  value: number;
  maxDiscount?: number;
}

/**
 * Pure discount calculation shared by the coupon routes. Kept side-effect free
 * so it can be unit tested without a database or Express context.
 */
export function calculateCouponDiscount(coupon: CouponDiscountInput, orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal < 0) {
    return 0;
  }

  let discountAmount = 0;

  if (coupon.type === "percentage") {
    discountAmount = (orderTotal * coupon.value) / 100;
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  } else if (coupon.type === "fixed") {
    discountAmount = coupon.value;
  }

  // Never discount more than the order total, and round to 2 decimals.
  discountAmount = Math.min(discountAmount, orderTotal);
  return Math.round(discountAmount * 100) / 100;
}

export type CouponRedeemResult =
  | { status: "applied"; couponId: string; code: string; discountAmount: number }
  | { status: "rejected"; reason: string };

/**
 * Siparis olusturma aninda kuponu dogrular ve ATOMIK sekilde kullanimi
 * isaretler. onceki /coupons/:id/use akisindan farki: kullanici ID'yi
 * degil kodu verir ve isaretleme ile birlikte indirim tutari doner —
 * boylece "kupon harcandi ama indirim uygulanmadi" yarisi imkansiz.
 *
 * MP-2.15 deseni: kosullu findOneAndUpdate — kullanici zaten kullandiysa,
 * limit dolduysa veya sure gectiyse filtre eslesmez, hicbir yan etki olmaz.
 */
export async function redeemCouponForOrder(
  userId: string,
  couponCode: string,
  orderTotal: number,
): Promise<CouponRedeemResult> {
  const code = couponCode.trim().toUpperCase();
  const coupon = await CouponModel.findOne({ code, active: true });

  if (!coupon) {
    return { status: "rejected", reason: await getSystemText("gecersiz-kupon-kodu") };
  }

  const now = new Date().toISOString();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return { status: "rejected", reason: await getSystemText("kupon-suresi-gecerli-degil") };
  }

  if (coupon.minOrderAmount > 0 && orderTotal < coupon.minOrderAmount) {
    return { status: "rejected", reason: `Minimum sipariş tutarı ${coupon.minOrderAmount} TL olmalıdır.` };
  }

  if (coupon.newUsersOnly) {
    const userOrderCount = await OrderModel.countDocuments({ userId, status: "completed" });
    if (userOrderCount > 0) {
      return { status: "rejected", reason: await getSystemText("bu-kupon-sadece-yeni-kullanicilar-icindir") };
    }
  }

  const discountAmount = calculateCouponDiscount(
    { type: coupon.type, value: coupon.value, maxDiscount: coupon.maxDiscount },
    orderTotal,
  );

  if (discountAmount <= 0) {
    return { status: "rejected", reason: await getSystemText("kupon-bu-siparise-uygulanamaz") };
  }

  const updated = await CouponModel.findOneAndUpdate(
    {
      _id: coupon._id,
      active: true,
      usedBy: { $ne: userId },
      $expr: {
        $or: [
          { $eq: ["$usageLimit", 0] },
          { $lt: ["$usedCount", "$usageLimit"] },
        ],
      },
    },
    {
      $inc: { usedCount: 1 },
      $addToSet: { usedBy: userId },
    },
    { new: true },
  );

  if (!updated) {
    if (coupon.usedBy?.includes(userId)) {
      return { status: "rejected", reason: await getSystemText("bu-kuponu-daha-once-kullandiniz") };
    }
    return { status: "rejected", reason: await getSystemText("kupon-kullanim-limiti-doldu") };
  }

  return {
    status: "applied",
    couponId: updated._id.toString(),
    code: updated.code,
    discountAmount,
  };
}

/**
 * Siparis reddedilince kupon kullanimi geri alinir (usedCount geri, usedBy'dan
 * cikar). Siparişi olusturan kupon bilgisi Order belgesinde tasindigi icin
 * iade idempotent olur: kullanici tekrar ayni kodu kullanabilir.
 */
export async function refundCouponUsage(couponId: string, userId: string): Promise<void> {
  await CouponModel.updateOne(
    { _id: couponId, usedBy: userId },
    {
      $inc: { usedCount: -1 },
      $pull: { usedBy: userId },
    },
  );
}
