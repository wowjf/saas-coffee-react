import mongoose from "mongoose";

// MP-2.11: createdAt Date olarak saklanir (eski String kayitlar Mongoose
// cast'i ile okunur); API serilestirmesinde toIsoString ile ISO string'e
// cevrilir. acknowledgedAt/completedAt server-side ISO string uretmeye devam
// eder (serializer beslemesi ayni kalir).
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
    createdAt: { type: Date, required: true },
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
