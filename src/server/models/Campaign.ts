import mongoose from "mongoose";

const CampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      default: "discount",
    },
    type: {
      type: String,
      required: true,
      default: "discount",
    },
    value: { type: Number, required: true, default: 0 },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    image: { type: String, default: "" },
    startDate: { type: String, required: true, default: "" },
    expiryDate: { type: String, required: true },
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

export type CampaignDocument = mongoose.InferSchemaType<typeof CampaignSchema> & mongoose.Document;

const CampaignModel =
  (mongoose.models.Campaign as mongoose.Model<CampaignDocument>) ||
  mongoose.model<CampaignDocument>("Campaign", CampaignSchema);

export default CampaignModel;
