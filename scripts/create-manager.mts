import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cafe_db";
const EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@bancho.cafe";
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin1234!";

await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const col = mongoose.connection.db!.collection("users");
const hash = await bcrypt.hash(PASSWORD, 10);

const existing = await col.findOne({ email: EMAIL });

if (existing) {
  await col.updateOne(
    { email: EMAIL },
    { $set: { password: hash, role: "manager", sessionRole: "manager", updatedAt: new Date() } },
  );
  console.log(`Updated existing user → role: manager`);
} else {
  await col.insertOne({
    name: "Admin",
    surname: "Manager",
    gender: "male",
    email: EMAIL,
    password: hash,
    role: "manager",
    sessionRole: "manager",
    balance: 0,
    points: 0,
    avatar: "",
    favorites: [],
    addresses: [],
    paymentMethods: [],
    settings: { language: "tr", theme: "light" },
    selectedCampaign: null,
    activePointReward: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Created manager account`);
}

console.log(`Email   : ${EMAIL}`);
console.log(`Password: ${PASSWORD}`);

await mongoose.disconnect();
console.log("Done.");