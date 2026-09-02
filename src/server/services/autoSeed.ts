import mongoose from "mongoose";
import NotificationModel from "../models/Notification.js";
import CategoryModel from "../models/Category.js";
import ProductModel from "../models/Product.js";
import IngredientModel from "../models/Ingredient.js";
import TableModel from "../models/Table.js";
import CampaignModel from "../models/Campaign.js";
import UserModel from "../models/User.js";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { ensureUploadDirectories, getUploadRoot } from "./storage.js";

/**
 * Seed images are bundled with the project in src/server/data/seed-images/
 * (see scripts/download-seed-images.mjs). Values starting with "seed:"
 * are copied into uploads/ at seed time and replaced with local /uploads/... URLs.
 */
const SEED_IMAGE_DIR = path.join(process.cwd(), "src/server/data/seed-images");

async function materializeSeedImage(value: string, scope: "categories" | "products") {
  if (!value.startsWith("seed:")) return value;

  const fileName = value.slice("seed:".length);
  const source = path.join(SEED_IMAGE_DIR, fileName);
  const targetDir = path.join(getUploadRoot(), scope);
  const targetName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;

  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(source, path.join(targetDir, targetName));

  return `/uploads/${scope}/${targetName}`;
}

const categoriesData = [
  { name: "Kahveler", iconName: "Coffee", image: "seed:cat-kahveler.webp" },
  { name: "Bitki Çayları & Çay", iconName: "Leaf", image: "seed:cat-cay.webp" },
  { name: "Soğuk İçecekler", iconName: "CupSoda", image: "seed:cat-soguk.webp" },
  { name: "Fırından Taze", iconName: "Croissant", image: "seed:cat-firindan.webp" },
  { name: "Tuzlular & Tostlar", iconName: "Sandwich", image: "seed:cat-tuzlular.webp" },
  { name: "Tatlılar", iconName: "Donut", image: "seed:cat-tatlilar.webp" }
];

const ingredientsData = [
  { name: "Gluten", iconName: "WheatOff" },
  { name: "Laktoz", iconName: "Milk" },
  { name: "Yumurta", iconName: "Egg" },
  { name: "Kuruyemiş", iconName: "Nut" },
  { name: "Kafein", iconName: "Bean" }
];

const productsData = [
  { name: "Espresso Single", price: 75, category: "Kahveler", description: "%100 Arabica taze çekilmiş espresso.", image: "seed:prod-espresso-single.webp", inStock: true, ingredients: ["Kafein"] },
  { name: "Espresso Double", price: 95, category: "Kahveler", description: "Çift shot espresso.", image: "seed:prod-espresso-double.webp", inStock: true, ingredients: ["Kafein"] },
  { name: "Americano", price: 110, category: "Kahveler", description: "Sıcak su ile yumuşatılmış espresso.", image: "seed:prod-americano.webp", inStock: true, ingredients: ["Kafein"] },
  { name: "Filtre Kahve", price: 100, category: "Kahveler", description: "Taze demlenmiş günün filtre kahvesi.", image: "seed:prod-filtre.webp", inStock: true, ingredients: ["Kafein"] },
  { name: "Caffe Latte", price: 120, category: "Kahveler", description: "Süt ve kadifemsi süt köpüğü.", image: "seed:prod-latte.webp", inStock: true, ingredients: ["Kafein", "Laktoz"] },
  { name: "Cappuccino", price: 120, category: "Kahveler", description: "Yoğun süt köpüklü espresso.", image: "seed:prod-cappuccino.webp", inStock: true, ingredients: ["Kafein", "Laktoz"] },
  { name: "Flat White", price: 125, category: "Kahveler", description: "Çift shot espresso ve ince mikro süt köpüğü.", image: "seed:prod-flatwhite.webp", inStock: true, ingredients: ["Kafein", "Laktoz"] },
  { name: "Demleme Türk Çayı", price: 40, category: "Bitki Çayları & Çay", description: "Rize Karadeniz harmanı taze demleme çay.", image: "seed:cat-cay.webp", inStock: true, ingredients: ["Kafein"] },
  { name: "Tereyağlı Sade Kruvasan", price: 95, category: "Fırından Taze", description: "Fransız tereyağlı kat kat kruvasan.", image: "seed:cat-firindan.webp", inStock: true, ingredients: ["Gluten", "Yumurta", "Laktoz"] },
  { name: "Kaşarlı & Füme Etli Tost", price: 140, category: "Tuzlular & Tostlar", description: "Ekşi mayalı ekmekte kaşar ve Dana füme et.", image: "seed:cat-tuzlular.webp", inStock: true, ingredients: ["Gluten", "Laktoz"] },
  { name: "San Sebastian Cheesecake", price: 165, category: "Tatlılar", description: "Karamelize yanık cheesecake, çikolata sosu ile.", image: "seed:cat-tatlilar.webp", inStock: true, ingredients: ["Gluten", "Yumurta", "Laktoz"] },
  { name: "Çikolatalı Sufle", price: 145, category: "Tatlılar", description: "Sıcak akışkan Belçika çikolatalı sufle.", image: "seed:prod-sufle.webp", inStock: true, ingredients: ["Gluten", "Yumurta", "Laktoz"] }
];

/**
 * One-off backfill: older notifications were matched by their Turkish title
 * string. We now rely on a stable `event` field, so map any legacy documents
 * that still lack it. Safe to run on every boot (only touches event:"").
 */
const LEGACY_TITLE_TO_EVENT: Record<string, string> = {
  "Sipariş hazırlanıyor": "order_preparing",
  "Siparişiniz hazır": "order_ready",
  "Siparişiniz iptal edildi": "order_cancelled",
  "Sipariş Geldi": "staff_new_order",
};

export async function backfillNotificationEvents() {
  try {
    const pending = await NotificationModel.countDocuments({
      $or: [{ event: { $exists: false } }, { event: "" }],
    });

    if (pending === 0) {
      return;
    }

    let updated = 0;
    for (const [title, event] of Object.entries(LEGACY_TITLE_TO_EVENT)) {
      const result = await NotificationModel.updateMany(
        { title, $or: [{ event: { $exists: false } }, { event: "" }] },
        { $set: { event } },
      );
      updated += result.modifiedCount ?? 0;
    }

    if (updated > 0) {
      console.log(`✓ Backfilled event field on ${updated} legacy notification(s).`);
    }
  } catch (err) {
    console.error("Notification event backfill error:", err);
  }
}

export async function checkAndSeedInitialData() {
  try {
    // Guvenlik (MP-0.2): bootstrap yonetici kosulu "veritabani bossa" degil
    // "sistemde hic manager yoksa" seklinde calisir. Urunler dolu ama yonetici
    // hesabi silinmis bir veritabaninda admin e-postasi bosta kalmasin.
    const managerCount = await UserModel.countDocuments({ role: "manager" });
    if (managerCount > 0) return;

    console.log("No manager account found. Seeding default catalog & admin user...");

    const productCount = await ProductModel.countDocuments();
    const shouldSeedCatalog = productCount === 0;

    await ensureUploadDirectories();

    if (shouldSeedCatalog) {
      await CategoryModel.insertMany(
        await Promise.all(categoriesData.map(async (c) => ({ ...c, image: await materializeSeedImage(c.image, "categories") }))),
      );
      await IngredientModel.insertMany(ingredientsData);
      await ProductModel.insertMany(
        await Promise.all(productsData.map(async (p) => ({ ...p, image: await materializeSeedImage(p.image, "products") }))),
      );
    }

    // Create 10 tables if none exist
    const existingTableCount = await TableModel.countDocuments();
    if (existingTableCount === 0) {
      const tableDocs = [];
      for (let i = 1; i <= 10; i++) {
        tableDocs.push({
          tableNumber: String(i),
          qrCodeUrl: `/qr-codes/table-${i}.png`,
          active: true,
        });
      }
      try {
        await TableModel.insertMany(tableDocs, { ordered: false });
      } catch {
        // Ignore any duplicate key warnings during auto-seed
      }
    }

    // Bootstrap admin user (MP-0.2 + MP-0.7):
    // - Kayitta rol atamasi YOKTUR; rol yalnizca burada, bos veritabanina karsi olusturulur.
    // - Bilinen bir varsayilan sifre YOK — BOOTSTRAP_ADMIN_PASSWORD tanimli degilse
    //   yonetici hesabi acilmaz.
    // - E-postasi zaten kayitli bir hesap (orn. customer olarak kaydolmus) ASLA
    //   otomatik yukseltilmez; operator farkli bir BOOTSTRAP_ADMIN_EMAIL kullanir.
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@bancho.cafe";
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const existingAdmin = await UserModel.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.warn(
        `Bootstrap admin e-postasi (${adminEmail}) zaten kayitli ve rolu "${existingAdmin.role}". Otomatik yukseltme yapilmaz.`,
      );
    } else if (!adminPassword) {
      console.warn(
        "\n⚠️  BOOTSTRAP_ADMIN_PASSWORD tanımlı olmadığı için yönetici hesabı OLUŞTURULMADI.",
        `\n   Yönetici hesabı açmak için .env dosyasına güçlü bir BOOTSTRAP_ADMIN_PASSWORD`,
        `\n   değeri ekleyip yeniden başlatın (e-posta: ${adminEmail}).`,
      );
    } else {
      await UserModel.create({
        name: process.env.BOOTSTRAP_ADMIN_NAME || "Admin",
        surname: process.env.BOOTSTRAP_ADMIN_SURNAME || "User",
        username: "admin",
        email: adminEmail,
        password: adminPassword,
        role: "manager",
        points: 1000,
        balance: 500,
      });
      console.log(`Created admin user: ${adminEmail}`);
    }

    console.log("Auto-seeding completed successfully!");
  } catch (err) {
    console.error("Auto-seeding error:", err);
  }
}
