import { beforeAll, afterAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiRoutes from "./api";
import { errorHandler } from "../middleware/errorHandler";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "events_test" });

  app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  app.use("/api", errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("GET /api/events (MP-3.1 SSE)", () => {
  it("token yokken 401 döner", async () => {
    const response = await request(app).get("/api/events");
    expect(response.status).toBe(401);
  });

  it("geçersiz token ile 401 döner", async () => {
    const response = await request(app).get("/api/events?token=sahte-token");
    expect(response.status).toBe(401);
  });

  it("geçerli token ile event-stream açılır ve ilk komentar düşer", async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Sse",
      surname: "Deneme",
      username: "sse_deneme",
      gender: "female",
      email: "sse@test.com",
      password: "gizli123",
      phone: "05051234567",
      birthDate: "1995-05-10",
    });
    const token = register.body.token as string;
    expect(token).toBeTruthy();

    const response = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        // SSE akışını hemen kapatmadan ilk parçayı yakala
        res.on("data", (chunk: Buffer) => {
          callback(null, chunk.toString());
        });
        setTimeout(() => res.destroy(), 300);
      });

    const body = typeof response.body === "string" ? response.body : "";
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(body).toContain(": connected");
  });
});
