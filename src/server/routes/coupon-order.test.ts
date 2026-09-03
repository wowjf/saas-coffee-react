import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";
import UserModel from "../models/User";
import CouponModel from "../models/Coupon";
import ProductModel from "../models/Product";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;
let customerToken: string;
let customerUserId: string;
let managerToken: string;
let product: any;

async function loginManager() {
  await UserModel.create({
    name: "Y", surname: "T", username: "yt_coupon", gender: "female",
    email: "yt@coupon.com", password: "guclu-sifre-123", phone: "05001112233",
    birthDate: "1990-01-01", role: "manager", sessionRole: "manager",
  });
  const login = await request(app).post("/api/auth/login").send({
    email: "yt@coupon.com", password: "guclu-sifre-123",
  });
  await request(app).post("/api/auth/session-role")
    .set("Authorization", `Bearer ${login.body.token}`)
    .send({ role: "manager" });
  return login.body.token as string;
}

async function registerCustomer() {
  const reg = await request(app).post("/api/auth/register").send({
    name: "M", surname: "K", username: "mk_coupon", gender: "female",
    email: "mk@coupon.com", password: "guclu-sifre-123", phone: "05001112233",
    birthDate: "1995-01-01",
  });
  return { token: reg.body.token as string, userId: reg.body.user.id as string };
}

async function createCoupon(overrides: Record<string, unknown> = {}) {
  return CouponModel.create({
    title: "Test Kuponu",
    code: "TEST10",
    type: "percentage",
    value: 10,
    maxDiscount: 50,
    minOrderAmount: 0,
    usageLimit: 0,
    usedCount: 0,
    usedBy: [],
    validFrom: "2020-01-01",
    validUntil: "2099-01-01",
    active: true,
    newUsersOnly: false,
    ...overrides,
  } as Record<string, unknown>);
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "coupon_order_test" });
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
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
  );
  managerToken = await loginManager();
  const customer = await registerCustomer();
  customerToken = customer.token;
  customerUserId = customer.userId;
  product = await ProductModel.create({ name: "Kahve", price: 100, category: "Kahveler" });
  await UserModel.updateOne({ _id: customerUserId }, { $set: { balance: 500 } });
});

describe("POST /api/orders couponCode ile (A3)", () => {
  it("geçerli kupon indirim uygular, kullanım sayacı artar, bakiyeden düşük tutar düşer", async () => {
    const coupon = await createCoupon();

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ product: { id: product._id.toString() }, quantity: 1 }],
        couponCode: "test10",
      });

    expect(response.status).toBe(201);
    // 100 - %10 = 90
    expect(response.body.order.total).toBe(90);
    expect(response.body.order.appliedCoupon.code).toBe("TEST10");
    expect(response.body.couponWarning).toBeUndefined();

    const after = await CouponModel.findById(coupon._id);
    expect(after!.usedCount).toBe(1);
    expect(after!.usedBy).toContain(customerUserId);

    const user = await UserModel.findById(customerUserId);
    expect(user!.balance).toBe(410); // 500 - 90
  });

  it("geçersiz kupon siparişi bozmaz — uyarı döner, indirim yok", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ product: { id: product._id.toString() }, quantity: 1 }],
        couponCode: "YOK Boyle",
      });

    expect(response.status).toBe(201);
    expect(response.body.order.total).toBe(100);
    expect(response.body.couponWarning).toBeTruthy();
  });

  it("aynı kupon ikinci kullanımda reddedilir ama sipariş oluşur", async () => {
    await createCoupon({ code: "BIRKEZ", usageLimit: 1 });

    const first = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "birkez" });
    expect(first.status).toBe(201);
    expect(first.body.order.total).toBe(90);

    const second = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "birkez" });
    expect(second.status).toBe(201);
    expect(second.body.order.total).toBe(100);
    expect(second.body.couponWarning).toBeTruthy();
  });

  it("minOrderAmount tutmayan kupon reddedilir", async () => {
    await createCoupon({ code: "MIN200", minOrderAmount: 200 });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "min200" });

    expect(response.status).toBe(201);
    expect(response.body.order.total).toBe(100);
    expect(response.body.couponWarning).toBeTruthy();
  });

  it("sipariş reddedilince kupon kullanımı geri alınır", async () => {
    const coupon = await createCoupon({ code: "IADE10" });

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "iade10" });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.total).toBe(90);

    // pending -> rejected gecisi
    const rejected = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "rejected" });
    expect(rejected.status).toBe(200);

    const after = await CouponModel.findById(coupon._id);
    expect(after!.usedCount).toBe(0);
    expect(after!.usedBy).not.toContain(customerUserId);

    // Kullanici bakiyesi de geri odedi (90) — kupon tekrar kullanilabilir.
    const user = await UserModel.findById(customerUserId);
    expect(user!.balance).toBe(500);

    const again = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "iade10" });
    expect(again.status).toBe(201);
    expect(again.body.order.total).toBe(90);
  });

  it("eşzamanlı iki sipariş limit-1 kuponu yalnız birinde kazanır", async () => {
    await createCoupon({ code: "YARIS1", usageLimit: 1 });

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "yaris1" }),
      request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], couponCode: "yaris1" }),
    ]);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const discounted = [a, b].filter((r) => r.body.order.total === 90);
    const warned = [a, b].filter((r) => r.body.couponWarning);
    expect(discounted).toHaveLength(1);
    expect(warned).toHaveLength(1);
  });
});
