import mongoose from "mongoose";

// MP-2.12: category index — menü kategoriye göre listelenir.
// MP-2.14: price required + min:0 — negatif/eksik fiyat new-save'lerde reddedilir.
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    inStock: { type: Boolean, default: true },
    // S-O4a (MP-0.10): inStock=false değerinin envanter senkronu tarafından
    // mı yoksa manuel karar tarafından mı kapatıldığını ayırır. true iken
    // syncProductStockFlags stoğu geri gelen ürünü yeniden açabilir;
    // manuel kapatmada kalır.
    inStockAutoClosed: { type: Boolean, default: false },
    ingredients: [{ type: String }],
    preparationTime: { type: Number, default: 5 }, // in minutes
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// MP-2.12: kategori bazlı menü okumaları.
ProductSchema.index({ category: 1 });

export type ProductDocument = mongoose.InferSchemaType<typeof ProductSchema> & mongoose.Document;

const ProductModel =
  (mongoose.models.Product as mongoose.Model<ProductDocument>) ||
  mongoose.model<ProductDocument>("Product", ProductSchema);

export default ProductModel;
