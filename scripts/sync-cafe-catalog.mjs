import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cafe_db";
const sourcePath = path.join(process.cwd(), "scripts", "sync-cafe-catalog.mts");

function extractArray(source, variableName) {
  const pattern = new RegExp(`const ${variableName} = (\\[[\\s\\S]*?\\]) as const;`);
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`${variableName} dizisi bulunamadi.`);
  }

  return Function(`return ${match[1]};`)();
}

async function main() {
  const source = await fs.readFile(sourcePath, "utf8");
  const categories = extractArray(source, "categories");
  const ingredients = extractArray(source, "ingredients");
  const products = extractArray(source, "products");

  await mongoose.connect(MONGODB_URI);

  const categoriesCollection = mongoose.connection.collection("categories");
  const ingredientsCollection = mongoose.connection.collection("ingredients");
  const productsCollection = mongoose.connection.collection("products");

  await categoriesCollection.bulkWrite(
    categories.map((category) => ({
      updateOne: {
        filter: { name: category.name },
        update: { $set: category },
        upsert: true,
      },
    })),
  );

  await ingredientsCollection.bulkWrite(
    ingredients.map((ingredient) => ({
      updateOne: {
        filter: { name: ingredient.name },
        update: { $set: ingredient },
        upsert: true,
      },
    })),
  );

  await productsCollection.deleteMany({});
  await productsCollection.insertMany(
    products.map((product) => ({
      ...product,
      image: "",
      inStock: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );

  console.log(`Categories synced: ${categories.length}`);
  console.log(`Ingredients synced: ${ingredients.length}`);
  console.log(`Products inserted: ${products.length}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Catalog sync failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
