// MP-0.10 güvenlik düzeltmelerinin regression kanıtları. Güvenlik simülasyon
// raporundaki (docs/raporlar/guvenlik-simulasyon-raporu.md) KRİTİK yarış
// senaryoları ile ORTA/DÜŞÜK girdi doğrulamaları API düzeyinde yeniden
// üretilir — bir geri dönüş anında bu testler düşer.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";
import UserModel from "../models/User";
import ProductModel from "../models/Product";
import InventoryItemModel from "../models/InventoryItem";
import { SubscriptionPlanModel } from "../models/Subscription";
import jwt from "jsonwebtoken";
import { createLoyaltyQrToken } from "../services/loyalty";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

let managerToken: string;
let customerId: string;
let customerToken: string;

async function createManager() {
  const manager = await UserModel.create({
    name: "Reg",
    surname: "Manager",
    username: "reg_manager",
    gender: "female",
    email: "regmanager@test.com",
    password: "GizliParola1",
    role: "manager",
    sessionRole: "manager",
  });
  const token = jwt.sign(
    { userId: manager._id.toString(), tokenVersion: manager.tokenVersion ?? 0 },
    process.env.JWT_SECRET!,
  );
  return { token, id: manager._id.toString() };
}

async function registerCustomer(email: string, username: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Reg",
      surname: "Musteri",
      username,
      gender: "male",
      email,
      password: "GizliParola1",
      phone: "05051112233",
      birthDate: "1995-05-05",
    });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, id: response.body.user.id as string };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "security_regression_test" });

  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  app.use("/api", errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );

  const manager = await createManager();
  managerToken = manager.token;

  const customer = await registerCustomer("regcustomer@test.com", "reg_customer");
  customerToken = customer.token;
  customerId = customer.id;
});

describe("S-K1: sadakat QR token'ı oturum olarak kullanılamaz", () => {
  it("rejects a loyalty-qr token as a Bearer session (401)", async () => {
    const user = await UserModel.findById(customerId);
    const qr = createLoyaltyQrToken(customerId, user?.tokenVersion ?? 0);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${qr.token}`);

    expect(response.status).toBe(401);
  });
});

describe("S-K4: paralel bakiye yükleme kaybolmaz", () => {
  it("credits all 5 concurrent top-ups exactly (atomik $inc)", async () => {
    const loads = Array.from({ length: 5 }, () =>
      request(app)
        .post(`/api/users/${customerId}/balance`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ amount: 100 }),
    );
    const responses = await Promise.all(loads);

    responses.forEach((r) => expect(r.status).toBe(200));

    const user = await UserModel.findById(customerId);
    expect(user?.balance).toBe(500);
  });
});

describe("S-K5: self top-up manager'a özeldir", () => {
  it("rejects a customer crediting their own balance (403)", async () => {
    const response = await request(app)
      .post("/api/users/me/balance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ amount: 100 });

    expect(response.status).toBe(403);
  });
});

describe("S-K7: paralel abonelik tek kez düşer", () => {
  it("charges balance once for 3 concurrent subscribes", async () => {
    const plan = await SubscriptionPlanModel.create({
      name: "Reg Plan",
      description: "",
      price: 200,
      duration: "monthly",
      discountPercent: 10,
      active: true,
    });

    await UserModel.updateOne({ _id: customerId }, { $set: { balance: 200 } });

    const subs = Array.from({ length: 3 }, () =>
      request(app)
        .post("/api/subscriptions/subscribe")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ planId: plan._id.toString() }),
    );
    const responses = await Promise.all(subs);

    const okCount = responses.filter((r) => r.status === 200 || r.status === 201).length;
    expect(okCount).toBe(1);

    const user = await UserModel.findById(customerId);
    expect(user?.balance).toBe(0);
  });
});

describe("S-O5: sipariş anında malzeme yeterliliği", () => {
  it("rejects an order exceeding ingredient stock (400)", async () => {
    const product = await ProductModel.create({
      name: "Reg Latte",
      price: 50,
      category: "Sıcak İçecekler",
      ingredients: ["RegSut"],
      inStock: true,
    });
    await InventoryItemModel.create({
      name: "RegSut",
      unit: "liter",
      currentStock: 2,
      minStock: 1,
      reorderPoint: 1,
    });
    await UserModel.updateOne({ _id: customerId }, { $set: { balance: 1000 } });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 5 }] });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("yetersiz");
  });
});

describe("S-O8: sipariş notu sınırlı", () => {
  it("truncates a 1MB note to 500 chars instead of storing it", async () => {
    const product = await ProductModel.create({
      name: "Reg Coffee",
      price: 30,
      category: "Sıcak İçecekler",
      ingredients: [],
      inStock: true,
    });
    await UserModel.updateOne({ _id: customerId }, { $set: { balance: 1000 } });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], note: "x".repeat(1_000_000) });

    expect(response.status).toBe(201);
    expect(response.body.order.note.length).toBe(500);
  });
});

describe("S-O11: e-posta değişimi şifre ister", () => {
  it("rejects email change without currentPassword (403)", async () => {
    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ email: "yeni@test.com" });

    expect(response.status).toBe(403);
  });

  it("allows email change with correct currentPassword", async () => {
    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ email: "yeni2@test.com", currentPassword: "GizliParola1" });

    expect(response.status).toBe(200);
  });
});

describe("S-O12: register çakışma mesajı envanter sızdırmaz", () => {
  it("returns a single generic 409 for existing email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Baska",
        surname: "Kullanici",
        username: "baska_kullanici",
        gender: "male",
        email: "regcustomer@test.com",
        password: "GizliParola1",
        phone: "05051112233",
        birthDate: "1995-05-05",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).not.toContain("kullanıcı adı");
    expect(response.body.message).not.toContain("e-posta");
  });
});

describe("S-O3: envanter PATCH doğrulaması", () => {
  let itemId: string;

  beforeEach(async () => {
    const item = await InventoryItemModel.create({
      name: "RegCekirdek",
      unit: "kg",
      currentStock: 5,
    });
    itemId = item._id.toString();
  });

  it("rejects negative currentStock (400)", async () => {
    const response = await request(app)
      .patch(`/api/inventory/${itemId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ currentStock: -10 });

    expect(response.status).toBe(400);
  });

  it("normalizes a numeric string currentStock", async () => {
    const response = await request(app)
      .patch(`/api/inventory/${itemId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ currentStock: "12.5" });

    expect(response.status).toBe(200);
    expect(response.body.currentStock).toBe(12.5);
  });
});

describe("S-O1/O2: stok hareketi doğrulaması", () => {
  let itemId: string;

  beforeEach(async () => {
    const item = await InventoryItemModel.create({
      name: "RegSeker",
      unit: "kg",
      currentStock: 10,
    });
    itemId = item._id.toString();
  });

  it("rejects negative out quantity (400) — previously raised stock", async () => {
    const response = await request(app)
      .post(`/api/inventory/${itemId}/movement`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ type: "out", quantity: -100 });

    expect(response.status).toBe(400);
    const item = await InventoryItemModel.findById(itemId);
    expect(item?.currentStock).toBe(10);
  });

  it("rejects an unknown movement type (400)", async () => {
    const response = await request(app)
      .post(`/api/inventory/${itemId}/movement`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ type: "INJECT", quantity: 5 });

    expect(response.status).toBe(400);
  });

  it("normalizes a string quantity and decrements numerically", async () => {
    const response = await request(app)
      .post(`/api/inventory/${itemId}/movement`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ type: "out", quantity: "3" });

    expect(response.status).toBe(200);
    const item = await InventoryItemModel.findById(itemId);
    expect(item?.currentStock).toBe(7);
  });
});

describe("S-D1: garson çağrısı enum doğrulaması", () => {
  it("rejects an invalid type with 400 (not 500)", async () => {
    const response = await request(app)
      .post("/api/waiter-calls")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ tableNumber: "1", type: "refill" });

    expect(response.status).toBe(400);
  });
});

describe("S-O10: düz metin sanitize", () => {
  it("neutralizes script tags in product names", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "<script>alert(1)</script> Kahve", price: 10, category: "Test" });

    expect(response.status).toBe(201);
    expect(response.body.name.toLowerCase()).not.toContain("<script");
  });
});

describe("S-D2: kayıt alan uzunlukları", () => {
  it("rejects a 5000-char name (400)", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "a".repeat(5000),
        surname: "Test",
        username: "uzunad_test",
        gender: "male",
        email: "uzunad@test.com",
        password: "GizliParola1",
        phone: "05051112233",
        birthDate: "1995-05-05",
      });

    expect(response.status).toBe(400);
  });
});
