import mongoose from "mongoose";

const SystemTextSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type SystemTextDocument = mongoose.InferSchemaType<typeof SystemTextSchema> & mongoose.Document;

const SystemTextModel =
  (mongoose.models.SystemText as mongoose.Model<SystemTextDocument>) ||
  mongoose.model<SystemTextDocument>("SystemText", SystemTextSchema);

export default SystemTextModel;