import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    inStock: { type: Boolean, default: true },
    ingredients: [{ type: String }],
    preparationTime: { type: Number, default: 5 }, // in minutes
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type ProductDocument = mongoose.InferSchemaType<typeof ProductSchema> & mongoose.Document;

const ProductModel =
  (mongoose.models.Product as mongoose.Model<ProductDocument>) ||
  mongoose.model<ProductDocument>("Product", ProductSchema);

export default ProductModel;
