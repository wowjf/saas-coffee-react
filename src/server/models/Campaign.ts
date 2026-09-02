import mongoose from "mongoose";

// MP-2.12: aktif kampanya listelemeleri (active) + kategori filtreleri (category).
// MP-2.14: type/category enum — frontend CampaignType/CampaignCategory ile eşleşir.
// MP-2.11: startDate/expiryDate YYYY-AA-GG validator'ı ile normalize edilir.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const CampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      default: "discount",
      enum: ["discount", "balance", "loyalty", "financial", "operational", "personalization"],
    },
    type: {
      type: String,
      required: true,
      default: "discount",
      enum: [
        "discount",
        "balance_bonus",
        "point_reward",
        "points_free_product",
        "points_discount_product",
        "fixed_bonus",
        "referral",
        "stamp_card",
        "combo",
        "limited_stock",
        "happy_hour",
        "early_bird",
        "night_owl",
        "we_miss_you",
        "birthday",
        "vip",
      ],
    },
    value: { type: Number, required: true, default: 0 },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    image: { type: String, default: "" },
    startDate: {
      type: String,
      required: true,
      default: "",
      validate: {
        validator: (v: string) => v === "" || DATE_ONLY_PATTERN.test(v),
        message: "startDate YYYY-AA-GG biciminde olmalidir",
      },
    },
    expiryDate: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => DATE_ONLY_PATTERN.test(v),
        message: "expiryDate YYYY-AA-GG biciminde olmalidir",
      },
    },
    active: { type: Boolean, default: true },
    minLoadAmount: { type: Number, default: 0 },
    minOrderAmount: { type: Number, default: 0 },
    fixedGiftAmount: { type: Number, default: 0 },
    pointsCost: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 1 },
    validityHours: { type: Number, default: 24 },
    targetType: { type: String, enum: ["all", "category", "product"], default: "all" },
    targetCategory: { type: String, default: "" },
    targetProductId: { type: String, default: "" },
    comboProducts: [{ type: String }],
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    targetDays: { type: Number, default: 0 },
    vipThreshold: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// MP-2.12: aktif kampanya okumaları kategori sırasıyla.
CampaignSchema.index({ active: 1, category: 1 });

export type CampaignDocument = mongoose.InferSchemaType<typeof CampaignSchema> & mongoose.Document;

const CampaignModel =
  (mongoose.models.Campaign as mongoose.Model<CampaignDocument>) ||
  mongoose.model<CampaignDocument>("Campaign", CampaignSchema);

export default CampaignModel;
