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
