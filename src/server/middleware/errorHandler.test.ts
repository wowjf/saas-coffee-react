import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import multer from "multer";
import { asyncHandler, autoAsyncHandlers } from "./asyncHandler";
import { ApiError, errorHandler } from "./errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = autoAsyncHandlers(express.Router());

  router.get("/boom-async", async () => {
    throw new Error("kayit-sirasinda-db-hatasi");
  });

  router.get("/boom-api-error", async () => {
    throw new ApiError(418, "TEST_ERROR", "Test ApiError mesajı");
  });

  // MP-1.8: sys: önekli mesaj → errorHandler systemText'i çözer.
  router.get("/boom-system-text", async () => {
    throw new ApiError(500, "LOGIN_FAILED", "sys:giris-islemi-sirasinda-bir-hata-olustu");
  });

  // MP-1.8: catch'ten next(new ApiError(...)) akışı (route catch'lerinin yeni hali).
  router.get("/boom-next", async (_req, _res, next) => {
    try {
      throw new Error("db dustu");
    } catch {
      return next(new ApiError(500, "REGISTER_FAILED", "sys:kayit-islemi-sirasinda-bir-hata-olustu"));
    }
  });

  router.get("/boom-cast", async () => {
    throw new mongoose.Error.CastError("ObjectId", "not-an-id", "_id");
  });

  router.get("/boom-validation", async () => {
    throw new mongoose.Error.ValidationError({} as never);
  });

  router.get("/boom-duplicate", async () => {
    const error = new Error("E11000 duplicate key error collection: cafe_db.users index: username_1 dup key: { : \"admin\" }") as Error & { code?: number };
    error.code = 11000;
    throw error;
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  router.get("/boom-multer", async () => {
    throw new multer.MulterError("LIMIT_FILE_SIZE");
  });

  router.get("/sync-ok", (_req, res) => {
    res.json({ ok: true });
  });

  router.get("/multer-endpoint", upload.single("image"), async (req, res) => {
    res.json({ ok: true, hasFile: Boolean(req.file) });
  });

  app.use("/api", router);
  app.use("/api", errorHandler);
  return app;
}

describe("asyncHandler", () => {
  it("passes a resolved handler straight through", async () => {
    const wrapped = asyncHandler(async (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as never;
    const next = vi.fn();
    await wrapped({} as never, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("routes a rejection to next(err)", async () => {
    const failure = new Error("red");
    const wrapped = asyncHandler(async () => {
      throw failure;
    });

    const next = vi.fn();
    await wrapped({} as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("autoAsyncHandlers wraps async route handlers so rejections reach the error handler", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-async");

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_ERROR");
  });
});

describe("errorHandler", () => {
  it("returns the ApiError status/code/message verbatim", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-api-error");

    expect(response.status).toBe(418);
    expect(response.body).toEqual({ code: "TEST_ERROR", message: "Test ApiError mesajı" });
  });

  it("resolves sys:-prefixed messages through systemTexts (MP-1.8)", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-system-text");

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("LOGIN_FAILED");
    // SYSTEM_TEXTS varsayılanı (DB bağlantısı yok → override boş):
    expect(response.body.message).toBe("Giriş işlemi sırasında bir hata oluştu.");
    expect(response.body.message).not.toBe("sys:giris-islemi-sirasinda-bir-hata-olustu");
  });

  it("keeps message stable and adds code when a catch forwards via next()", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-next");

    expect(response.status).toBe(500);
    expect(response.body.code).toBe("REGISTER_FAILED");
    expect(response.body.message).toBe("Kayıt işlemi sırasında bir hata oluştu.");
  });

  it("maps Mongoose CastError to 400 INVALID_ID", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-cast");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_ID");
  });

  it("maps Mongoose ValidationError to 400 VALIDATION_ERROR", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-validation");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("maps duplicate key (11000) errors to 409 DUPLICATE_KEY", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-duplicate");

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DUPLICATE_KEY");
    expect(response.body.message).toContain("kullanıcı adı");
  });

  it("maps Multer errors to 400 UPLOAD_ERROR", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/boom-multer");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("UPLOAD_ERROR");
    expect(response.body.message).toContain("8 MB");
  });

  it("maps malformed JSON bodies to 400 INVALID_JSON", async () => {
    const app = buildApp();
    const response = await request(app)
      .post("/api/multer-endpoint")
      .set("Content-Type", "application/json")
      .send("{not-json");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_JSON");
  });

  it("does not interfere with successful requests", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/sync-ok");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
