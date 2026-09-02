import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { existsSync } from "fs";
import { createServer } from "http";
import { networkInterfaces } from "os";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import apiRoutes from "./src/server/routes/api.js";
import { errorHandler } from "./src/server/middleware/errorHandler.js";
import { ensureUploadDirectories, getUploadRoot } from "./src/server/services/storage.js";
import { checkAndSeedInitialData, backfillNotificationEvents } from "./src/server/services/autoSeed.js";

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not defined.");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cafe_db";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const VIRTUAL_INTERFACE_PATTERN = /docker|hyper-v|loopback|podman|vethernet|virtual|vmware|wsl/i;

function collectLanUrls(port: number, includeVirtualInterfaces = false) {
  const urls = new Set<string>();

  for (const [name, network] of Object.entries(networkInterfaces())) {
    if (!includeVirtualInterfaces && VIRTUAL_INTERFACE_PATTERN.test(name)) {
      continue;
    }

    for (const details of network ?? []) {
      if (details.family === "IPv4" && !details.internal) {
        urls.add(`http://${details.address}:${port}`);
      }
    }
  }

  return Array.from(urls);
}

function getLanUrls(port: number) {
  const physicalUrls = collectLanUrls(port);
  return physicalUrls.length > 0 ? physicalUrls : collectLanUrls(port, true);
}

function logServerUrls(port: number) {
  console.log(`Local: http://localhost:${port}`);

  // Containers can only see their own bridge IP, not the host machine's LAN IP.
  if (existsSync("/.dockerenv")) {
    console.log(`LAN: use the host machine IP on port ${port}`);
    return;
  }

  const lanUrls = getLanUrls(port);

  if (lanUrls.length > 0) {
    console.log(`LAN: ${lanUrls.join(", ")}`);
  }
}

async function connectDatabase() {
  console.log(`Attempting connection to MongoDB at: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await ensureUploadDirectories();
    console.log(`✓ Connected to persistent MongoDB at ${MONGODB_URI}`);
    return;
  } catch (error) {
    if (IS_PRODUCTION) {
      console.error("\n❌ [FATAL] Production MongoDB connection failed!");
      console.error("In production mode, fallback to in-memory database is strictly disabled to prevent data loss.");
      console.error("Please verify MONGODB_URI and ensure MongoDB container / cluster is healthy.");
      console.error("Error details:", error);
      process.exit(1);
    }

    console.warn("\n⚠️  [DEV ONLY] Local MongoDB not reachable. Starting fallback embedded MongoMemoryServer...");
    console.warn("⚠️  NOTE: Data stored in MongoMemoryServer is non-persistent and will reset on restart.\n");

    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      // Let mongodb-memory-server pick a free port to avoid clashing with a
      // locally running MongoDB on the default 27017.
      const mongod = await MongoMemoryServer.create({
        instance: { dbName: "cafe_db" },
      });
      const uri = mongod.getUri();
      await mongoose.connect(uri + "cafe_db");
      await ensureUploadDirectories();
      console.log(`✓ Connected to embedded MongoMemoryServer at ${uri}cafe_db`);
    } catch (memErr) {
      console.error("Failed to start embedded MongoDB server:", memErr);
      process.exit(1);
    }
  }
}

async function startServer() {
  await connectDatabase();
  await checkAndSeedInitialData();
  await backfillNotificationEvents();

  const app = express();
  const httpServer = createServer(app);

  // Trust proxy for secure headers & real client IP behind Nginx reverse proxy
  app.set("trust proxy", 1);

  // MP-1.4: 'simple' query parser — Express 4 varsayılanı ('extended') query
  // string'lerini nesnelere dönüştürebilir (?a[$gt]=1 gibi), NoSQL operatör
  // enjeksiyonuna zemin hazırlar. 'simple' yalnızca anahtar=değer çiftleri
  // üretir, iç içe nesne üretmez.
  app.set("query parser", "simple");

  // HTTP Security Headers via Helmet
  app.use(
    helmet({
      // Report-only CSP: observe violations without breaking the SPA, camera or
      // QR flows. Once the reports are clean this can be switched to enforcing
      // (remove reportOnly) in a follow-up.
      contentSecurityPolicy: {
        useDefaults: true,
        reportOnly: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", ...(IS_PRODUCTION ? [] : ["'unsafe-inline'", "'unsafe-eval'"])],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", ...(IS_PRODUCTION ? [] : ["ws:", "wss:"])],
          mediaSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS policy
  // Auth is carried via the Authorization header (Bearer token in localStorage),
  // not cookies, so credentials mode is intentionally disabled. In production a
  // wildcard origin is refused: ALLOWED_ORIGINS must list explicit domains.
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : (IS_PRODUCTION ? [] : ["*"]);

  const allowAnyOrigin = allowedOrigins.includes("*");

  if (IS_PRODUCTION && (allowAnyOrigin || allowedOrigins.length === 0)) {
    console.error("\n❌ [FATAL] ALLOWED_ORIGINS must list explicit domains in production (wildcard '*' is not permitted).");
    console.error("Example: ALLOWED_ORIGINS=https://bancho.cafe,https://www.bancho.cafe");
    process.exit(1);
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (no Origin header) are always allowed.
        if (!origin) {
          callback(null, true);
          return;
        }

        // Wildcard is only honoured outside production (guarded above).
        if (allowAnyOrigin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS origin ${origin} not permitted.`));
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: false,
    }),
  );

  // Rate Limiting
  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin." },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çok fazla kimlik doğrulama denemesi. Lütfen 15 dakika sonra tekrar deneyin." },
  });

  // MP-0.9: İstemcinin düzenli aralıklarla poll'ladığı durum endpoint'leri
  // için genişletilmiş limit grubu. Genel /api limitine (600/15 dk) girmeden
  // önce masa modundaki bir istemci ~590 istek/15 dk üretiyordu ve ~10
  // dakikada 429 alıyordu; bu grup polling trafiğini ayrı bir bütçeye taşır.
  const pollingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin." },
  });

  // MP-1.3: push endpoint'lerine ozel dar limit — Web Push gonderimi pahali bir
  // islemdir ve test/unsubscribe uçları istismarla spam kanalına dönüşebilir.
  const pushLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Çok fazla bildirim isteği. Lütfen bir dakika sonra tekrar deneyin." },
  });

  // MP-1.5: genel JSON gövde limiti 10mb → 1mb. Görsel yüklemeleri multipart
  // (multer) üzerinden gider, bu limitten etkilenmez. Kalan REST gövdeleri
  // için 1mb cömiz bir üst sınırdır.
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(getUploadRoot()));

  // Apply rate limits
  app.use("/api/auth", authLimiter);
  // Push uçları dar limit grubuna önce düşer (MP-1.3); genel limiter
  // arkasında kalır, sıralama önemli.
  app.use("/api/push", pushLimiter);
  // Sık poll'lanan endpoint'ler önce geniş limit grubuna düşer (MP-0.9);
  // sıralama önemli: genel limiter onları tekrar saymamalı.
  app.use(["/api/bootstrap", "/api/table-sessions/session", "/api/health"], pollingLimiter);
  app.use("/api", generalApiLimiter);
  app.use("/api", apiRoutes);

  // MP-0.6: Merkezi hata yönetimi — API route'larından gelen tüm hatalar
  // (asyncHandler üzerinden akan redler dahil) tek biçimli JSON'a çevrilir.
  // Route mount'undan sonra, SPA fallback'inden önce gelmelidir.
  app.use("/api", errorHandler);

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr:
          process.env.DISABLE_HMR === "true"
            ? false
            : { server: httpServer },
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`Server bound to ${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`);
    logServerUrls(PORT);
  });
}

startServer();

