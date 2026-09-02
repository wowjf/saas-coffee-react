import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    productId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    staffRating: { type: Number, min: 1, max: 5, default: null },
    staffComment: { type: String, default: "" },
    response: { type: String, default: "" },
    respondedBy: { type: String, default: "" },
    respondedAt: { type: String, default: "" },
  },
  { timestamps: true },
);

ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });

// MP-2.12: bir sipariş için yalnızca bir gerçek (comment'i dolu) review
// yazılabilir; comment'i boş kayıtlar (iskelet/placeholder) index dışıdır.
ReviewSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { comment: { $gt: "" } } }
);

export type ReviewDocument = mongoose.InferSchemaType<typeof ReviewSchema> & mongoose.Document;

const ReviewModel =
  (mongoose.models.Review as mongoose.Model<ReviewDocument>) ||
  mongoose.model<ReviewDocument>("Review", ReviewSchema);

export default ReviewModel;
