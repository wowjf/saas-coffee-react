import mongoose from "mongoose";

const ChangeLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export type ChangeLogDocument = mongoose.InferSchemaType<typeof ChangeLogSchema> & mongoose.Document;

const ChangeLogModel =
  (mongoose.models.ChangeLog as mongoose.Model<ChangeLogDocument>) ||
  mongoose.model<ChangeLogDocument>("ChangeLog", ChangeLogSchema);

export default ChangeLogModel;
