import mongoose from "mongoose";

const ReservationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    tableNumber: { type: String, required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
    guestCount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "no_show", "completed"], default: "pending" },
    note: { type: String, default: "" },
    confirmedBy: { type: String, default: "" },
    confirmedAt: { type: String, default: "" },
    cancelledBy: { type: String, default: "" },
    cancelledAt: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true },
);

ReservationSchema.index({ tableNumber: 1, date: 1, time: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ date: 1, status: 1 });

export type ReservationDocument = mongoose.InferSchemaType<typeof ReservationSchema> & mongoose.Document;

const ReservationModel =
  (mongoose.models.Reservation as mongoose.Model<ReservationDocument>) ||
  mongoose.model<ReservationDocument>("Reservation", ReservationSchema);

export default ReservationModel;
