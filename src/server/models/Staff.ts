import mongoose from "mongoose";

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["staff", "manager"], default: "staff" },
    status: { type: String, enum: ["Vardiyada", "İzinli"], default: "İzinli" },
  },
  { timestamps: true },
);

export type StaffDocument = mongoose.InferSchemaType<typeof StaffSchema> & mongoose.Document;

const StaffModel =
  (mongoose.models.Staff as mongoose.Model<StaffDocument>) ||
  mongoose.model<StaffDocument>("Staff", StaffSchema);

export default StaffModel;
