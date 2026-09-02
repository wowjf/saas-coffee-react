import mongoose from "mongoose";

const FriendSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    friendId: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    requestedBy: { type: String, required: true },
    requestedAt: { type: String, required: true },
    respondedAt: { type: String, default: "" },
  },
  { timestamps: true },
);

FriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
FriendSchema.index({ userId: 1, status: 1 });

export type FriendDocument = mongoose.InferSchemaType<typeof FriendSchema> & mongoose.Document;

const FriendModel =
  (mongoose.models.Friend as mongoose.Model<FriendDocument>) ||
  mongoose.model<FriendDocument>("Friend", FriendSchema);

export default FriendModel;
