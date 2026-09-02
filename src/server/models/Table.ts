import mongoose from "mongoose";
import { randomUUID } from "crypto";

const TableSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
    qrToken: { type: String, default: () => randomUUID(), unique: true, index: true },
    currentSessionId: { type: String, default: "" },
  },
  { timestamps: true },
);

export type TableDocument = mongoose.InferSchemaType<typeof TableSchema> & mongoose.Document;

const TableModel =
  (mongoose.models.Table as mongoose.Model<TableDocument>) ||
  mongoose.model<TableDocument>("Table", TableSchema);

export default TableModel;