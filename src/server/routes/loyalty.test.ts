import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";
import UserModel from "../models/User";
import CampaignModel from "../models/Campaign";
import ProductModel from "../models/Product";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

let managerToken: string;
let customerToken: string;
let customerUserId: string;

async function registerCustomer() {
  const response = await request(app).post("/api/auth/register").send({
    name: "Musteri",
    surname: "Sadakat",
    username: "musteri_sadakat",
    gender: "female",
    email: "musteri@sadakat.com",
    password: "guclu-sifre-123",
    phone: "05001112233",
    birthDate: "1995-01-01",
  });
  return {
    token: response.body.token as string,
    userId: response.body.user?.id as string,
  };
}

async function createManager() {
  await UserModel.create({
    name: "Yonetici",
    surname: "Test",
    username: "yonetici_sadakat",
    gender: "female",
    email: "yonetici@sadakat.com",
    password: "guclu-sifre-123",
    phone: "05001112233",
    birthDate: "1990-01-01",
    role: "manager",
    sessionRole: "manager",
  });

  const login = await request(app).post("/api/auth/login").send({
    email: "yonetici@sadakat.com",
    password: "guclu-sifre-123",
  });

  if (login.status !== 200) {
    throw new Error(`manager login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  // Giris akisi sessionRole'u sifirlar; yonetici oturumunu tekrar yukseltir
  // (uretimde rol secim ekraniyla ayni akis).
  const elevate = await request(app)
    .post("/api/auth/session-role")
    .set("Authorization", `Bearer ${login.body.token}`)
    .send({ role: "manager" });

  if (elevate.status !== 200) {
    throw new Error(`manager session-role failed: ${elevate.status} ${JSON.stringify(elevate.body)}`);
  }

  return login.body.token as string;
}

async function getQrToken(token: string) {
  const response = await request(app)
    .get("/api/loyalty/qr")
    .set("Authorization", `Bearer ${token}`);
  return response;
}

async function createPointCampaign(overrides: Record<string, unknown> = {}) {
  const campaign = await CampaignModel.create({
    title: "Puanla Bedava Kahve",
    description: "500 puan karsiligi bedava kahve",
    category: "loyalty",
    type: "points_free_product",
    value: 100,
    pointsCost: 500,
    usageLimit: 1,
    validityHours: 24,
    active: true,
    startDate: "2020-01-01",
    expiryDate: "2099-01-01",
    targetProductId: "",
    ...overrides,
  } as Record<string, unknown>);
  return campaign;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "loyalty_test" });

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
  managerToken = await createManager();
  const customer = await registerCustomer();
  customerToken = customer.token;
  customerUserId = customer.userId;
});

describe("GET /api/loyalty/qr", () => {
  it("musteri QR uretebilir ve ozet icerir", async () => {
    const response = await getQrToken(customerToken);

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(20);
    expect(response.body.expiresAt).toBeTruthy();
    expect(response.body.summary.pointsBalance).toBe(0);
  });

  it("personel/yonetici QR uretemez (customer kisiti)", async () => {
    const response = await getQrToken(managerToken);
    expect(response.status).toBe(403);
  });
});

describe("POST /api/loyalty/scan/resolve", () => {
  it("gecerli QR ile musteriyi cozer", async () => {
    const qr = await getQrToken(customerToken);
    const response = await request(app)
      .post("/api/loyalty/scan/resolve")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: qr.body.token });

    expect(response.status).toBe(200);
    expect(response.body.customer.id).toBe(customerUserId);
    expect(response.body.summary.pointsBalance).toBe(0);
    expect(response.body.scannedAt).toBeTruthy();
  });

  it("gecersiz token 400 doner", async () => {
    const response = await request(app)
      .post("/api/loyalty/scan/resolve")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: "sahte-token" });
    expect(response.status).toBe(400);
  });

  it("oturum JWT'si sadakat amaciyla kullanilamaz (purpose farki)", async () => {
    const response = await request(app)
      .post("/api/loyalty/scan/resolve")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: customerToken });
    expect(response.status).toBe(400);
  });

  it("musteri tarama yapamaz (staff/manager kisiti)", async () => {
    const qr = await getQrToken(customerToken);
    const response = await request(app)
      .post("/api/loyalty/scan/resolve")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ token: qr.body.token });
    expect(response.status).toBe(403);
  });

  it("parola degisikliginden sonra eski QR gecersizlesir (MP-2.1 uyumu)", async () => {
    const qr = await getQrToken(customerToken);

    await request(app)
      .post("/api/users/me/password")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ currentPassword: "guclu-sifre-123", newPassword: "yeni-guclu-456" });

    const response = await request(app)
      .post("/api/loyalty/scan/resolve")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: qr.body.token });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/loyalty/scan/redeem-campaign", () => {
  it("yeterli puanla bedava urun kampanyasi tanimlanir ve otomatik siparis olusur", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 90, category: "Kahveler" });
    const campaign = await createPointCampaign({ targetProductId: product._id.toString() });

    await UserModel.updateOne({ _id: customerUserId }, { $set: { points: 600 } });

    const qr = await getQrToken(customerToken);
    const response = await request(app)
      .post("/api/loyalty/scan/redeem-campaign")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: qr.body.token, campaignId: campaign._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body.summary.pointsBalance).toBe(100);
    expect(response.body.summary.activePointReward).toBeTruthy();
    expect(response.body.summary.activePointReward.campaignId).toBe(campaign._id.toString());

    const user = await UserModel.findById(customerUserId);
    expect(user!.points).toBe(100);
  });

  it("yetersiz puanla redeem reddedilir", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 90, category: "Kahveler" });
    const campaign = await createPointCampaign({ targetProductId: product._id.toString() });

    await UserModel.updateOne({ _id: customerUserId }, { $set: { points: 100 } });

    const qr = await getQrToken(customerToken);
    const response = await request(app)
      .post("/api/loyalty/scan/redeem-campaign")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ token: qr.body.token, campaignId: campaign._id.toString() });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeTruthy();

    const user = await UserModel.findById(customerUserId);
    expect(user!.points).toBe(100);
  });

  it("ayni anda iki redeem isteginden yalniz biri puan dusur", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 90, category: "Kahveler" });
    const campaign = await createPointCampaign({ targetProductId: product._id.toString() });

    await UserModel.updateOne({ _id: customerUserId }, { $set: { points: 600 } });

    const qr = await getQrToken(customerToken);

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/loyalty/scan/redeem-campaign")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ token: qr.body.token, campaignId: campaign._id.toString() }),
      request(app)
        .post("/api/loyalty/scan/redeem-campaign")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ token: qr.body.token, campaignId: campaign._id.toString() }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);

    const user = await UserModel.findById(customerUserId);
    // 600 - 500 = 100; ikinci istek puan dusuremedi.
    expect(user!.points).toBe(100);
  });
});

describe("Damga (stamp_card) sadakati", () => {
  it("tamamlanan sipariste kalem basina damga eklenir ve esik dolunca hak kazanilir", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 50, category: "Kahveler" });
    await CampaignModel.create({
      title: "5 Al 1 Bedava",
      description: "Damga kampanyasi",
      category: "loyalty",
      type: "stamp_card",
      value: 100,
      requiredQuantity: 5,
      active: true,
      startDate: "2020-01-01",
      expiryDate: "2099-01-01",
      targetProductId: product._id.toString(),
    } as Record<string, unknown>);

    await UserModel.updateOne(
      { _id: customerUserId },
      { $set: { balance: 1000 } },
    );

    // 3 kalemlik siparis olustur ve tamamla
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 3 }] });
    expect(orderRes.status).toBe(201);

    await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "preparing" });
    await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "ready" });
    await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "completed" });

    const user = await UserModel.findById(customerUserId);
    expect(user!.loyaltyStampProgress).toBe(3);
    expect(user!.loyaltyRewardCredits).toBe(0);

    // Ozet damga durumunu icerir
    const qr = await getQrToken(customerToken);
    expect(qr.body.summary.stampStatus).toMatchObject({
      requiredQuantity: 5,
      currentProgress: 3,
      remainingToReward: 2,
      rewardCredits: 0,
    });
  });

  it("esik doldugunda progress sifirlanir ve 1 hak verilir", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 50, category: "Kahveler" });
    await CampaignModel.create({
      title: "5 Al 1 Bedava",
      description: "Damga kampanyasi",
      category: "loyalty",
      type: "stamp_card",
      value: 100,
      requiredQuantity: 5,
      active: true,
      startDate: "2020-01-01",
      expiryDate: "2099-01-01",
      targetProductId: product._id.toString(),
    } as Record<string, unknown>);

    await UserModel.updateOne({ _id: customerUserId }, { $set: { balance: 1000, loyaltyStampProgress: 4 } });

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });
    expect(orderRes.status).toBe(201);

    for (const status of ["preparing", "ready", "completed"]) {
      await request(app)
        .patch(`/api/orders/${orderRes.body.order.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status });
    }

    const user = await UserModel.findById(customerUserId);
    expect(user!.loyaltyStampProgress).toBe(0);
    expect(user!.loyaltyRewardCredits).toBe(1);
  });

  it("bedava urun hakki sipariste otomatik harcanir ve indirim uygulanir", async () => {
    const product = await ProductModel.create({ name: "Kahve", price: 50, category: "Kahveler" });
    await CampaignModel.create({
      title: "5 Al 1 Bedava",
      description: "Damga kampanyasi",
      category: "loyalty",
      type: "stamp_card",
      value: 100,
      requiredQuantity: 5,
      active: true,
      startDate: "2020-01-01",
      expiryDate: "2099-01-01",
      targetProductId: product._id.toString(),
    } as Record<string, unknown>);

    // 1 hak + 200 bakiye ile basla
    await UserModel.updateOne(
      { _id: customerUserId },
      { $set: { balance: 200, loyaltyRewardCredits: 1 } },
    );

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 2 }] });
    expect(orderRes.status).toBe(201);

    // 2x50=100 tutarindan 1 hak (50) dusulur → 50
    expect(orderRes.body.order.total).toBe(50);

    const user = await UserModel.findById(customerUserId);
    expect(user!.loyaltyRewardCredits).toBe(0);
    expect(user!.balance).toBe(150);
  });
});
