import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { attachAuth, attachOptionalAuth, restrictTo, type AuthRequest } from "./auth";
import UserModel from "../models/User";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

let mongo: MongoMemoryServer;

function buildRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response;
}

async function runMiddleware(
  middleware: (req: AuthRequest, res: Response, next: NextFunction) => unknown | Promise<unknown>,
  headers: Record<string, string> = {},
) {
  const req = { headers } as unknown as AuthRequest;
  const res = buildRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "auth_middleware_test" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(
    mongoose.connection.collections.User
      ? [mongoose.connection.collections.User.deleteMany({})]
      : [],
  );
});

describe("attachAuth", () => {
  it("rejects requests without an Authorization header with 401", async () => {
    const { res, nextCalled } = await runMiddleware(attachAuth, {});
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("rejects a non-Bearer Authorization header with 401", async () => {
    const { res, nextCalled } = await runMiddleware(attachAuth, { authorization: "Basic abc" });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("rejects a token signed with the wrong secret with 401", async () => {
    const token = jwt.sign({ userId: "irrelevant" }, "not-the-real-secret");
    const { res, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("rejects a malformed token with 401", async () => {
    const { res, nextCalled } = await runMiddleware(attachAuth, { authorization: "Bearer not-a-jwt" });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("rejects an expired token with 401", async () => {
    const token = jwt.sign({ userId: "irrelevant" }, process.env.JWT_SECRET!, { expiresIn: "-1h" });
    const { res, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("rejects a valid token for a deleted user with 401", async () => {
    const token = jwt.sign({ userId: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET!);
    const { res, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it("accepts a valid token and attaches the user with effective role", async () => {
    const user = await UserModel.create({
      name: "Ayse",
      surname: "Test",
      username: "ayse_test",
      email: "ayse@test.com",
      password: "secret123",
      gender: "female",
      role: "customer",
      sessionRole: "customer",
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, res, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });

    expect(res.statusCode).toBe(200);
    expect(nextCalled).toBe(true);
    expect(req.authUser?._id.toString()).toBe(user._id.toString());
    expect(req.authRole).toBe("customer");
  });

  it("falls back a manager without a matching sessionRole to staff, never customer (vardiya kuralı)", async () => {
    const user = await UserModel.create({
      name: "Menejur",
      surname: "Test",
      username: "menejur_test",
      email: "menejur@test.com",
      password: "secret123",
      gender: "male",
      role: "manager",
      sessionRole: null,
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });

    expect(nextCalled).toBe(true);
    expect(req.authRole).toBe("staff");
  });

  it("keeps the manager role when sessionRole matches the account role", async () => {
    const user = await UserModel.create({
      name: "Menejur",
      surname: "Aktif",
      username: "menejur_aktif",
      email: "menejur2@test.com",
      password: "secret123",
      gender: "male",
      role: "manager",
      sessionRole: "manager",
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });

    expect(nextCalled).toBe(true);
    expect(req.authRole).toBe("manager");
  });

  it("lets a manager downgrade their session to staff", async () => {
    const user = await UserModel.create({
      name: "Menejur",
      surname: "Garson",
      username: "menejur_garson",
      email: "menejur3@test.com",
      password: "secret123",
      gender: "female",
      role: "manager",
      sessionRole: "staff",
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });

    expect(nextCalled).toBe(true);
    expect(req.authRole).toBe("staff");
  });

  it("never upgrades a staff account above its role via sessionRole (etkin rol staff kalır)", async () => {
    const user = await UserModel.create({
      name: "Garson",
      surname: "Test",
      username: "garson_test",
      email: "garson@test.com",
      password: "secret123",
      gender: "male",
      role: "staff",
      sessionRole: "manager",
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, nextCalled } = await runMiddleware(attachAuth, { authorization: `Bearer ${token}` });

    expect(nextCalled).toBe(true);
    expect(req.authRole).toBe("staff");
  });
});

describe("attachOptionalAuth", () => {
  it("continues without a token and attaches no user", async () => {
    const { req, nextCalled } = await runMiddleware(attachOptionalAuth, {});
    expect(nextCalled).toBe(true);
    expect(req.authUser).toBeUndefined();
    expect(req.authRole).toBeUndefined();
  });

  it("attaches the user when the token is valid", async () => {
    const user = await UserModel.create({
      name: "Misafir",
      surname: "Test",
      username: "misafir_test",
      email: "misafir@test.com",
      password: "secret123",
      gender: "female",
      role: "customer",
      sessionRole: "customer",
    });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET!);
    const { req, nextCalled } = await runMiddleware(attachOptionalAuth, { authorization: `Bearer ${token}` });

    expect(nextCalled).toBe(true);
    expect(req.authUser?._id.toString()).toBe(user._id.toString());
    expect(req.authRole).toBe("customer");
  });

  it("silently continues on an invalid token instead of failing", async () => {
    const { req, res, nextCalled } = await runMiddleware(attachOptionalAuth, { authorization: "Bearer garbage" });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(req.authUser).toBeUndefined();
    expect(req.authRole).toBeUndefined();
  });
});

describe("restrictTo", () => {
  // restrictTo reads auth state that attachAuth normally sets, so the request
  // is built directly with the injected auth context.
  async function runRestrictTo(
    roles: (string | string[])[],
    auth: { authUser?: unknown; authRole?: string },
  ) {
    const req = { headers: {}, ...auth } as unknown as AuthRequest;
    const res = buildRes();
    let nextCalled = false;

    await (restrictTo(...roles) as unknown as (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>)(
      req,
      res,
      () => {
        nextCalled = true;
      },
    );

    return { req, res, nextCalled };
  }

  it("denies access when no auth middleware ran (403)", async () => {
    const { res, nextCalled } = await runRestrictTo(["manager"], {});
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it("denies a customer access to staff-only endpoints (403)", async () => {
    const { res, nextCalled } = await runRestrictTo(["staff", "manager"], {
      authUser: { id: "u1" },
      authRole: "customer",
    });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it("denies staff access to manager-only endpoints (403)", async () => {
    const { res, nextCalled } = await runRestrictTo(["manager"], {
      authUser: { id: "u1" },
      authRole: "staff",
    });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  it("allows a matching role through", async () => {
    const { res, nextCalled } = await runRestrictTo(["manager"], {
      authUser: { id: "u1" },
      authRole: "manager",
    });
    expect(res.statusCode).toBe(200);
    expect(nextCalled).toBe(true);
  });

  it("allows any role in the flattened list", async () => {
    for (const role of ["staff", "manager"]) {
      const { res, nextCalled } = await runRestrictTo(["staff", "manager"], {
        authUser: { id: "u1" },
        authRole: role,
      });
      expect(res.statusCode).toBe(200);
      expect(nextCalled).toBe(true);
    }
  });

  it("accepts nested role arrays", async () => {
    const { res, nextCalled } = await runRestrictTo([["staff"], "manager"], {
      authUser: { id: "u1" },
      authRole: "staff",
    });
    expect(res.statusCode).toBe(200);
    expect(nextCalled).toBe(true);
  });
});
