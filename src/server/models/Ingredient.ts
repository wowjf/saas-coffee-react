import mongoose from "mongoose";

const IngredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    iconName: { type: String, required: true },
  },
  { timestamps: true },
);

export type IngredientDocument = mongoose.InferSchemaType<typeof IngredientSchema> & mongoose.Document;

const IngredientModel =
  (mongoose.models.Ingredient as mongoose.Model<IngredientDocument>) ||
  mongoose.model<IngredientDocument>("Ingredient", IngredientSchema);

export default IngredientModel;
