import mongoose from "mongoose";

const MONGO_URI = "mongodb://localhost:27017/cafe_db";

await mongoose.connect(MONGO_URI);
console.log("Connected");

const result = await mongoose.connection.db!.collection("users").updateOne(
  { email: "admin@bancho.cafe" },
  { $set: { sessionRole: "manager" } },
);

console.log("Modified:", result.modifiedCount);

// Verify
const user = await mongoose.connection.db!.collection("users").findOne({ email: "admin@bancho.cafe" });
console.log("sessionRole now:", user?.sessionRole);
console.log("role:", user?.role);

await mongoose.disconnect();
console.log("Done.");