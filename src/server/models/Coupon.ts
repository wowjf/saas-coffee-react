import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["percentage", "fixed", "free_delivery"], required: true },
    value: { type: Number, required: true },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    validFrom: { type: String, required: true },
    validUntil: { type: String, required: true },
    active: { type: Boolean, default: true },
    targetCategory: { type: String, default: "" },
    targetProductId: { type: String, default: "" },
    newUsersOnly: { type: Boolean, default: false },
    usedBy: [{ type: String }], // User IDs who used this coupon
  },
  { timestamps: true },
);

export type CouponDocument = mongoose.InferSchemaType<typeof CouponSchema> & mongoose.Document;

const CouponModel =
  (mongoose.models.Coupon as mongoose.Model<CouponDocument>) ||
  mongoose.model<CouponDocument>("Coupon", CouponSchema);

export default CouponModel;
