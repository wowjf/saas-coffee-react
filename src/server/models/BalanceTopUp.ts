import mongoose from "mongoose";

const BalanceTopUpSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    creditedAmount: { type: Number, required: true },
    bonusAmount: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export type BalanceTopUpDocument = mongoose.InferSchemaType<typeof BalanceTopUpSchema> & mongoose.Document;

const BalanceTopUpModel =
  (mongoose.models.BalanceTopUp as mongoose.Model<BalanceTopUpDocument>) ||
  mongoose.model<BalanceTopUpDocument>("BalanceTopUp", BalanceTopUpSchema);

export default BalanceTopUpModel;
