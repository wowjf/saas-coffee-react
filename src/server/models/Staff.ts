import mongoose from "mongoose";

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["staff", "manager"], default: "staff" },
    // Personel rol modeli: garson/bar/mutfak/mudur. Eski belgelerde
    // undefined kalabilir — boş/undefined değer "tüm personel görünümlerine
    // erişebilir" eski davranışı olarak yorumlanır (görünürlük uçlarında
    // toleranslı, müdür-yetkili uçlarda kısıtlı).
    staffRole: {
      type: String,
      enum: ["garson", "bar", "mutfak", "mudur", ""],
      default: "",
    },
    status: { type: String, enum: ["Vardiyada", "İzinli"], default: "İzinli" },
  },
  { timestamps: true },
);

export type StaffDocument = mongoose.InferSchemaType<typeof StaffSchema> & mongoose.Document;

const StaffModel =
  (mongoose.models.Staff as mongoose.Model<StaffDocument>) ||
  mongoose.model<StaffDocument>("Staff", StaffSchema);

export default StaffModel;
