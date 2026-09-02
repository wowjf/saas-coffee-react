// MP-2.12 + MP-2.14 + MP-2.11: şema index/validator/timestamp sertleştirmesinin
// kanıt testleri. mongodb-memory-server ile gerçek Mongo üzerinde çalışır.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import OrderModel from "./Order";
import NotificationModel from "./Notification";
import ProductModel from "./Product";
import CampaignModel from "./Campaign";
import ReviewModel from "./Review";
import TableSessionModel from "./TableSession";
import BalanceTopUpModel from "./BalanceTopUp";
import ChangeLogModel from "./ChangeLog";
import CouponModel from "./Coupon";
import ReservationModel from "./Reservation";
import WaiterCallModel from "./WaiterCall";
import UserModel from "./User";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "schema_hardening_test" });
  // Koleksiyon henüz yoksa Mongoose index'leri build etmez; test amaçlı
  // açılışta şema index'lerini senkronize ediyoruz.
  await Promise.all(
    [
      OrderModel,
      NotificationModel,
      ProductModel,
      CampaignModel,
      ReviewModel,
      TableSessionModel,
      BalanceTopUpModel,
      ChangeLogModel,
      CouponModel,
      ReservationModel,
      WaiterCallModel,
      UserModel,
    ].map((m) => m.syncIndexes()),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function collectionIndexes(name: string) {
  const indexes = await mongoose.connection.db
    .collection(name)
    .listIndexes()
    .toArray();
  return indexes.map((idx) => JSON.stringify(idx.key));
}

// --- MP-2.12: bileşik indexler ---

describe("MP-2.12: eksik indexler", () => {
  it("Order {userId:1,status:1,timestamp:-1} bileşik index'i oluşur", async () => {
    const keys = await collectionIndexes("orders");
    expect(keys).toContain(JSON.stringify({ userId: 1, status: 1, timestamp: -1 }));
  });

  it("Notification (userId,event) ve (targetRole,event) bileşik index'leri oluşur", async () => {
    const keys = await collectionIndexes("notifications");
    expect(keys).toContain(JSON.stringify({ userId: 1, event: 1 }));
    expect(keys).toContain(JSON.stringify({ targetRole: 1, event: 1 }));
  });

  it("Product {category:1} index'i oluşur", async () => {
    const keys = await collectionIndexes("products");
    expect(keys).toContain(JSON.stringify({ category: 1 }));
  });

  it("Campaign {active:1,category:1} index'i oluşur", async () => {
    const keys = await collectionIndexes("campaigns");
    expect(keys).toContain(JSON.stringify({ active: 1, category: 1 }));
  });

  it("Review orderId partial-unique index'i (comment dolu) oluşur", async () => {
    const indexes = await mongoose.connection.db
      .collection("reviews")
      .listIndexes()
      .toArray();
    const partial = indexes.find(
      (idx) => JSON.stringify(idx.key) === JSON.stringify({ orderId: 1 }),
    );
    expect(partial).toBeDefined();
    expect(partial!.unique).toBe(true);
    expect(partial!.partialFilterExpression).toEqual({ comment: { $gt: "" } });
  });

  it("partial-unique: aynı orderId'ye iki gerçek review yazılamaz, boş comment olabilir", async () => {
    const base = {
      orderId: new mongoose.Types.ObjectId().toString(),
      userId: "u1",
      userName: "A",
      productId: "p1",
      productName: "Latte",
      rating: 5,
    };
    await ReviewModel.create({ ...base, comment: "harikaydı" });
    await expect(
      ReviewModel.create({ ...base, comment: "ikinci yorum" }),
    ).rejects.toThrow(/duplicate key/);
    // comment boş kayıtlar partial filter dışında olduğundan çakışmaz.
    await expect(
      ReviewModel.create({ ...base, comment: "" }),
    ).resolves.toBeDefined();
  });

  it("TableSession {tableId:1,status:1} index'i oluşur", async () => {
    const keys = await collectionIndexes("tablesessions");
    expect(keys).toContain(JSON.stringify({ tableId: 1, status: 1 }));
  });

  it("Coupon code unique index'i oluşur", async () => {
    const keys = await collectionIndexes("coupons");
    expect(keys).toContain(JSON.stringify({ code: 1 }));
    const indexes = await mongoose.connection.db
      .collection("coupons")
      .listIndexes()
      .toArray();
    expect(indexes.find((idx) => idx.key?.code)?.unique).toBe(true);
  });

  it("User email unique index'i oluşur", async () => {
    const keys = await collectionIndexes("users");
    expect(keys).toContain(JSON.stringify({ email: 1 }));
  });

  it("BalanceTopUp {userId:1,timestamp:-1} index'i oluşur", async () => {
    const keys = await collectionIndexes(BalanceTopUpModel.collection.name);
    expect(keys).toContain(JSON.stringify({ userId: 1, timestamp: -1 }));
  });

  it("ChangeLog {timestamp:-1} index'i oluşur", async () => {
    const keys = await collectionIndexes("changelogs");
    expect(keys).toContain(JSON.stringify({ timestamp: -1 }));
  });

  it("WaiterCall {status:1,createdAt:-1} index'i oluşur", async () => {
    const keys = await collectionIndexes("waitercalls");
    expect(keys).toContain(JSON.stringify({ status: 1, createdAt: -1 }));
  });
});

// --- MP-2.14: şema validasyonları ---

describe("MP-2.14: şema validasyonları", () => {
  it("Product.price negatif reddedilir", async () => {
    await expect(
      ProductModel.create({ name: "X", price: -5, category: "Icecek" }),
    ).rejects.toThrow();
  });

  it("Order.total negatif reddedilir", async () => {
    await expect(
      OrderModel.create({ userId: "u1", userName: "A", items: [], total: -10 }),
    ).rejects.toThrow();
  });

  it("Order items quantity tam sayı olmalı — 1.5 reddedilir", async () => {
    await expect(
      OrderModel.create({
        userId: "u1",
        userName: "A",
        items: [
          {
            product: { name: "Latte", price: 50, category: "Icecek" },
            quantity: 1.5,
          },
        ],
        total: 75,
      }),
    ).rejects.toThrow(/tam sayi/);
  });

  it("Campaign.type bilinmeyen değer reddedilir", async () => {
    await expect(
      CampaignModel.create({
        title: "T",
        description: "D",
        type: "not_a_type",
        expiryDate: "2026-12-31",
        value: 10,
      }),
    ).rejects.toThrow(/not_a_type/);
  });

  it("Campaign.category bilinmeyen değer reddedilir", async () => {
    await expect(
      CampaignModel.create({
        title: "T",
        description: "D",
        category: "bogus",
        expiryDate: "2026-12-31",
        value: 10,
      }),
    ).rejects.toThrow(/bogus/);
  });

  it("Coupon.value percentage > 100 reddedilir, fixed >= 0 kabul edilir", async () => {
    const base = {
      code: "TEST" + Date.now(),
      title: "T",
      type: "percentage" as const,
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
    };
    await expect(CouponModel.create({ ...base, value: 150 })).rejects.toThrow(
      /0-100/,
    );
    await expect(CouponModel.create({ ...base, value: 20 })).resolves.toBeDefined();
    const fixed = await CouponModel.create({
      ...base,
      code: "FIX" + Date.now(),
      type: "fixed",
      value: 50,
    });
    expect(fixed.value).toBe(50);
  });

  it("Coupon.value fixed negatif reddedilir", async () => {
    await expect(
      CouponModel.create({
        code: "NEG" + Date.now(),
        title: "T",
        type: "fixed",
        value: -5,
        validFrom: "2026-01-01",
        validUntil: "2026-12-31",
      }),
    ).rejects.toThrow();
  });

  it("User.points negatif reddedilir", async () => {
    const u = new UserModel({
      name: "N",
      surname: "S",
      email: `neg-${Date.now()}@t.co`,
      password: "hashed123",
      points: -1,
    });
    await expect(u.validate()).rejects.toThrow(/negatif olamaz/i);
  });

  it("User.phone geçersiz format reddedilir, geçerli kabul edilir", async () => {
    const mk = (phone: string) =>
      new UserModel({
        name: "N",
        surname: "S",
        email: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@t.co`,
        password: "hashed123",
        phone,
      });
    await expect(mk("abc").validate()).rejects.toThrow(/Telefon/i);
    await expect(mk("03121234567").validate()).rejects.toThrow(/Telefon/i);
    await expect(mk("05051234567").validate()).resolves.toBeUndefined();
    await expect(mk("").validate()).resolves.toBeUndefined();
  });
});

// --- MP-2.11: timestamp standardı ---

describe("MP-2.11: timestamp standardı", () => {
  it("WaiterCall.createdAt Date olarak saklanır ve serialize'da ISO string olur", async () => {
    const call = await WaiterCallModel.create({
      tableNumber: "5",
      userId: "u1",
      userName: "A",
      type: "bill",
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    expect(call.createdAt).toBeInstanceOf(Date);
    const raw = call.toObject();
    expect(typeof raw.createdAt).toBe("object");
    expect(JSON.parse(JSON.stringify(raw)).createdAt).toBe("2026-09-01T12:00:00.000Z");
  });

  it("Reservation.date bozuk format reddedilir (YYYY-MM-DD validator)", async () => {
    await expect(
      ReservationModel.create({
        userId: "u1",
        userName: "A",
        userPhone: "05051234567",
        tableNumber: "3",
        date: "01.09.2026",
        time: "14:00",
        guestCount: 2,
      }),
    ).rejects.toThrow(/YYYY-AA-GG/);
  });

  it("Reservation.time bozuk format reddedilir (HH:mm validator)", async () => {
    await expect(
      ReservationModel.create({
        userId: "u1",
        userName: "A",
        userPhone: "05051234567",
        tableNumber: "3",
        date: "2026-09-10",
        time: "25:99",
        guestCount: 2,
      }),
    ).rejects.toThrow(/SS:dd/);
  });

  it("Campaign.expiryDate bozuk format reddedilir", async () => {
    await expect(
      CampaignModel.create({
        title: "T",
        description: "D",
        expiryDate: "yarın",
        value: 10,
      }),
    ).rejects.toThrow(/YYYY-AA-GG/);
  });

  it("Coupon.validFrom/validUntil bozuk format reddedilir", async () => {
    await expect(
      CouponModel.create({
        code: "BAD" + Date.now(),
        title: "T",
        type: "percentage",
        value: 10,
        validFrom: "2026/01/01",
        validUntil: "2026-12-31",
      }),
    ).rejects.toThrow(/YYYY-AA-GG/);
  });

  it("Subscription.startDate bozuk format reddedilir", async () => {
    const { default: SubscriptionModel } = await import("./Subscription");
    await expect(
      SubscriptionModel.create({
        userId: "sub-u1-" + Date.now(),
        planId: "p1",
        planName: "Gold",
        startDate: "geçen ay",
        endDate: "2027-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(/ISO/);
  });
});
