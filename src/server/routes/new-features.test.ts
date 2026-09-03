import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import UserModel from "../models/User";
import GiftModel from "../models/Gift";
import CouponModel from "../models/Coupon";
import PushSubscriptionModel from "../models/PushSubscription";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

const SENDER = {
  name: "Sena",
  surname: "Gonderen",
  username: "sena_gonderen",
  gender: "female",
  email: "sena@test.com",
  password: "gizli123",
  phone: "05051112233",
  birthDate: "1993-03-15",
};

const RECIPIENT = {
  name: "Reyhan",
  surname: "Alan",
  username: "reyhan_alan",
  gender: "female",
  email: "reyhan@test.com",
  password: "gizli123",
  phone: "05052223344",
  birthDate: "1994-07-21",
};

const MANAGER = {
  name: "Mina",
  surname: "Yonetici",
  username: "mina_yonetici",
  gender: "female",
  email: "mina@bancho-cafe.test",
  password: "guclu-sifre-123",
  phone: "05053334455",
  birthDate: "1990-01-01",
};

async function registerAndGetToken(payload: Record<string, unknown>) {
  const response = await request(app).post("/api/auth/register").send(payload);
  if (response.status !== 201) {
    throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    token: response.body.token as string,
    userId: (response.body.user?.id ?? response.body.user?._id) as string,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "new_features_test" });

  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

describe("POST /api/gifts/send — atomik bakiye guard'ı (MP-0.4)", () => {
  it("bakiyeyi aşan paralel isteklerde yalnızca ilk istek başarılı olur, kalanı 400 alır ve bakiye negatife düşmez", async () => {
    const sender = await registerAndGetToken(SENDER);
    await registerAndGetToken(RECIPIENT);

    // Gönderenin bakiyesi tek hediye kadar: 100 TL
    await UserModel.updateOne({ _id: sender.userId }, { $set: { balance: 100 } });

    const sendGift = () =>
      request(app)
        .post("/api/gifts/send")
        .set("Authorization", `Bearer ${sender.token}`)
        .send({ recipientEmail: RECIPIENT.email, type: "balance", amount: 100 });

    // Aynı anda 5 istek — hepsi eski bakiyeyi (100) görürse hepsi başarılı
    // olurdu ve bakiye -400'e düşerdi. Atomik guard ile yalnızca 1'i geçer.
    const responses = await Promise.all([sendGift(), sendGift(), sendGift(), sendGift(), sendGift()]);

    const successCount = responses.filter((r) => r.status === 200).length;
    const rejectedCount = responses.filter((r) => r.status === 400).length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(4);

    const senderAfter = await UserModel.findById(sender.userId);
    expect(senderAfter!.balance).toBe(0);

    // Reddedilen istekler hediye belgesi de oluşturmamalı.
    expect(await GiftModel.countDocuments({})).toBe(1);
  });

  it("bakiyesi tamamen yetmeyen kullanıcı 400 alır ve hediye oluşmaz", async () => {
    const sender = await registerAndGetToken(SENDER);
    await registerAndGetToken(RECIPIENT);

    await UserModel.updateOne({ _id: sender.userId }, { $set: { balance: 49.99 } });

    const response = await request(app)
      .post("/api/gifts/send")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ recipientEmail: RECIPIENT.email, type: "balance", amount: 50 });

    expect(response.status).toBe(400);

    const senderAfter = await UserModel.findById(sender.userId);
    expect(senderAfter!.balance).toBe(49.99);
    expect(await GiftModel.countDocuments({})).toBe(0);
  });

  it("tutarı 2 basamağın üzerinde hassasiyetle gelen istek normalize edilir", async () => {
    const sender = await registerAndGetToken(SENDER);
    await registerAndGetToken(RECIPIENT);

    await UserModel.updateOne({ _id: sender.userId }, { $set: { balance: 100 } });

    const response = await request(app)
      .post("/api/gifts/send")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ recipientEmail: RECIPIENT.email, type: "balance", amount: 10.456 });

    expect(response.status).toBe(200);

    const senderAfter = await UserModel.findById(sender.userId);
    // 10.456 → 10.46'ya yuvarlanır; kalan 89.54
    expect(senderAfter!.balance).toBeCloseTo(89.54, 2);
  });

  it("aşırı büyük tutar reddedilir", async () => {
    const sender = await registerAndGetToken(SENDER);
    await registerAndGetToken(RECIPIENT);

    await UserModel.updateOne({ _id: sender.userId }, { $set: { balance: 5_000_000 } });

    const response = await request(app)
      .post("/api/gifts/send")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ recipientEmail: RECIPIENT.email, type: "balance", amount: 2_000_000 });

    expect(response.status).toBe(400);
    expect(await GiftModel.countDocuments({})).toBe(0);
  });
});

describe("POST /api/gifts/:id/claim — çift claim yarışı (MP-0.4)", () => {
  it("aynı hediye için paralel claim isteklerinden yalnızca biri bakiye yükler", async () => {
    const sender = await registerAndGetToken(SENDER);
    const recipient = await registerAndGetToken(RECIPIENT);

    await UserModel.updateOne({ _id: sender.userId }, { $set: { balance: 100 } });

    await request(app)
      .post("/api/gifts/send")
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ recipientEmail: RECIPIENT.email, type: "balance", amount: 100 });

    const gift = await GiftModel.findOne({ recipientId: recipient.userId });
    expect(gift).toBeTruthy();

    const claim = () =>
      request(app)
        .post(`/api/gifts/${gift!._id.toString()}/claim`)
        .set("Authorization", `Bearer ${recipient.token}`);

    const responses = await Promise.all([claim(), claim(), claim(), claim()]);

    const successCount = responses.filter((r) => r.status === 200).length;
    const rejectedCount = responses.filter((r) => r.status === 400).length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(3);

    const recipientAfter = await UserModel.findById(recipient.userId);
    expect(recipientAfter!.balance).toBe(100);

    const claimedGift = await GiftModel.findById(gift!._id.toString());
    expect(claimedGift!.status).toBe("claimed");
  });
});

describe("GET /api/admin/overview — manager yetkisi (MP-0.9)", () => {
  it("manager olmayan (customer) erişimi 403 döner", async () => {
    const customer = await registerAndGetToken(SENDER);

    const response = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${customer.token}`);

    expect(response.status).toBe(403);
  });

  it("kimlik doğrulaması olmadan 401 döner", async () => {
    const response = await request(app).get("/api/admin/overview");

    expect(response.status).toBe(401);
  });

  it("manager kullanıcı listesini, bakiye hareketlerini ve logları alır", async () => {
    // Rol doğrudan DB'de ayarlanır — kayıttaki e-posta-rol eşlemesine
    // (MP-0.2 kapsamında değişecek) bağımlı kalınmaz. Yeni açılan manager
    // hesabı sessionRole seçene kadar customer muamelesi gördüğünden (bkz.
    // getEffectiveRole) oturum rolü de açıkça manager yapılır.
    const manager = await registerAndGetToken(MANAGER);
    await UserModel.updateOne(
      { _id: manager.userId },
      { $set: { role: "manager", sessionRole: "manager" } },
    );

    const response = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${manager.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(Array.isArray(response.body.balanceTopUps)).toBe(true);
    expect(Array.isArray(response.body.recentChanges)).toBe(true);
    expect(response.body.users.length).toBeGreaterThanOrEqual(1);
  });

  it("manager bootstrap yanıtında artık kullanıcı listesi bulunmaz (bootstrap hafifledi)", async () => {
    const manager = await registerAndGetToken(MANAGER);
    await UserModel.updateOne(
      { _id: manager.userId },
      { $set: { sessionRole: "manager" } },
    );

    const bootstrap = await request(app)
      .get("/api/bootstrap")
      .set("Authorization", `Bearer ${manager.token}`);

    expect(bootstrap.status).toBe(200);
    // Geriye uyumluluk: alan hâlâ var ama boş — ağır veri admin/overview'da.
    expect(bootstrap.body.users).toEqual([]);
    expect(bootstrap.body.balanceTopUps).toEqual([]);
    expect(bootstrap.body.recentChanges).toEqual([]);
  });
});

// --- MP-1.2: Kupon kullanım endpoint'inin yetki/sahiplik/limit koruması ---

describe("POST /api/coupons/:id/use (MP-1.2)", () => {
  const COUPON = {
    code: "TEST10",
    title: "Test Kuponu",
    type: "percentage",
    value: 10,
    usageLimit: 1,
    validFrom: new Date(Date.now() - 86400000).toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    active: true,
  };

  async function createCoupon(overrides: Record<string, unknown> = {}) {
    return CouponModel.create({ ...COUPON, ...overrides });
  }

  it("kimlik doğrulaması olmadan 401 döner", async () => {
    const coupon = await createCoupon();

    const response = await request(app).post(`/api/coupons/${coupon._id}/use`);

    expect(response.status).toBe(401);
  });

  it("aynı kullanıcı bir kupona yalnızca bir kez işlenir (sahiplik/tek kullanım)", async () => {
    const customer = await registerAndGetToken(SENDER);
    const coupon = await createCoupon();

    const first = await request(app)
      .post(`/api/coupons/${coupon._id}/use`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const couponAfter = await CouponModel.findById(coupon._id);
    expect(couponAfter!.usedCount).toBe(1);
    expect(couponAfter!.usedBy).toEqual([customer.userId]);

    const second = await request(app)
      .post(`/api/coupons/${coupon._id}/use`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(second.status).toBe(400);
    expect(second.body.message).toBeTruthy();

    // İkinci deneme sayacı da artırmadı.
    const couponFinal = await CouponModel.findById(coupon._id);
    expect(couponFinal!.usedCount).toBe(1);
  });

  it("usageLimit dolduğunda başka kullanıcı 400 alır ve usedCount aşmaz", async () => {
    const first = await registerAndGetToken(SENDER);
    const second = await registerAndGetToken(RECIPIENT);
    const coupon = await createCoupon({ usageLimit: 1 });

    const ok = await request(app)
      .post(`/api/coupons/${coupon._id}/use`)
      .set("Authorization", `Bearer ${first.token}`);
    expect(ok.status).toBe(200);

    const rejected = await request(app)
      .post(`/api/coupons/${coupon._id}/use`)
      .set("Authorization", `Bearer ${second.token}`);

    expect(rejected.status).toBe(400);

    const couponAfter = await CouponModel.findById(coupon._id);
    expect(couponAfter!.usedCount).toBe(1);
    expect(couponAfter!.usageLimit).toBe(1);
  });

  it("limit dolmadan önce paralel isteklerden yalnızca limit kadarı geçer (atomik koşullu güncelleme)", async () => {
    const users = await Promise.all([
      registerAndGetToken({ ...SENDER, email: "p1@test.com", username: "paralel_bir" }),
      registerAndGetToken({ ...RECIPIENT, email: "p2@test.com", username: "paralel_iki" }),
      registerAndGetToken({ ...MANAGER, email: "p3@test.com", username: "paralel_uc", role: undefined }),
    ]);
    const coupon = await createCoupon({ usageLimit: 2 });

    const responses = await Promise.all(
      users.map((u) =>
        request(app).post(`/api/coupons/${coupon._id}/use`).set("Authorization", `Bearer ${u.token}`),
      ),
    );

    const successCount = responses.filter((r) => r.status === 200).length;
    const rejectedCount = responses.filter((r) => r.status === 400).length;

    expect(successCount).toBe(2);
    expect(rejectedCount).toBe(1);

    const couponAfter = await CouponModel.findById(coupon._id);
    expect(couponAfter!.usedCount).toBe(2);
  });

  it("olmayan kupon için 404 döner", async () => {
    const customer = await registerAndGetToken(SENDER);

    const response = await request(app)
      .post(`/api/coupons/${new mongoose.Types.ObjectId().toString()}/use`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(response.status).toBe(404);
  });

  it("pasif kupon kullanılamaz", async () => {
    const customer = await registerAndGetToken(SENDER);
    const coupon = await createCoupon({ active: false });

    const response = await request(app)
      .post(`/api/coupons/${coupon._id}/use`)
      .set("Authorization", `Bearer ${customer.token}`);

    expect(response.status).toBe(400);
  });
});

// --- MP-1.3: Push endpoint'lerinde kimlik + sahiplik ---

describe("POST /api/push/test (MP-1.3)", () => {
  it("kimlik doğrulaması olmadan 401 döner", async () => {
    const response = await request(app)
      .post("/api/push/test")
      .send({ subscription: { endpoint: "https://fcm/x", keys: { p256dh: "a", auth: "b" } } });

    expect(response.status).toBe(401);
  });

  it("başkasına ait abonelikle test gönderilemez (403)", async () => {
    const owner = await registerAndGetToken(SENDER);
    const other = await registerAndGetToken(RECIPIENT);

    await PushSubscriptionModel.create({
      endpoint: "https://fcm.test/owner-endpoint",
      keys: { p256dh: "pub", auth: "authkey" },
      userId: owner.userId,
      role: "customer",
    });

    const response = await request(app)
      .post("/api/push/test")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ subscription: { endpoint: "https://fcm.test/owner-endpoint", keys: { p256dh: "pub", auth: "authkey" } } });

    expect(response.status).toBe(403);
  });

  it("orderId hedeflemesi kaldırıldı — kimliksiz order bombardımanı yapılamaz", async () => {
    const response = await request(app)
      .post("/api/push/test")
      .send({ orderId: "665a1b2c3d4e5f6a7b8c9d0e" });

    expect(response.status).toBe(401);
  });
});

describe("POST /api/push/unsubscribe (MP-1.3)", () => {
  it("kimlik doğrulaması olmadan 401 döner", async () => {
    const response = await request(app)
      .post("/api/push/unsubscribe")
      .send({ endpoint: "https://fcm.test/x" });

    expect(response.status).toBe(401);
  });

  it("başkasının aboneliği silinemez (403) ve kayıt yerinde kalır", async () => {
    const owner = await registerAndGetToken(SENDER);
    const other = await registerAndGetToken(RECIPIENT);

    await PushSubscriptionModel.create({
      endpoint: "https://fcm.test/owner-endpoint",
      keys: { p256dh: "pub", auth: "authkey" },
      userId: owner.userId,
      role: "customer",
    });

    const response = await request(app)
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ endpoint: "https://fcm.test/owner-endpoint" });

    expect(response.status).toBe(403);

    const remaining = await PushSubscriptionModel.countDocuments({
      endpoint: "https://fcm.test/owner-endpoint",
    });
    expect(remaining).toBe(1);
  });

  it("sahibi kendi aboneliğini silebilir", async () => {
    const owner = await registerAndGetToken(SENDER);

    await PushSubscriptionModel.create({
      endpoint: "https://fcm.test/own-endpoint",
      keys: { p256dh: "pub", auth: "authkey" },
      userId: owner.userId,
      role: "customer",
    });

    const response = await request(app)
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ endpoint: "https://fcm.test/own-endpoint" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const remaining = await PushSubscriptionModel.countDocuments({
      endpoint: "https://fcm.test/own-endpoint",
    });
    expect(remaining).toBe(0);
  });

  it("anonim sipariş aboneliğini orderId bilen kişi silebilir", async () => {
    const someUser = await registerAndGetToken(SENDER);

    await PushSubscriptionModel.create({
      endpoint: "https://fcm.test/anon-endpoint",
      keys: { p256dh: "pub", auth: "authkey" },
      userId: "",
      orderId: "order-123",
      role: "customer",
    });

    const wrongOrder = await request(app)
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${someUser.token}`)
      .send({ endpoint: "https://fcm.test/anon-endpoint", orderId: "order-999" });
    expect(wrongOrder.status).toBe(403);

    const rightOrder = await request(app)
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${someUser.token}`)
      .send({ endpoint: "https://fcm.test/anon-endpoint", orderId: "order-123" });
    expect(rightOrder.status).toBe(200);

    const remaining = await PushSubscriptionModel.countDocuments({
      endpoint: "https://fcm.test/anon-endpoint",
    });
    expect(remaining).toBe(0);
  });
});

// ============================================
// A2: ENVANTER-SİPARİŞ ENTEGRASYONU
// ============================================

describe("Sipariş tamamlamada envanter stok düşümü (A2)", () => {
  async function createManagerToken() {
    const manager = await UserModel.create({
      name: "Env",
      surname: "Yonetici",
      username: "env_yonetici",
      email: "env-manager@test.com",
      password: "guclu-sifre-123",
      role: "manager",
      sessionRole: "manager",
    });
    const login = await request(app).post("/api/auth/login").send({
      email: manager.email,
      password: "guclu-sifre-123",
    });
    await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ role: "manager" });
    return login.body.token as string;
  }

  async function setupOrderFixture() {
    const InventoryItemModel = (await import("../models/InventoryItem")).default;
    const ProductModel = (await import("../models/Product")).default;

    const kahve = await InventoryItemModel.create({
      name: "Espresso Çekirdeği",
      unit: "kg",
      currentStock: 10,
      minStock: 2,
      reorderPoint: 3,
    });
    const sut = await InventoryItemModel.create({
      name: "Süt",
      unit: "liter",
      currentStock: 2,
      minStock: 1,
      reorderPoint: 1,
    });

    const latte = await ProductModel.create({
      name: "Test Latte",
      description: "A2 test",
      price: 30,
      category: "Sıcak İçecekler",
      image: "",
      ingredients: ["Espresso Çekirdeği", "Süt"],
      inStock: true,
    });

    const customer = await request(app).post("/api/auth/register").send({
      name: "Env",
      surname: "Musteri",
      username: "env_musteri",
      gender: "female",
      email: "env-musteri@test.com",
      password: "gizli123",
      phone: "05059998877",
      birthDate: "1995-05-10",
    });
    await UserModel.updateOne(
      { _id: customer.body.user.id },
      { $set: { balance: 100 } },
    );

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customer.body.token}`)
      .send({ items: [{ productId: latte._id.toString(), quantity: 2 }] });

    return { kahve, sut, latte, orderRes, customer };
  }

  it("tamamlanan sipariş malzeme stoklarını miktarla düşürür", async () => {
    const { kahve, sut, orderRes } = await setupOrderFixture();
    const managerToken = await createManagerToken();

    // pending → preparing → ready → completed
    for (const status of ["preparing", "ready", "completed"]) {
      const response = await request(app)
        .patch(`/api/orders/${orderRes.body.order.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status });
      expect(response.status).toBe(200);
    }

    const InventoryItemModel = (await import("../models/InventoryItem")).default;
    const kahveAfter = await InventoryItemModel.findById(kahve._id);
    const sutAfter = await InventoryItemModel.findById(sut._id);

    // 2 adet latte = 2 birim çekirdek + 2 birim süt
    expect(kahveAfter!.currentStock).toBe(8);
    expect(sutAfter!.currentStock).toBe(0);
  });

  it("eşik altına inen malzeme personel bildirimi üretir ve ürünü satıştan çeker", async () => {
    const { sut, latte, orderRes } = await setupOrderFixture();
    const managerToken = await createManagerToken();

    for (const status of ["preparing", "ready", "completed"]) {
      await request(app)
        .patch(`/api/orders/${orderRes.body.order.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status });
    }

    // Süt 2→0 düştü (reorderPoint 1) → low stock bildirimi + ürün satış dışı
    const NotificationModel = (await import("../models/Notification")).default;
    const ProductModel = (await import("../models/Product")).default;

    const warning = await NotificationModel.findOne({
      title: "Stok Uyarısı",
      message: /Süt/,
    });
    expect(warning).toBeTruthy();
    expect(warning!.targetRole).toBe("staff");

    const latteAfter = await ProductModel.findById(latte._id);
    expect(latteAfter!.inStock).toBe(false);
  });

  it("stok yeterli değilse sipariş tamamlama yine başarılı olur (best-effort)", async () => {
    const { orderRes } = await setupOrderFixture();
    const managerToken = await createManagerToken();

    // Stokları sıfıra çek — düşüm yine de tamamlamayı bozmamalı
    const InventoryItemModel = (await import("../models/InventoryItem")).default;
    await InventoryItemModel.updateMany({}, { $set: { currentStock: 0 } });

    const response = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "preparing" });
    const readyResponse = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "ready" });
    const completedResponse = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "completed" });

    expect(response.status).toBe(200);
    expect(readyResponse.status).toBe(200);
    expect(completedResponse.status).toBe(200);
  });
});
