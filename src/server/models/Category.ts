import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    iconName: { type: String, required: true },
    image: { type: String, default: "" },
  },
  { timestamps: true },
);

export type CategoryDocument = mongoose.InferSchemaType<typeof CategorySchema> & mongoose.Document;

const CategoryModel =
  (mongoose.models.Category as mongoose.Model<CategoryDocument>) ||
  mongoose.model<CategoryDocument>("Category", CategorySchema);

export default CategoryModel;
