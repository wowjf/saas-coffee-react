/**
 * generate-table-qr.mjs
 *
 * Usage:
 *   node scripts/generate-table-qr.mjs [--count 60] [--base-url http://localhost:3000]
 *
 * What it does:
 *   1. Connects to MongoDB
 *   2. Creates tables that don't exist yet (1 ... 60)
 *   3. Generates a QR PNG for each table locally (qrcode package, no internet)
 *
 * Each QR encodes: {baseUrl}/table/{tableNumber}
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import { config } from "dotenv";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const port = Number(process.env.PORT || 3001);

function getLanBaseUrl(defaultPort) {
  const virtualInterfacePattern = /docker|hyper-v|loopback|podman|vethernet|virtual|vmware|wsl/i;
  for (const [name, network] of Object.entries(networkInterfaces())) {
    if (virtualInterfacePattern.test(name)) continue;
    for (const details of network ?? []) {
      if (details.family === "IPv4" && !details.internal) {
        return `http://${details.address}:${defaultPort}`;
      }
    }
  }
  return `http://localhost:${defaultPort}`;
}

const TABLE_COUNT = parseInt(getArg("--count", "60"), 10);
const BASE_URL = args.includes("--lan")
  ? getLanBaseUrl(port)
  : getArg("--base-url", `http://localhost:${port}`);
const OUT_DIR = path.resolve(__dirname, "../qr-codes");

// ── Mongoose schema ───────────────────────────────────────────────────────────
const TableSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    qrToken: { type: String, default: "" },
    currentSessionId: { type: String, default: "" },
  },
  { timestamps: true },
);

const TableModel = mongoose.models.Table || mongoose.model("Table", TableSchema);

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/cafe_db";
  console.log(`Connecting to ${mongoUri} ...`);
  await mongoose.connect(mongoUri);
  console.log("Connected.\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let created = 0;
  let existing = 0;
  let generated = 0;

  for (let i = 1; i <= TABLE_COUNT; i++) {
    const tableNumber = String(i);

    // Upsert table
    let table = await TableModel.findOne({ tableNumber });
    if (!table) {
      table = await TableModel.create({
        tableNumber,
        isActive: true,
        qrToken: `qr-table-${i}-${Math.random().toString(36).slice(2, 8)}`,
        currentSessionId: ""
      });
      created++;
      console.log(`  ✚ Created table: ${tableNumber}`);
    } else {
      existing++;
    }

    const url = `${BASE_URL}/table/${tableNumber}`;
    const filename = path.join(OUT_DIR, `masa-${i}-qr.png`);

    // Generate QR locally with the `qrcode` package (no internet required)
    try {
      const qrBuffer = await QRCode.toBuffer(url, {
        type: "png",
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      fs.writeFileSync(filename, qrBuffer);

      generated++;
      console.log(`  ✔ QR generated: masa-${i}-qr.png  →  ${url}`);
    } catch (err) {
      console.error(`  ✘ Failed to generate QR for table ${tableNumber}:`, err.message);
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Tables created : ${created}`);
  console.log(`Tables existing: ${existing}`);
  console.log(`QR PNGs saved  : ${generated}  →  ${OUT_DIR}`);
  console.log(`─────────────────────────────────────────\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
