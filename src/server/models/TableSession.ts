import mongoose from "mongoose";
import { randomUUID } from "crypto";

const ParticipantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    hasPaid: { type: Boolean, default: false },
    paidAmount: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
  },
  { _id: false },
);

const PendingParticipantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const LeftParticipantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    paidAmount: { type: Number, default: 0 },
    leftAt: { type: Date, default: Date.now },
    totalUnpaid: { type: Number, default: 0 },
  },
  { _id: false },
);

const TableSessionSchema = new mongoose.Schema(
  {
    tableId: { type: String, required: true, index: true },
    tableNumber: { type: String, required: true },
    sessionToken: { type: String, default: () => randomUUID(), unique: true, index: true },
    hostUserId: { type: String, required: true },
    participants: { type: [ParticipantSchema], default: [] },
    pendingParticipants: { type: [PendingParticipantSchema], default: [] },
    leftParticipants: { type: [LeftParticipantSchema], default: [] },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: "" },
    closedByRole: { type: String, default: "" },
    closeReason: { type: String, default: "" },
  },
  { timestamps: true },
);

TableSessionSchema.index(
  { tableNumber: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);

// MP-2.12: masa kimliği + durum ile oturum aramaları.
TableSessionSchema.index({ tableId: 1, status: 1 });

export type TableSessionDocument = mongoose.InferSchemaType<typeof TableSessionSchema> & mongoose.Document;

const TableSessionModel =
  (mongoose.models.TableSession as mongoose.Model<TableSessionDocument>) ||
  mongoose.model<TableSessionDocument>("TableSession", TableSessionSchema);

export default TableSessionModel;