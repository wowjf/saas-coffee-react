import { Router } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import multer from "multer";
import { attachAuth, attachOptionalAuth, restrictTo, type AuthRequest } from "../middleware/auth";
import { autoAsyncHandlers } from "../middleware/asyncHandler";
import { redeemCouponForOrder, refundCouponUsage } from "../services/coupon";
import { ApiError } from "../middleware/errorHandler";
import UserModel from "../models/User";
import ProductModel from "../models/Product";
import OrderModel from "../models/Order";
import NotificationModel from "../models/Notification";
import CampaignModel from "../models/Campaign";
import IngredientModel from "../models/Ingredient";
import CategoryModel from "../models/Category";
import ChangeLogModel from "../models/ChangeLog";
import StaffModel from "../models/Staff";
import BalanceTopUpModel from "../models/BalanceTopUp";
import { normalizeEmail, serializeDocument, toIsoString } from "../utils";
import TableModel from "../models/Table";
import TableSessionModel from "../models/TableSession";
import ReviewModel from "../models/Review";
import CouponModel from "../models/Coupon";
import FriendModel from "../models/Friend";
import GiftModel from "../models/Gift";
import SubscriptionModel, { SubscriptionPlanModel } from "../models/Subscription";
import ChatRoomModel from "../models/ChatRoom";
import ReservationModel from "../models/Reservation";
import WaiterCallModel from "../models/WaiterCall";
// A2: sipariş tamamlamada envanter stok düşümü.
import { decrementInventoryForOrder, syncProductStockFlags } from "../services/inventory.js";
import PushSubscriptionModel from "../models/PushSubscription.js";
import { getVapidKeys } from "../config/vapid.js";
import {
  sendPushToUser,
  sendPushToOrder,
  sendPushToRole,
  sendPushToSubscription,
} from "../services/pushNotification.js";
// MP-3.1: SSE kanalına olay yayını — bildirim oluşturma noktalarında realtime push.
import { publishToUser, publishToManagers } from "../services/eventBus.js";
import {
  applyActivePointRewardToOrder,
  applyStampRewardCreditsToOrder,
  applyCompletedOrderLoyalty,
  buildLoyaltyScanResult,
  buildLoyaltySummary,
  clearExpiredActivePointReward,
  createLoyaltyQrToken,
  isCampaignActive,
  redeemPointCampaign,
  resolveLoyaltyToken,
} from "../services/loyalty";
import { getTurkeyDateTimeIso } from "../../lib/campaignSchedule";
import { isConfiguredManagerEmail } from "../services/role.js";
import {
  clearManagedUploads,
  deleteManagedImage,
  saveImageAsWebp,
  type ImageScope,
} from "../services/storage";
import type { UserRole } from "../../types";

// MP-0.5: bundan sonra kaydedilen tüm async handler/middleware'lar otomatik
// asyncHandler ile sarmalanır; Express 4'te redler süreci düşürmez, merkezi
// errorHandler'a akar.
const router = autoAsyncHandlers(Router());
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Yalnizca gorsel dosyalari yuklenebilir."));
  },
});

// MP-2.1: token iptal versiyonu — payload'a gomulur; kullanici dokumanindaki
// tokenVersion arttiginda eski token'lar 401 alir (tum oturumlar duser).
function signToken(userId: string, tokenVersion: number) {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
}

function serializeUser(user: any) {
  if (!user) {
    return null;
  }

  const raw = serializeDocument(user);
  const accountRole = getAccountRole(user);
  const effectiveRole = getEffectiveRole(user);
  const {
    password,
    createdAt,
    updatedAt,
    selectedCampaignId,
    lastCampaignSelectionDate,
    loyaltyStampProgress,
    loyaltyRewardCredits,
    ...rest
  } = raw as Record<string, unknown> & {
    password?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  return {
    ...rest,
    accountRole,
    effectiveRole,
    createdAt: toIsoString(createdAt),
    updatedAt: toIsoString(updatedAt),
  };
}

function serializeOrder(order: any) {
  const raw = serializeDocument(order!);
  const { loyaltyStampCountAwarded, ...rest } = raw as Record<string, unknown>;

  return {
    ...rest,
    timestamp: toIsoString(rest.timestamp as Date | string),
  };
}

function serializeNotification(notification: any) {
  const raw = serializeDocument(notification!);
  return {
    ...raw,
    userId: raw.userId || undefined,
    targetRole: raw.targetRole || undefined,
    timestamp: toIsoString(raw.timestamp as Date | string),
  };
}

function serializeLog(log: any) {
  const raw = serializeDocument(log!);
  return {
    ...raw,
    timestamp: toIsoString(raw.timestamp as Date | string),
  };
}

function serializeBalanceTopUp(topUp: any) {
  const raw = serializeDocument(topUp!);
  return {
    ...raw,
    timestamp: toIsoString(raw.timestamp as Date | string),
  };
}

function serializeSimpleDocument(document: {
  _id: { toString(): string } | string;
  toObject(): Record<string, unknown>;
}) {
  return serializeDocument(document);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// MP-2.2: yaygin/kolay tahmin edilebilir parolalar kabul edilmez.
const COMMON_PASSWORD_BLACKLIST = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "admin123",
  "admin123!",
  "admin1234",
  "qwerty123",
  "qwertyuiop",
  "1q2w3e4r",
  "abc12345",
  "iloveyou1",
  "welcome1",
  "welcome123",
  "letmein1",
  "monkey123",
  "dragon123",
  "sifre123",
  "sifre1234",
  "sifrem123",
  "parola123",
]);

// MP-2.2: parola politikasi — en az 8 karakter, en az bir harf ve bir rakam.
// Kara liste ve e-posta/kullanici adi icermesi de burada denetlenir.
// Donulen deger, dogrulama basarisizsa kullanilacak system-text anahtaridir.
async function validatePasswordPolicy(
  password: string,
  context?: { email?: string; username?: string },
): Promise<string | null> {
  if (password.length < 8) {
    return await getSystemText("sifre-en-az-8-karakterden-olusmalidir");
  }

  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/[0-9]/.test(password)) {
    return await getSystemText("sifre-en-az-bir-harf-ve-bir-rakam-icermelidir");
  }

  if (COMMON_PASSWORD_BLACKLIST.has(password.toLowerCase())) {
    return await getSystemText("bu-sifre-cok-yaygin-lutfen-daha-guvenli-bir-sifre-secin");
  }

  if (context) {
    const localEmailPart = (context.email || "").split("@")[0]?.toLowerCase() || "";
    const username = (context.username || "").toLowerCase();
    const normalizedPassword = password.toLowerCase();

    if ((localEmailPart.length >= 3 && normalizedPassword.includes(localEmailPart)) ||
        (username.length >= 3 && normalizedPassword.includes(username))) {
      return await getSystemText("sifre-e-posta-veya-kullanici-adi-iceremez");
    }
  }

  return null;
}

function isImageScope(value: string): value is ImageScope {
  return ["avatar", "category", "product", "campaign"].includes(value);
}

function normalizeImageValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAddresses(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ id: string; title: string; details: string }>;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const payload = item as Record<string, unknown>;
      const title = String(payload.title || "").trim();
      const details = String(payload.details || "").trim();

      if (!title || !details) {
        return null;
      }

      return {
        id: String(payload.id || randomUUID()),
        title,
        details,
      };
    })
    .filter((item): item is { id: string; title: string; details: string } => item !== null);
}

function normalizePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ id: string; type: "card"; last4: string; brand: string }>;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const payload = item as Record<string, unknown>;
      const last4 = String(payload.last4 || "").replace(/\D/g, "").slice(-4);
      const brand = String(payload.brand || "").trim();

      if (last4.length !== 4 || !brand) {
        return null;
      }

      return {
        id: String(payload.id || randomUUID()),
        type: "card",
        last4,
        brand,
      };
    })
    .filter((item): item is { id: string; type: "card"; last4: string; brand: string } => item !== null);
}

function normalizeUserSettings(value: unknown, fallback?: { language?: string; theme?: string }) {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const nextLanguage = String(payload.language || fallback?.language || "tr");
  const nextTheme = String(payload.theme || fallback?.theme || "light");

  return {
    language: ["tr", "en", "de", "fr"].includes(nextLanguage) ? nextLanguage : "tr",
    theme: nextTheme === "dark" ? "dark" : "light",
  };
}

function getCampaignSelectionExpiry(campaign: { expiryDate?: string; endTime?: string }) {
  const endDate = String(campaign.expiryDate || "");
  if (!endDate) {
    return new Date().toISOString();
  }

  return getTurkeyDateTimeIso(endDate, campaign.endTime || "23:59", 59) || new Date().toISOString();
}

/**
 * Guvenlik (MP-0.1): bakiye yuklemesinde ciro/bonus miktarlarini istemci
 * govdesinden degil sunucu tarafinda hesaplar. Kullanici o an secili ve aktif
 * bir finansal kampanyasi tutuyorsa bonus kurallari DB'deki kampanya
 * belgesinden uygulanir; aksi halde bonus yoktur ve ciro yuklenen tutara
 * esittir. Boylece raporlama verisi istemciden zehirlenemez.
 */
async function resolveBalanceTopUpAmounts(user: any, creditedAmount: number) {
  await clearExpiredSelectedCampaign(user);

  const selected = user?.selectedCampaign;
  if (!selected?.campaignId) {
    return { revenueAmount: creditedAmount, bonusAmount: 0 };
  }

  const campaign = await CampaignModel.findById(selected.campaignId);
  const serialized = campaign ? (serializeSimpleDocument(campaign) as any) : null;

  const isFinancialCampaign =
    serialized &&
    serialized.category === "financial" &&
    (serialized.type === "balance_bonus" || serialized.type === "fixed_bonus");

  if (!serialized || !isFinancialCampaign || !isCampaignActive(serialized)) {
    return { revenueAmount: creditedAmount, bonusAmount: 0 };
  }

  const minLoadAmount = Math.max(0, ensureNumber(serialized.minLoadAmount));
  if (creditedAmount < minLoadAmount) {
    return { revenueAmount: creditedAmount, bonusAmount: 0 };
  }

  let bonusAmount = 0;
  if (serialized.type === "balance_bonus") {
    bonusAmount = (creditedAmount * Math.max(0, ensureNumber(serialized.value))) / 100;
  } else if (serialized.type === "fixed_bonus") {
    bonusAmount = Math.max(0, ensureNumber(serialized.fixedGiftAmount));
  }

  return {
    revenueAmount: creditedAmount,
    bonusAmount: Math.round(bonusAmount * 100) / 100,
  };
}

function getAccountRole(user: any): UserRole {
  return (user?.role || "customer") as UserRole;
}

function getEffectiveRole(user: any): UserRole {
  const accountRole = getAccountRole(user);

  if (accountRole === "customer") {
    return "customer";
  }

  if (accountRole === "manager") {
    if (user?.sessionRole === "manager" || user?.sessionRole === "staff") {
      return user.sessionRole;
    }
    return "customer";
  }

  return user?.sessionRole === accountRole ? accountRole : "customer";
}

function isShiftRole(role: UserRole) {
  return role === "staff" || role === "manager";
}

async function clearExpiredSelectedCampaign(user: InstanceType<typeof UserModel>) {
  if (!user.selectedCampaign?.expiresAt) {
    return false;
  }

  if (new Date(user.selectedCampaign.expiresAt).getTime() > Date.now()) {
    return false;
  }

  user.selectedCampaign = null;
  await user.save();
  return true;
}

// Stable event identifiers decouple notification matching from display text.
// Titles may be edited via system-texts without breaking role-based filtering.
const CUSTOMER_NOTIFICATION_EVENTS = ["order_preparing", "order_ready", "order_cancelled"] as const;
const STAFF_NOTIFICATION_EVENTS = ["staff_new_order"] as const;

type CustomerNotificationEvent = (typeof CUSTOMER_NOTIFICATION_EVENTS)[number];

const CUSTOMER_EVENT_TITLES: Record<CustomerNotificationEvent, string> = {
  order_preparing: "Sipariş hazırlanıyor",
  order_ready: "Siparişiniz hazır",
  order_cancelled: "Siparişiniz iptal edildi",
};

function getNotificationQueryForUser(user: any) {
  if (!user) {
    return null;
  }

  const effectiveRole = getEffectiveRole(user);
  const allowedEvents =
    effectiveRole === "customer"
      ? [...CUSTOMER_NOTIFICATION_EVENTS]
      : effectiveRole === "staff"
        ? [...STAFF_NOTIFICATION_EVENTS]
        : [];

  if (allowedEvents.length === 0) {
    return null;
  }

  return {
    $and: [
      {
        $or: [{ userId: user._id.toString() }, { targetRole: effectiveRole }],
      },
      {
        event: { $in: allowedEvents },
      },
    ],
  };
}

async function createCustomerOrderNotification(
  userId: string,
  event: CustomerNotificationEvent,
  orderId?: string,
) {
  const title = CUSTOMER_EVENT_TITLES[event];
  await NotificationModel.create({
    event,
    title,
    message: title,
    type: event === "order_ready" ? "success" : "info",
    userId,
    read: false,
    timestamp: new Date(),
  });

  // MP-3.1: SSE — bağlı istemciye (müşteri paneli) anlık olay gönderimi.
  publishToUser(userId, event, { orderId: orderId || "" });

  // Dispatch Web Push notification to user / order device(s)
  let body = title;
  if (event === "order_preparing") {
    body = "Siparişiniz barista tarafından hazırlanmaya başlandı.";
  } else if (event === "order_ready") {
    body = "Siparişiniz hazır! Bardan teslim alabilirsiniz. Afiyet olsun!";
  } else if (event === "order_cancelled") {
    body = "Siparişiniz iptal edildi. Bakiye iadeniz tanımlandı.";
  }

  const pushPayload = {
    title: `Bancho Cafe • ${title}`,
    body,
    tag: `order-${orderId || userId}-${event}`,
    data: {
      url: "/?tab=orders",
      orderId,
      type: event,
    },
  };

  // Ateşle-unut push gönderimi: hatalar yakalanmazsa Node 15+ süreci
  // öldürür (unhandled rejection) ve test teardown'ında Mongo bağlantısı
  // kapandıktan sonra reddedilen promise vitest'i exit 1 yapar.
  const dispatchPush = orderId
    ? sendPushToOrder(orderId, pushPayload, userId)
    : sendPushToUser(userId, pushPayload);
  dispatchPush.catch(() => {
    // Push gönderimi best-effort'tır; bildirim kaydı zaten oluştu.
  });
}

async function createStaffOrderNotification(details?: { tableNumber?: string; orderId?: string; total?: number }) {
  const message = details?.tableNumber
    ? `Masa ${details.tableNumber} yeni sipariş verdi (₺${details.total || 0}).`
    : await getSystemText("yeni-bir-siparis-geldi");

  await NotificationModel.create({
    event: "staff_new_order",
    title: "Sipariş Geldi",
    message,
    type: "info",
    targetRole: "staff",
    read: false,
    timestamp: new Date(),
  });

  // MP-3.1: SSE — personel/yönetici panellerine anlık yeni sipariş olayı.
  publishToManagers("staff_new_order", {
    orderId: details?.orderId || "",
    tableNumber: details?.tableNumber || "",
    total: details?.total || 0,
    message,
  });

  sendPushToRole(["staff", "manager"], {
    title: "Bancho Cafe • Yeni Sipariş!",
    body: message,
    tag: `staff-order-${details?.orderId || Date.now()}`,
    data: {
      url: "/?tab=orders",
      orderId: details?.orderId,
      type: "staff_new_order",
    },
  }).catch(() => {
    // Best-effort push; bildirim kaydı zaten oluştu.
  });
}

async function syncShiftStatusForUser(
  user: { email?: string; name?: string; surname?: string; role?: string } | null | undefined,
  status: "Vardiyada" | "İzinli",
) {
  if (!user || (user.role !== "staff" && user.role !== "manager") || !user.email) {
    return;
  }

  await StaffModel.findOneAndUpdate(
    { email: normalizeEmail(user.email) },
    {
      $set: {
        email: normalizeEmail(user.email),
        name: String(user.name || "").trim(),
        surname: String(user.surname || "").trim(),
        role: user.role,
        status,
      },
    },
    { upsert: true, new: true },
  );
}

async function buildBootstrapPayload(user: any) {
  const effectiveRole = getEffectiveRole(user);

  if (user && effectiveRole === "customer") {
    await clearExpiredActivePointReward(user);
    await clearExpiredSelectedCampaign(user);
  }

  const [products, campaigns, categories] = await Promise.all([
    ProductModel.find().sort({ name: 1 }),
    CampaignModel.find({ type: { $ne: "stamp_card" } }).sort({ createdAt: -1 }),
    CategoryModel.find().sort({ name: 1 }),
  ]);

  const payload: Record<string, unknown> = {
    user: serializeUser(user),
    role: effectiveRole,
    products: products.map((item) => serializeSimpleDocument(item)),
    campaigns: campaigns.map((item) => serializeSimpleDocument(item)),
    categories: categories.map((item) => serializeSimpleDocument(item)),
    orders: [],
    notifications: [],
    ingredients: [],
    recentChanges: [],
    balanceTopUps: [],
    staff: [],
    users: [],
  };

  if (!user) {
    return payload;
  }

  const orderQuery =
    effectiveRole === "manager" || effectiveRole === "staff"
      ? {}
      : { userId: user._id.toString() };

  const notificationQuery = getNotificationQueryForUser(user);

  const [orders, notifications] = await Promise.all([
    OrderModel.find(orderQuery).sort({ timestamp: -1 }),
    notificationQuery ? NotificationModel.find(notificationQuery).sort({ timestamp: -1 }) : Promise.resolve([]),
  ]);

  payload.orders = orders.map((item) => serializeOrder(item));
  payload.notifications = notifications.map((item) => serializeNotification(item));

  if (effectiveRole === "manager" || effectiveRole === "staff") {
    const [ingredients, staff] = await Promise.all([
      IngredientModel.find().sort({ name: 1 }),
      StaffModel.find().sort({ createdAt: -1 }),
    ]);

    payload.ingredients = ingredients.map((item) => serializeSimpleDocument(item));
    payload.staff = staff.map((item) => serializeSimpleDocument(item));
  }

  if (effectiveRole === "manager") {
    // MP-0.9: manager'a özgü ağır veriler (users / balanceTopUps / logs)
    // bootstrap'tan çıkarıldı — GET /api/admin/overview üzerinden ayrı çekilir.
    // Alanlar yanıt içinde korunur (boş dizi) böylece eski istemciler kırılmaz.
    payload.users = [];
    payload.balanceTopUps = [];
    payload.recentChanges = [];
  } else {
    const balanceTopUps = await BalanceTopUpModel.find({ userId: user._id.toString() }).sort({ timestamp: -1 });
    payload.balanceTopUps = balanceTopUps.map((item) => serializeBalanceTopUp(item));
  }

  return payload;
}

/**
 * MP-0.9: Manager'a özgü ağır veriler (kullanıcı listesi, tüm bakiye
 * hareketleri, sistem logları). Bootstrap 5 sn'lik polling'e girdiğinde bu
 * veriler O(n×m) maliyet üretiyordu; artık yalnızca bu endpoint'te sunulur.
 */
async function buildAdminOverviewPayload() {
  // MP-2.13: ağır dizilere limit — users/balanceTopUps sınırsız dönmüyordu;
  // artık ilk 200 kayıt döner (tümü için GET /users?envelope=1 ve
  // GET /balance-top-ups?envelope=1 paginasyonlu endpoint'leri kullanılır).
  const [logs, users, balanceTopUps] = await Promise.all([
    ChangeLogModel.find().sort({ timestamp: -1 }).limit(100),
    UserModel.find().sort({ createdAt: -1 }).limit(200),
    BalanceTopUpModel.find().sort({ timestamp: -1 }).limit(200),
  ]);

  return {
    users: users.map((item) => serializeUser(item)),
    balanceTopUps: balanceTopUps.map((item) => serializeBalanceTopUp(item)),
    recentChanges: logs.map((item) => serializeLog(item)),
  };
}

/**
 * MP-2.13: manager listelerinde pagination. ?page=&limit= desteği —
 * varsayılan limit 50, üst sınır 200. Dizi yanıtı bozulmaz (geriye
 * uyumluluk): toplam kayıt sayısı X-Total-Count başlığıyla, meta
 * bilgisi ise ?envelope=1 ile {items, page, limit, total} sarılır.
 */
const PAGINATION_DEFAULT_LIMIT = 50;
const PAGINATION_MAX_LIMIT = 200;

function parsePaginationParams(query: Record<string, unknown>) {
  const rawPage = Number.parseInt(String(query.page ?? ""), 10);
  const rawLimit = Number.parseInt(String(query.limit ?? ""), 10);

  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, PAGINATION_MAX_LIMIT)
      : PAGINATION_DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

function ensureNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/analytics/dashboard", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const parseBoundary = (value: unknown, fallback: Date) => {
      if (!value) return fallback;
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };

    const start = parseBoundary(req.query.start, todayStart);
    const end = parseBoundary(req.query.end, now);
    end.setHours(23, 59, 59, 999);

    const rangeMatch = { timestamp: { $gte: start, $lte: end } };

    const [popularProducts, topUps, summaryRows] = await Promise.all([
      OrderModel.aggregate([
        { $match: { status: { $ne: "rejected" }, timestamp: { $gte: start, $lte: end } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product.id",
            name: { $first: "$items.product.name" },
            price: { $first: "$items.product.price" },
            image: { $first: "$items.product.image" },
            category: { $first: "$items.product.category" },
            salesCount: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.product.price"] } },
            orderCount: { $sum: 1 },
          },
        },
        { $match: { _id: { $ne: "" } } },
        { $sort: { salesCount: -1, revenue: -1 } },
      ]),
      BalanceTopUpModel.find(rangeMatch).sort({ timestamp: -1 }).limit(300),
      BalanceTopUpModel.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: null,
            loaded: { $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] } },
            spent: { $sum: { $cond: [{ $lt: ["$amount", 0] }, "$amount", 0] } },
            bonus: { $sum: { $cond: [{ $gt: ["$bonusAmount", 0] }, "$bonusAmount", 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.json({
      period: { start: toIsoString(start), end: toIsoString(end) },
      popularProducts: popularProducts.map((item: any) => ({
        id: item._id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        salesCount: item.salesCount,
        revenue: Number(item.revenue.toFixed(2)),
        orderCount: item.orderCount,
      })),
      topUps: topUps.map((item) => serializeBalanceTopUp(item)),
      topUpSummary: summaryRows[0]
        ? {
            loaded: Number(summaryRows[0].loaded.toFixed(2)),
            spent: Math.abs(Number(summaryRows[0].spent.toFixed(2))),
            bonus: Number(summaryRows[0].bonus.toFixed(2)),
            count: summaryRows[0].count,
          }
        : { loaded: 0, spent: 0, bonus: 0, count: 0 },
    });
  } catch (error) {
    // MP-1.8: mesaj çözümlemesi errorHandler'da; burada yalnızca log + yönlendir.
    console.error("GET /analytics/dashboard error:", error);
    return next(new ApiError(500, "ANALYTICS_FETCH_FAILED", "sys:analitik-verileri-alinamadi"));
  }
});

router.get("/bootstrap", attachOptionalAuth, async (req, res) => {
  const payload = await buildBootstrapPayload(req.authUser);
  res.json(payload);
});

// MP-0.9: Manager bootstrap'ının ağır bölümü — kullanıcı listesi, tüm bakiye
// hareketleri ve son sistem logları. Bootstrap'tan ayrıldı ki 5 sn'lik
// polling bu O(n×m) sorguları tetiklemesin.
router.get("/admin/overview", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const payload = await buildAdminOverviewPayload();
    return res.json(payload);
  } catch (error) {
    console.error("GET /admin/overview error:", error);
    return next(new ApiError(500, "ADMIN_OVERVIEW_FAILED", "sys:yonetici-ozeti-alinamadi"));
  }
});

router.post("/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const surname = String(req.body.surname || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase().replace(/^@/, '');
    const gender = String(req.body.gender || "").trim();
    const email = normalizeEmail(String(req.body.email || ""));
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim();
    const birthDate = String(req.body.birthDate || "").trim();

    if (!name || !surname || !username || !email || !password || !gender || !phone || !birthDate) {
      return res.status(400).json({ message: "Ad, soyad, kullanıcı adı, cinsiyet, e-posta, şifre, telefon ve doğum tarihi alanları zorunludur." });
    }

    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ message: "Kullanıcı adı 3-20 karakter arasında olmalı, yalnızca küçük harf, rakam ve alt çizgi içerebilir." });
    }

    // MP-2.2: parola politikasi — 8+ karakter, harf+rakam, kara liste,
    // e-posta/kullanici adi icermeme.
    const passwordError = await validatePasswordPolicy(password, { email, username });
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    if (!["female", "male"].includes(gender)) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-cinsiyet-secilmelidir") });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-e-posta-adresi-giriniz") });
    }

    // Türkiye telefon numarası doğrulaması
    const cleanPhone = phone.replace(/\D/g, "");
    const isValidTurkeyPhone =
      (cleanPhone.length === 10 && cleanPhone.startsWith("5")) ||
      (cleanPhone.length === 11 && cleanPhone.startsWith("05")) ||
      (cleanPhone.length === 12 && cleanPhone.startsWith("905"));

    if (!isValidTurkeyPhone) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-turkiye-telefon-numarasi-giriniz-orn-05051234567-2") });
    }

    // Doğum tarihi doğrulaması
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-dogum-tarihi-giriniz-2") });
    }
    const currentYear = new Date().getFullYear();
    const age = currentYear - birth.getFullYear();
    if (age < 12 || age > 100) {
      return res.status(400).json({ message: await getSystemText("lutfen-gercekci-bir-dogum-tarihi-giriniz-yas-12-100-arasinda-olmalidir") });
    }

    const existingUsername = await UserModel.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: "Bu kullanıcı adı zaten başka bir kullanıcı tarafından alınmış." });
    }

    const existingEmail = await UserModel.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: await getSystemText("bu-e-posta-zaten-kullanimda") });
    }

    // Guvenlik (MP-0.2): kayitta rol her zaman customer'dir. Ayricalikli roller
    // yalnizca oturum acmis bir manager tarafindan (PATCH /users/:id, POST /staff)
    // verilir; e-posta ile otomatik rol yukseltme akisi kapalidir.
    const role: UserRole = "customer";
    if (isConfiguredManagerEmail(email)) {
      console.warn(`[security] Kayit talimati ayarlanmis yonetici e-postasiyla geldi: ${email} (rol: customer olarak olusturuldu)`);
    }
    const user = await UserModel.create({
      name,
      surname,
      username,
      gender,
      email,
      password,
      phone: cleanPhone,
      birthDate: birthDate,
      role,
      sessionRole: role === "customer" ? "customer" : null,
      balance: 0,
      points: 0,
      avatar: "",
      favorites: [],
      addresses: [],
      paymentMethods: [],
      socialLinks: {},
      privacy: {
        isProfilePrivate: false,
        showKp: true,
        showSocials: true,
        showAge: true,
        showGender: true,
        showJoinDate: true,
      },
      followers: [],
      following: [],
    });

    return res.status(201).json({
      token: signToken(user._id.toString(), user.tokenVersion ?? 0),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("POST /auth/register error:", error);
    return next(new ApiError(500, "REGISTER_FAILED", "sys:kayit-islemi-sirasinda-bir-hata-olustu"));
  }
});

// MP-1.1: hesap bazli login kilidi sabitleri ve yardimcilari.
const LOGIN_MAX_FAILED_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

function isLoginLocked(user: { lockUntil?: Date | string | null }): boolean {
  return !!user.lockUntil && new Date(user.lockUntil).getTime() > Date.now();
}

async function registerFailedLogin(user: any): Promise<void> {
  const attempts = (user.failedLoginAttempts || 0) + 1;

  if (attempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: attempts, lockUntil: new Date(Date.now() + LOGIN_LOCK_DURATION_MS) } },
    );
    return;
  }

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { failedLoginAttempts: attempts } },
  );
}

async function resetLoginLockout(user: any): Promise<void> {
  if (!user.failedLoginAttempts && !user.lockUntil) {
    return;
  }

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { failedLoginAttempts: 0, lockUntil: null } },
  );
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
}


router.post("/auth/login", async (req, res, next) => {
  try {
    const rawLogin = String(req.body.email || req.body.username || req.body.login || "").trim();
    const cleanUsername = rawLogin.toLowerCase().replace(/^@/, '');
    const email = normalizeEmail(rawLogin);
    const password = String(req.body.password || "");

    const user = await UserModel.findOne({
      $or: [
        { email },
        { username: cleanUsername },
      ],
    });

    // MP-1.1: hesap bazli kilitleme — 5 basarisiz denemeden sonra 15 dakika.
    // Kilit yanıtı kimlik sayımına izin vermez: mesaj genel hatadir ve var
    // olmayan hesapla ayni status/body döner.
    if (user && isLoginLocked(user)) {
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "E-posta/Kullanıcı adı veya şifre hatalı.",
      });
    }

    // Generic response to prevent user enumeration
    if (!user || !(await user.comparePassword(password))) {
      if (user) {
        await registerFailedLogin(user);
      }
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "E-posta/Kullanıcı adı veya şifre hatalı.",
      });
    }

    await resetLoginLockout(user);

    user.sessionRole = user.role === "customer" ? "customer" : null;
    await user.save();
    await syncShiftStatusForUser(user, "İzinli");

    return res.json({
      token: signToken(user._id.toString(), user.tokenVersion ?? 0),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("POST /auth/login error:", error);
    return next(new ApiError(500, "LOGIN_FAILED", "sys:giris-islemi-sirasinda-bir-hata-olustu"));
  }
});

router.post("/auth/logout", attachAuth, async (req, res) => {
  if (req.authUser) {
    req.authUser.sessionRole = req.authUser.role === "customer" ? "customer" : null;
    // MP-2.1: logout tum oturumlari dusurur — tokenVersion arttirilir.
    req.authUser.tokenVersion = (req.authUser.tokenVersion ?? 0) + 1;
    await req.authUser.save();
  }
  await syncShiftStatusForUser(req.authUser, "İzinli");
  return res.json({ success: true });
});

router.post("/auth/session-role", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const accountRole = getAccountRole(req.authUser);
  const nextRole = String(req.body.role || "").trim() as UserRole;

  if (accountRole === "customer") {
    req.authUser.sessionRole = "customer";
    await req.authUser.save();
    return res.json({ user: serializeUser(req.authUser), role: "customer" });
  }

  const allowedRoles: UserRole[] =
    accountRole === "manager"
      ? ["manager", "staff", "customer"]
      : [accountRole, "customer"];

  if (!allowedRoles.includes(nextRole)) {
    return res.status(400).json({ message: await getSystemText("gecerli-bir-oturum-secimi-yapin") });
  }

  req.authUser.sessionRole = nextRole;
  await req.authUser.save();
  await syncShiftStatusForUser(req.authUser, isShiftRole(nextRole) ? "Vardiyada" : "İzinli");

  return res.json({
    user: serializeUser(req.authUser),
    role: getEffectiveRole(req.authUser),
  });
});

router.post("/auth/reset-password", async (_req, res) => {
  // Guvenlik (MP-0.8): e-posta sayum (enumeration) kanalini kapatmak icin yanit
  // kayitli/kayitsiz tum adresler icin birebir aynidir. Gercek sifirlama akisi
  // (SMTP + tek kullanimlik token) gelene kadar hicbir kullanici aramasi yapilmaz.
  return res.json({
    success: true,
    message: await getSystemText("sifre-sifirlama-talebi-alindi-lutfen-girdiginiz-e-posta-adresini-kontrol-edin"),
  });
});

router.get("/auth/me", attachAuth, async (req, res) => {
  res.json({ user: serializeUser(req.authUser) });
});

router.post("/uploads/image", attachAuth, (req, res) => {
  imageUpload.single("image")(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const authRequest = req as AuthRequest;

    if (!authRequest.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const scope = String(req.body.scope || "").trim();

    if (!isImageScope(scope)) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-upload-alani-secilmeli") });
    }

    if (scope !== "avatar" && authRequest.authRole !== "manager") {
      return res.status(403).json({ message: await getSystemText("bu-gorsel-alani-icin-yetkiniz-yok") });
    }

    if (!req.file) {
      return res.status(400).json({ message: await getSystemText("yuklenecek-bir-gorsel-secin") });
    }

    try {
      const url = await saveImageAsWebp(req.file.buffer, scope);
      return res.status(201).json({ url });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Gorsel kaydedilemedi.";
      return res.status(500).json({ message });
    }
  });
});

router.patch("/users/me", attachAuth, async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const previousAvatar = req.authUser.avatar;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: await getSystemText("ad-alani-bos-birakilamaz") });
      }
      updates.name = trimmed;
    }

    if (typeof body.surname === "string") {
      const trimmed = body.surname.trim();
      if (!trimmed) {
        return res.status(400).json({ message: await getSystemText("soyad-alani-bos-birakilamaz") });
      }
      updates.surname = trimmed;
    }

    if (typeof body.gender === "string") {
      if (["female", "male"].includes(body.gender.trim())) {
        updates.gender = body.gender.trim();
      } else {
        updates.gender = undefined;
      }
    }

    if (typeof body.phone === "string") {
      const cleanPhone = body.phone.replace(/\D/g, "");
      const isValidTurkeyPhone =
        (cleanPhone.length === 10 && cleanPhone.startsWith("5")) ||
        (cleanPhone.length === 11 && cleanPhone.startsWith("05")) ||
        (cleanPhone.length === 12 && cleanPhone.startsWith("905"));
      if (body.phone.trim() !== "" && !isValidTurkeyPhone) {
        return res.status(400).json({ message: await getSystemText("gecerli-bir-turkiye-telefon-numarasi-giriniz-orn-05051234567-2") });
      }
      updates.phone = cleanPhone;
    }

    if (typeof body.birthDate === "string") {
      if (body.birthDate.trim() !== "") {
        const birth = new Date(body.birthDate);
        if (isNaN(birth.getTime())) {
          return res.status(400).json({ message: await getSystemText("gecerli-bir-dogum-tarihi-giriniz-2") });
        }
        const currentYear = new Date().getFullYear();
        const age = currentYear - birth.getFullYear();
        if (age < 12 || age > 100) {
          return res.status(400).json({ message: await getSystemText("lutfen-gercekci-bir-dogum-tarihi-giriniz-yas-12-100-arasinda-olmalidir") });
        }
      }
      updates.birthDate = body.birthDate.trim();
    }

    if (typeof body.email === "string") {
      const trimmed = body.email.trim();
      if (!trimmed) {
        return res.status(400).json({ message: await getSystemText("e-posta-alani-bos-birakilamaz") });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return res.status(400).json({ message: await getSystemText("gecerli-bir-e-posta-adresi-giriniz") });
      }
      updates.email = normalizeEmail(trimmed);
    }

    if ("avatar" in body) {
      updates.avatar = normalizeImageValue(body.avatar);
    }

    if ("favorites" in body) {
      updates.favorites = Array.isArray(body.favorites)
        ? body.favorites.map((item) => String(item)).filter(Boolean)
        : [];
    }

    if (typeof body.username === "string") {
      const cleanUsername = body.username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername !== "") {
        const usernameRegex = /^[a-z0-9_]{3,20}$/;
        if (!usernameRegex.test(cleanUsername)) {
          return res.status(400).json({ message: "Kullanıcı adı 3-20 karakter arasında olmalı, yalnızca küçük harf, rakam ve alt çizgi içerebilir." });
        }
        const existing = await UserModel.findOne({ username: cleanUsername, _id: { $ne: req.authUser._id } });
        if (existing) {
          return res.status(409).json({ message: "Bu kullanıcı adı zaten başka bir kullanıcı tarafından alınmış." });
        }
        updates.username = cleanUsername;
      } else {
        updates.username = undefined;
      }
    }

    if (typeof body.bio === "string") {
      updates.bio = body.bio.trim().slice(0, 200);
    }

    if (body.socialLinks && typeof body.socialLinks === "object") {
      const rawSocials = body.socialLinks as Record<string, unknown>;
      updates.socialLinks = {
        instagram: typeof rawSocials.instagram === "string" ? rawSocials.instagram.trim().replace(/^@/, '') : (req.authUser.socialLinks?.instagram || ''),
        twitter: typeof rawSocials.twitter === "string" ? rawSocials.twitter.trim().replace(/^@/, '') : (req.authUser.socialLinks?.twitter || ''),
        linkedin: typeof rawSocials.linkedin === "string" ? rawSocials.linkedin.trim() : (req.authUser.socialLinks?.linkedin || ''),
        github: typeof rawSocials.github === "string" ? rawSocials.github.trim().replace(/^@/, '') : (req.authUser.socialLinks?.github || ''),
        website: typeof rawSocials.website === "string" ? rawSocials.website.trim() : (req.authUser.socialLinks?.website || ''),
        tiktok: typeof rawSocials.tiktok === "string" ? rawSocials.tiktok.trim().replace(/^@/, '') : (req.authUser.socialLinks?.tiktok || ''),
        youtube: typeof rawSocials.youtube === "string" ? rawSocials.youtube.trim() : (req.authUser.socialLinks?.youtube || ''),
      };
    }

    if (body.privacy && typeof body.privacy === "object") {
      const rawPrivacy = body.privacy as Record<string, unknown>;
      updates.privacy = {
        isProfilePrivate: typeof rawPrivacy.isProfilePrivate === "boolean" ? rawPrivacy.isProfilePrivate : (req.authUser.privacy?.isProfilePrivate ?? false),
        showKp: typeof rawPrivacy.showKp === "boolean" ? rawPrivacy.showKp : (req.authUser.privacy?.showKp ?? true),
        showSocials: typeof rawPrivacy.showSocials === "boolean" ? rawPrivacy.showSocials : (req.authUser.privacy?.showSocials ?? true),
        showAge: typeof rawPrivacy.showAge === "boolean" ? rawPrivacy.showAge : (req.authUser.privacy?.showAge ?? true),
        showGender: typeof rawPrivacy.showGender === "boolean" ? rawPrivacy.showGender : (req.authUser.privacy?.showGender ?? true),
        showJoinDate: typeof rawPrivacy.showJoinDate === "boolean" ? rawPrivacy.showJoinDate : (req.authUser.privacy?.showJoinDate ?? true),
      };
    }

    if ("addresses" in body) {
      updates.addresses = normalizeAddresses(body.addresses);
    }

    if ("paymentMethods" in body) {
      updates.paymentMethods = normalizePaymentMethods(body.paymentMethods);
    }

    if ("settings" in body) {
      updates.settings = normalizeUserSettings(body.settings, req.authUser.settings);
    }

    const previousEmail = req.authUser.email;
    if (updates.username === undefined && typeof body.username === "string" && body.username.trim() === "") {
      req.authUser.set("username", undefined);
    }
    Object.assign(req.authUser, updates);
    if ("socialLinks" in updates) {
      req.authUser.markModified("socialLinks");
    }
    if ("privacy" in updates) {
      req.authUser.markModified("privacy");
    }
    await req.authUser.save();

    if ("email" in updates && previousEmail !== req.authUser.email) {
      if (isShiftRole(req.authUser.role)) {
        await StaffModel.updateMany(
          { email: previousEmail },
          { $set: { email: req.authUser.email } }
        );
      }
    }

    if (
      "name" in updates ||
      "surname" in updates ||
      "email" in updates
    ) {
      await syncShiftStatusForUser(req.authUser, isShiftRole(getEffectiveRole(req.authUser)) ? "Vardiyada" : "İzinli");
    }

    if ("avatar" in updates && previousAvatar !== req.authUser.avatar) {
      await deleteManagedImage(previousAvatar);
    }

    return res.json({ user: serializeUser(req.authUser) });
  } catch (error: any) {
    console.error("PATCH /users/me error:", error);
    if (error.code === 11000 || error.message?.includes("E11000")) {
      if (error.keyPattern?.username || error.message?.includes("username")) {
        return res.status(409).json({ message: "Bu kullanıcı adı zaten kullanımda." });
      }
      return res.status(409).json({ message: await getSystemText("bu-e-posta-adresi-zaten-kullanimda") });
    }
    return res.status(500).json({ message: await getSystemText("profil-guncellenirken-bir-hata-olustu") });
  }
});

// GET Public User Profile
router.get("/users/profile/:idOrUsername", attachOptionalAuth, async (req, res) => {
  try {
    const param = String(req.params.idOrUsername || "").trim().replace(/^@/, '');
    if (!param) {
      return res.status(400).json({ message: "Kullanıcı parametresi gerekli." });
    }

    let targetUser: any = null;
    if (mongoose.Types.ObjectId.isValid(param)) {
      targetUser = await UserModel.findById(param);
    }
    if (!targetUser) {
      targetUser = await UserModel.findOne({ username: param.toLowerCase() });
    }

    if (!targetUser) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const currentUserId = req.authUser?._id ? req.authUser._id.toString() : null;
    const isSelf = currentUserId === targetUser._id.toString();
    const isStaffOrManager = req.authUser?.role === "staff" || req.authUser?.role === "manager";
    const isFollowing = currentUserId ? (targetUser.followers || []).includes(currentUserId) : false;
    const isFollower = currentUserId ? (targetUser.following || []).includes(currentUserId) : false;

    const privacy = targetUser.privacy || {
      isProfilePrivate: false,
      showKp: true,
      showSocials: true,
      showAge: true,
      showGender: true,
      showJoinDate: true,
    };

    const isPrivate = Boolean(privacy.isProfilePrivate) && !isSelf && !isFollowing && !isStaffOrManager;

    let age: number | null = null;
    if (targetUser.birthDate && (privacy.showAge || isSelf || isStaffOrManager)) {
      const birth = new Date(targetUser.birthDate);
      if (!isNaN(birth.getTime())) {
        age = new Date().getFullYear() - birth.getFullYear();
      }
    }

    const publicProfile = {
      id: targetUser._id.toString(),
      name: targetUser.name,
      surname: targetUser.surname,
      username: targetUser.username || undefined,
      avatar: targetUser.avatar || "",
      bio: targetUser.bio || "",
      isProfilePrivate: privacy.isProfilePrivate ?? false,
      isFollowing,
      isFollower,
      followersCount: (targetUser.followers || []).length,
      followingCount: (targetUser.following || []).length,
      points: !isPrivate && (privacy.showKp || isSelf || isStaffOrManager) ? targetUser.points : null,
      socialLinks: !isPrivate && (privacy.showSocials || isSelf || isStaffOrManager) ? targetUser.socialLinks : null,
      age: !isPrivate ? age : null,
      gender: !isPrivate && (privacy.showGender || isSelf || isStaffOrManager) ? targetUser.gender : null,
      createdAt: !isPrivate && (privacy.showJoinDate || isSelf || isStaffOrManager) ? toIsoString(targetUser.createdAt) : null,
    };

    return res.json({ profile: publicProfile });
  } catch (error: any) {
    console.error("GET /users/profile/:idOrUsername error:", error);
    return res.status(500).json({ message: "Profil bilgisi alınamadı." });
  }
});

// Follow / Unfollow toggle
router.post("/users/:id/follow", attachAuth, async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const targetId = String(req.params.id || "").trim();
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });
    }

    const currentUserId = req.authUser._id.toString();
    if (targetId === currentUserId) {
      return res.status(400).json({ message: "Kendinizi takip edemezsiniz." });
    }

    const targetUser = await UserModel.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const isFollowing = (targetUser.followers || []).includes(currentUserId);

    if (isFollowing) {
      // Unfollow
      await UserModel.findByIdAndUpdate(targetId, { $pull: { followers: currentUserId } });
      await UserModel.findByIdAndUpdate(currentUserId, { $pull: { following: targetId } });
    } else {
      // Follow
      await UserModel.findByIdAndUpdate(targetId, { $addToSet: { followers: currentUserId } });
      await UserModel.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetId } });

      // Create in-app notification for target
      await NotificationModel.create({
        userId: targetId,
        title: "Yeni Takipçi!",
        message: `${req.authUser.name} ${req.authUser.surname} seni takip etmeye başladı.`,
        type: "info",
        read: false,
        timestamp: new Date().toISOString(),
      });
    }

    const updatedTarget = await UserModel.findById(targetId);
    const updatedRequester = await UserModel.findById(currentUserId);

    return res.json({
      isFollowing: !isFollowing,
      followersCount: (updatedTarget?.followers || []).length,
      followingCount: (updatedTarget?.following || []).length,
      currentUserFollowingCount: (updatedRequester?.following || []).length,
    });
  } catch (error: any) {
    console.error("POST /users/:id/follow error:", error);
    return res.status(500).json({ message: "Takip işlemi gerçekleştirilemedi." });
  }
});

// GET Followers list
router.get("/users/:id/followers", attachAuth, async (req, res) => {
  try {
    const targetId = String(req.params.id || "").trim();
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });
    }

    const user = await UserModel.findById(targetId).lean();
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const followerIds = (user.followers || []).filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    const followers = await UserModel.find({ _id: { $in: followerIds } }, "name surname username avatar bio").lean();

    return res.json({
      followers: followers.map((f: any) => ({
        id: f._id.toString(),
        name: f.name,
        surname: f.surname,
        username: f.username || undefined,
        avatar: f.avatar || "",
        bio: f.bio || "",
      })),
    });
  } catch (error: any) {
    console.error("GET /users/:id/followers error:", error);
    return res.status(500).json({ message: "Takipçi listesi alınamadı." });
  }
});

// GET Following list
router.get("/users/:id/following", attachAuth, async (req, res) => {
  try {
    const targetId = String(req.params.id || "").trim();
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });
    }

    const user = await UserModel.findById(targetId).lean();
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const followingIds = (user.following || []).filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    const following = await UserModel.find({ _id: { $in: followingIds } }, "name surname username avatar bio").lean();

    return res.json({
      following: following.map((f: any) => ({
        id: f._id.toString(),
        name: f.name,
        surname: f.surname,
        username: f.username || undefined,
        avatar: f.avatar || "",
        bio: f.bio || "",
      })),
    });
  } catch (error: any) {
    console.error("GET /users/:id/following error:", error);
    return res.status(500).json({ message: "Takip edilenler listesi alınamadı." });
  }
});

router.get("/users/search", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json([]);
    }

    const regex = new RegExp(escapeRegExp(q), "i");
    const users = await UserModel.find({
      $or: [
        { name: regex },
        { surname: regex },
        { phone: regex }
      ]
    }).limit(15);

    return res.json(users.map(u => serializeUser(u)));
  } catch (error) {
    console.error("Search users error:", error);
    return next(new ApiError(500, "USER_SEARCH_FAILED", "sys:kullanicilar-aranirken-hata-olustu"));
  }
});

router.post("/users/me/password", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const currentPassword = String(req.body.currentPassword || "");
    const nextPassword = String(req.body.newPassword || "");

    if (!currentPassword || !nextPassword) {
      return res.status(400).json({ message: await getSystemText("mevcut-sifre-ve-yeni-sifre-gerekli") });
    }

    // MP-2.2: ayni parola politikasi sifre degisikliginde de uygulanir.
    const passwordError = await validatePasswordPolicy(nextPassword, {
      email: normalizeEmail(req.authUser.email || ""),
      username: String(req.authUser.username || ""),
    });
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    if (!(await req.authUser.comparePassword(currentPassword))) {
      return res.status(401).json({ message: await getSystemText("mevcut-sifre-hatali") });
    }

    req.authUser.password = nextPassword;
    // MP-2.1: parola degisikligi tum oturumlari dusurur (diger cihazlar
    // dahil) — tokenVersion arttirilir.
    req.authUser.tokenVersion = (req.authUser.tokenVersion ?? 0) + 1;
    await req.authUser.save();

    return res.json({ success: true });
  } catch (error) {
    console.error("POST /users/me/password error:", error);
    return next(new ApiError(500, "PASSWORD_UPDATE_FAILED", "sys:sifre-guncellenirken-bir-hata-olustu"));
  }
});

// Guvenlik (MP-0.1): musteri kendi bakiyesini yukleyemez — odeme saglayicisi
// (Iyzico/Stripe) entegrasyonu gelene kadar musteri tarafi yukleme akisi
// tamamen kapalidir. Bakiye yukleme yalnizca kasa/personel uzerinden
// POST /users/:id/balance ile yapilir.
router.post("/users/me/balance", attachAuth, restrictTo("staff", "manager"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const creditedAmount = ensureNumber(req.body.amount);
  if (creditedAmount <= 0) {
    return res.status(400).json({ message: await getSystemText("yuklenecek-miktar-sifirdan-buyuk-olmalidir") });
  }
  if (creditedAmount > 10000) {
    return res.status(400).json({ message: await getSystemText("tek-seferde-en-fazla-10-000-yuklenebilir") });
  }

  // revenueAmount/bonusAmount istemciden ASLA kabul edilmez (MP-0.1): sunucu
  // tarafinda, kullaniciya ait secili kampanyadan hesaplanir.
  const { revenueAmount, bonusAmount } = await resolveBalanceTopUpAmounts(req.authUser, creditedAmount);

  const totalCredited = Math.round((creditedAmount + bonusAmount) * 100) / 100;

  req.authUser.balance = Math.max(0, req.authUser.balance + totalCredited);
  await req.authUser.save();

  await BalanceTopUpModel.create({
    userId: req.authUser._id.toString(),
    userName: `${req.authUser.name} ${req.authUser.surname}`.trim(),
    userEmail: req.authUser.email,
    amount: revenueAmount,
    creditedAmount: totalCredited,
    bonusAmount,
    timestamp: new Date(),
  });

  return res.json({ user: serializeUser(req.authUser) });
});

router.post("/users/:id/balance", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const creditedAmount = ensureNumber(req.body.amount);
    if (creditedAmount <= 0) {
      return res.status(400).json({ message: await getSystemText("yuklenecek-miktar-sifirdan-buyuk-olmalidir") });
    }
    if (creditedAmount > 10000) {
      return res.status(400).json({ message: await getSystemText("tek-seferde-en-fazla-10-000-yuklenebilir") });
    }

    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
    }

    // Guvenlik (MP-0.1): ciro/bonus istemci govdesinden alinmaz; kullaniciya
    // ait secili finansal kampanyaya gore sunucu tarafinda hesaplanir.
    const { revenueAmount, bonusAmount } = await resolveBalanceTopUpAmounts(user, creditedAmount);
    const totalCredited = Math.round((creditedAmount + bonusAmount) * 100) / 100;

    user.balance = Math.max(0, user.balance + totalCredited);
    await user.save();

    await BalanceTopUpModel.create({
      userId: user._id.toString(),
      userName: `${user.name} ${user.surname}`.trim(),
      userEmail: user.email,
      amount: revenueAmount,
      creditedAmount: totalCredited,
      bonusAmount,
      timestamp: new Date(),
    });

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error("POST /users/:id/balance error:", error);
    return next(new ApiError(500, "BALANCE_TOPUP_FAILED", "sys:bakiye-yuklenirken-hata-olustu"));
  }
});

router.post("/users/me/points", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  return res.status(403).json({ message: await getSystemText("sadakat-puanlari-yalnizca-tamamlanan-siparislerden-kazanilir") });
});

router.get("/loyalty/qr", attachAuth, restrictTo("customer"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  try {
    const { token, expiresAt } = createLoyaltyQrToken(
      req.authUser._id.toString(),
      req.authUser.tokenVersion ?? 0,
    );

    return res.json({
      token,
      expiresAt,
      summary: await buildLoyaltySummary(req.authUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sadakat QR kodu olusturulamadi.";
    return res.status(400).json({ message });
  }
});

router.post("/loyalty/scan/resolve", attachAuth, restrictTo("staff", "manager"), async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const customer = await resolveLoyaltyToken(token);
    return res.json(await buildLoyaltyScanResult(customer));
  } catch (error) {
    const message = error instanceof Error ? error.message : "QR kodu gecersiz veya suresi dolmus.";
    return res.status(400).json({ message });
  }
});

router.post("/loyalty/scan/redeem-campaign", attachAuth, restrictTo("staff", "manager"), async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const campaignId = String(req.body.campaignId || "");
    const customer = await resolveLoyaltyToken(token);
    const result = await redeemPointCampaign(customer, campaignId);

    if (result.order?.status === "preparing") {
      await createCustomerOrderNotification(result.order.userId, "order_preparing");
    }

    return res.json(await buildLoyaltyScanResult(customer));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puan kampanyasi kullanilamadi.";
    return res.status(400).json({ message });
  }
});

// MP-2.13: ?page=&limit= desteği (varsayılan 50, üst sınır 200). Yanıt gövdesi
// eski istemciler için dizi olarak korunur; toplam kayıt X-Total-Count
// başlığıyla, meta ise ?envelope=1 ile {items, page, limit, total} olarak döner.
router.get("/users", attachAuth, restrictTo("manager"), async (req, res) => {
  const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>);
  const [users, total] = await Promise.all([
    UserModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    UserModel.countDocuments(),
  ]);
  const items = users.map((item) => serializeUser(item));

  res.setHeader("X-Total-Count", String(total));

  if (String((req.query as Record<string, unknown>).envelope ?? "") === "1") {
    return res.json({ items, page, limit, total });
  }

  return res.json(items);
});

// MP-2.13: manager için bakiye hareketleri listesi — /admin/overview'daki
// sınırsız dizinin paginasyonlu hali. Format /users ile aynı (dizi + X-Total-Count,
// ?envelope=1 ile {items, page, limit, total}).
router.get("/balance-top-ups", attachAuth, restrictTo("manager"), async (req, res) => {
  const { page, limit, skip } = parsePaginationParams(req.query as Record<string, unknown>);
  const [topUps, total] = await Promise.all([
    BalanceTopUpModel.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
    BalanceTopUpModel.countDocuments(),
  ]);
  const items = topUps.map((item) => serializeBalanceTopUp(item));

  res.setHeader("X-Total-Count", String(total));

  if (String((req.query as Record<string, unknown>).envelope ?? "") === "1") {
    return res.json({ items, page, limit, total });
  }

  return res.json(items);
});

router.patch("/users/:id", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const nextRole = String(req.body.role || "") as "customer" | "staff" | "manager";

    if (!["customer", "staff", "manager"].includes(nextRole)) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-rol-secilmeli") });
    }

    const user = await UserModel.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
    }

    if (req.authUser._id.toString() === user._id.toString() && nextRole !== "manager") {
      return res.status(409).json({ message: await getSystemText("aktif-yonetici-hesabi-manager-rolunden-dusurulemez") });
    }

    if (isConfiguredManagerEmail(user.email) && nextRole !== "manager") {
      return res.status(409).json({ message: await getSystemText("sabit-yonetici-hesabi-farkli-role-atanamaz") });
    }

    if (nextRole === "customer") {
      await StaffModel.deleteMany({ email: user.email });
    } else {
      await StaffModel.findOneAndUpdate(
        { email: user.email },
        {
          $set: {
            name: user.name,
            surname: user.surname,
            email: user.email,
            role: nextRole,
          },
          $setOnInsert: {
            status: "İzinli",
          },
        },
        { upsert: true, new: true },
      );
    }

    user.role = nextRole;
    // MP-2.1: rol degisikliginde kullanici hesabinin tum oturumlari
    // dusurulur — ayri calisma rollu eski token ile devam edemez.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error("PATCH /users/:id error:", error);
    return next(new ApiError(500, "USER_UPDATE_FAILED", "sys:kullanici-rolu-guncellenirken-bir-hata-olustu"));
  }
});

router.delete("/users/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  if (req.params.id === req.authUser._id.toString()) {
    return res.status(409).json({ message: await getSystemText("aktif-yonetici-hesabi-silinemez") });
  }

  const user = await UserModel.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
  }

  const previousAvatar = user.avatar;

  await Promise.all([
    StaffModel.deleteMany({ email: user.email }),
    OrderModel.deleteMany({ userId: user._id.toString() }),
    NotificationModel.deleteMany({ userId: user._id.toString() }),
    ChangeLogModel.deleteMany({ userId: user._id.toString() }),
    BalanceTopUpModel.deleteMany({ userId: user._id.toString() }),
  ]);

  await user.deleteOne();
  await deleteManagedImage(previousAvatar);

  return res.json({
    success: true,
    deletedUserId: req.params.id,
  });
});

router.get("/products", async (_req, res) => {
  const products = await ProductModel.find().sort({ name: 1 });
  res.json(products.map((item) => serializeSimpleDocument(item)));
});

router.post("/products", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const price = ensureNumber(req.body.price);
    const category = String(req.body.category || "").trim();
    const description = String(req.body.description || "").trim();
    const inStock = req.body.inStock !== undefined ? Boolean(req.body.inStock) : true;
    const ingredients = Array.isArray(req.body.ingredients) ? req.body.ingredients.map(String) : [];

    if (!name) {
      return res.status(400).json({ message: await getSystemText("urun-ismi-zorunludur") });
    }
    if (price < 0) {
      return res.status(400).json({ message: await getSystemText("fiyat-sifirdan-kucuk-olamaz") });
    }
    if (!category) {
      return res.status(400).json({ message: await getSystemText("kategori-zorunludur") });
    }

    const product = await ProductModel.create({
      name,
      price,
      category,
      description,
      inStock,
      ingredients,
      image: normalizeImageValue(req.body.image),
    });
    res.status(201).json(serializeSimpleDocument(product));
  } catch (error) {
    console.error("POST /products error:", error);
    return next(new ApiError(500, "PRODUCT_CREATE_FAILED", "sys:urun-eklenirken-bir-hata-olustu"));
  }
});

router.patch("/products/:id", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const updates = { ...req.body };

    if (req.authUser?.role === "staff") {
      const current = await ProductModel.findById(req.params.id);

      if (!current) {
        return res.status(404).json({ message: await getSystemText("urun-bulunamadi") });
      }

      current.inStock = Boolean(updates.inStock);
      await current.save();
      return res.json(serializeSimpleDocument(current));
    }

    const product = await ProductModel.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: await getSystemText("urun-bulunamadi") });
    }

    const previousImage = product.image;

    const name = updates.name !== undefined ? String(updates.name || "").trim() : undefined;
    const price = updates.price !== undefined ? ensureNumber(updates.price) : undefined;
    const category = updates.category !== undefined ? String(updates.category || "").trim() : undefined;
    const description = updates.description !== undefined ? String(updates.description || "").trim() : undefined;
    const inStock = updates.inStock !== undefined ? Boolean(updates.inStock) : undefined;
    const ingredients = Array.isArray(updates.ingredients) ? updates.ingredients.map(String) : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ message: await getSystemText("urun-ismi-bos-olamaz") });
    }
    if (price !== undefined && price < 0) {
      return res.status(400).json({ message: await getSystemText("fiyat-sifirdan-kucuk-olamaz") });
    }
    if (category !== undefined && !category) {
      return res.status(400).json({ message: await getSystemText("kategori-bos-olamaz") });
    }

    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = price;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (inStock !== undefined) product.inStock = inStock;
    if (ingredients !== undefined) product.ingredients = ingredients;

    if ("image" in updates) {
      product.image = normalizeImageValue(updates.image);
    }

    await product.save();

    if ("image" in updates && previousImage !== product.image) {
      await deleteManagedImage(previousImage);
    }

    return res.json(serializeSimpleDocument(product));
  } catch (error) {
    console.error("PATCH /products/:id error:", error);
    return next(new ApiError(500, "PRODUCT_UPDATE_FAILED", "sys:urun-guncellenirken-bir-hata-olustu"));
  }
});

router.delete("/products/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const product = await ProductModel.findById(req.params.id);

  if (product) {
    const previousImage = product.image;
    await product.deleteOne();
    await deleteManagedImage(previousImage);
  }

  res.status(204).send();
});

router.get("/campaigns", async (_req, res) => {
  const campaigns = await CampaignModel.find({ type: { $ne: "stamp_card" } }).sort({ createdAt: -1 });
  res.json(campaigns.map((item) => serializeSimpleDocument(item)));
});

router.post("/campaigns/select/:id", attachAuth, restrictTo("customer"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  await clearExpiredSelectedCampaign(req.authUser);

  const campaign = await CampaignModel.findById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ message: await getSystemText("kampanya-bulunamadi") });
  }

  const serializedCampaign = serializeSimpleDocument(campaign) as any;

  if (!isCampaignActive(serializedCampaign)) {
    return res.status(409).json({ message: await getSystemText("secilen-kampanya-su-an-aktif-degil") });
  }

  req.authUser.selectedCampaign = {
    campaignId: serializedCampaign.id,
    campaignTitle: serializedCampaign.title,
    campaignType: serializedCampaign.type,
    category: serializedCampaign.category,
    selectedAt: new Date().toISOString(),
    expiresAt: getCampaignSelectionExpiry(serializedCampaign),
    targetCategory: serializedCampaign.targetCategory || "",
    targetProductId: serializedCampaign.targetProductId || "",
  };
  await req.authUser.save();

  res.json({ success: true, selectedCampaign: req.authUser.selectedCampaign });
});

router.post("/campaigns/deselect", attachAuth, restrictTo("customer"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  req.authUser.selectedCampaign = null;
  await req.authUser.save();

  res.json({ success: true, selectedCampaign: null });
});

router.post("/campaigns", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "discount").trim();
    const type = String(req.body.type || "discount").trim();
    const value = ensureNumber(req.body.value);
    const discountType = req.body.discountType === "fixed" ? "fixed" : "percentage";
    const startDate = String(req.body.startDate || "").trim();
    const expiryDate = String(req.body.expiryDate || "").trim();
    const active = req.body.active !== undefined ? Boolean(req.body.active) : true;
    const minLoadAmount = ensureNumber(req.body.minLoadAmount);
    const minOrderAmount = ensureNumber(req.body.minOrderAmount);
    const fixedGiftAmount = ensureNumber(req.body.fixedGiftAmount);
    const pointsCost = ensureNumber(req.body.pointsCost);
    const usageLimit = ensureNumber(req.body.usageLimit) || 1;
    const validityHours = ensureNumber(req.body.validityHours) || 24;
    const targetType = req.body.targetType || "all";
    const targetCategory = String(req.body.targetCategory || "").trim();
    const targetProductId = String(req.body.targetProductId || "").trim();
    const comboProducts = Array.isArray(req.body.comboProducts) ? req.body.comboProducts.map(String) : [];
    const startTime = String(req.body.startTime || "").trim();
    const endTime = String(req.body.endTime || "").trim();
    const targetDays = ensureNumber(req.body.targetDays);
    const vipThreshold = ensureNumber(req.body.vipThreshold);

    if (!title) return res.status(400).json({ message: await getSystemText("kampanya-basligi-zorunludur") });
    if (!description) return res.status(400).json({ message: await getSystemText("kampanya-aciklamasi-zorunludur") });
    if (!expiryDate) return res.status(400).json({ message: await getSystemText("bitis-tarihi-zorunludur") });

    const campaign = await CampaignModel.create({
      title,
      description,
      category,
      type,
      value,
      discountType,
      startDate,
      expiryDate,
      active,
      minLoadAmount,
      minOrderAmount,
      fixedGiftAmount,
      pointsCost,
      usageLimit,
      validityHours,
      targetType,
      targetCategory,
      targetProductId,
      comboProducts,
      startTime,
      endTime,
      targetDays,
      vipThreshold,
      image: normalizeImageValue(req.body.image),
    });
    res.status(201).json(serializeSimpleDocument(campaign));
  } catch (error) {
    console.error("POST /campaigns error:", error);
    return next(new ApiError(500, "CAMPAIGN_CREATE_FAILED", "sys:kampanya-eklenirken-bir-hata-olustu"));
  }
});

router.patch("/campaigns/:id", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const campaign = await CampaignModel.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({ message: await getSystemText("kampanya-bulunamadi") });
    }

    const previousImage = campaign.image;
    const updates = { ...req.body };

    const title = updates.title !== undefined ? String(updates.title || "").trim() : undefined;
    const description = updates.description !== undefined ? String(updates.description || "").trim() : undefined;
    const category = updates.category !== undefined ? String(updates.category || "").trim() : undefined;
    const type = updates.type !== undefined ? String(updates.type || "").trim() : undefined;
    const value = updates.value !== undefined ? ensureNumber(updates.value) : undefined;
    const discountType = updates.discountType !== undefined ? (updates.discountType === "fixed" ? "fixed" : "percentage") : undefined;
    const startDate = updates.startDate !== undefined ? String(updates.startDate || "").trim() : undefined;
    const expiryDate = updates.expiryDate !== undefined ? String(updates.expiryDate || "").trim() : undefined;
    const active = updates.active !== undefined ? Boolean(updates.active) : undefined;
    const minLoadAmount = updates.minLoadAmount !== undefined ? ensureNumber(updates.minLoadAmount) : undefined;
    const minOrderAmount = updates.minOrderAmount !== undefined ? ensureNumber(updates.minOrderAmount) : undefined;
    const fixedGiftAmount = updates.fixedGiftAmount !== undefined ? ensureNumber(updates.fixedGiftAmount) : undefined;
    const pointsCost = updates.pointsCost !== undefined ? ensureNumber(updates.pointsCost) : undefined;
    const usageLimit = updates.usageLimit !== undefined ? ensureNumber(updates.usageLimit) : undefined;
    const validityHours = updates.validityHours !== undefined ? ensureNumber(updates.validityHours) : undefined;
    const targetType = updates.targetType !== undefined ? updates.targetType : undefined;
    const targetCategory = updates.targetCategory !== undefined ? String(updates.targetCategory || "").trim() : undefined;
    const targetProductId = updates.targetProductId !== undefined ? String(updates.targetProductId || "").trim() : undefined;
    const comboProducts = Array.isArray(updates.comboProducts) ? updates.comboProducts.map(String) : undefined;
    const startTime = updates.startTime !== undefined ? String(updates.startTime || "").trim() : undefined;
    const endTime = updates.endTime !== undefined ? String(updates.endTime || "").trim() : undefined;
    const targetDays = updates.targetDays !== undefined ? ensureNumber(updates.targetDays) : undefined;
    const vipThreshold = updates.vipThreshold !== undefined ? ensureNumber(updates.vipThreshold) : undefined;

    if (title !== undefined && !title) return res.status(400).json({ message: await getSystemText("kampanya-basligi-bos-olamaz") });
    if (description !== undefined && !description) return res.status(400).json({ message: await getSystemText("kampanya-aciklamasi-bos-olamaz") });
    if (expiryDate !== undefined && !expiryDate) return res.status(400).json({ message: await getSystemText("bitis-tarihi-bos-olamaz") });

    if (title !== undefined) campaign.title = title;
    if (description !== undefined) campaign.description = description;
    if (category !== undefined) campaign.category = category as any;
    if (type !== undefined) campaign.type = type as any;
    if (value !== undefined) campaign.value = value;
    if (discountType !== undefined) campaign.discountType = discountType;
    if (startDate !== undefined) campaign.startDate = startDate;
    if (expiryDate !== undefined) campaign.expiryDate = expiryDate;
    if (active !== undefined) campaign.active = active;
    if (minLoadAmount !== undefined) campaign.minLoadAmount = minLoadAmount;
    if (minOrderAmount !== undefined) campaign.minOrderAmount = minOrderAmount;
    if (fixedGiftAmount !== undefined) campaign.fixedGiftAmount = fixedGiftAmount;
    if (pointsCost !== undefined) campaign.pointsCost = pointsCost;
    if (usageLimit !== undefined) campaign.usageLimit = usageLimit;
    if (validityHours !== undefined) campaign.validityHours = validityHours;
    if (targetType !== undefined) campaign.targetType = targetType;
    if (targetCategory !== undefined) campaign.targetCategory = targetCategory;
    if (targetProductId !== undefined) campaign.targetProductId = targetProductId;
    if (comboProducts !== undefined) campaign.comboProducts = comboProducts;
    if (startTime !== undefined) campaign.startTime = startTime;
    if (endTime !== undefined) campaign.endTime = endTime;
    if (targetDays !== undefined) campaign.targetDays = targetDays;
    if (vipThreshold !== undefined) campaign.vipThreshold = vipThreshold;

    if ("image" in updates) {
      campaign.image = normalizeImageValue(updates.image);
    }

    await campaign.save();

    if ("image" in updates && previousImage !== campaign.image) {
      await deleteManagedImage(previousImage);
    }

    return res.json(serializeSimpleDocument(campaign));
  } catch (error) {
    console.error("PATCH /campaigns/:id error:", error);
    return next(new ApiError(500, "CAMPAIGN_UPDATE_FAILED", "sys:kampanya-guncellenirken-bir-hata-olustu"));
  }
});

router.delete("/campaigns/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const campaign = await CampaignModel.findById(req.params.id);

  if (campaign) {
    const previousImage = campaign.image;
    await campaign.deleteOne();
    await deleteManagedImage(previousImage);
  }

  res.status(204).send();
});

router.get("/ingredients", attachAuth, restrictTo("staff", "manager"), async (_req, res) => {
  const ingredients = await IngredientModel.find().sort({ name: 1 });
  res.json(ingredients.map((item) => serializeSimpleDocument(item)));
});

router.post("/ingredients", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const iconName = String(req.body.iconName || "").trim();

    if (!name) return res.status(400).json({ message: await getSystemText("icerik-ismi-zorunludur") });
    if (!iconName) return res.status(400).json({ message: await getSystemText("ikon-ismi-zorunludur") });

    const ingredient = await IngredientModel.create({ name, iconName });
    res.status(201).json(serializeSimpleDocument(ingredient));
  } catch (error) {
    console.error("POST /ingredients error:", error);
    return next(new ApiError(500, "INGREDIENT_CREATE_FAILED", "sys:icerik-eklenirken-bir-hata-olustu"));
  }
});

router.patch("/ingredients/:id", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const ingredient = await IngredientModel.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({ message: await getSystemText("icerik-bulunamadi") });
    }

    const name = req.body.name !== undefined ? String(req.body.name || "").trim() : undefined;
    const iconName = req.body.iconName !== undefined ? String(req.body.iconName || "").trim() : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ message: await getSystemText("icerik-ismi-bos-olamaz") });
    }
    if (iconName !== undefined && !iconName) {
      return res.status(400).json({ message: await getSystemText("ikon-ismi-bos-olamaz") });
    }

    const oldName = ingredient.name;
    if (name !== undefined) ingredient.name = name;
    if (iconName !== undefined) ingredient.iconName = iconName;
    await ingredient.save();

    if (name !== undefined && name !== oldName) {
      const products = await ProductModel.find({ ingredients: oldName });

      await Promise.all(
        products.map(async (product) => {
          product.ingredients = (product.ingredients || []).map((item) =>
            item === oldName ? name : item,
          );
          await product.save();
        }),
      );
    }

    return res.json(serializeSimpleDocument(ingredient));
  } catch (error) {
    console.error("PATCH /ingredients/:id error:", error);
    return next(new ApiError(500, "INGREDIENT_UPDATE_FAILED", "sys:icerik-guncellenirken-bir-hata-olustu"));
  }
});

router.delete("/ingredients/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const ingredient = await IngredientModel.findById(req.params.id);

  if (ingredient) {
    const products = await ProductModel.find({ ingredients: ingredient.name });

    await Promise.all(
      products.map(async (product) => {
        product.ingredients = (product.ingredients || []).filter((item) => item !== ingredient.name);
        await product.save();
      }),
    );

    await ingredient.deleteOne();
  }

  res.status(204).send();
});

router.get("/categories", async (_req, res) => {
  const categories = await CategoryModel.find().sort({ name: 1 });
  res.json(categories.map((item) => serializeSimpleDocument(item)));
});

router.post("/categories", attachAuth, restrictTo("manager"), async (req, res) => {
  const name = String(req.body.name || "").trim();
  const iconName = String(req.body.iconName || "").trim();
  const image = normalizeImageValue(req.body.image);

  if (!name || !iconName) {
    return res.status(400).json({ message: await getSystemText("kategori-adi-ve-ikon-gerekli") });
  }

  const existing = await CategoryModel.findOne({
    name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
  });

  if (existing) {
    return res.status(409).json({ message: await getSystemText("bu-kategori-zaten-mevcut") });
  }

  const category = await CategoryModel.create({ name, iconName, image });
  res.status(201).json(serializeSimpleDocument(category));
});

router.patch("/categories/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const category = await CategoryModel.findById(req.params.id);

  if (!category) {
    return res.status(404).json({ message: await getSystemText("kategori-bulunamadi") });
  }

  const nextName = String(req.body.name || category.name).trim();
  const nextIconName = String(req.body.iconName || category.iconName).trim();
  const nextImage = "image" in req.body ? normalizeImageValue(req.body.image) : category.image;

  if (!nextName || !nextIconName) {
    return res.status(400).json({ message: await getSystemText("kategori-adi-ve-ikon-gerekli") });
  }

  const duplicate = await CategoryModel.findOne({
    _id: { $ne: category._id },
    name: { $regex: `^${escapeRegExp(nextName)}$`, $options: "i" },
  });

  if (duplicate) {
    return res.status(409).json({ message: await getSystemText("bu-kategori-zaten-mevcut") });
  }

  const oldName = category.name;
  const previousImage = category.image;
  category.name = nextName;
  category.iconName = nextIconName;
  category.image = nextImage;
  await category.save();

  if (oldName !== nextName) {
    await ProductModel.updateMany({ category: oldName }, { $set: { category: nextName } });
  }

  if ("image" in req.body && previousImage !== category.image) {
    await deleteManagedImage(previousImage);
  }

  return res.json(serializeSimpleDocument(category));
});

router.delete("/categories/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const category = await CategoryModel.findById(req.params.id);

  if (!category) {
    return res.status(404).json({ message: await getSystemText("kategori-bulunamadi") });
  }

  const linkedProducts = await ProductModel.countDocuments({ category: category.name });

  if (linkedProducts > 0) {
    return res.status(409).json({
      message: await getSystemText("bu-kategoriye-bagli-urunler-var-once-urunleri-tasiyin-veya-silin"),
    });
  }

  const previousImage = category.image;
  await category.deleteOne();
  await deleteManagedImage(previousImage);
  res.status(204).send();
});

router.get("/staff", attachAuth, restrictTo("staff", "manager"), async (_req, res) => {
  const staff = await StaffModel.find().sort({ createdAt: -1 });
  res.json(staff.map((item) => serializeSimpleDocument(item)));
});

router.post("/staff", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const surname = String(req.body.surname || "").trim();
    const email = normalizeEmail(String(req.body.email || ""));
    const role = String(req.body.role || "") as "staff" | "manager";
    const status = String(req.body.status || "İzinli") as "Vardiyada" | "İzinli";

    if (!name) return res.status(400).json({ message: await getSystemText("isim-zorunludur") });
    if (!surname) return res.status(400).json({ message: await getSystemText("soyisim-zorunludur") });
    if (!email) return res.status(400).json({ message: await getSystemText("e-posta-zorunludur") });
    if (!["staff", "manager"].includes(role)) return res.status(400).json({ message: await getSystemText("gecersiz-rol") });
    if (!["Vardiyada", "İzinli"].includes(status)) return res.status(400).json({ message: await getSystemText("gecersiz-durum") });

    const staff = await StaffModel.create({
      name,
      surname,
      email,
      role,
      status,
    });

    await UserModel.updateOne({ email }, { $set: { role } });
    res.status(201).json(serializeSimpleDocument(staff));
  } catch (error) {
    console.error("POST /staff error:", error);
    return next(new ApiError(500, "STAFF_CREATE_FAILED", "sys:personel-eklenirken-bir-hata-olustu"));
  }
});

router.patch("/staff/:id", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const nextRole = String(req.body.role || "") as "customer" | "staff" | "manager";

    if (!["customer", "staff", "manager"].includes(nextRole)) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-rol-secilmeli") });
    }

    const staff = await StaffModel.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: await getSystemText("personel-bulunamadi") });
    }

    if (normalizeEmail(req.authUser.email) === normalizeEmail(staff.email) && nextRole !== "manager") {
      return res.status(409).json({ message: await getSystemText("aktif-yonetici-hesabi-manager-rolunden-dusurulemez") });
    }

    if (isConfiguredManagerEmail(staff.email) && nextRole !== "manager") {
      return res.status(409).json({ message: await getSystemText("sabit-yonetici-hesabi-farkli-role-atanamaz") });
    }

    if (nextRole === "customer") {
      // MP-2.1: ayri calisma dususunde oturumlar dusurulur.
      await UserModel.updateOne(
        { email: staff.email },
        { $set: { role: "customer" }, $inc: { tokenVersion: 1 } },
      );
      await staff.deleteOne();
      return res.json({ success: true, removed: true });
    }

    staff.role = nextRole;
    await staff.save();
    await UserModel.updateOne({ email: staff.email }, { $set: { role: nextRole } });

    return res.json(serializeSimpleDocument(staff));
  } catch (error) {
    console.error("PATCH /staff/:id error:", error);
    return next(new ApiError(500, "STAFF_UPDATE_FAILED", "sys:personel-rolu-guncellenirken-bir-hata-olustu"));
  }
});

router.delete("/staff/:id", attachAuth, restrictTo("manager"), async (req, res) => {
  const staff = await StaffModel.findById(req.params.id);

  if (staff) {
    // Guvenlik (MP-0.2): personel kaydi silindiginde kullanici customer'a
    // dusurulur; yalnizca env uzerinden tanimli yonetici e-postalari korunur.
    if (!isConfiguredManagerEmail(staff.email)) {
      // MP-2.1: personel kaydi silinip customer'a dusurulurken oturumlar dusulur.
      await UserModel.updateOne(
        { email: staff.email },
        { $set: { role: "customer" }, $inc: { tokenVersion: 1 } },
      );
    }

    await staff.deleteOne();
  }

  res.status(204).send();
});

router.get("/orders", attachAuth, async (req, res) => {
  const authRequest = req as AuthRequest;

  if (!authRequest.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const query =
    authRequest.authRole === "manager" || authRequest.authRole === "staff"
      ? {}
      : { userId: authRequest.authUser._id.toString() };
  const orders = await OrderModel.find(query).sort({ timestamp: -1 });

  res.json(orders.map((item) => serializeOrder(item)));
});

router.post("/orders", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  await clearExpiredActivePointReward(req.authUser);

  const incomingItems = Array.isArray(req.body.items) ? req.body.items : [];

  // MP-2.5: adet ve kalem sınırları — 1..50 arası tam sayı adet, en fazla
  // 50 kalem. Eskiden quantity 0/NaN 1'e keçiriliyordu; artık geçersiz adet
  // net 400 döner.
  if (incomingItems.length === 0) {
    return res.status(400).json({ message: await getSystemText("siparis-bos-olamaz") });
  }

  if (incomingItems.length > 50) {
    return res.status(400).json({ message: await getSystemText("siparis-kalem-siniri-asilir") });
  }

  for (const item of incomingItems) {
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return res.status(400).json({ message: await getSystemText("siparis-adedi-gecersiz") });
    }
  }

  const normalizedItems = await Promise.all(
    incomingItems.map(async (item) => {
      const productId = String(item.product?.id || item.productId || "");
      // MP-2.5: fiyat/name/kategori dâhil tüm ürün verisi sunucuda
      // ProductModel'den çözülür — istemciden gelen item.product.price
      // gibi alanlar asla okunmaz (mevcut davranışın doğrulanması).
      const product = await ProductModel.findById(productId);

      if (!product || !product.inStock) {
        // DEF-1 / MP-0.5: ApiError fırlat; asyncHandler bunu errorHandler'a
        // taşır ve istemci askıda kalmadan 400 alır.
        throw new ApiError(400, "PRODUCT_OUT_OF_STOCK", await getSystemText("bazi-urunler-stokta-degil"));
      }

      const quantity = Number(item.quantity);

      return {
        product: {
          id: product._id.toString(),
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.image,
          ingredients: product.ingredients,
          inStock: product.inStock,
        },
        quantity,
      };
    }),
  );

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  // Damga (stamp) bedava urun haklari once harcanir; puan kampanyasi
  // indirimi kalan tutara, kupon en sonda uygulanir — indirimler ayni
  // birime binmez, her adim oncekinden kalan tutar uzerinde calisir.
  const stampDiscount = await applyStampRewardCreditsToOrder(req.authUser, normalizedItems);
  const { discountTotal, appliedCampaign } = await applyActivePointRewardToOrder(req.authUser, normalizedItems);

  // Kupon: kod verildiyse atomik kullanilir ve indirimi kalan tutara
  // uygulanir. Gecersiz/kosullari tutmayan kupon siparisi BOZMAZ —
  // aciklama mesajiyla reddedilir, siparis kuponuz devam eder.
  let appliedCoupon: { couponId: string; code: string; discountAmount: number } | undefined;
  let couponRejection: string | undefined;
  const couponCode = typeof req.body.couponCode === "string" ? req.body.couponCode.trim() : "";
  const afterCampaignDiscount = Number((subtotal - stampDiscount.discountTotal - discountTotal).toFixed(2));

  if (couponCode) {
    const couponResult = await redeemCouponForOrder(
      req.authUser._id.toString(),
      couponCode,
      Math.max(0, afterCampaignDiscount),
    );

    if (couponResult.status === "applied") {
      appliedCoupon = {
        couponId: couponResult.couponId,
        code: couponResult.code,
        discountAmount: couponResult.discountAmount,
      };
    } else {
      couponRejection = couponResult.reason;
    }
  }

  const totalDiscount = Number((stampDiscount.discountTotal + discountTotal + (appliedCoupon?.discountAmount || 0)).toFixed(2));
  const total = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));

  const tableSessionToken = typeof req.body.tableSessionToken === "string" ? req.body.tableSessionToken.trim() : "";
  let tableNumber = "";
  let orderUserId = req.authUser._id.toString();
  let orderUserName = `${req.authUser.name} ${req.authUser.surname}`.trim();

  if (tableSessionToken) {
    const session = await TableSessionModel.findOne({ sessionToken: tableSessionToken, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }
    const isStaffOrManager = req.authRole === "staff" || req.authRole === "manager";
    const isParticipant = session.participants.some((p) => p.userId === req.authUser._id.toString());
    if (!isParticipant && !isStaffOrManager) {
      return res.status(403).json({ message: await getSystemText("bu-masa-oturumuna-katilim-izniniz-yok") });
    }
    tableNumber = session.tableNumber;

    if (isStaffOrManager) {
      const targetUserId = req.body.targetUserId || session.hostUserId;
      const participant = session.participants.find(p => p.userId === targetUserId) || session.participants[0];
      if (participant) {
        orderUserId = participant.userId;
        orderUserName = participant.userName;
      }
    }

    // MP-2.5: masa siparişinde katılımcı bakiye kontrolü. Masa akışında
    // bakiye sipariş anında değil /table-sessions/pay'da düşülür; bu nedenle
    // katılımcının masadaki mevcut borcu + bu yeni sipariş bakiyesini
    // aşmamalı (negatif bakiyeye izin verilmez). Personel/yönetici siparişinde
    // borç hedef katılımcıya yazılır, kontrol o kullanıcı üzerinden yapılır.
    const existingOrders = await OrderModel.find({
      tableSessionToken,
      userId: orderUserId,
      status: { $ne: "rejected" },
    });
    const paidSoFar = session.participants
      .filter((p) => p.userId === orderUserId)
      .reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const existingDebt = Math.max(
      0,
      Number((existingOrders.reduce((sum, o) => sum + o.total, 0) - paidSoFar).toFixed(2)),
    );

    const debtor = await UserModel.findById(orderUserId);
    const debtorBalance = debtor ? Number(debtor.balance || 0) : 0;

    if (Number((existingDebt + total).toFixed(2)) > debtorBalance) {
      return res.status(400).json({ message: await getSystemText("masa-siparis-bakiyesi-yetersiz") });
    }
  }

  if (!tableSessionToken) {
    const roundedTotal = Number(total.toFixed(2));
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: req.authUser._id.toString(), balance: { $gte: roundedTotal } },
      { $inc: { balance: -roundedTotal } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(409).json({ message: await getSystemText("bakiye-yetersiz-veya-islem-sirasinda-bir-cakisma-olustu") });
    }
    req.authUser = updatedUser;
  }

  const order = await OrderModel.create({
    userId: orderUserId,
    userName: orderUserName,
    tableNumber,
    tableSessionToken,
    items: normalizedItems,
    total,
    status: "pending",
    timestamp: new Date(),
    note: String(req.body.note || ""),
    cancelReason: "",
    appliedCampaign,
    appliedCoupon,
  });

  await createStaffOrderNotification({ tableNumber: order.tableNumber, orderId: order._id.toString(), total: order.total });

  return res.status(201).json({
    order: serializeOrder(order),
    user: serializeUser(req.authUser),
    // Kupon reddedildiyse siparis yine de olustu — istemci mesaji gosterir.
    couponWarning: couponRejection,
  });
});

router.patch("/orders/:id/status", attachAuth, restrictTo("staff", "manager"), async (req, res) => {
  let order = await OrderModel.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: await getSystemText("siparis-bulunamadi") });
  }

  const previousStatus = order.status;
  const newStatus = req.body.status;

  const allowedStatuses = ["pending", "preparing", "ready", "completed", "rejected"];
  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ message: await getSystemText("gecersiz-siparis-durumu") });
  }

  if (previousStatus === "completed" || previousStatus === "rejected") {
    return res.status(400).json({ message: await getSystemText("tamamlanmis-veya-reddedilmis-siparislerin-durumu-degistirilemez") });
  }

  const validTransitions: Record<string, string[]> = {
    pending: ["preparing", "rejected"],
    preparing: ["ready", "rejected"],
    ready: ["completed", "rejected"],
  };

  const allowedNext = validTransitions[previousStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return res.status(400).json({ message: `Sipariş durumu ${previousStatus} iken ${newStatus} yapılamaz.` });
  }

  const statusUpdate: Record<string, unknown> = {
    status: newStatus,
    cancelReason:
      newStatus === "rejected" ? String(req.body.cancelReason || "").trim() : order.cancelReason || "",
  };

  if (newStatus === "completed" && req.authUser) {
    statusUpdate.completedBy = {
      id: req.authUser._id.toString(),
      name: `${req.authUser.name} ${req.authUser.surname}`.trim(),
    };
  }

  // MP-2.15: durum geçişi artık koşullu atomik findOneAndUpdate ile yapılır —
  // sorgu hem geçerli önceki durumu doğrular hem de yarış koşulunda (iki
  // eşzamanlı red/tamamlama isteği) yalnızca birinin geçmesini sağlar.
  order = await OrderModel.findOneAndUpdate(
    { _id: order._id, status: previousStatus },
    { $set: statusUpdate },
    { new: true },
  );

  if (!order) {
    return res.status(409).json({ message: await getSystemText("bakiye-yetersiz-veya-islem-sirasinda-bir-cakisma-olustu") });
  }

  if (newStatus === "rejected") {
    if (!order.tableSessionToken) {
      // MP-2.15: iade read-modify-write save() yerine atomik $inc — aynı
      // sipariş ikinci kez iade edilemez (üstteki status guard'ı zaten
      // geçişi tek seferlik yapar) ve eşzamanlı bakiye güncellemeleri
      // birbirinin üzerine yazmaz.
      const refundTotal = Number(order.total.toFixed(2));
      await UserModel.updateOne(
        { _id: order.userId },
        { $inc: { balance: refundTotal } },
      );
    }

    // Kupon iadesi: siparis reddedildiyse kullanici hakki geri alir;
    // status guard'i bu blogu tek sefer yapar (idempotent).
    if (order.appliedCoupon?.couponId) {
      await refundCouponUsage(order.appliedCoupon.couponId, order.userId);
    }

    await createCustomerOrderNotification(order.userId, "order_cancelled", order._id.toString());
  }

  if (req.body.status === "preparing" && (previousStatus as string) !== "preparing") {
    await createCustomerOrderNotification(order.userId, "order_preparing", order._id.toString());
  }

  if (req.body.status === "ready" && (previousStatus as string) !== "ready") {
    await createCustomerOrderNotification(order.userId, "order_ready", order._id.toString());
  }

  if (req.body.status === "completed" && (previousStatus as string) !== "completed") {
    await applyCompletedOrderLoyalty(order);

    // A2: envanter stok düşümü — malzeme adı eşleşmesiyle atomik $inc.
    // Hata durumunda sipariş tamamlama başarısız olmamalı (best-effort);
    // düşüm idempotentliği status guard'ı (yukarıdaki atomik geçiş) ile
    // sağlanır — bu blok yalnızca tek seferlik geçişte çalışır.
    try {
      const stockResult = await decrementInventoryForOrder(order);
      if (stockResult.lowStockItems.length > 0) {
        await syncProductStockFlags(stockResult.lowStockItems.map((item) => item.name));
      }
    } catch (error) {
      console.error("Inventory decrement failed:", error);
    }
  }

  res.json(serializeOrder(order));
});

router.delete("/orders/:id", attachAuth, restrictTo("staff", "manager"), async (req, res) => {
  await OrderModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

router.get("/notifications", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const notificationQuery = getNotificationQueryForUser(req.authUser);

  if (!notificationQuery) {
    return res.json([]);
  }

  const notifications = await NotificationModel.find(notificationQuery).sort({ timestamp: -1 });

  res.json(notifications.map((item) => serializeNotification(item)));
});

router.post("/notifications", attachAuth, async (req, res) => {
  return res.status(403).json({ message: await getSystemText("manuel-bildirim-olusturma-kapatildi") });
});

router.patch("/notifications/:id/read", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const notification = await NotificationModel.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({ message: await getSystemText("bildirim-bulunamadi") });
  }

  const effectiveRole = getEffectiveRole(req.authUser);
  const isOwner = notification.userId === req.authUser._id.toString();
  const isTargetedToRole = notification.targetRole === effectiveRole;

  if (!isOwner && !isTargetedToRole) {
    return res.status(403).json({ message: await getSystemText("bu-bildirim-uzerinde-islem-yapma-yetkiniz-yok") });
  }

  notification.read = true;
  await notification.save();
  res.json(serializeNotification(notification));
});

router.delete("/notifications/:id", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const notification = await NotificationModel.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({ message: await getSystemText("bildirim-bulunamadi") });
  }

  const effectiveRole = getEffectiveRole(req.authUser);
  const isOwner = notification.userId === req.authUser._id.toString();
  const isTargetedToRole = notification.targetRole === effectiveRole;

  if (!isOwner && !isTargetedToRole) {
    return res.status(403).json({ message: await getSystemText("bu-bildirim-uzerinde-islem-yapma-yetkiniz-yok") });
  }

  await notification.deleteOne();
  res.status(204).send();
});

router.delete("/notifications", attachAuth, async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const notificationQuery = getNotificationQueryForUser(req.authUser);

  if (!notificationQuery) {
    return res.status(204).send();
  }

  await NotificationModel.deleteMany(notificationQuery);

  res.status(204).send();
});

router.get("/push/public-key", async (_req, res) => {
  const keys = getVapidKeys();
  res.json({ publicKey: keys.publicKey });
});

router.post("/push/subscribe", attachOptionalAuth, async (req: AuthRequest, res) => {
  const { subscription, orderId } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ message: "Geçersiz push aboneliği verisi." });
  }

  const userId = req.authUser ? req.authUser._id.toString() : "";
  const role = req.authRole === "manager" || req.authRole === "staff" ? req.authRole : "customer";

  const updated = await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userId: userId || undefined,
      orderId: orderId || undefined,
      role,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, id: updated._id.toString() });
});

router.post("/push/unsubscribe", attachAuth, async (req: AuthRequest, res) => {
  // MP-1.3: sahiplik dogrulamasi — yalnizca aboneligin sahibi (veya anonim
  // siparis takip aboneliginin orderId'sini bilen) cikis yapabilir. Eski hali
  // hicbir middleware korumasi icermiyordu: baskasinin endpoint degeri ile
  // abonelik silinebiliyordu.
  const endpoint = typeof req.body.endpoint === "string" ? req.body.endpoint : "";
  const orderId = typeof req.body.orderId === "string" ? req.body.orderId : "";

  if (!endpoint) {
    return res.status(400).json({ message: "Geçersiz push abonelik isteği." });
  }

  const subscription = await PushSubscriptionModel.findOne({ endpoint });

  if (subscription) {
    const ownerId = subscription.userId || "";
    const isOwner = ownerId && ownerId === req.authUser!._id.toString();
    // Anonim (giris yapmadan) siparis takibi icin acilmis abonelikler
    // userId tasimaz; orderId'sini bilen cikis yapabilir.
    const isAnonymousOrderSub = !ownerId && orderId && subscription.orderId === orderId;

    if (isOwner || isAnonymousOrderSub) {
      await PushSubscriptionModel.deleteOne({ endpoint });
    } else {
      return res.status(403).json({ message: "Bu abonelik size ait değil." });
    }
  }

  res.json({ success: true });
});

router.post("/push/test", attachAuth, async (req: AuthRequest, res) => {
  // MP-1.3: kimlik dogrulamasi zorunlu ve yalnizca KENDI aboneliklerine
  // bildirim gonderilebilir. Eski hali kimlik sizmadan herhangi bir orderId'nin
  // cihazlarina bildirim atmaya imkan veriyordu (spam/istismar kanali).
  const { subscription } = req.body;
  const userId = req.authUser!._id.toString();
  const testPayload = {
    title: "Bancho Cafe • Bildirim Testi",
    body: "Bildirimler başarıyla aktif edildi! Sipariş durumunuz buradan iletilecek.",
    tag: `test-${Date.now()}`,
    data: { url: "/?tab=orders" },
  };

  if (subscription && subscription.endpoint) {
    const endpoint = String(subscription.endpoint);
    const stored = await PushSubscriptionModel.findOne({ endpoint });

    if (!stored || stored.userId !== userId) {
      return res.status(403).json({ message: "Bu abonelik size ait değil." });
    }

    const success = await sendPushToSubscription(subscription, testPayload);
    return res.json({ success });
  }

  await sendPushToUser(userId, testPayload);
  return res.json({ success: true });
});

router.get("/logs", attachAuth, restrictTo("manager"), async (_req, res) => {
  const logs = await ChangeLogModel.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs.map((item) => serializeLog(item)));
});

router.post("/logs", attachAuth, restrictTo("manager"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  const log = await ChangeLogModel.create({
    userId: req.authUser._id.toString(),
    userName: req.authUser.name,
    action: String(req.body.action || ""),
    details: String(req.body.details || ""),
    timestamp: new Date(),
  });

  res.status(201).json(serializeLog(log));
});

router.post("/system/reset", attachAuth, restrictTo("manager"), async (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
  }

  await Promise.all([
    StaffModel.deleteMany({ email: { $ne: req.authUser.email } }),
    UserModel.deleteMany({ _id: { $ne: req.authUser._id } }),
    ProductModel.deleteMany({}),
    CampaignModel.deleteMany({}),
    IngredientModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    OrderModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    ChangeLogModel.deleteMany({}),
    BalanceTopUpModel.deleteMany({}),
    TableSessionModel.deleteMany({}),
    TableModel.updateMany({}, { $set: { currentSessionId: "" } }),
  ]);
  
  await clearManagedUploads([req.authUser.avatar]);

  res.json({ success: true });
});

// --- Table Session Endpoints ---

router.get("/tables", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const tables = await TableModel.find();
    tables.sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));

    const populatedTables = await Promise.all(tables.map(async (table) => {
      const tableObj = table.toObject() as any;
      if (table.currentSessionId) {
        const session = await TableSessionModel.findById(table.currentSessionId);
        if (session && session.status === "open") {
          const sessionObj = session.toObject() as any;
          const orders = await OrderModel.find({ tableSessionToken: session.sessionToken, status: { $ne: "rejected" } });
          const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
          const totalPaid = 
            session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
            (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
          
          sessionObj.totalBill = Number(totalBill.toFixed(2));
          sessionObj.totalPaid = Number(totalPaid.toFixed(2));
          sessionObj.unpaidAmount = Math.max(0, Number((totalBill - totalPaid).toFixed(2)));
          
          // Self-heal: Close session if no participants are left and no unpaid balance remains
          if (session.participants.length === 0 && sessionObj.unpaidAmount <= 0) {
            session.status = "closed";
            session.closedAt = new Date();
            session.closedBy = "system-healing";
            session.closedByRole = "system";
            session.closeReason = "Masada kullanıcı kalmadı ve borç yok.";
            await session.save();

            table.currentSessionId = "";
            await table.save();
            tableObj.currentSessionId = "";
          } else {
            // Resolve hostName from participants
            const hostParticipant = session.participants.find((p) => p.userId === session.hostUserId);
            sessionObj.hostName = hostParticipant ? hostParticipant.userName : "Masa Sahibi";

            // Also attach orders list for easy access
            sessionObj.orders = orders.map(o => ({
              id: o._id.toString(),
              userName: o.userName,
              items: o.items,
              total: o.total,
              status: o.status,
              timestamp: o.timestamp,
              note: o.note,
            }));
            
            tableObj.session = sessionObj;
          }
        } else {
          // Self-healing database: clear invalid/closed currentSessionId
          table.currentSessionId = "";
          await table.save();
          tableObj.currentSessionId = "";
        }
      }
      return tableObj;
    }));

    res.json(populatedTables);
  } catch (error) {
    console.error("get tables error:", error);
    return next(new ApiError(500, "TABLES_FETCH_FAILED", "sys:masalar-alinirken-hata-olustu"));
  }
});

router.post("/tables/initialize", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const existingCount = await TableModel.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ message: await getSystemText("masalar-zaten-ilklendirilmis") });
    }

    const tablesToCreate = [];
    for (let i = 1; i <= 60; i++) {
      tablesToCreate.push({
        tableNumber: String(i),
        isActive: true,
        currentSessionId: "",
      });
    }

    await TableModel.create(tablesToCreate);
    res.json({ success: true, message: await getSystemText("60-masa-basariyla-olusturuldu") });
  } catch (error) {
    console.error("initialize tables error:", error);
    return next(new ApiError(500, "TABLES_INIT_FAILED", "sys:masalar-olusturulurken-hata-olustu"));
  }
});

router.post("/tables/:tableNumber/force-close", attachAuth, restrictTo("manager"), async (req, res, next) => {
  try {
    const { tableNumber } = req.params;
    const table = await TableModel.findOne({ tableNumber });
    if (!table) {
      return res.status(404).json({ message: await getSystemText("masa-bulunamadi") });
    }

    if (table.currentSessionId) {
      await TableSessionModel.findByIdAndUpdate(table.currentSessionId, {
        status: "closed",
        closedAt: new Date(),
      });
      table.currentSessionId = "";
      await table.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("force close table error:", error);
    return next(new ApiError(500, "TABLE_FORCE_CLOSE_FAILED", "sys:masa-oturumu-sonlandirilamadi"));
  }
});

function serializeTableSession(session: any) {
  if (!session) return null;
  const raw = serializeDocument(session);
  return {
    ...raw,
    openedAt: toIsoString(raw.openedAt as Date | string),
    closedAt: toIsoString(raw.closedAt as Date | string),
  };
}

router.post("/table-sessions/join-or-create", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const tableNumber = String(req.body.tableNumber || "").trim();
    if (!tableNumber) {
      return res.status(400).json({ message: await getSystemText("masa-numarasi-gerekli") });
    }

    const table = await TableModel.findOne({ tableNumber });
    if (!table) {
      return res.status(404).json({ message: await getSystemText("masa-bulunamadi") });
    }

    // Aktif oturum ara
    let session = await TableSessionModel.findOne({
      tableNumber,
      status: "open",
    });

    const currentUserId = req.authUser._id.toString();
    const currentUserName = `${req.authUser.name} ${req.authUser.surname}`.trim();

    if (!session) {
      // Aktif oturum yok, yeni oluştur ve host yap
      session = await TableSessionModel.create({
        tableId: table._id.toString(),
        tableNumber,
        hostUserId: currentUserId,
        participants: [
          {
            userId: currentUserId,
            userName: currentUserName,
            joinedAt: new Date(),
            hasPaid: false,
            paidAmount: 0,
            paidAt: null,
          },
        ],
        pendingParticipants: [],
        status: "open",
        openedAt: new Date(),
      });

      table.currentSessionId = session._id.toString();
      await table.save();

      return res.status(201).json({
        status: "active",
        session: serializeTableSession(session),
      });
    }

    // Aktif oturum var. Katılımcı mıyız?
    const isParticipant = session.participants.some((p) => p.userId === currentUserId);
    if (isParticipant) {
      return res.json({
        status: "active",
        session: serializeTableSession(session),
      });
    }

    // Eğer daha önce ayrılmışsak, katılımcılara geri taşıyalım
    const leftIndex = (session.leftParticipants || []).findIndex((lp) => lp.userId === currentUserId);
    if (leftIndex !== -1) {
      const leftP = session.leftParticipants[leftIndex];
      session.participants.push({
        userId: leftP.userId,
        userName: leftP.userName,
        joinedAt: new Date(),
        hasPaid: leftP.paidAmount > 0,
        paidAmount: leftP.paidAmount,
        paidAt: leftP.paidAmount > 0 ? leftP.leftAt : null,
      });
      session.leftParticipants.splice(leftIndex, 1);
      
      // Eğer masada hiç aktif katılımcı kalmamışsa ve ilk biz dönüyorsak bizi host yap
      if (session.participants.length === 1) {
        session.hostUserId = currentUserId;
      }
      
      // Deduplicate arrays just in case before saving
      const uniquePending = [];
      const seenPending = new Set();
      for (const p of session.pendingParticipants) {
        if (!seenPending.has(p.userId)) {
          seenPending.add(p.userId);
          uniquePending.push(p);
        }
      }
      session.pendingParticipants = uniquePending as any;

      const uniqueParticipants = [];
      const seenParticipants = new Set();
      for (const p of session.participants) {
        if (!seenParticipants.has(p.userId)) {
          seenParticipants.add(p.userId);
          uniqueParticipants.push(p);
        }
      }
      session.participants = uniqueParticipants as any;

      await session.save();
      return res.json({
        status: "active",
        session: serializeTableSession(session),
      });
    }

    // Eğer masada aktif hiç kimse kalmadıysa, onay beklemeden direkt katıl ve host ol!
    if (session.participants.length === 0) {
      session.hostUserId = currentUserId;
      session.participants.push({
        userId: currentUserId,
        userName: currentUserName,
        joinedAt: new Date(),
        hasPaid: false,
        paidAmount: 0,
        paidAt: null,
      });
      session.pendingParticipants = [] as any;
      await session.save();
      return res.json({
        status: "active",
        session: serializeTableSession(session),
      });
    }

    // Bekleme odasında mıyız?
    const isPending = session.pendingParticipants.some((p) => p.userId === currentUserId);
    if (!isPending) {
      session.pendingParticipants.push({
        userId: currentUserId,
        userName: currentUserName,
        requestedAt: new Date(),
      });
      
      // Deduplicate arrays just in case before saving
      const uniquePending = [];
      const seenPending = new Set();
      for (const p of session.pendingParticipants) {
        if (!seenPending.has(p.userId)) {
          seenPending.add(p.userId);
          uniquePending.push(p);
        }
      }
      session.pendingParticipants = uniquePending as any;
      
      await session.save();
    }

    // Masa sahibi bilgisini al
    const hostUser = await UserModel.findById(session.hostUserId);
    const hostName = hostUser ? `${hostUser.name} ${hostUser.surname}`.trim() : "Masa Sahibi";

    return res.json({
      status: "pending",
      hostName,
    });
  } catch (error) {
    console.error("join-or-create table session error:", error);
    return next(new ApiError(500, "TABLE_JOIN_FAILED", "sys:masa-oturumuna-katilirken-hata-olustu"));
  }
});

router.get("/table-sessions/session/:token", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const { token } = req.params;
    const session = await TableSessionModel.findOne({ sessionToken: token, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }

    const currentUserId = req.authUser._id.toString();
    const isParticipant = session.participants.some((p) => p.userId === currentUserId);

    if (!isParticipant) {
      return res.status(403).json({ message: await getSystemText("bu-masa-oturumuna-katilim-izniniz-yok") });
    }

    // Masanın tüm siparişlerini sorgula
    const orders = await OrderModel.find({ tableSessionToken: token, status: { $ne: "rejected" } });

    // Sipariş toplamları ve bireysel harcamaları hesapla
    const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
    const totalPaid = 
      session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
      (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
    const remainingBill = Math.max(0, Number((totalBill - totalPaid).toFixed(2)));

    // Bireysel sipariş toplamı
    const individualTotals: Record<string, number> = {};
    session.participants.forEach((p) => {
      individualTotals[p.userId] = 0;
    });
    (session.leftParticipants || []).forEach((p) => {
      individualTotals[p.userId] = 0;
    });

    orders.forEach((order) => {
      if (individualTotals[order.userId] !== undefined) {
        individualTotals[order.userId] += order.total;
      } else {
        individualTotals[order.userId] = order.total;
      }
    });

    const isHost = session.hostUserId === currentUserId;

    return res.json({
      session: serializeTableSession(session),
      orders: orders.map((o) => serializeOrder(o)),
      isHost,
      metrics: {
        totalBill: Number(totalBill.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        remainingBill,
        individualTotals,
      },
    });
  } catch (error) {
    console.error("get table session error:", error);
    return next(new ApiError(500, "TABLE_SESSION_FETCH_FAILED", "sys:masa-bilgileri-alinirken-hata-olustu"));
  }
});

router.get("/table-sessions/poll-status", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const tableNumber = String(req.query.tableNumber || "").trim();
    if (!tableNumber) {
      return res.status(400).json({ message: await getSystemText("masa-numarasi-gerekli") });
    }

    const session = await TableSessionModel.findOne({ tableNumber, status: "open" });
    if (!session) {
      return res.json({ approved: false, reason: "Oturum kapatıldı veya bulunamadı." });
    }

    const currentUserId = req.authUser._id.toString();
    const isParticipant = session.participants.some((p) => p.userId === currentUserId);

    if (isParticipant) {
      return res.json({ approved: true, sessionToken: session.sessionToken });
    }

    const isPending = session.pendingParticipants.some((p) => p.userId === currentUserId);
    if (!isPending) {
      return res.json({ approved: false, status: "rejected" });
    }

    return res.json({ approved: false, status: "pending" });
  } catch (error) {
    console.error("poll-status error:", error);
    return next(new ApiError(500, "TABLE_POLL_FAILED", "sys:onay-durumu-kontrol-edilirken-hata-olustu"));
  }
});

router.post("/table-sessions/approve-participant", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const { sessionToken, pendingUserId, action } = req.body;
    if (!sessionToken || !pendingUserId || !action) {
      return res.status(400).json({ message: await getSystemText("eksik-parametre") });
    }

    const session = await TableSessionModel.findOne({ sessionToken, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }

    if (session.hostUserId !== req.authUser._id.toString() && req.authRole !== "staff" && req.authRole !== "manager") {
      return res.status(403).json({ message: await getSystemText("sadece-masa-sahibi-veya-personel-bu-islemi-yapabilir") });
    }

    // Beklemedeki katılımcıyı bul
    const pendingIndex = session.pendingParticipants.findIndex((p) => p.userId === pendingUserId);
    if (pendingIndex === -1) {
      return res.status(404).json({ message: await getSystemText("bekleme-listesinde-kullanici-bulunamadi") });
    }

    const pendingUser = session.pendingParticipants[pendingIndex];

    if (action === "approve") {
      // Katılımcılara ekle (Duplicate check)
      const exists = session.participants.some((p) => p.userId === pendingUser.userId);
      if (!exists) {
        session.participants.push({
          userId: pendingUser.userId,
          userName: pendingUser.userName,
          joinedAt: new Date(),
          hasPaid: false,
          paidAmount: 0,
          paidAt: null,
        });
      }
    }

    // Beklemeden çıkar
    session.pendingParticipants.splice(pendingIndex, 1);

    // Deduplicate lists just in case
    const uniquePending = [];
    const seenPending = new Set();
    for (const p of session.pendingParticipants) {
      if (!seenPending.has(p.userId)) {
        seenPending.add(p.userId);
        uniquePending.push(p);
      }
    }
    session.pendingParticipants = uniquePending as any;

    const uniqueParticipants = [];
    const seenParticipants = new Set();
    for (const p of session.participants) {
      if (!seenParticipants.has(p.userId)) {
        seenParticipants.add(p.userId);
        uniqueParticipants.push(p);
      }
    }
    session.participants = uniqueParticipants as any;

    await session.save();

    return res.json({ success: true, session: serializeTableSession(session) });
  } catch (error) {
    console.error("approve participant error:", error);
    return next(new ApiError(500, "PARTICIPANT_APPROVE_FAILED", "sys:katilimci-onaylanirken-hata-olustu"));
  }
});

router.post("/table-sessions/force-create", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const tableNumber = String(req.body.tableNumber || "").trim();
    const userId = String(req.body.userId || "").trim();
    
    if (!tableNumber) {
      return res.status(400).json({ message: await getSystemText("masa-numarasi-gerekli") });
    }

    if (!userId) {
      return res.status(400).json({ message: await getSystemText("kullanici-secimi-gerekli") });
    }

    const hostUser = await UserModel.findById(userId);
    if (!hostUser) {
      return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
    }

    const table = await TableModel.findOne({ tableNumber });
    if (!table) {
      return res.status(404).json({ message: await getSystemText("masa-bulunamadi") });
    }

    let session = await TableSessionModel.findOne({ tableNumber, status: "open" });
    if (session) {
      return res.status(400).json({ message: await getSystemText("masa-zaten-dolu") });
    }

    const hostName = `${hostUser.name} ${hostUser.surname}`.trim();
    session = await TableSessionModel.create({
      tableId: table._id.toString(),
      tableNumber,
      hostUserId: hostUser._id.toString(),
      participants: [
        {
          userId: hostUser._id.toString(),
          userName: hostName,
          joinedAt: new Date(),
          hasPaid: false,
          paidAmount: 0,
          paidAt: null,
        }
      ],
      pendingParticipants: [],
      status: "open",
      openedAt: new Date(),
    });

    table.currentSessionId = session._id.toString();
    await table.save();

    res.status(201).json({
      success: true,
      session: serializeTableSession(session),
    });
  } catch (error) {
    console.error("force-create session error:", error);
    return next(new ApiError(500, "SESSION_FORCE_CREATE_FAILED", "sys:oturum-olusturulurken-hata-olustu"));
  }
});

router.post("/table-sessions/add-walkin", attachAuth, restrictTo("staff", "manager"), async (req, res, next) => {
  try {
    const { sessionToken, userId } = req.body;
    if (!sessionToken || !userId) {
      return res.status(400).json({ message: await getSystemText("eksik-parametreler") });
    }

    const guestUser = await UserModel.findById(userId);
    if (!guestUser) {
      return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
    }

    const session = await TableSessionModel.findOne({ sessionToken, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }

    // Check if user is already a participant
    const alreadyJoined = session.participants.some((p) => p.userId === guestUser._id.toString());
    if (alreadyJoined) {
      return res.status(400).json({ message: await getSystemText("bu-kullanici-zaten-masada") });
    }

    const guestName = `${guestUser.name} ${guestUser.surname}`.trim();
    session.participants.push({
      userId: guestUser._id.toString(),
      userName: guestName,
      joinedAt: new Date(),
      hasPaid: false,
      paidAmount: 0,
      paidAt: null,
    });

    await session.save();

    res.json({
      success: true,
      session: serializeTableSession(session),
    });
  } catch (error) {
    console.error("add walkin error:", error);
    return next(new ApiError(500, "WALKIN_ADD_FAILED", "sys:misafir-eklenirken-hata-olustu"));
  }
});

router.post("/table-sessions/pay", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const { sessionToken, paymentType } = req.body;
    if (!sessionToken || !["self", "split", "all"].includes(paymentType)) {
      return res.status(400).json({ message: await getSystemText("gecersiz-parametreler") });
    }

    const session = await TableSessionModel.findOne({ sessionToken, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }

    const currentUserId = req.authUser._id.toString();
    const isParticipant = session.participants.some((p) => p.userId === currentUserId);
    const isStaffOrManager = req.authRole === "staff" || req.authRole === "manager";
    if (!isParticipant && !isStaffOrManager) {
      return res.status(403).json({ message: await getSystemText("bu-masanin-odemesini-yapamazsiniz") });
    }

    const orders = await OrderModel.find({ tableSessionToken: sessionToken, status: { $ne: "rejected" } });
    const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
    const totalPaidSoFar = 
      session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
      (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
    const remainingBill = Math.max(0, Number((totalBill - totalPaidSoFar).toFixed(2)));

    if (remainingBill <= 0) {
      // Masa hesabı zaten tamamen ödenmişse kapatıp çıkalım
      session.status = "closed";
      session.closedAt = new Date();
      session.closedBy = currentUserId;
      session.closedByRole = req.authUser.role;
      session.closeReason = "Tüm hesap ödendi.";
      await session.save();

      await TableModel.updateOne({ tableNumber: session.tableNumber }, { $set: { currentSessionId: "" } });
      return res.json({ success: true, message: await getSystemText("hesap-zaten-odenmis-masa-kapatildi") });
    }

    if (isStaffOrManager) {
      // Manager/Staff ödemesi (nakit/kart) - Bakiye düşülmez, masa doğrudan kapatılır
      session.status = "closed";
      session.closedAt = new Date();
      session.closedBy = currentUserId;
      session.closedByRole = req.authUser.role;
      session.closeReason = "Kasa tarafından tahsil edildi.";
      await session.save();

      await TableModel.updateOne({ tableNumber: session.tableNumber }, { $set: { currentSessionId: "" } });
      
      return res.json({
        success: true,
        paidAmount: remainingBill,
        session: serializeTableSession(session),
        user: serializeUser(req.authUser),
      });
    }

    let paymentAmount = 0;

    if (paymentType === "self") {
      // Kendi sipariş ettiği yemeklerin toplamını hesapla
      const userOrdersTotal = orders
        .filter((o) => o.userId === currentUserId)
        .reduce((sum, o) => sum + o.total, 0);

      const participant = session.participants.find((p) => p.userId === currentUserId);
      const userAlreadyPaid = participant ? participant.paidAmount : 0;
      paymentAmount = Math.max(0, Number((userOrdersTotal - userAlreadyPaid).toFixed(2)));

      // Kalan borçtan fazla ödenmesini engelle
      paymentAmount = Math.min(paymentAmount, remainingBill);
    } else if (paymentType === "split") {
      // Eşit bölünmüş hesaptan payına düşeni hesapla
      const splitShare = Number((totalBill / session.participants.length).toFixed(2));
      const participant = session.participants.find((p) => p.userId === currentUserId);
      const userAlreadyPaid = participant ? participant.paidAmount : 0;
      paymentAmount = Math.max(0, Number((splitShare - userAlreadyPaid).toFixed(2)));
      paymentAmount = Math.min(paymentAmount, remainingBill);
    } else if (paymentType === "all") {
      // Masanın kalan tüm hesabını öde
      paymentAmount = remainingBill;
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({ message: await getSystemText("odenecek-borcunuz-bulunmamaktadir") });
    }

    const roundedPayment = Number(paymentAmount.toFixed(2));
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: currentUserId, balance: { $gte: roundedPayment } },
      { $inc: { balance: -roundedPayment } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ message: await getSystemText("bakiye-yetersiz-veya-islem-sirasinda-bir-cakisma-olustu-lutfen-tekrar-deneyin") });
    }
    req.authUser = updatedUser;

    // Oturumda kullanıcının ödemesini güncelle
    const participantIndex = session.participants.findIndex((p) => p.userId === currentUserId);
    if (participantIndex !== -1) {
      const p = session.participants[participantIndex];
      p.paidAmount = Number((p.paidAmount + roundedPayment).toFixed(2));
      p.hasPaid = true;
      p.paidAt = new Date();
    }
    await session.save();

    // Log veya balance top up kaydı oluştur
    await BalanceTopUpModel.create({
      userId: currentUserId,
      userName: `${req.authUser.name} ${req.authUser.surname}`.trim(),
      userEmail: req.authUser.email,
      amount: -roundedPayment, // Eksi miktar harcamayı temsil eder
      creditedAmount: -roundedPayment,
      bonusAmount: 0,
      timestamp: new Date(),
    });

    // Masadaki toplam ödenen tutarı tekrar hesapla
    const nextTotalPaid = 
      session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
      (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
    const nextRemaining = Math.max(0, Number((totalBill - nextTotalPaid).toFixed(2)));

    // Eğer tüm borç ödendiyse oturumu kapat
    if (nextRemaining <= 0 || paymentType === "all") { // tolerans veya all
      session.status = "closed";
      session.closedAt = new Date();
      session.closedBy = currentUserId;
      session.closedByRole = req.authUser.role;
      session.closeReason = "Hesap tamamen ödendi.";
      await session.save();

      await TableModel.updateOne({ tableNumber: session.tableNumber }, { $set: { currentSessionId: "" } });
    }

    return res.json({
      success: true,
      paidAmount: paymentAmount,
      session: serializeTableSession(session),
      user: serializeUser(req.authUser),
    });
  } catch (error) {
    console.error("table payment error:", error);
    return next(new ApiError(500, "TABLE_PAYMENT_FAILED", "sys:odeme-islemi-gerceklestirilirken-hata-olustu"));
  }
});

router.post("/table-sessions/leave", attachAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: await getSystemText("oturum-gerekli") });
    }

    const { sessionToken, action, paymentType } = req.body;
    if (!sessionToken || !action || !["pay", "no-pay"].includes(action)) {
      return res.status(400).json({ message: await getSystemText("gecersiz-parametreler") });
    }

    const session = await TableSessionModel.findOne({ sessionToken, status: "open" });
    if (!session) {
      return res.status(404).json({ message: await getSystemText("aktif-masa-oturumu-bulunamadi") });
    }

    const currentUserId = req.authUser._id.toString();
    const currentUserName = `${req.authUser.name} ${req.authUser.surname}`.trim();

    // Kullanıcı katılımcı mı?
    const participantIndex = session.participants.findIndex((p) => p.userId === currentUserId);
    if (participantIndex === -1) {
      return res.status(403).json({ message: await getSystemText("bu-masada-bulunmuyorsunuz") });
    }

    const participant = session.participants[participantIndex];
    let paymentAmount = 0;

    const orders = await OrderModel.find({ tableSessionToken: sessionToken, status: { $ne: "rejected" } });
    const userOrdersTotal = orders
      .filter((o) => o.userId === currentUserId)
      .reduce((sum, o) => sum + o.total, 0);
    const userUnpaid = Math.max(0, Number((userOrdersTotal - participant.paidAmount).toFixed(2)));

    if (action === "pay") {
      if (!paymentType || !["self", "all"].includes(paymentType)) {
        return res.status(400).json({ message: await getSystemText("gecersiz-odeme-turu") });
      }

      if (paymentType === "self") {
        paymentAmount = userUnpaid;

        const isLastParticipant = session.participants.length === 1;
        const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
        const totalPaidSoFar = 
          session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
          (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
        const remainingBill = Math.max(0, Number((totalBill - totalPaidSoFar).toFixed(2)));

        if (isLastParticipant && remainingBill > userUnpaid) {
          return res.status(400).json({ 
            message: await getSystemText("masada-diger-kisilerden-kalan-odenmemis-borclar-bulunmaktadir-son-kisi-oldugunuz-icin-tum-kalan-hesabi-kapatmaniz-gerekmektedir") 
          });
        }
      } else if (paymentType === "all") {
        const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
        const totalPaidSoFar = 
          session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
          (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
        paymentAmount = Math.max(0, Number((totalBill - totalPaidSoFar).toFixed(2)));
      }

      if (paymentAmount > 0) {
        const roundedPayment = Number(paymentAmount.toFixed(2));
        const updatedUser = await UserModel.findOneAndUpdate(
          { _id: currentUserId, balance: { $gte: roundedPayment } },
          { $inc: { balance: -roundedPayment } },
          { new: true }
        );
        if (!updatedUser) {
          return res.status(400).json({ message: await getSystemText("bakiye-yetersiz-veya-islem-sirasinda-bir-cakisma-olustu-lutfen-tekrar-deneyin") });
        }
        req.authUser = updatedUser;

        // Ödeme kaydı oluştur
        await BalanceTopUpModel.create({
          userId: currentUserId,
          userName: currentUserName,
          userEmail: req.authUser.email,
          amount: -roundedPayment,
          creditedAmount: -roundedPayment,
          bonusAmount: 0,
          timestamp: new Date(),
        });

        // Ödenen miktarı güncelle
        participant.paidAmount = Number((participant.paidAmount + roundedPayment).toFixed(2));
        participant.hasPaid = true;
        participant.paidAt = new Date();
      }

      // leftParticipants'a ekle (Borç kalmadı)
      session.leftParticipants.push({
        userId: currentUserId,
        userName: currentUserName,
        paidAmount: participant.paidAmount,
        leftAt: new Date(),
        totalUnpaid: 0,
      });
    } else {
      // Ödemeden ayrılma (no-pay)
      // leftParticipants'a ekle (Borç masada kaldı)
      session.leftParticipants.push({
        userId: currentUserId,
        userName: currentUserName,
        paidAmount: participant.paidAmount,
        leftAt: new Date(),
        totalUnpaid: userUnpaid,
      });
    }

    // Katılımcılardan çıkar
    session.participants.splice(participantIndex, 1);

    // Eğer host ayrılıyorsa ve masada hâlâ birileri varsa host yetkisini devret
    if (session.hostUserId === currentUserId && session.participants.length > 0) {
      session.hostUserId = session.participants[0].userId;
    }

    // Eğer masada aktif hiç kimse kalmadıysa VE borç kalmadıysa oturumu kapat
    const totalBill = orders.reduce((sum, order) => sum + order.total, 0);
    const totalPaidSoFar = 
      session.participants.map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0) +
      (session.leftParticipants || []).map((p) => p.paidAmount).reduce((sum, amt) => sum + amt, 0);
    const remainingBill = Math.max(0, Number((totalBill - totalPaidSoFar).toFixed(2)));

    if (session.participants.length === 0 && remainingBill <= 0) {
      session.status = "closed";
      session.closedAt = new Date();
      session.closedBy = currentUserId;
      session.closedByRole = req.authUser.role;
      session.closeReason = "Tüm katılımcılar ayrıldı ve borç kalmadı.";
      
      await TableModel.updateOne({ tableNumber: session.tableNumber }, { $set: { currentSessionId: "" } });
    }

    await session.save();

    return res.json({
      success: true,
      paidAmount: paymentAmount,
      session: serializeTableSession(session),
      user: serializeUser(req.authUser),
    });
  } catch (error) {
    console.error("table leave error:", error);
    return next(new ApiError(500, "TABLE_LEAVE_FAILED", "sys:masadan-ayrilirken-hata-olustu"));
  }
});

// Import new feature routes
import newFeaturesRouter from "./new-features.js";
// MP-3.1: SSE realtime kanalı (GET /api/events) — EventSource header
// gönderemediği için token sorgu parametresi ile de doğrulanır.
import eventsRouter from "./events.js";
import { getSystemText } from "../services/systemTexts";
router.use(newFeaturesRouter);
router.use(eventsRouter);

export default router;
