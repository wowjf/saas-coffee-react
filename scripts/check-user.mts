import mongoose from "mongoose";

const MONGO_URI = "mongodb://localhost:27017/cafe_db";
await mongoose.connect(MONGO_URI);

// Raw DB query
const raw = await mongoose.connection.db!.collection("users").findOne({ email: "admin@bancho.cafe" });
console.log("Raw DB sessionRole:", raw?.sessionRole);
console.log("Raw DB role:", raw?.role);

// Via Mongoose model
const UserSchema = new mongoose.Schema({
  name: String,
  surname: String,
  email: String,
  role: String,
  sessionRole: { type: String, enum: ["customer", "staff", "manager"], default: null },
});
const UserModel = mongoose.model("UserCheck", UserSchema, "users");
const user = await UserModel.findOne({ email: "admin@bancho.cafe" });
console.log("Mongoose sessionRole:", user?.sessionRole);
console.log("Mongoose role:", user?.get("role"));
console.log("toObject sessionRole:", user?.toObject()?.sessionRole);

await mongoose.disconnect();