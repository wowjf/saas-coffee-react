// Vardiya sistemi + personel rol modeli regression testleri:
// (a) personel session-role customer reddi,
// (b) vardiya başlat → çift başlat 409 → bitir talebi → müdür onayı,
// (c) mudur olmayan personelin review 403,
// (d) rezervasyon GET'i sıradan staff'a 403, mudür + manager'a 200.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";
import UserModel from "../models/User";
import StaffModel from "../models/Staff";
import ShiftModel from "../models/Shift";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

interface TestAccount {
  token: string;
  id: string;
}

async function registerCustomer(email: string, username: string): Promise<TestAccount> {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Vardiya",
      surname: "Personeli",
      username,
      gender: "female",
      email,
      password: "GizliParola1",
      phone: "05051112233",
      birthDate: "1995-05-05",
    });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, id: response.body.user.id as string };
}

// Kullanıcıyı DB'den personel/müdür yapar (kayıt ucu rol yükseltmez —
// mevcut testlerdeki DB üstünden rol atama kalıbı) ve Staff kaydı açar.
async function promoteToStaff(
  account: TestAccount,
  role: "staff" | "manager",
  staffRole: string,
): Promise<void> {
  const user = await UserModel.findById(account.id);
  expect(user).toBeTruthy();

  await StaffModel.findOneAndUpdate(
    { email: user!.email },
    {
      $set: {
        email: user!.email,
        name: user!.name,
        surname: user!.surname,
        role,
        staffRole,
        status: "İzinli",
      },
    },
    { upsert: true },
  );

  // tokenVersion değişmediği için mevcut token geçerli kalır; rol etkisi
  // account role üzerinden çözümlenir.
  await UserModel.updateOne({ _id: account.id }, { $set: { role } });
}

// Personel oturumunu session-role ile staff etkisine yükseltir (login
// sonrası sessionRole null'dır; getEffectiveRole staff için her koşulda
// staff döndürse de akışı üretimle aynı tutmak için yükseltiyoruz).
async function elevateToStaffSession(account: TestAccount) {
  const response = await request(app)
    .post("/api/auth/session-role")
    .set("Authorization", `Bearer ${account.token}`)
    .send({ role: "staff" });
  expect(response.status).toBe(200);
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "shifts_test" });

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
});

describe("(a) Personel hesabı müşteri olarak devam edemez", () => {
  it("rejects staff session-role customer with 403", async () => {
    const account = await registerCustomer("vardiya-staff@test.com", "vardiya_staff");
    await promoteToStaff(account, "staff", "garson");
    await elevateToStaffSession(account);

    const response = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ role: "customer" });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("müşteri olarak devam edemez");
  });

  it("rejects manager session-role customer with 403", async () => {
    const account = await registerCustomer("vardiya-manager@test.com", "vardiya_manager");
    await promoteToStaff(account, "manager", "mudur");

    const elevate = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ role: "manager" });
    expect(elevate.status).toBe(200);

    const response = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ role: "customer" });

    expect(response.status).toBe(403);
  });

  it("still lets a plain customer account switch (no regression)", async () => {
    const account = await registerCustomer("vardiya-musteri@test.com", "vardiya_musteri");

    const response = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${account.token}`)
      .send({ role: "customer" });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("customer");
  });
});

describe("(b) Vardiya akışı: başlat → 409 → bitirme talebi → onay", () => {
  it("runs the full happy path", async () => {
    const garson = await registerCustomer("garson@test.com", "garson_akisy");
    await promoteToStaff(garson, "staff", "garson");
    await elevateToStaffSession(garson);

    // Başlat
    const start = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${garson.token}`);
    expect(start.status).toBe(201);
    expect(start.body.status).toBe("active");
    expect(start.body.staffRole).toBe("garson");

    // Çift başlat → 409
    const second = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${garson.token}`);
    expect(second.status).toBe(409);

    // Bitirme talebi
    const endRequest = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${garson.token}`)
      .send({ reason: "vardiya_bitti" });
    expect(endRequest.status).toBe(200);
    expect(endRequest.body.status).toBe("end_requested");
    expect(endRequest.body.endRequest.reason).toBe("vardiya_bitti");

    // Geçersiz reason başka vardiyada 400 dönmeli — aktif vardiya kalmadığı
    // için burada 404 beklenir (aktif vardiya yok). Önce kendi geçmişi.
    const myShifts = await request(app)
      .get("/api/shifts/my")
      .set("Authorization", `Bearer ${garson.token}`);
    expect(myShifts.status).toBe(200);
    expect(myShifts.body.length).toBe(1);

    // Talebi incelemeden önce reddetme (reject) akışını da kapsayalım:
    const mudur = await registerCustomer("mudur@test.com", "mudur_akisy");
    await promoteToStaff(mudur, "staff", "mudur");
    await elevateToStaffSession(mudur);

    // Reject → talep düşer, vardiya active'a döner.
    const reject = await request(app)
      .patch(`/api/shifts/${endRequest.body.id}/review`)
      .set("Authorization", `Bearer ${mudur.token}`)
      .send({ approve: false, reviewNote: "Yoğunluk var, 15 dk daha" });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe("active");
    expect(reject.body.endRequest).toBeNull();

    // Yeni bitirme talebi + onay → completed + endedAt.
    const endRequest2 = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${garson.token}`)
      .send({ reason: "diger", customNote: "Günün sonu" });
    expect(endRequest2.status).toBe(200);

    const approve = await request(app)
      .patch(`/api/shifts/${endRequest2.body.id}/review`)
      .set("Authorization", `Bearer ${mudur.token}`)
      .send({ approve: true });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe("completed");
    expect(approve.body.endedAt).toBeTruthy();

    // Onaydan sonra personel bildirimi oluşmuş olmalı.
    const NotificationModel = (await import("../models/Notification")).default;
    const notification = await NotificationModel.findOne({ userId: garson.id }).sort({ timestamp: -1 });
    expect(notification).toBeTruthy();
    expect(notification!.message).toContain("onaylandı");

    // Onay sonrası yeni vardiya başlatılabilir.
    const restart = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${garson.token}`);
    expect(restart.status).toBe(201);
  });

  it("rejects end-request without active shift with 404", async () => {
    const barista = await registerCustomer("barista@test.com", "barista_akisy");
    await promoteToStaff(barista, "staff", "bar");
    await elevateToStaffSession(barista);

    const response = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${barista.token}`)
      .send({ reason: "vardiya_bitti" });

    expect(response.status).toBe(404);
  });

  it("rejects end-request with invalid reason with 400", async () => {
    const barista = await registerCustomer("barista2@test.com", "barista2_akisy");
    await promoteToStaff(barista, "staff", "bar");
    await elevateToStaffSession(barista);

    await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${barista.token}`);

    const response = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${barista.token}`)
      .send({ reason: "gecerli-degil" });

    expect(response.status).toBe(400);
  });
});

describe("(c) Vardiya review yetkisi", () => {
  it("rejects non-mudur staff review with 403", async () => {
    const garson = await registerCustomer("review-garson@test.com", "review_garson");
    await promoteToStaff(garson, "staff", "garson");
    await elevateToStaffSession(garson);

    await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${garson.token}`);

    const endRequest = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${garson.token}`)
      .send({ reason: "mola" });
    expect(endRequest.status).toBe(200);

    const asci = await registerCustomer("asci@test.com", "asci_akisy");
    await promoteToStaff(asci, "staff", "mutfak");
    await elevateToStaffSession(asci);

    const response = await request(app)
      .patch(`/api/shifts/${endRequest.body.id}/review`)
      .set("Authorization", `Bearer ${asci.token}`)
      .send({ approve: true });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("müdür yetkisi");

    // Talep değinilmediği için hala end_requested olmalı.
    const shift = await ShiftModel.findById(endRequest.body.id);
    expect(shift!.status).toBe("end_requested");
  });

  it("allows a manager account to review", async () => {
    const garson = await registerCustomer("review2-garson@test.com", "review2_garson");
    await promoteToStaff(garson, "staff", "garson");
    await elevateToStaffSession(garson);

    const start = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${garson.token}`);
    const endRequest = await request(app)
      .post("/api/shifts/end-request")
      .set("Authorization", `Bearer ${garson.token}`)
      .send({ reason: "acil_durum" });
    expect(endRequest.status).toBe(200);

    const manager = await registerCustomer("review-manager@test.com", "review_manager");
    await promoteToStaff(manager, "manager", "mudur");

    const elevate = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ role: "manager" });
    expect(elevate.status).toBe(200);

    const response = await request(app)
      .patch(`/api/shifts/${endRequest.body.id}/review`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ approve: true });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("completed");
    expect(start.body.status).toBe("active");
  });
});

describe("(d) Rezervasyon görünürlüğü", () => {
  it("rejects plain staff (403) but allows mudur staff and manager (200)", async () => {
    const garson = await registerCustomer("rez-garson@test.com", "rez_garson");
    await promoteToStaff(garson, "staff", "garson");
    await elevateToStaffSession(garson);

    const garsonResponse = await request(app)
      .get("/api/reservations")
      .set("Authorization", `Bearer ${garson.token}`);
    expect(garsonResponse.status).toBe(403);

    const mudur = await registerCustomer("rez-mudur@test.com", "rez_mudur");
    await promoteToStaff(mudur, "staff", "mudur");
    await elevateToStaffSession(mudur);

    const mudurResponse = await request(app)
      .get("/api/reservations")
      .set("Authorization", `Bearer ${mudur.token}`);
    expect(mudurResponse.status).toBe(200);

    const manager = await registerCustomer("rez-manager@test.com", "rez_manager");
    await promoteToStaff(manager, "manager", "mudur");

    const elevate = await request(app)
      .post("/api/auth/session-role")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ role: "manager" });
    expect(elevate.status).toBe(200);

    const managerResponse = await request(app)
      .get("/api/reservations")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(managerResponse.status).toBe(200);
  });
});
