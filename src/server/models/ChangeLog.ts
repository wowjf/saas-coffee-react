import mongoose from "mongoose";

// MP-2.12: log listelemeleri timestamp tersten sıralı; tek-alan index
// tanımlı (timestamp:1) — tersten okuma için -1'e çevrilir.
const ChangeLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// MP-2.12: loglar her zaman en yeniden eskiye okunur.
ChangeLogSchema.index({ timestamp: -1 });

export type ChangeLogDocument = mongoose.InferSchemaType<typeof ChangeLogSchema> & mongoose.Document;

const ChangeLogModel =
  (mongoose.models.ChangeLog as mongoose.Model<ChangeLogDocument>) ||
  mongoose.model<ChangeLogDocument>("ChangeLog", ChangeLogSchema);

export default ChangeLogModel;
