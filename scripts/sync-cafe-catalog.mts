import dotenv from "dotenv";
import mongoose from "mongoose";
import CategoryModel from "../src/server/models/Category";
import IngredientModel from "../src/server/models/Ingredient";
import ProductModel from "../src/server/models/Product";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cafe_db";

const categories = [
  { name: "Espresso Bar", iconName: "Coffee", image: "" },
  { name: "Brewed Coffee", iconName: "Bean", image: "" },
  { name: "Frozen Drinks", iconName: "IceCream", image: "" },
  { name: "Tea & Refresher", iconName: "CupSoda", image: "" },
  { name: "Sandwich & Toast", iconName: "Sandwich", image: "" },
  { name: "Bakery & Dessert", iconName: "Croissant", image: "" },
] as const;

const ingredients = [
  { name: "Sut", iconName: "Milk" },
  { name: "Laktoz", iconName: "Droplets" },
  { name: "Gluten", iconName: "Wheat" },
  { name: "Yumurta", iconName: "Egg" },
  { name: "Soya", iconName: "Droplets" },
  { name: "Kuruyemis", iconName: "Bean" },
  { name: "Findik", iconName: "Nut" },
  { name: "Badem", iconName: "Nut" },
  { name: "Fistik", iconName: "Nut" },
  { name: "Ceviz", iconName: "Nut" },
  { name: "Susam", iconName: "WheatOff" },
  { name: "Balik", iconName: "Fish" },
  { name: "Somon", iconName: "Fish" },
  { name: "Ton Baligi", iconName: "Fish" },
  { name: "Tavuk", iconName: "Drumstick" },
  { name: "Et", iconName: "Beef" },
  { name: "Hindi", iconName: "Ham" },
  { name: "Peynir", iconName: "Layers" },
  { name: "Tereyagi", iconName: "Droplets" },
  { name: "Krema", iconName: "Droplets" },
  { name: "Yulaf", iconName: "Wheat" },
  { name: "Bal", iconName: "Star" },
  { name: "Kakao", iconName: "Candy" },
  { name: "Vanilya", iconName: "Star" },
  { name: "Karamel", iconName: "CandyCane" },
  { name: "Kafein", iconName: "Zap" },
  { name: "Tarcin", iconName: "Star" },
  { name: "Cilek", iconName: "Cherry" },
  { name: "Visne", iconName: "Cherry" },
  { name: "Muz", iconName: "Banana" },
  { name: "Limon", iconName: "Citrus" },
  { name: "Portakal", iconName: "Citrus" },
  { name: "Matcha", iconName: "Leaf" },
  { name: "Balkabagi", iconName: "Carrot" },
  { name: "Nane", iconName: "Leaf" },
  { name: "Zencefil", iconName: "Leaf" },
  { name: "Kurabiye", iconName: "Cookie" },
  { name: "Su", iconName: "GlassWater" },
  { name: "Soda", iconName: "CupSoda" },
  { name: "Sandvic Ekmek", iconName: "Sandwich" },
  { name: "Kruvasan Hamuru", iconName: "Croissant" },
  { name: "Yesillik", iconName: "Salad" },
  { name: "Vegan Baz", iconName: "Vegan" },
] as const;

const products = [
  { name: "Caffe Latte", price: 170, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein"] },
  { name: "Cappuccino", price: 175, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein"] },
  { name: "Flat White", price: 180, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein"] },
  { name: "Caramel Macchiato", price: 190, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein", "Karamel"] },
  { name: "White Mocha", price: 205, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein", "Vanilya"] },
  { name: "Cafe Mocha", price: 195, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein", "Kakao"] },
  { name: "Americano", price: 160, category: "Espresso Bar", ingredients: ["Kafein"] },
  { name: "Espresso Double", price: 155, category: "Espresso Bar", ingredients: ["Kafein"] },
  { name: "Honey Cinnamon Latte", price: 205, category: "Espresso Bar", ingredients: ["Sut", "Laktoz", "Kafein", "Bal", "Tarcin"] },
  { name: "Oat Milk Latte", price: 185, category: "Espresso Bar", ingredients: ["Yulaf", "Kafein"] },

  { name: "Filter Coffee House Blend", price: 160, category: "Brewed Coffee", ingredients: ["Kafein"] },
  { name: "Pour Over Ethiopia", price: 175, category: "Brewed Coffee", ingredients: ["Kafein"] },
  { name: "Cold Brew Reserve", price: 170, category: "Brewed Coffee", ingredients: ["Kafein"] },
  { name: "Nitro Cold Brew", price: 185, category: "Brewed Coffee", ingredients: ["Kafein"] },
  { name: "Pumpkin Cream Cold Brew", price: 210, category: "Brewed Coffee", ingredients: ["Kafein", "Sut", "Laktoz", "Krema", "Balkabagi"] },
  { name: "Vanilla Sweet Cream Cold Brew", price: 205, category: "Brewed Coffee", ingredients: ["Kafein", "Sut", "Laktoz", "Vanilya", "Krema"] },
  { name: "Iced Shaken Espresso", price: 180, category: "Brewed Coffee", ingredients: ["Kafein"] },
  { name: "Brown Sugar Shaken Espresso", price: 190, category: "Brewed Coffee", ingredients: ["Kafein", "Sut", "Laktoz"] },
  { name: "Hazelnut Filter Coffee", price: 185, category: "Brewed Coffee", ingredients: ["Kafein", "Findik"] },
  { name: "Cinnamon Americano", price: 170, category: "Brewed Coffee", ingredients: ["Kafein", "Tarcin"] },

  { name: "Java Chip Frappe", price: 215, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Kakao", "Kafein"] },
  { name: "Caramel Frappe", price: 210, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Karamel", "Kafein"] },
  { name: "Vanilla Cream Frappe", price: 205, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Vanilya"] },
  { name: "Mocha Cookie Frappe", price: 220, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Kakao", "Kurabiye", "Gluten", "Kafein"] },
  { name: "Strawberry Cream Frappe", price: 210, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Cilek"] },
  { name: "Matcha Cream Frappe", price: 215, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Matcha"] },
  { name: "Double Chocolate Frozen", price: 225, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Kakao"] },
  { name: "Banana Oat Frozen", price: 210, category: "Frozen Drinks", ingredients: ["Muz", "Yulaf"] },
  { name: "Espresso Caramel Frozen", price: 220, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Kafein", "Karamel"] },
  { name: "Lemon Cream Frozen", price: 205, category: "Frozen Drinks", ingredients: ["Sut", "Laktoz", "Limon"] },

  { name: "English Breakfast Tea", price: 150, category: "Tea & Refresher", ingredients: ["Kafein"] },
  { name: "Earl Grey Tea", price: 155, category: "Tea & Refresher", ingredients: ["Kafein"] },
  { name: "Matcha Latte", price: 185, category: "Tea & Refresher", ingredients: ["Sut", "Laktoz", "Matcha"] },
  { name: "Iced Peach Tea", price: 165, category: "Tea & Refresher", ingredients: ["Kafein"] },
  { name: "Strawberry Acai Refresher", price: 190, category: "Tea & Refresher", ingredients: ["Cilek"] },
  { name: "Lemon Mint Refresher", price: 170, category: "Tea & Refresher", ingredients: ["Limon", "Nane"] },
  { name: "Hibiscus Berry Tea", price: 175, category: "Tea & Refresher", ingredients: ["Cilek", "Visne"] },
  { name: "Orange Ginger Tea", price: 180, category: "Tea & Refresher", ingredients: ["Portakal", "Zencefil"] },
  { name: "Sparkling Citrus Soda", price: 160, category: "Tea & Refresher", ingredients: ["Soda", "Limon", "Portakal"] },
  { name: "Mineral Water", price: 45, category: "Tea & Refresher", ingredients: ["Su"] },

  { name: "Smoked Turkey Croissant", price: 235, category: "Sandwich & Toast", ingredients: ["Kruvasan Hamuru", "Gluten", "Hindi", "Peynir", "Yumurta", "Sut", "Laktoz"] },
  { name: "Three Cheese Toast", price: 225, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Peynir", "Sut", "Laktoz", "Tereyagi"] },
  { name: "Chicken Pesto Panini", price: 245, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Tavuk", "Peynir", "Sut", "Laktoz"] },
  { name: "Tuna Melt Sandwich", price: 255, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Ton Baligi", "Peynir", "Sut", "Laktoz"] },
  { name: "Salmon Cream Bagel", price: 275, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Somon", "Krema", "Laktoz"] },
  { name: "Roast Beef Focaccia", price: 285, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Et", "Peynir"] },
  { name: "Avocado Vegan Sandwich", price: 235, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Vegan Baz", "Yesillik"] },
  { name: "Halloumi Toast", price: 240, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Peynir", "Sut", "Laktoz"] },
  { name: "Egg Salad Brioche", price: 225, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Yumurta"] },
  { name: "Ham Cheese Melt", price: 250, category: "Sandwich & Toast", ingredients: ["Sandvic Ekmek", "Gluten", "Hindi", "Peynir", "Sut", "Laktoz"] },

  { name: "Butter Croissant", price: 170, category: "Bakery & Dessert", ingredients: ["Kruvasan Hamuru", "Gluten", "Sut", "Laktoz", "Tereyagi"] },
  { name: "Chocolate Croissant", price: 185, category: "Bakery & Dessert", ingredients: ["Kruvasan Hamuru", "Gluten", "Sut", "Laktoz", "Kakao"] },
  { name: "Cinnamon Roll", price: 190, category: "Bakery & Dessert", ingredients: ["Gluten", "Sut", "Laktoz", "Tarcin", "Yumurta"] },
  { name: "Chocolate Muffin", price: 195, category: "Bakery & Dessert", ingredients: ["Gluten", "Sut", "Laktoz", "Kakao", "Yumurta"] },
  { name: "San Sebastian Slice", price: 225, category: "Bakery & Dessert", ingredients: ["Sut", "Laktoz", "Yumurta"] },
  { name: "Cheesecake Forest Fruit", price: 230, category: "Bakery & Dessert", ingredients: ["Sut", "Laktoz", "Yumurta", "Cilek", "Visne"] },
  { name: "Tiramisu Cup", price: 235, category: "Bakery & Dessert", ingredients: ["Sut", "Laktoz", "Yumurta", "Kafein"] },
  { name: "Brownie Deluxe", price: 205, category: "Bakery & Dessert", ingredients: ["Gluten", "Sut", "Laktoz", "Yumurta", "Kakao"] },
  { name: "Lemon Loaf", price: 195, category: "Bakery & Dessert", ingredients: ["Gluten", "Sut", "Laktoz", "Yumurta", "Limon"] },
  { name: "Vanilla Donut", price: 180, category: "Bakery & Dessert", ingredients: ["Gluten", "Sut", "Laktoz", "Yumurta", "Vanilya"] },
] as const;

async function main() {
  await mongoose.connect(MONGODB_URI);

  await CategoryModel.bulkWrite(
    categories.map((category) => ({
      updateOne: {
        filter: { name: category.name },
        update: { $set: category },
        upsert: true,
      },
    })),
  );

  await IngredientModel.bulkWrite(
    ingredients.map((ingredient) => ({
      updateOne: {
        filter: { name: ingredient.name },
        update: { $set: ingredient },
        upsert: true,
      },
    })),
  );

  await ProductModel.deleteMany({});
  await ProductModel.insertMany(
    products.map((product) => ({
      ...product,
      image: "",
      inStock: true,
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
