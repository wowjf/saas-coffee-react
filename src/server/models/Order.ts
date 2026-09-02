import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      id: { type: String, default: "" },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      category: { type: String, required: true },
      image: { type: String, default: "" },
      ingredients: [{ type: String }],
      inStock: { type: Boolean, default: true },
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    tableNumber: { type: String, default: "" },
    tableSessionToken: { type: String, default: "", index: true },
    items: { type: [OrderItemSchema], required: true, default: [] },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "completed", "rejected"],
      default: "pending",
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    appliedCampaign: {
      campaignId: { type: String, default: "" },
      campaignTitle: { type: String, default: "" },
      campaignType: {
        type: String,
        enum: ["", "points_free_product", "points_discount_product"],
        default: "",
      },
      discountAmount: { type: Number, default: 0 },
      discountPercent: { type: Number, default: 0 },
      appliedQuantity: { type: Number, default: 0 },
      expiresAt: { type: String, default: "" },
    },
    appliedCoupon: {
      code: { type: String, default: "" },
      discountAmount: { type: Number, default: 0 },
    },
    loyaltyProcessed: { type: Boolean, default: false },
    loyaltyPointsAwarded: { type: Number, default: 0 },
    completedBy: {
      id: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    estimatedReadyTime: { type: String, default: "" },
    actualReadyTime: { type: String, default: "" },
  },
  { timestamps: true },
);

export type OrderDocument = mongoose.InferSchemaType<typeof OrderSchema> & mongoose.Document;

const OrderModel =
  (mongoose.models.Order as mongoose.Model<OrderDocument>) ||
  mongoose.model<OrderDocument>("Order", OrderSchema);

export default OrderModel;
