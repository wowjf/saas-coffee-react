import mongoose from "mongoose";

const WaiterCallSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true, index: true },
    tableSessionToken: { type: String, default: "" },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    type: { type: String, enum: ["bill", "help", "complaint", "order"], required: true },
    message: { type: String, default: "" },
    priority: { type: String, enum: ["normal", "urgent"], default: "normal" },
    status: { type: String, enum: ["pending", "acknowledged", "completed", "cancelled"], default: "pending" },
    createdAt: { type: String, required: true },
    acknowledgedBy: { type: String, default: "" },
    acknowledgedAt: { type: String, default: "" },
    completedBy: { type: String, default: "" },
    completedAt: { type: String, default: "" },
    response: { type: String, default: "" },
  },
  { timestamps: true },
);

WaiterCallSchema.index({ tableNumber: 1, status: 1 });
WaiterCallSchema.index({ status: 1, createdAt: -1 });

export type WaiterCallDocument = mongoose.InferSchemaType<typeof WaiterCallSchema> & mongoose.Document;

const WaiterCallModel =
  (mongoose.models.WaiterCall as mongoose.Model<WaiterCallDocument>) ||
  mongoose.model<WaiterCallDocument>("WaiterCall", WaiterCallSchema);

export default WaiterCallModel;
