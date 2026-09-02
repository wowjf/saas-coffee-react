import mongoose from "mongoose";

// MP-2.12: code unique index zaten tanimli (unique: true + index: true).
// MP-2.14: value — percentage kuponlarda 0-100 arasi, fixed kuponlarda >= 0.
// MP-2.11: validFrom/validUntil YYYY-AA-GG... ISO bicim validator'i.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["percentage", "fixed", "free_delivery"], required: true },
    value: {
      type: Number,
      required: true,
      validate: {
        validator(this: { type: string }, v: number) {
          return this.type === "percentage" ? v >= 0 && v <= 100 : v >= 0;
        },
        message: "Kupon degeri yuzde tipinde 0-100, sabit tipte en az 0 olmalidir",
      },
    },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    validFrom: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => ISO_DATE_PATTERN.test(v),
        message: "validFrom YYYY-AA-GG biciminde olmalidir",
      },
    },
    validUntil: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => ISO_DATE_PATTERN.test(v),
        message: "validUntil YYYY-AA-GG biciminde olmalidir",
      },
    },
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
