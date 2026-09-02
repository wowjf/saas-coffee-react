import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";
import UserModel from "../models/User";
import ProductModel from "../models/Product";
import OrderModel from "../models/Order";
import StaffModel from "../models/Staff";
import CampaignModel from "../models/Campaign";
import BalanceTopUpModel from "../models/BalanceTopUp";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

const VALID_REGISTER = {
  name: "Deniz",
  surname: "Yilmaz",
  username: "deniz_yilmaz",
  gender: "female",
  email: "deniz@test.com",
  password: "gizli123",
  phone: "05051234567",
  birthDate: "1995-05-10",
};

async function registerUser(overrides: Record<string, unknown> = {}) {
  const payload = { ...VALID_REGISTER, ...overrides };
  return request(app).post("/api/auth/register").send(payload);
}

async function getTokenFor(overrides: Record<string, unknown> = {}) {
  const response = await registerUser(overrides);
  if (response.status !== 201) {
    throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    token: response.body.token as string,
    userId: (response.body.user?.id ?? response.body.user?._id) as string,
    user: response.body.user,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "api_test" });

  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  // server.ts ile aynı sıra: errorHandler route mount'undan sonra gelmelidir.
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
});

describe("GET /api/health", () => {
  it("returns ok with a timestamp", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.timestamp).toBe("string");
    expect(new Date(response.body.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("does not require authentication", async () => {
    const response = await request(app).get("/api/health").set("Authorization", "");
    expect(response.status).toBe(200);
  });
});

describe("POST /api/auth/register", () => {
  it("creates a customer account and returns a token", async () => {
    const response = await registerUser();

    expect(response.status).toBe(201);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.user.email).toBe(VALID_REGISTER.email);
    expect(response.body.user.role).toBe("customer");
    expect(response.body.user.password).toBeUndefined();
  });

  it("rejects missing required fields with 400", async () => {
    const response = await registerUser({ email: "" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeTruthy();
  });

  it("rejects a short password with 400", async () => {
    const response = await registerUser({ password: "123" });
    expect(response.status).toBe(400);
  });

  it("rejects an invalid username format with 400", async () => {
    const response = await registerUser({ username: "X" });
    expect(response.status).toBe(400);
  });

  it("rejects an invalid email with 400", async () => {
    const response = await registerUser({ email: "not-an-email" });
    expect(response.status).toBe(400);
  });

  it("rejects an invalid Turkish phone number with 400", async () => {
    const response = await registerUser({ phone: "12345" });
    expect(response.status).toBe(400);
  });

  it("rejects an unrealistic birth date with 400", async () => {
    const response = await registerUser({ birthDate: String(new Date().getFullYear() - 5) });
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate username with 409", async () => {
    await registerUser();
    const response = await registerUser({ email: "other@test.com" });

    expect(response.status).toBe(409);
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser();
    const response = await registerUser({ username: "baska_kullanici" });

    expect(response.status).toBe(409);
  });

  it("does not store the password in plain text", async () => {
    await registerUser();
    const user = await UserModel.findOne({ email: VALID_REGISTER.email });

    expect(user).toBeTruthy();
    expect(user!.password).not.toBe(VALID_REGISTER.password);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with email and returns a fresh token", async () => {
    await registerUser();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_REGISTER.email, password: VALID_REGISTER.password });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.user.email).toBe(VALID_REGISTER.email);
  });

  it("logs in with username instead of email", async () => {
    await registerUser();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: VALID_REGISTER.username, password: VALID_REGISTER.password });

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe(VALID_REGISTER.username);
  });

  it("rejects a wrong password with 401 and a generic message", async () => {
    await registerUser();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_REGISTER.email, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown user with the same generic 401 (no enumeration)", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.com", password: "whatever" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user for a valid token", async () => {
    const { token } = await getTokenFor();

    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("rejects an invalid token with 401", async () => {
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/products", () => {
  it("lists products without authentication", async () => {
    await ProductModel.create({ name: "Filtre Kahve", price: 60, category: "kahve" });
    await ProductModel.create({ name: "Latte", price: 75, category: "kahve" });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((item: { name: string }) => item.name)).toEqual(
      expect.arrayContaining(["Filtre Kahve", "Latte"]),
    );
  });

  it("returns an empty list when no products exist", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("POST /api/orders", () => {
  it("creates an order, deducts the balance and returns status pending", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });

    const product = await ProductModel.create({ name: "Latte", price: 75, category: "kahve" });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 2 }] });

    expect(response.status).toBe(201);
    expect(response.body.order.status).toBe("pending");
    expect(response.body.order.total).toBe(150);
    expect(response.body.order.items).toHaveLength(1);
    expect(response.body.order.items[0].quantity).toBe(2);
    expect(response.body.user.balance).toBe(350);

    const storedOrder = await OrderModel.findById(response.body.order._id ?? response.body.order.id);
    expect(storedOrder).toBeTruthy();
    expect(storedOrder!.status).toBe("pending");
  });

  it("rejects unauthenticated requests with 401", async () => {
    const response = await request(app).post("/api/orders").send({ items: [] });

    expect(response.status).toBe(401);
  });

  it("rejects an empty items array with 400", async () => {
    const { token } = await getTokenFor();

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [] });

    expect(response.status).toBe(400);
  });

  it("rejects an order for an out-of-stock product with 400 (DEF-1 fixed)", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "V60", price: 80, category: "kahve", inStock: false });

    // DEF-1 was fixed with MP-0.5/MP-0.6 (asyncHandler + central errorHandler):
    // the out-of-stock rejection now surfaces as a proper HTTP 400 response
    // instead of hanging the request and escaping as an unhandled rejection.
    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("PRODUCT_OUT_OF_STOCK");
    expect(response.body.message).toBeTruthy();
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("rejects an order when the balance is insufficient with 409", async () => {
    const { token } = await getTokenFor();
    const product = await ProductModel.create({ name: "Gourmet Tabak", price: 999, category: "yemek" });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });

    expect(response.status).toBe(409);
  });

  it("does not create an order document when the balance is insufficient", async () => {
    const { token } = await getTokenFor();
    const product = await ProductModel.create({ name: "Gourmet Tabak 2", price: 999, category: "yemek" });

    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });

    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("rejects a zero quantity with 400 (MP-2.5: clamp yerine net reddetme)", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Cay", price: 20, category: "icecek" });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 0 }] });

    expect(response.status).toBe(400);
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("rejects a fractional or above-50 quantity with 400 (MP-2.5)", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Cay", price: 20, category: "icecek" });

    const fractional = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1.5 }] });
    expect(fractional.status).toBe(400);

    const tooMany = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 51 }] });
    expect(tooMany.status).toBe(400);

    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("accepts a valid quantity of 50 (MP-2.5 üst sınır)", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Cay", price: 10, category: "icecek" });

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 50 }] });

    expect(response.status).toBe(201);
    expect(response.body.order.items[0].quantity).toBe(50);
    expect(response.body.order.total).toBe(500);
  });

  it("rejects more than 50 order lines with 400 (MP-2.5)", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 5000 } });
    const product = await ProductModel.create({ name: "Cay", price: 10, category: "icecek" });

    const items = Array.from({ length: 51 }, () => ({
      product: { id: product._id.toString() },
      quantity: 1,
    }));

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items });

    expect(response.status).toBe(400);
    expect(await OrderModel.countDocuments()).toBe(0);
  });
});

describe("GET /api/orders", () => {
  it("lists the authenticated customer's orders", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Espresso", price: 50, category: "kahve" });

    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });

    const response = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].items[0].product.name).toBe("Espresso");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/orders");
    expect(response.status).toBe(401);
  });
});

describe("role-based access control (integration)", () => {
  it("denies a customer access to the manager-only user list with 403", async () => {
    const { token } = await getTokenFor();

    const response = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("denies a customer access to creating products with 403", async () => {
    const { token } = await getTokenFor();

    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Kaçak Ürün", price: 10, category: "test" });

    expect(response.status).toBe(403);
    expect(await ProductModel.countDocuments({ name: "Kaçak Ürün" })).toBe(0);
  });
});

// --- MP-0.1: Müşterinin kendi bakiyesini yüklemesi (kendi kendine para basma) ---

async function createManagerAndGetToken(email = "yonetici@test.com") {
  const manager = await UserModel.create({
    name: "Yonetici",
    surname: "Test",
    username: "yonetici_test",
    gender: "female",
    email,
    password: "guclu-sifre-123",
    phone: "05001112233",
    birthDate: "1990-01-01",
    role: "manager",
    sessionRole: "manager",
  });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "guclu-sifre-123" });

  if (login.status !== 200) {
    throw new Error(`manager login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  // Giriş akışı sessionRole'u sıfırlar; yönetici oturumunu tekrar yükseltir
  // (üretimde role seçim ekranıyla aynı akış).
  const elevate = await request(app)
    .post("/api/auth/session-role")
    .set("Authorization", `Bearer ${login.body.token}`)
    .send({ role: "manager" });

  if (elevate.status !== 200) {
    throw new Error(`manager session-role failed: ${elevate.status} ${JSON.stringify(elevate.body)}`);
  }

  return { token: login.body.token as string, managerId: manager._id.toString() };
}

describe("POST /api/users/me/balance (MP-0.1: self top-up)", () => {
  it("rejects a customer with 403 and does not change the balance", async () => {
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 10 } });

    const response = await request(app)
      .post("/api/users/me/balance")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10000 });

    expect(response.status).toBe(403);

    const user = await UserModel.findById(userId);
    expect(user!.balance).toBe(10);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const response = await request(app)
      .post("/api/users/me/balance")
      .send({ amount: 100 });

    expect(response.status).toBe(401);
  });

  it("still allows a manager session to top up their own balance", async () => {
    const { token } = await createManagerAndGetToken();

    const response = await request(app)
      .post("/api/users/me/balance")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250 });

    expect(response.status).toBe(200);
    expect(response.body.user.balance).toBe(250);
  });
});

describe("server-side revenue/bonus calculation (MP-0.1)", () => {
  it("ignores client-supplied revenueAmount/bonusAmount on the staff top-up endpoint", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    const { userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 0 } });

    const response = await request(app)
      .post(`/api/users/${userId}/balance`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount: 100, revenueAmount: 1, bonusAmount: 9999 });

    expect(response.status).toBe(200);

    const topUps = await BalanceTopUpModel.find({ userId: userId.toString() }).sort({ timestamp: 1 });

    expect(topUps).toHaveLength(1);
    // İstemciden gelen sahte değerler yok sayılır: ciro = yükleme, bonus = 0.
    expect(topUps[0].amount).toBe(100);
    expect(topUps[0].bonusAmount).toBe(0);
  });

  it("applies the selected active financial campaign server-side", async () => {
    const { token, userId } = await getTokenFor();

    const campaign = await CampaignModel.create({
      title: "Yukleme Bonusu",
      description: "Yuklemelerde %10 bonus",
      category: "financial",
      type: "balance_bonus",
      value: 10,
      active: true,
      startDate: "2020-01-01",
      expiryDate: "2099-12-31",
      minLoadAmount: 50,
    });

    const select = await request(app)
      .post(`/api/campaigns/select/${campaign._id.toString()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(select.status).toBe(200);

    const { token: managerToken } = await createManagerAndGetToken();

    const response = await request(app)
      .post(`/api/users/${userId}/balance`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.user.balance).toBe(110); // 100 + sunucu tarafında %10 bonus

    const topUps = await BalanceTopUpModel.find({ userId: userId.toString() }).sort({ timestamp: 1 });

    expect(topUps[0].amount).toBe(100);
    expect(topUps[0].bonusAmount).toBe(10);
  });

  it("does not apply a bonus below the campaign threshold", async () => {
    const { token, userId } = await getTokenFor();

    const campaign = await CampaignModel.create({
      title: "Esik Altina Bonus Yok",
      description: "50 TL uzeri %10 bonus",
      category: "financial",
      type: "balance_bonus",
      value: 10,
      active: true,
      startDate: "2020-01-01",
      expiryDate: "2099-12-31",
      minLoadAmount: 50,
    });

    await request(app)
      .post(`/api/campaigns/select/${campaign._id.toString()}`)
      .set("Authorization", `Bearer ${token}`);

    const { token: managerToken } = await createManagerAndGetToken();

    const response = await request(app)
      .post(`/api/users/${userId}/balance`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ amount: 30 });

    expect(response.status).toBe(200);
    expect(response.body.user.balance).toBe(30);
  });
});

// --- MP-0.2: Kayıtta e-posta ile rol yükseltme ---

describe("POST /api/auth/register role assignment (MP-0.2)", () => {
  it("creates a customer even when the email is a built-in manager address", async () => {
    const response = await registerUser({
      email: "yonetici@bancho.cafe",
      username: "sahte_yonetici",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("customer");
    expect(response.body.user.accountRole).toBe("customer");

    const stored = await UserModel.findOne({ email: "yonetici@bancho.cafe" });
    expect(stored!.role).toBe("customer");
  });

  it("creates a customer even when a matching Staff record exists", async () => {
    await StaffModel.create({
      name: "Kayitli",
      surname: "Personel",
      email: "gelecekteki.personel@test.com",
      role: "staff",
      status: "İzinli",
    });

    const response = await registerUser({
      email: "gelecekteki.personel@test.com",
      username: "sahte_personel",
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("customer");

    const stored = await UserModel.findOne({ email: "gelecekteki.personel@test.com" });
    expect(stored!.role).toBe("customer");
  });

  it("creates a customer even when the email is set in DEFAULT_MANAGER_EMAILS env", async () => {
    const previous = process.env.DEFAULT_MANAGER_EMAILS;
    process.env.DEFAULT_MANAGER_EMAILS = "env-yonetici@test.com";

    try {
      const response = await registerUser({
        email: "env-yonetici@test.com",
        username: "env_yonetici",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("customer");
    } finally {
      if (previous === undefined) {
        delete process.env.DEFAULT_MANAGER_EMAILS;
      } else {
        process.env.DEFAULT_MANAGER_EMAILS = previous;
      }
    }
  });
});

// --- MP-0.8: Parola sıfırlamada e-posta sayımı ---

describe("POST /api/auth/reset-password (MP-0.8: enumeration)", () => {
  it("returns the same response for a registered and an unknown email", async () => {
    await registerUser();

    const registered = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: VALID_REGISTER.email });

    const unknown = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "ghost@test.com" });

    expect(registered.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(registered.body.success).toBe(true);
    expect(unknown.body.success).toBe(true);
    expect(registered.body.message).toBe(unknown.body.message);
    expect(registered.body.message).toBeTruthy();
  });

  it("does not leak existence through timing-sensitive success values", async () => {
    await registerUser();

    const registered = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: VALID_REGISTER.email });

    const unknown = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "hayalet@test.com" });

    expect(JSON.stringify(registered.body)).toBe(JSON.stringify(unknown.body));
  });
});

// --- MP-1.1: Hesap bazlı login kilitleme ---

describe("POST /api/auth/login account lockout (MP-1.1)", () => {
  it("locks the account for 15 minutes after 5 failed attempts, even with the correct password", async () => {
    await registerUser();

    const attempt = (password: string) =>
      request(app).post("/api/auth/login").send({ email: VALID_REGISTER.email, password });

    for (let i = 0; i < 5; i += 1) {
      const response = await attempt("yanlis-sifre");
      expect(response.status).toBe(401);
    }

    const user = await UserModel.findOne({ email: VALID_REGISTER.email });
    expect(user!.failedLoginAttempts).toBe(5);
    expect(user!.lockUntil).toBeTruthy();
    expect(new Date(user!.lockUntil!).getTime()).toBeGreaterThan(Date.now());

    // Kilitliyken dogru sifre bile red edilir ve kilitkirici mesaj vermez.
    const lockedOut = await attempt(VALID_REGISTER.password);
    expect(lockedOut.status).toBe(401);
    expect(lockedOut.body.code).toBe("INVALID_CREDENTIALS");

    // Sayac kilit sirasinda artmaya devam etmez (kilit kontrolu once gelir).
    const after = await UserModel.findOne({ email: VALID_REGISTER.email });
    expect(after!.failedLoginAttempts).toBe(5);
  });

  it("resets the counter after a successful login", async () => {
    await registerUser();

    const attempt = (password: string) =>
      request(app).post("/api/auth/login").send({ email: VALID_REGISTER.email, password });

    await attempt("yanlis-sifre");
    await attempt("yanlis-sifre");

    const success = await attempt(VALID_REGISTER.password);
    expect(success.status).toBe(200);

    const user = await UserModel.findOne({ email: VALID_REGISTER.email });
    expect(user!.failedLoginAttempts).toBe(0);
    expect(user!.lockUntil).toBeNull();

    // Sifirlama sonrasi tekrar 4 hata kilide dusmez.
    await attempt("yanlis-sifre");
    const stillOpen = await attempt(VALID_REGISTER.password);
    expect(stillOpen.status).toBe(200);
  });

  it("lets an expired lock pass through (lock is time-bound)", async () => {
    await registerUser();

    await UserModel.updateOne(
      { email: VALID_REGISTER.email },
      { $set: { failedLoginAttempts: 5, lockUntil: new Date(Date.now() - 1000) } },
    );

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_REGISTER.email, password: VALID_REGISTER.password });

    expect(response.status).toBe(200);

    const user = await UserModel.findOne({ email: VALID_REGISTER.email });
    expect(user!.failedLoginAttempts).toBe(0);
    expect(user!.lockUntil).toBeNull();
  });

  it("does not lock unknown accounts (no enumeration side channel)", async () => {
    for (let i = 0; i < 6; i += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "ghost@test.com", password: "yanlis-sifre" });
      expect(response.status).toBe(401);
    }

    // Hayalet hesap icin DB'de kayit olusmaz — login yolu user olusturmaz.
    const count = await UserModel.countDocuments({ email: "ghost@test.com" });
    expect(count).toBe(0);
  });
});

// --- MP-2.13: Manager listelerinde pagination ---

describe("GET /api/users pagination (MP-2.13)", () => {
  it("returns an array by default with X-Total-Count header (backward compatible)", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    await getTokenFor({ email: "sayfa1@test.com", username: "sayfa1" });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
    expect(response.headers["x-total-count"]).toBe(String(response.body.length));
  });

  it("supports ?page=&limit= with envelope for new clients", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    for (let i = 1; i <= 5; i += 1) {
      await getTokenFor({ email: `sayfa_uye${i}@test.com`, username: `sayfa_uye${i}` });
    }

    const response = await request(app)
      .get("/api/users?page=1&limit=3&envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(3);
    expect(response.body.total).toBe(6); // manager + 5 yeni kullanıcı
  });

  it("caps limit at 200 and defaults to 50", async () => {
    const { token: managerToken } = await createManagerAndGetToken();

    const capped = await request(app)
      .get("/api/users?limit=9999&envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(capped.body.limit).toBe(200);

    const fallback = await request(app)
      .get("/api/users?envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(fallback.body.limit).toBe(50);
  });

  it("serves the second page with correct offset", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    for (let i = 1; i <= 4; i += 1) {
      await getTokenFor({ email: `sayfa2_uye${i}@test.com`, username: `sayfa2_uye${i}` });
    }

    const page1 = await request(app)
      .get("/api/users?page=1&limit=3&envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);
    const page2 = await request(app)
      .get("/api/users?page=2&limit=3&envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(2); // 5 kullanıcı, limit 3 → 2. sayfada 2
    const page1Ids = page1.body.items.map((u: any) => u.id ?? u._id);
    const page2Ids = page2.body.items.map((u: any) => u.id ?? u._id);
    expect(page2Ids.some((id: string) => page1Ids.includes(id))).toBe(false);
  });
});

describe("GET /api/balance-top-ups pagination (MP-2.13)", () => {
  it("requires manager role", async () => {
    const { token } = await getTokenFor();

    const response = await request(app)
      .get("/api/balance-top-ups")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("returns a paginated envelope with X-Total-Count", async () => {
    const { token: managerToken, managerId } = await createManagerAndGetToken();

    for (let i = 0; i < 4; i += 1) {
      await BalanceTopUpModel.create({
        userId: managerId,
        userName: "Yonetici Test",
        userEmail: "yonetici@test.com",
        amount: 100,
        creditedAmount: 100,
        bonusAmount: 0,
        timestamp: new Date(Date.now() + i),
      });
    }

    const response = await request(app)
      .get("/api/balance-top-ups?page=1&limit=2&envelope=1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBe(4);
    expect(response.headers["x-total-count"]).toBe("4");
  });
});

// --- MP-2.15: Atomik iade ---

describe("PATCH /api/orders/:id/status refund (MP-2.15)", () => {
  it("refunds the balance exactly once on rejection; a second reject attempt fails", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Iade Kahve", price: 120, category: "kahve" });

    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 2 }] });
    expect(created.status).toBe(201);
    expect(created.body.user.balance).toBe(260); // 500 - 240

    const orderId = created.body.order._id ?? created.body.order.id;

    const rejected = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "rejected", cancelReason: "test" });
    expect(rejected.status).toBe(200);

    const afterRefund = await UserModel.findById(userId);
    expect(afterRefund!.balance).toBe(500); // 260 + 240 iade

    // Aynı order ikinci kez reddedilemez — bakiye tekrar iade edilmez.
    const rejectedAgain = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "rejected", cancelReason: "tekrar" });
    expect(rejectedAgain.status).toBe(400);

    const afterSecondAttempt = await UserModel.findById(userId);
    expect(afterSecondAttempt!.balance).toBe(500);
  });

  it("awards loyalty points exactly once even for concurrent completion attempts", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 500 } });
    const product = await ProductModel.create({ name: "Puan Kahve", price: 100, category: "kahve" });

    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }] });
    expect(created.status).toBe(201);

    const orderId = created.body.order._id ?? created.body.order.id;

    // pending → preparing → ready geçişleri
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "preparing" });
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "ready" });

    const before = await UserModel.findById(userId);
    const pointsBefore = before!.points;

    // İki eşzamanlı tamamlama isteği — loyaltyProcessed guard'ı atomik.
    const [a, b] = await Promise.all([
      request(app).patch(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: "completed" }),
      request(app).patch(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: "completed" }),
    ]);

    // Yarışta kazanan 200 döner; kaybeden atomik status guard'ına takılır
    // ve 409 (çakışma) alır — puan tek sefer verilir.
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const after = await UserModel.findById(userId);
    // Ürün başına 100 puan (LOYALTY_POINTS_PER_COMPLETED_ITEM), total 100/10=10 → max(100, 10) = 100.
    const expectedAward = 100;
    expect(after!.points).toBe(pointsBefore + expectedAward);
  });
});

// --- MP-2.5: Masa siparişi bakiye kontrolü ---

describe("POST /api/orders table session balance guard (MP-2.5)", () => {
  it("rejects a table order whose accumulated debt exceeds the participant balance", async () => {
    const { token: managerToken } = await createManagerAndGetToken();
    const { token, userId } = await getTokenFor();
    await UserModel.updateOne({ _id: userId }, { $set: { balance: 150 } });
    const product = await ProductModel.create({ name: "Masa Kahve", price: 100, category: "kahve" });

    const table = await request(app)
      .post("/api/tables/initialize")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(table.status).toBe(200);

    const joined = await request(app)
      .post("/api/table-sessions/join-or-create")
      .set("Authorization", `Bearer ${token}`)
      .send({ tableNumber: "1" });
    expect(joined.status).toBe(201);

    const sessionToken = joined.body.session.sessionToken;

    // 100'lük masa siparişi — bakiye 150 olduğu için geçmeli.
    const first = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: product._id.toString() }, quantity: 1 }], tableSessionToken: sessionToken });
    expect(first.status).toBe(201);

    // Borç 100; bakiye 150. 60'lık ikinci sipariş toplam borcu 160 yapar → 400.
    const cheapProduct = await ProductModel.create({ name: "Masa Cay", price: 60, category: "icecek" });
    const second = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: cheapProduct._id.toString() }, quantity: 1 }], tableSessionToken: sessionToken });
    expect(second.status).toBe(400);

    // 50'lik sipariş ise borcu 150 yapar → bakiyeye eşit, geçmeli.
    const fittingProduct = await ProductModel.create({ name: "Masa Su", price: 50, category: "icecek" });
    const third = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ product: { id: fittingProduct._id.toString() }, quantity: 1 }], tableSessionToken: sessionToken });
    expect(third.status).toBe(201);
  });
});
