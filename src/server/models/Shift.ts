import mongoose from "mongoose";

// Vardiya kaydı: personel vardiyaya başladığında açılır, bitirme talebi
// (end_requested) müdür/yönetici onayıyla kapanır. Staff.status alanı
// yalnızca eski görünürlük için korunur — vardiya gerçeği bu koleksiyondur.
const ShiftEndRequestSchema = new mongoose.Schema(
  {
    requestedAt: { type: Date, default: null },
    reason: {
      type: String,
      enum: ["vardiya_bitti", "mola", "acil_durum", "diger", ""],
      default: "",
    },
    customNote: { type: String, default: "", maxlength: 300 },
  },
  { _id: false },
);

const ShiftSchema = new mongoose.Schema(
  {
    staffUserId: { type: String, required: true, index: true },
    staffEmail: { type: String, default: "" },
    staffName: { type: String, default: "" },
    staffRole: {
      type: String,
      enum: ["garson", "bar", "mutfak", "mudur", ""],
      default: "",
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "end_requested", "completed", "rejected"],
      default: "active",
      index: true,
    },
    endRequest: { type: ShiftEndRequestSchema, default: null },
    reviewedByUserId: { type: String, default: "" },
    reviewedByName: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);

// "Personelinin aktif/talepli vardiyası" sorguları için bileşik index.
ShiftSchema.index({ staffUserId: 1, status: 1, startedAt: -1 });

export type ShiftDocument = mongoose.InferSchemaType<typeof ShiftSchema> & mongoose.Document;

const ShiftModel =
  (mongoose.models.Shift as mongoose.Model<ShiftDocument>) ||
  mongoose.model<ShiftDocument>("Shift", ShiftSchema);

export default ShiftModel;
