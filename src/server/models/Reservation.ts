import mongoose from "mongoose";

// MP-2.11: tarih/saat alanlari String kalir (YYYY-MM-DD / HH:mm domain
// bicimi — cakisma sorgulari string karsilastirmasiyla calisir) ancak
// validator ile bicim garanti edilir.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const ReservationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    tableNumber: { type: String, required: true, index: true },
    date: {
      type: String,
      required: true, // YYYY-MM-DD
      validate: {
        validator: (v: string) => DATE_ONLY_PATTERN.test(v),
        message: "Rezervasyon tarihi YYYY-AA-GG biciminde olmalidir",
      },
    },
    time: {
      type: String,
      required: true, // HH:mm
      validate: {
        validator: (v: string) => TIME_ONLY_PATTERN.test(v),
        message: "Rezervasyon saati SS:dd biciminde olmalidir",
      },
    },
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

// MP-2.12: masa+tarih+saat çakışma sorgusu (schema'da masa alanı tableNumber'dır).
ReservationSchema.index({ tableNumber: 1, date: 1, time: 1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ date: 1, status: 1 });

export type ReservationDocument = mongoose.InferSchemaType<typeof ReservationSchema> & mongoose.Document;

const ReservationModel =
  (mongoose.models.Reservation as mongoose.Model<ReservationDocument>) ||
  mongoose.model<ReservationDocument>("Reservation", ReservationSchema);

export default ReservationModel;
