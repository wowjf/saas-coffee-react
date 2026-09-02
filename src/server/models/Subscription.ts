import mongoose from "mongoose";

// MP-2.11: abonelik tarih alanlari ISO string olarak saklanir; validator
// bicimi garanti eder (server-side uretilir, istemciden gelmez).
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    duration: { type: String, enum: ["monthly", "yearly"], required: true },
    benefits: [{ type: String }],
    discountPercent: { type: Number, default: 0 },
    freeDelivery: { type: Boolean, default: false },
    priorityQueue: { type: Boolean, default: false },
    exclusiveProducts: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    status: { type: String, enum: ["active", "cancelled", "expired"], default: "active" },
    startDate: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => ISO_DATE_PATTERN.test(v),
        message: "startDate ISO tarih biciminde olmalidir",
      },
    },
    endDate: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => ISO_DATE_PATTERN.test(v),
        message: "endDate ISO tarih biciminde olmalidir",
      },
    },
    autoRenew: { type: Boolean, default: true },
    cancelledAt: {
      type: String,
      default: "",
      validate: {
        validator: (v: string) => v === "" || ISO_DATE_PATTERN.test(v),
        message: "cancelledAt ISO tarih biciminde olmalidir",
      },
    },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ userId: 1, status: 1 });

export type SubscriptionPlanDocument = mongoose.InferSchemaType<typeof SubscriptionPlanSchema> & mongoose.Document;
export type SubscriptionDocument = mongoose.InferSchemaType<typeof SubscriptionSchema> & mongoose.Document;

const SubscriptionPlanModel =
  (mongoose.models.SubscriptionPlan as mongoose.Model<SubscriptionPlanDocument>) ||
  mongoose.model<SubscriptionPlanDocument>("SubscriptionPlan", SubscriptionPlanSchema);

const SubscriptionModel =
  (mongoose.models.Subscription as mongoose.Model<SubscriptionDocument>) ||
  mongoose.model<SubscriptionDocument>("Subscription", SubscriptionSchema);

export { SubscriptionPlanModel };
export default SubscriptionModel;
