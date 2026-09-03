// GÜVENLİK SİMÜLASYON SUNUCUSU — yalnızca yerel denetim için.
// Gerçek apiRoutes'u MongoMemoryServer üzerinde :3999'dan serve eder.
// Üretim/normal dev akışına bağlı DEĞİLDİR; hiçbir .env okumaz.
// Kullanım: npx tsx scripts/sim-server.ts   (kapat: Ctrl+C veya kill)
import express from "express";
import mongoose from "mongoose";
import http from "node:http";
import apiRoutes from "../src/server/routes/api";
import { errorHandler } from "../src/server/middleware/errorHandler";

process.env.JWT_SECRET = process.env.JWT_SECRET || "sim-audit-jwt-secret";

const PORT = 3999;

async function main() {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "sim_audit" });

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  app.use("/api", errorHandler);

  // Sim-only kurulum ucu: modelleri doğrudan tohumlar (audit agentları
  // manager/staff hesabı ve katalog olmadan test edemez). Yalnızca bu
  // süreçte yaşar; üretim koduna dokunmaz.
  app.post("/__sim/seed", async (req, res) => {
    try {
      const UserModel = (await import("../src/server/models/User")).default;
      const ProductModel = (await import("../src/server/models/Product")).default;
      const InventoryItemModel = (await import("../src/server/models/InventoryItem")).default;
      const CampaignModel = (await import("../src/server/models/Campaign")).default;
      const CouponModel = (await import("../src/server/models/Coupon")).default;
      const TableModel = (await import("../src/server/models/Table")).default;

      // Manager + staff (şifreler bcrypt pre-save ile hashlenir)
      const manager = await UserModel.create({
        name: "Sim", surname: "Manager", username: "sim_manager", gender: "female",
        email: "manager@sim.test", password: "Manager123!", role: "manager",
        sessionRole: "manager", balance: 1000,
      });
      const staff = await UserModel.create({
        name: "Sim", surname: "Staff", username: "sim_staff", gender: "male",
        email: "staff@sim.test", password: "Staff123!", role: "staff",
        sessionRole: "staff", balance: 100,
      });

      const espresso = await ProductModel.create({
        name: "Espresso", description: "sim", price: 40,
        category: "Sıcak İçecekler", image: "", ingredients: ["Espresso Çekirdeği", "Su"],
        inStock: true,
      });
      const latte = await ProductModel.create({
        name: "Latte", description: "sim", price: 55,
        category: "Sıcak İçecekler", image: "", ingredients: ["Espresso Çekirdeği", "Süt"],
        inStock: true,
      });

      await InventoryItemModel.create([
        { name: "Espresso Çekirdeği", unit: "kg", currentStock: 5, minStock: 1, reorderPoint: 2 },
        { name: "Süt", unit: "liter", currentStock: 3, minStock: 1, reorderPoint: 1 },
        { name: "Su", unit: "liter", currentStock: 100, minStock: 10, reorderPoint: 20 },
      ]);

      await CampaignModel.create({
        title: "Sim Puan Ödülü", description: "sim", type: "points_free_product",
        category: "loyalty", active: true, value: 0, pointsCost: 50,
        startDate: "2026-01-01", expiryDate: "2027-01-01",
        usageLimit: 1, validityHours: 24, targetProductId: espresso._id.toString(),
      });

      await CouponModel.create({
        title: "Sim Kupon", code: "SIM10", type: "percentage", value: 10,
        minOrderAmount: 30, usageLimit: 100, usedCount: 0, active: true,
        validFrom: "2026-01-01", validUntil: "2027-01-01",
      });

      await TableModel.create({ tableNumber: "1" });
      await TableModel.create({ tableNumber: "2" });

      res.json({
        ok: true,
        ids: {
          managerId: manager._id.toString(), staffId: staff._id.toString(),
          espressoId: espresso._id.toString(), latteId: latte._id.toString(),
        },
        creds: {
          manager: { email: "manager@sim.test", password: "Manager123!" },
          staff: { email: "staff@sim.test", password: "Staff123!" },
        },
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Sim-only reset: koleksiyonları temizler (yarış testleri temiz durumda
  // başlasın diye).
  app.post("/__sim/reset", async (req, res) => {
    try {
      await Promise.all(
        Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`[sim] audit server on http://localhost:${PORT}`);
    console.log(`[sim] mongo (in-memory) uri=${mongo.getUri().slice(0, 40)}...`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[sim] fatal:", err);
  process.exit(1);
});
