import mongoose from "mongoose";

const StockMovementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["in", "out", "adjustment"], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, default: "" },
    performedBy: { type: String, required: true },
    performedByName: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false },
);

const InventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, required: true }, // kg, liter, piece, etc.
    currentStock: { type: Number, required: true, min: 0 },
    minStock: { type: Number, default: 0 },
    maxStock: { type: Number, default: 0 },
    reorderPoint: { type: Number, default: 0 },
    costPerUnit: { type: Number, default: 0 },
    supplier: { type: String, default: "" },
    category: { type: String, default: "" },
    movements: [StockMovementSchema],
    lastRestocked: { type: String, default: "" },
  },
  { timestamps: true },
);

InventoryItemSchema.index({ name: 1 });
InventoryItemSchema.index({ currentStock: 1 });

export type InventoryItemDocument = mongoose.InferSchemaType<typeof InventoryItemSchema> & mongoose.Document;

const InventoryItemModel =
  (mongoose.models.InventoryItem as mongoose.Model<InventoryItemDocument>) ||
  mongoose.model<InventoryItemDocument>("InventoryItem", InventoryItemSchema);

export default InventoryItemModel;
