import mongoose from "mongoose";

// MP-2.12: sipariş listeleme profili için bileşik index (kullanıcı + durum + zaman).
// MP-2.14: total alt sınırı — negatif sipariş tutarı new-save'lerde reddedilir.
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
    // MP-2.14: adet pozitif tam sayi — 1.5 adet kahve new-save'lerde reddedilir.
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v: number) => Number.isInteger(v),
        message: "Urun adedi tam sayi olmalidir",
      },
    },
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
    total: { type: Number, required: true, min: 0 },
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
      couponId: { type: String, default: "" },
      code: { type: String, default: "" },
      discountAmount: { type: Number, default: 0 },
    },
    loyaltyProcessed: { type: Boolean, default: false },
    loyaltyPointsAwarded: { type: Number, default: 0 },
    // Damga sadakati: bu siparisle eklenen damga sayisi ((serializer
    // ayiklar; istemciye LoyaltySummary uzerinden tasinir).
    loyaltyStampCountAwarded: { type: Number, default: 0 },
    completedBy: {
      id: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    estimatedReadyTime: { type: String, default: "" },
    actualReadyTime: { type: String, default: "" },
  },
  { timestamps: true },
);

// MP-2.12: {userId:1, status:1, timestamp:-1} — "kullanıcının duruma göre
// sıralı siparişleri" sorgularını tek index ile karşılar.
OrderSchema.index({ userId: 1, status: 1, timestamp: -1 });

export type OrderDocument = mongoose.InferSchemaType<typeof OrderSchema> & mongoose.Document;

const OrderModel =
  (mongoose.models.Order as mongoose.Model<OrderDocument>) ||
  mongoose.model<OrderDocument>("Order", OrderSchema);

export default OrderModel;
