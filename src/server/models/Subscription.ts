import mongoose from "mongoose";

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
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    autoRenew: { type: Boolean, default: true },
    cancelledAt: { type: String, default: "" },
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
