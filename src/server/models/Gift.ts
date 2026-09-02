import mongoose from "mongoose";

const GiftSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    recipientId: { type: String, required: true, index: true },
    recipientName: { type: String, required: true },
    type: { type: String, enum: ["balance", "product"], required: true },
    amount: { type: Number, default: 0 },
    productId: { type: String, default: "" },
    productName: { type: String, default: "" },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "claimed", "expired"], default: "pending" },
    sentAt: { type: String, required: true },
    claimedAt: { type: String, default: "" },
    expiresAt: { type: String, required: true },
  },
  { timestamps: true },
);

GiftSchema.index({ recipientId: 1, status: 1 });
GiftSchema.index({ senderId: 1, createdAt: -1 });

export type GiftDocument = mongoose.InferSchemaType<typeof GiftSchema> & mongoose.Document;

const GiftModel =
  (mongoose.models.Gift as mongoose.Model<GiftDocument>) ||
  mongoose.model<GiftDocument>("Gift", GiftSchema);

export default GiftModel;
