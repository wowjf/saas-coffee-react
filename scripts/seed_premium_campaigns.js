import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './src/server/models/Campaign.js';
import './src/server/models/Product.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cafe_db';

async function seedCampaigns() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB for campaign seeding...");

  const Campaign = mongoose.model('Campaign');
  const Product = mongoose.model('Product');

  // Clear existing campaigns
  await Campaign.deleteMany({});
  console.log("Cleared existing campaigns.");

  // Dynamically resolve product IDs
  const filterKahve = await Product.findOne({ name: "Filtre Kahve" });
  const sufle = await Product.findOne({ name: "Çikolatalı Sufle" });
  const kruvasan = await Product.findOne({ name: "Tereyağlı Sade Kruvasan" });

  const campaignsData = [
    // 1. Puan Ödülleri (Loyalty)
    {
      title: "Hediye Filtre Kahve Ödülü",
      description: "100 Kahve Puanı (KP) biriktirin, taze demlenmiş günün Filtre Kahvesini anında ücretsiz alın.",
      category: "loyalty",
      type: "points_free_product",
      pointsCost: 100,
      targetProductId: filterKahve ? filterKahve._id.toString() : "",
      value: 100,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true,
      usageLimit: 1,
      validityHours: 24
    },
    {
      title: "Hediye Çikolatalı Sufle Ödülü",
      description: "180 Kahve Puanı (KP) karşılığında içi akışkan, sıcacık Belçika çikolatalı sufle tatlınız bizden hediye!",
      category: "loyalty",
      type: "points_free_product",
      pointsCost: 180,
      targetProductId: sufle ? sufle._id.toString() : "",
      value: 100,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true,
      usageLimit: 1,
      validityHours: 24
    },
    {
      title: "%20 Kruvasan İndirimi",
      description: "80 Kahve Puanı (KP) karşılığında tereyağlı çıtır kruvasanınızda anında %20 indirim kazanın!",
      category: "loyalty",
      type: "points_discount_product",
      pointsCost: 80,
      targetProductId: kruvasan ? kruvasan._id.toString() : "",
      value: 20,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true,
      usageLimit: 1,
      validityHours: 24
    },

    // 2. Cüzdan Fırsatları (Financial)
    {
      title: "%10 Cüzdan Yükleme Bonusu",
      description: "Cüzdanınıza yapacağınız 200 ₺ ve üzeri bakiye yüklemelerinde anında %10 ekstra bonus bakiye kazanın!",
      category: "financial",
      type: "balance_bonus",
      value: 10,
      minLoadAmount: 200,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true
    },
    {
      title: "50 ₺ Cüzdan Yükleme Hediyesi",
      description: "Cüzdanınıza tek seferde yapacağınız 400 ₺ ve üzeri yüklemelere anında 50 ₺ hediye bakiye!",
      category: "financial",
      type: "fixed_bonus",
      fixedGiftAmount: 50,
      minLoadAmount: 400,
      value: 50,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true
    },

    // 3. Özel Kampanyalar (Operational / VIP)
    {
      title: "%15 Kahve Happy Hour",
      description: "Hafta içi saat 14:00 ile 17:00 arasında vereceğiniz tüm kahve siparişlerinizde anında %15 indirim uygulansın!",
      category: "operational",
      type: "happy_hour",
      value: 15,
      targetCategory: "Kahveler",
      startTime: "14:00",
      endTime: "17:00",
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true
    },
    {
      title: "VIP Üyelere %10 İndirim",
      description: "Toplam harcaması 2000 ₺ barajını aşan tüm sadık VIP üyelerimize özel, her siparişte koşulsuz şartsız %10 indirim!",
      category: "personalization",
      type: "vip",
      value: 10,
      vipThreshold: 2000,
      startDate: "2026-01-01",
      expiryDate: "2027-12-31",
      active: true
    }
  ];

  const inserted = await Campaign.insertMany(campaignsData);
  console.log(`Successfully seeded ${inserted.length} premium campaigns!`);

  await mongoose.disconnect();
}

seedCampaigns().catch(console.error);
