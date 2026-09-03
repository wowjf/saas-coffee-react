import { Router } from "express";
import { attachAuth, restrictTo, type AuthRequest } from "../middleware/auth";
import { autoAsyncHandlers } from "../middleware/asyncHandler";
import ReviewModel from "../models/Review";
import CouponModel from "../models/Coupon";
import FriendModel from "../models/Friend";
import GiftModel from "../models/Gift";
import SubscriptionModel, { SubscriptionPlanModel } from "../models/Subscription";
import ChatRoomModel from "../models/ChatRoom";
import ReservationModel from "../models/Reservation";
import WaiterCallModel from "../models/WaiterCall";
import InventoryItemModel from "../models/InventoryItem";
import UserModel from "../models/User";
import ProductModel from "../models/Product";
import OrderModel from "../models/Order";
import TableModel from "../models/Table";
import { serializeDocument, sanitizePlainText, toIsoString } from "../utils";
import {
  getLeaderboard,
  getLeaderboardCooldownRemainingMs,
  LEADERBOARD_OPT_OUT_COOLDOWN_MS,
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from "../services/leaderboard";
import SystemTextModel from "../models/SystemText";
import { SYSTEM_TEXTS } from "../../shared/system-texts.js";
import {
  invalidateSystemTextCache,
  listSystemTextOverrides,
} from "../services/systemTexts.js";
// MP-3.1: SSE kanalına olay yayını — garson çağrısı ve sohbet mesajları.
import { publishToManagers, publishToUser } from "../services/eventBus.js";
import { getSystemText } from "../services/systemTexts";
import { calculateCouponDiscount } from "../services/coupon.js";
import { syncProductStockFlags } from "../services/inventory.js";

// MP-0.5: kaydedilen tüm async handler'lar asyncHandler ile sarmalanır.
const router = autoAsyncHandlers(Router());

// Hediye/abonelik tutarları için üst sınır (TL) — istemciden gelen amount'ın
// aşırı büyümesini ve kayan nokta birikimini engeller.
const MAX_TRANSACTION_AMOUNT = 1_000_000;

/**
 * Para akışına giren tutarı normalleştirir: sayı değilse null, 0'dan küçükse
 * null, en fazla 2 basamak hassasiyete yuvarlanır ve üst sınırı aşamaz.
 */
function normalizeAmount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const rounded = Math.round(parsed * 100) / 100;
  if (rounded <= 0 || rounded > MAX_TRANSACTION_AMOUNT) {
    return null;
  }

  return rounded;
}

// ============================================
// REVIEW ENDPOINTS - Ürün Değerlendirmeleri
// ============================================

// MP-2.6: değerlendirme listelerinde yalnızca güvenli alanlar döner —
// e-posta/telefon gibi kişisel veriler sızmaz, kullanıcı yalnızca username
// (userName) ile görünür.
function serializeReview(doc: {
  _id: { toString(): string };
  orderId: string;
  userId: string;
  userName: string;
  productId: string;
  productName: string;
  rating: number;
  comment?: string;
  staffRating?: number | null;
  staffComment?: string;
  response?: string;
  respondedAt?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId,
    userId: doc.userId,
    userName: doc.userName,
    productId: doc.productId,
    productName: doc.productName,
    rating: doc.rating,
    comment: doc.comment ?? "",
    staffRating: doc.staffRating ?? null,
    staffComment: doc.staffComment ?? "",
    response: doc.response ?? "",
    respondedAt: doc.respondedAt ?? "",
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt),
  };
}

// Get reviews for a product
router.get("/reviews/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await ReviewModel.find({ productId }).sort({ createdAt: -1 });
    return res.json(reviews.map((r) => serializeReview(r)));
  } catch (error) {
    console.error("Get reviews error:", error);
    return res.status(500).json({ message: await getSystemText("degerlendirmeler-yuklenirken-hata-olustu") });
  }
});

// Get user's reviews
router.get("/reviews/my", attachAuth, async (req: AuthRequest, res) => {
  try {
    const reviews = await ReviewModel.find({ userId: req.authUser!._id.toString() }).sort({ createdAt: -1 });
    return res.json(reviews.map((r) => serializeReview(r)));
  } catch (error) {
    console.error("Get my reviews error:", error);
    return res.status(500).json({ message: await getSystemText("degerlendirmeleriniz-yuklenirken-hata-olustu") });
  }
});

// Create a review
router.post("/reviews", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { orderId, productId, staffRating, staffComment } = req.body;
    // MP-1.4: dış girdiler normalleştirilir — sayı olmayan puan ve nesne
    // yorum gövdesi belgeye operatör olarak sızamaz.
    const rating = Number(req.body?.rating);
    const comment = sanitizePlainText(typeof req.body?.comment === "string" ? req.body.comment : "");

    if (!orderId || !productId || !Number.isFinite(rating)) {
      return res.status(400).json({ message: await getSystemText("eksik-bilgi") });
    }

    // MP-2.6: puan 1-5 arasında tam sayı olmalıdır.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: await getSystemText("gecersiz-puan") });
    }

    // MP-2.6: yorum en fazla 1000 karakter olabilir.
    if (comment.length > 1000) {
      return res.status(400).json({ message: await getSystemText("yorum-en-fazla-1000-karakter-olabilir") });
    }

    const userId = req.authUser!._id.toString();

    // MP-2.6: değerlendirme yalnızca kullanıcının kendi, tamamlanmış siparişi için yazılabilir.
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: await getSystemText("siparis-bulunamadi") });
    }
    if (order.userId !== userId) {
      return res.status(403).json({ message: await getSystemText("yalnizca-kendi-siparislerinizi-degerlendirebilirsiniz") });
    }
    if (order.status !== "completed") {
      return res.status(400).json({ message: await getSystemText("yalnizca-tamamlanan-siparisler-degerlendirilebilir") });
    }

    // MP-2.6: ürün adı istemciden alınmaz — katalogdan (ProductModel) çözülür.
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: await getSystemText("urun-bulunamadi") });
    }

    // Aynı sipariş için ikinci değerlendirme engellenir.
    const existing = await ReviewModel.findOne({ orderId, userId });
    if (existing) {
      return res.status(400).json({ message: await getSystemText("bu-siparisi-zaten-degerlendirdiniz") });
    }

    const review = await ReviewModel.create({
      orderId,
      userId,
      userName: `${req.authUser!.name} ${req.authUser!.surname}`,
      productId,
      productName: product.name,
      rating,
      comment,
      staffRating: staffRating || null,
      staffComment: staffComment || "",
      createdAt: new Date().toISOString(),
    });

    // Update product average rating
    const allReviews = await ReviewModel.find({ productId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await ProductModel.updateOne(
      { _id: productId },
      { $set: { averageRating: Math.round(avgRating * 10) / 10, reviewCount: allReviews.length } }
    );

    return res.json(serializeReview(review));
  } catch (error) {
    console.error("Create review error:", error);
    return res.status(500).json({ message: await getSystemText("degerlendirme-eklenirken-hata-olustu") });
  }
});

// Respond to a review (manager only)
router.patch("/reviews/:id/response", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const response = sanitizePlainText(String(req.body?.response ?? "")).slice(0, 1000);

    const review = await ReviewModel.findByIdAndUpdate(
      id,
      {
        $set: {
          response,
          respondedBy: req.authUser!._id.toString(),
          respondedAt: new Date().toISOString(),
        },
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: await getSystemText("degerlendirme-bulunamadi") });
    }

    return res.json(serializeReview(review));
  } catch (error) {
    console.error("Review response error:", error);
    return res.status(500).json({ message: await getSystemText("yanit-eklenirken-hata-olustu") });
  }
});

// ============================================
// COUPON ENDPOINTS - Kupon Sistemi
// ============================================

// Get all coupons (manager only)
router.get("/coupons", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const coupons = await CouponModel.find().sort({ createdAt: -1 });
    return res.json(coupons.map((c) => serializeDocument(c)));
  } catch (error) {
    console.error("Get coupons error:", error);
    return res.status(500).json({ message: await getSystemText("kuponlar-yuklenirken-hata-olustu") });
  }
});

// Validate and apply coupon
router.post("/coupons/validate", attachAuth, async (req: AuthRequest, res) => {
  try {
    const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
    const orderTotal = Number(req.body.orderTotal);

    if (!code) {
      return res.status(400).json({ message: await getSystemText("kupon-kodu-giriniz") });
    }

    if (!Number.isFinite(orderTotal) || orderTotal < 0) {
      return res.status(400).json({ message: await getSystemText("gecerli-bir-siparis-tutari-giriniz") });
    }

    const coupon = await CouponModel.findOne({ code: code.toUpperCase(), active: true });
    
    if (!coupon) {
      return res.status(404).json({ message: await getSystemText("gecersiz-kupon-kodu") });
    }

    const now = new Date().toISOString();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: await getSystemText("kupon-suresi-gecerli-degil") });
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: await getSystemText("kupon-kullanim-limiti-doldu") });
    }

    if (coupon.usedBy && coupon.usedBy.includes(req.authUser!._id.toString())) {
      return res.status(400).json({ message: await getSystemText("bu-kuponu-daha-once-kullandiniz") });
    }

    if (coupon.newUsersOnly) {
      const userOrderCount = await OrderModel.countDocuments({ userId: req.authUser!._id.toString(), status: "completed" });
      if (userOrderCount > 0) {
        return res.status(400).json({ message: await getSystemText("bu-kupon-sadece-yeni-kullanicilar-icindir") });
      }
    }

    if (coupon.minOrderAmount > 0 && orderTotal < coupon.minOrderAmount) {
      return res.status(400).json({ message: `Minimum sipariş tutarı ${coupon.minOrderAmount} TL olmalıdır.` });
    }

    const discountAmount = calculateCouponDiscount(
      { type: coupon.type, value: coupon.value, maxDiscount: coupon.maxDiscount },
      orderTotal,
    );

    return res.json({
      valid: true,
      coupon: serializeDocument(coupon),
      discountAmount,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    return res.status(500).json({ message: await getSystemText("kupon-dogrulanirken-hata-olustu") });
  }
});

// MP-1.4: kupon create/patch'lerinde beyaz listeli alan çıkarımı — $set'e
// asla ham req.body gitmez (mass assignment / NoSQL operatör enjeksiyonu).
const COUPON_WRITABLE_FIELDS = [
  "code",
  "title",
  "description",
  "type",
  "value",
  "minOrderAmount",
  "maxDiscount",
  "usageLimit",
  "validFrom",
  "validUntil",
  "active",
  "targetCategory",
  "targetProductId",
  "newUsersOnly",
] as const;

function pickCouponFields(body: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};

  for (const field of COUPON_WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  return picked;
}

// Create coupon (manager only)
router.post("/coupons", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const couponData = pickCouponFields(req.body ?? {});

    if (typeof couponData.code !== "string" || !couponData.code.trim()) {
      return res.status(400).json({ message: await getSystemText("kupon-kodu-giriniz") });
    }

    couponData.code = couponData.code.trim().toUpperCase();

    const existing = await CouponModel.findOne({ code: couponData.code });
    if (existing) {
      return res.status(400).json({ message: await getSystemText("bu-kupon-kodu-zaten-mevcut") });
    }

    const coupon = await CouponModel.create(couponData);
    return res.json(serializeDocument(coupon));
  } catch (error) {
    console.error("Create coupon error:", error);
    return res.status(500).json({ message: await getSystemText("kupon-olusturulurken-hata-olustu") });
  }
});

// Update coupon (manager only)
router.patch("/coupons/:id", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = pickCouponFields(req.body ?? {});

    if (updates.code) {
      updates.code = String(updates.code).toUpperCase();
    }

    const coupon = await CouponModel.findByIdAndUpdate(id, { $set: updates }, { new: true });

    if (!coupon) {
      return res.status(404).json({ message: await getSystemText("kupon-bulunamadi") });
    }

    return res.json(serializeDocument(coupon));
  } catch (error) {
    console.error("Update coupon error:", error);
    return res.status(500).json({ message: await getSystemText("kupon-guncellenirken-hata-olustu") });
  }
});

// Delete coupon (manager only)
router.delete("/coupons/:id", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await CouponModel.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.status(500).json({ message: await getSystemText("kupon-silinirken-hata-olustu") });
  }
});

// Mark coupon as used (internal, called when order is completed)
// MP-1.2: yalnizca customer oturumu, kupon daha once bu kullanici tarafindan
// kullanilmamissa VE kullanim limiti dolmamissa atomik kosullu guncelleme ile
// isaretlenir. Eski hali herhangi bir giris yapmis kullanicinin herhangi bir
// kuponu sinirsiz kez isaretlemesine izin veriyordu.
router.post("/coupons/:id/use", attachAuth, restrictTo("customer"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!._id.toString();

    // Atomik koşullu güncelleme: filtre eşleşmezse kupon kullanılmaz olmaz —
    // eşzamanlı isteklerden yalnızca limit izin verdigi kadarı geçer.
    const updated = await CouponModel.findOneAndUpdate(
      {
        _id: id,
        active: true,
        usedBy: { $ne: userId },
        // usageLimit 0 = sinirsiz; dolmamis limitli kuponlar gecer.
        $expr: {
          $or: [
            { $eq: ["$usageLimit", 0] },
            { $lt: ["$usedCount", "$usageLimit"] },
          ],
        },
      },
      {
        $inc: { usedCount: 1 },
        $addToSet: { usedBy: userId },
      },
      { new: true },
    );

    if (!updated) {
      const coupon = await CouponModel.findById(id).lean();

      if (!coupon) {
        return res.status(404).json({ message: await getSystemText("kupon-bulunamadi") });
      }

      if (coupon.usedBy?.includes(userId)) {
        return res.status(400).json({ message: await getSystemText("bu-kuponu-daha-once-kullandiniz") });
      }

      return res.status(400).json({ message: await getSystemText("kupon-kullanim-limiti-doldu") });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Use coupon error:", error);
    return res.status(500).json({ message: await getSystemText("kupon-kullanilirken-hata-olustu") });
  }
});

// ============================================
// FRIEND ENDPOINTS - Arkadaş Sistemi
// ============================================

// Get friends list
router.get("/friends", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    
    const friendships = await FriendModel.find({
      $or: [{ userId }, { friendId: userId }],
      status: "accepted",
    });

    const friendIds = friendships.map((f) => 
      f.userId === userId ? f.friendId : f.userId
    );

    const friends = await UserModel.find({ _id: { $in: friendIds } }).select("name surname avatar email");

    return res.json(friends.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      surname: f.surname,
      avatar: f.avatar,
      email: f.email,
    })));
  } catch (error) {
    console.error("Get friends error:", error);
    return res.status(500).json({ message: await getSystemText("arkadaslar-yuklenirken-hata-olustu") });
  }
});

// Get friend requests
router.get("/friends/requests", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    
    const requests = await FriendModel.find({
      friendId: userId,
      status: "pending",
    }).sort({ requestedAt: -1 });

    const requesterIds = requests.map((r) => r.userId);
    const users = await UserModel.find({ _id: { $in: requesterIds } }).select("name surname avatar email");

    const result = requests.map((req) => {
      const user = users.find((u) => u._id.toString() === req.userId);
      return {
        id: req._id.toString(),
        userId: req.userId,
        name: user?.name || "",
        surname: user?.surname || "",
        avatar: user?.avatar || "",
        email: user?.email || "",
        requestedAt: req.requestedAt,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Get friend requests error:", error);
    return res.status(500).json({ message: await getSystemText("arkadaslik-istekleri-yuklenirken-hata-olustu") });
  }
});

// Send friend request
router.post("/friends/request", attachAuth, async (req: AuthRequest, res) => {
  try {
    // MP-1.4: dış girdi sorguya girmeden String() ile normalleştirilir —
    // nesne gövdesi ({friendEmail: {$gt: ""}}) NoSQL enjeksiyonu olurdu.
    const friendEmail = String(req.body?.friendEmail || "").trim();
    const userId = req.authUser!._id.toString();

    const friend = await UserModel.findOne({ email: friendEmail });
    if (!friend) {
      return res.status(404).json({ message: await getSystemText("kullanici-bulunamadi") });
    }

    const friendId = friend._id.toString();

    if (userId === friendId) {
      return res.status(400).json({ message: await getSystemText("kendinize-arkadaslik-istegi-gonderemezsiniz") });
    }

    const existing = await FriendModel.findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ message: await getSystemText("zaten-arkadassiniz") });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ message: await getSystemText("zaten-bekleyen-bir-istek-var") });
      }
    }

    const request = await FriendModel.create({
      userId,
      friendId,
      status: "pending",
      requestedBy: userId,
      requestedAt: new Date().toISOString(),
    });

    return res.json(serializeDocument(request));
  } catch (error) {
    console.error("Send friend request error:", error);
    return res.status(500).json({ message: await getSystemText("arkadaslik-istegi-gonderilirken-hata-olustu") });
  }
});

// Respond to friend request
router.post("/friends/respond", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { requestId, action } = req.body; // action: "accept" | "reject"
    const userId = req.authUser!._id.toString();

    const request = await FriendModel.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: await getSystemText("istek-bulunamadi") });
    }

    if (request.friendId !== userId) {
      return res.status(403).json({ message: await getSystemText("bu-istegi-cevaplayamazsiniz") });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: await getSystemText("bu-istek-zaten-cevaplanmis") });
    }

    request.status = action === "accept" ? "accepted" : "rejected";
    request.respondedAt = new Date().toISOString();
    await request.save();

    // If accepted, add to both users' friends list
    if (action === "accept") {
      await UserModel.updateOne({ _id: request.userId }, { $addToSet: { friends: userId } });
      await UserModel.updateOne({ _id: userId }, { $addToSet: { friends: request.userId } });
    }

    return res.json(serializeDocument(request));
  } catch (error) {
    console.error("Respond to friend request error:", error);
    return res.status(500).json({ message: await getSystemText("istek-cevaplanirken-hata-olustu") });
  }
});

// Remove friend
router.delete("/friends/:friendId", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.authUser!._id.toString();

    await FriendModel.deleteOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    await UserModel.updateOne({ _id: userId }, { $pull: { friends: friendId } });
    await UserModel.updateOne({ _id: friendId }, { $pull: { friends: userId } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Remove friend error:", error);
    return res.status(500).json({ message: await getSystemText("arkadas-silinirken-hata-olustu") });
  }
});


// ============================================
// GIFT ENDPOINTS - Hediye Gönderme
// ============================================

// Get received gifts
router.get("/gifts/received", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    const gifts = await GiftModel.find({ recipientId: userId }).sort({ sentAt: -1 });
    return res.json(gifts.map((g) => serializeDocument(g)));
  } catch (error) {
    console.error("Get received gifts error:", error);
    return res.status(500).json({ message: await getSystemText("hediyeler-yuklenirken-hata-olustu") });
  }
});

// Get sent gifts
router.get("/gifts/sent", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    const gifts = await GiftModel.find({ senderId: userId }).sort({ sentAt: -1 });
    return res.json(gifts.map((g) => serializeDocument(g)));
  } catch (error) {
    console.error("Get sent gifts error:", error);
    return res.status(500).json({ message: await getSystemText("gonderilen-hediyeler-yuklenirken-hata-olustu") });
  }
});

// Send gift
router.post("/gifts/send", attachAuth, async (req: AuthRequest, res) => {
  try {
    // MP-1.4: dış girdiler sorguya/kayda girmeden normalleştirilir.
    const recipientEmail = String(req.body?.recipientEmail || "").trim();
    const { type, amount, productId, productName, message } = req.body;
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    const recipient = await UserModel.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: await getSystemText("alici-bulunamadi") });
    }

    const recipientId = recipient._id.toString();
    const recipientName = `${recipient.name} ${recipient.surname}`;

    if (userId === recipientId) {
      return res.status(400).json({ message: await getSystemText("kendinize-hediye-gonderemezsiniz") });
    }

    let normalizedAmount = 0;
    if (type === "balance") {
      normalizedAmount = normalizeAmount(amount) ?? 0;
      if (normalizedAmount <= 0) {
        return res.status(400).json({ message: await getSystemText("gecersiz-tutar") });
      }

      // Atomik koşullu düşüm (api.ts /orders deseni): bakiye yetersizse veya
      // eşzamanlı bir istek bakiyeyi arada tükettiyse güncelleme eşleşmez.
      const updatedSender = await UserModel.findOneAndUpdate(
        { _id: userId, balance: { $gte: normalizedAmount } },
        { $inc: { balance: -normalizedAmount } },
        { new: true },
      );
      if (!updatedSender) {
        return res.status(400).json({ message: await getSystemText("yetersiz-bakiye") });
      }
      req.authUser = updatedSender;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const gift = await GiftModel.create({
      senderId: userId,
      senderName: userName,
      recipientId,
      recipientName,
      type,
      amount: normalizedAmount,
      productId: productId || "",
      productName: productName || "",
      message: message || "",
      status: "pending",
      sentAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return res.json(serializeDocument(gift));
  } catch (error) {
    console.error("Send gift error:", error);
    return res.status(500).json({ message: await getSystemText("hediye-gonderilirken-hata-olustu") });
  }
});

// Claim gift
router.post("/gifts/:id/claim", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!._id.toString();

    const gift = await GiftModel.findById(id);
    if (!gift) {
      return res.status(404).json({ message: await getSystemText("hediye-bulunamadi") });
    }

    if (gift.recipientId !== userId) {
      return res.status(403).json({ message: await getSystemText("bu-hediye-size-ait-degil") });
    }

    if (gift.status !== "pending") {
      return res.status(400).json({ message: await getSystemText("bu-hediye-zaten-kullanildi-veya-suresi-doldu") });
    }

    const now = new Date().toISOString();
    if (now > gift.expiresAt) {
      gift.status = "expired";
      await gift.save();
      return res.status(400).json({ message: await getSystemText("hediyenin-suresi-dolmus") });
    }

    // Atomik koşullu güncelleme: status hâlâ "pending" olan belgeyi tek adımda
    // "claimed"e çevir. Eşzamanlı iki claim isteğinden yalnızca biri eşleşir;
    // kaybeden taraf burada 400 alır ve bakiye tek kez yüklenir.
    const claimedGift = await GiftModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "claimed", claimedAt: now } },
      { new: true },
    );
    if (!claimedGift) {
      return res.status(400).json({ message: await getSystemText("bu-hediye-zaten-kullanildi-veya-suresi-doldu") });
    }

    if (gift.type === "balance" && gift.amount > 0) {
      await UserModel.updateOne({ _id: userId }, { $inc: { balance: gift.amount } });
    }

    const updatedUser = await UserModel.findById(userId);

    return res.json({
      gift: serializeDocument(claimedGift),
      user: {
        balance: updatedUser?.balance || 0,
      },
    });
  } catch (error) {
    console.error("Claim gift error:", error);
    return res.status(500).json({ message: await getSystemText("hediye-alinirken-hata-olustu") });
  }
});

// ============================================
// SUBSCRIPTION ENDPOINTS - Abonelik Sistemi
// ============================================

// Get subscription plans
router.get("/subscriptions/plans", async (req, res) => {
  try {
    const plans = await SubscriptionPlanModel.find({ active: true });
    return res.json(plans.map((p) => serializeDocument(p)));
  } catch (error) {
    console.error("Get subscription plans error:", error);
    return res.status(500).json({ message: await getSystemText("abonelik-planlari-yuklenirken-hata-olustu") });
  }
});

// Get user subscription
router.get("/subscriptions/my", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    const subscription = await SubscriptionModel.findOne({ userId });
    
    if (!subscription) {
      return res.json(null);
    }

    return res.json(serializeDocument(subscription));
  } catch (error) {
    console.error("Get my subscription error:", error);
    return res.status(500).json({ message: await getSystemText("aboneliginiz-yuklenirken-hata-olustu") });
  }
});

// Subscribe to a plan
router.post("/subscriptions/subscribe", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { planId } = req.body;
    const userId = req.authUser!._id.toString();

    const plan = await SubscriptionPlanModel.findById(planId);
    if (!plan || !plan.active) {
      return res.status(404).json({ message: await getSystemText("plan-bulunamadi") });
    }

    const planPrice = normalizeAmount(plan.price);
    if (planPrice === null) {
      return res.status(400).json({ message: await getSystemText("gecersiz-tutar") });
    }

    // Check if already subscribed
    const existing = await SubscriptionModel.findOne({ userId, status: "active" });
    if (existing) {
      return res.status(400).json({ message: await getSystemText("zaten-aktif-bir-aboneliginiz-var") });
    }

    // Atomik koşullu düşüm (api.ts /orders deseni): bakiye yetsizse veya
    // eşzamanlı bir istek bakiyeyi arada tükettiyse güncelleme eşleşmez.
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId, balance: { $gte: planPrice } },
      { $inc: { balance: -planPrice } },
      { new: true },
    );
    if (!updatedUser) {
      return res.status(400).json({ message: await getSystemText("yetersiz-bakiye") });
    }
    req.authUser = updatedUser;

    const startDate = new Date();
    const endDate = new Date();
    if (plan.duration === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    let subscription;
    try {
      subscription = await SubscriptionModel.create({
        userId,
        planId: plan._id.toString(),
        planName: plan.name,
        status: "active",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        autoRenew: true,
      });
    } catch (createError) {
      // S-K7 (MP-0.10): eşzamanlı ikinci istek bakiyeyi düşüp create'te
      // unique userId index'ine takılabilir — düşülen para telafi edilmeden
      // 500 dönülürse para kaybolur.
      await UserModel.updateOne({ _id: userId }, { $inc: { balance: planPrice } });
      console.error("Subscribe create error (refund applied):", createError);

      const alreadyActive = await SubscriptionModel.findOne({ userId, status: "active" });
      if (alreadyActive) {
        return res.status(400).json({ message: await getSystemText("zaten-aktif-bir-aboneliginiz-var") });
      }
      throw createError;
    }

    // Update user with subscription ID
    const userWithSubscription = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { subscriptionId: subscription._id.toString() } },
      { new: true },
    );

    return res.json({
      subscription: serializeDocument(subscription),
      user: { balance: userWithSubscription?.balance ?? updatedUser.balance },
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return res.status(500).json({ message: await getSystemText("abonelik-olusturulurken-hata-olustu") });
  }
});

// Cancel subscription
router.post("/subscriptions/cancel", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();

    const subscription = await SubscriptionModel.findOne({ userId, status: "active" });
    if (!subscription) {
      return res.status(404).json({ message: await getSystemText("aktif-abonelik-bulunamadi") });
    }

    subscription.status = "cancelled";
    subscription.autoRenew = false;
    subscription.cancelledAt = new Date().toISOString();
    await subscription.save();

    await UserModel.updateOne({ _id: userId }, { $set: { subscriptionId: "" } });

    return res.json(serializeDocument(subscription));
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(500).json({ message: await getSystemText("abonelik-iptal-edilirken-hata-olustu") });
  }
});

// MP-1.4: abonelik planı create/patch'lerinde beyaz listeli alan çıkarımı.
const PLAN_WRITABLE_FIELDS = [
  "name",
  "description",
  "price",
  "duration",
  "benefits",
  "discountPercent",
  "freeDelivery",
  "priorityQueue",
  "exclusiveProducts",
  "active",
] as const;

function pickPlanFields(body: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};

  for (const field of PLAN_WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  return picked;
}

// Create subscription plan (manager only)
router.post("/subscriptions/plans", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const plan = await SubscriptionPlanModel.create(pickPlanFields(req.body ?? {}));
    return res.json(serializeDocument(plan));
  } catch (error) {
    console.error("Create subscription plan error:", error);
    return res.status(500).json({ message: await getSystemText("plan-olusturulurken-hata-olustu") });
  }
});

// Update subscription plan (manager only)
router.patch("/subscriptions/plans/:id", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlanModel.findByIdAndUpdate(id, { $set: pickPlanFields(req.body ?? {}) }, { new: true });

    if (!plan) {
      return res.status(404).json({ message: await getSystemText("plan-bulunamadi") });
    }

    return res.json(serializeDocument(plan));
  } catch (error) {
    console.error("Update subscription plan error:", error);
    return res.status(500).json({ message: await getSystemText("plan-guncellenirken-hata-olustu") });
  }
});

// ============================================
// CHAT ENDPOINTS - Canlı Destek
// ============================================

// Get user's chat room
router.get("/chat/my", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    let room = await ChatRoomModel.findOne({ customerId: userId, status: { $in: ["active", "waiting"] } });
    
    if (!room) {
      // Create new chat room
      room = await ChatRoomModel.create({
        customerId: userId,
        customerName: `${req.authUser!.name} ${req.authUser!.surname}`,
        status: "waiting",
        messages: [],
        lastMessageAt: new Date().toISOString(),
      });
    }

    return res.json(serializeDocument(room));
  } catch (error) {
    console.error("Get my chat error:", error);
    return res.status(500).json({ message: await getSystemText("sohbet-yuklenirken-hata-olustu") });
  }
});

// Get all chat rooms (staff/manager)
router.get("/chat/rooms", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const rooms = await ChatRoomModel.find().sort({ lastMessageAt: -1 });
    return res.json(rooms.map((r) => serializeDocument(r)));
  } catch (error) {
    console.error("Get chat rooms error:", error);
    return res.status(500).json({ message: await getSystemText("sohbetler-yuklenirken-hata-olustu") });
  }
});

// Send message
router.post("/chat/:roomId/message", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    // MP-1.4: mesaj gövdesi String() ile normalleştirilir — nesne girdisi
    // belgeye operatör olarak sızamaz.
    const message = sanitizePlainText(String(req.body?.message ?? ""));
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;
    const userRole = req.authUser!.role;

    // MP-2.6: sohbet mesajı en fazla 1000 karakter olabilir.
    if (message.length > 1000) {
      return res.status(400).json({ message: await getSystemText("mesaj-en-fazla-1000-karakter-olabilir") });
    }

    const room = await ChatRoomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: await getSystemText("sohbet-bulunamadi") });
    }

    // Authorization check
    if (room.customerId !== userId && !["staff", "manager"].includes(userRole)) {
      return res.status(403).json({ message: await getSystemText("bu-sohbete-erisiminiz-yok") });
    }

    const newMessage = {
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      message,
      timestamp: new Date().toISOString(),
      attachments: [],
    };

    room.messages.push(newMessage as any);
    room.lastMessageAt = newMessage.timestamp;

    // MP-3.1: SSE — mesaj karşı tarafa anlık iletilir. Müşteri gönderdiyse
    // personel kanalı, personel gönderdiyse müşteri kanalı hedeflenir.
    const chatEvent = {
      roomId,
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      message,
      timestamp: newMessage.timestamp,
    };
    if (["staff", "manager"].includes(userRole)) {
      publishToUser(room.customerId, "chat_message", chatEvent);
    } else {
      // Müşteriden gelen mesajı görüntüleyen tüm personel/yönetici alır.
      if (["waiting", "active"].includes(room.status)) {
        publishToManagers("chat_message", chatEvent);
      }
    }

    // If staff/manager sends message, mark as active
    if (["staff", "manager"].includes(userRole) && room.status === "waiting") {
      room.status = "active";
      room.assignedTo = userId;
      room.assignedToName = userName;
    }

    await room.save();

    return res.json(serializeDocument(room));
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ message: await getSystemText("mesaj-gonderilirken-hata-olustu") });
  }
});

// Close chat room
router.post("/chat/:roomId/close", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoomModel.findByIdAndUpdate(
      roomId,
      {
        $set: {
          status: "resolved",
          closedAt: new Date().toISOString(),
        },
      },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: await getSystemText("sohbet-bulunamadi") });
    }

    return res.json(serializeDocument(room));
  } catch (error) {
    console.error("Close chat error:", error);
    return res.status(500).json({ message: await getSystemText("sohbet-kapatilirken-hata-olustu") });
  }
});


// ============================================
// RESERVATION ENDPOINTS - Rezervasyon Sistemi
// ============================================

// Get user's reservations
router.get("/reservations/my", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    const reservations = await ReservationModel.find({ userId }).sort({ date: -1, time: -1 });
    return res.json(reservations.map((r) => serializeDocument(r)));
  } catch (error) {
    console.error("Get my reservations error:", error);
    return res.status(500).json({ message: await getSystemText("rezervasyonlariniz-yuklenirken-hata-olustu") });
  }
});

// Get all reservations (staff/manager)
router.get("/reservations", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    // MP-1.4: query nesnesi normalleştirme — dizi/nesne girdisi sorguya
    // operatör olarak sızamaz.
    const date = typeof req.query.date === "string" ? req.query.date : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filter: any = {};

    if (date) {
      filter.date = date;
    }
    if (status) {
      filter.status = status;
    }

    const reservations = await ReservationModel.find(filter).sort({ date: 1, time: 1 });
    return res.json(reservations.map((r) => serializeDocument(r)));
  } catch (error) {
    console.error("Get reservations error:", error);
    return res.status(500).json({ message: await getSystemText("rezervasyonlar-yuklenirken-hata-olustu") });
  }
});

// Create reservation
router.post("/reservations", attachAuth, async (req: AuthRequest, res) => {
  try {
    // MP-1.4: dış girdiler sorguya girmeden normalleştirilir — tableNumber
    // şemada String'dir, Number'a çevrilmez (nesne girdisi ayıklanır).
    const { date, time, note } = req.body;
    const tableNumber = String(req.body?.tableNumber ?? "").trim();
    const guestCount = Number(req.body?.guestCount);
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;
    const userPhone = req.authUser!.phone;

    if (!tableNumber || !date || !time || !guestCount) {
      return res.status(400).json({ message: await getSystemText("eksik-bilgi") });
    }

    // Check if table exists
    const table = await TableModel.findOne({ tableNumber });
    if (!table) {
      return res.status(404).json({ message: await getSystemText("masa-bulunamadi") });
    }

    // Check for conflicting reservations
    const conflicting = await ReservationModel.findOne({
      tableNumber,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    });

    if (conflicting) {
      return res.status(400).json({ message: await getSystemText("bu-masa-bu-saatte-zaten-rezerve-edilmis") });
    }

    const reservation = await ReservationModel.create({
      userId,
      userName,
      userPhone,
      tableNumber,
      date,
      time,
      guestCount,
      note: note || "",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    return res.json(serializeDocument(reservation));
  } catch (error) {
    console.error("Create reservation error:", error);
    return res.status(500).json({ message: await getSystemText("rezervasyon-olusturulurken-hata-olustu") });
  }
});

// Update reservation status (staff/manager)
router.patch("/reservations/:id/status", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    const reservation = await ReservationModel.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: await getSystemText("rezervasyon-bulunamadi") });
    }

    reservation.status = status;

    if (status === "confirmed") {
      reservation.confirmedBy = userId;
      reservation.confirmedAt = new Date().toISOString();
    } else if (status === "cancelled") {
      reservation.cancelledBy = userId;
      reservation.cancelledAt = new Date().toISOString();
      reservation.cancelReason = cancelReason || "";
    }

    await reservation.save();

    return res.json(serializeDocument(reservation));
  } catch (error) {
    console.error("Update reservation status error:", error);
    return res.status(500).json({ message: await getSystemText("rezervasyon-guncellenirken-hata-olustu") });
  }
});

// Cancel reservation (user can cancel own)
router.post("/reservations/:id/cancel", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!._id.toString();

    const reservation = await ReservationModel.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: await getSystemText("rezervasyon-bulunamadi") });
    }

    if (reservation.userId !== userId) {
      return res.status(403).json({ message: await getSystemText("bu-rezervasyonu-iptal-edemezsiniz") });
    }

    if (!["pending", "confirmed"].includes(reservation.status)) {
      return res.status(400).json({ message: await getSystemText("bu-rezervasyon-iptal-edilemez") });
    }

    reservation.status = "cancelled";
    reservation.cancelledBy = userId;
    reservation.cancelledAt = new Date().toISOString();
    reservation.cancelReason = "Müşteri tarafından iptal edildi.";
    await reservation.save();

    return res.json(serializeDocument(reservation));
  } catch (error) {
    console.error("Cancel reservation error:", error);
    return res.status(500).json({ message: await getSystemText("rezervasyon-iptal-edilirken-hata-olustu") });
  }
});

// ============================================
// WAITER CALL ENDPOINTS - Garson Çağrı Sistemi
// ============================================

// MP-2.11: WaiterCall.createdAt artik Date — serilestirmede ISO string'e cevrilir.
function serializeWaiterCall(call: any) {
  const raw = serializeDocument(call);
  return {
    ...raw,
    createdAt: toIsoString(raw.createdAt as Date | string),
  };
}

// Get active waiter calls (staff/manager)
router.get("/waiter-calls", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const calls = await WaiterCallModel.find({ status: { $in: ["pending", "acknowledged"] } }).sort({ createdAt: -1 });
    return res.json(calls.map((c) => serializeWaiterCall(c)));
  } catch (error) {
    console.error("Get waiter calls error:", error);
    return res.status(500).json({ message: await getSystemText("cagrilar-yuklenirken-hata-olustu") });
  }
});

// Get user's waiter calls
router.get("/waiter-calls/my", attachAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!._id.toString();
    const calls = await WaiterCallModel.find({ userId }).sort({ createdAt: -1 }).limit(20);
    return res.json(calls.map((c) => serializeWaiterCall(c)));
  } catch (error) {
    console.error("Get my waiter calls error:", error);
    return res.status(500).json({ message: await getSystemText("cagrilariniz-yuklenirken-hata-olustu") });
  }
});

// Create waiter call
router.post("/waiter-calls", attachAuth, async (req: AuthRequest, res) => {
  try {
    // MP-1.4: dış girdiler String() ile normalleştirilir.
    const tableNumber = String(req.body?.tableNumber ?? "").trim();
    const tableSessionToken = String(req.body?.tableSessionToken ?? "");
    const type = String(req.body?.type ?? "");
    const message = sanitizePlainText(String(req.body?.message ?? ""));
    const priority = String(req.body?.priority ?? "normal");
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    if (!tableNumber || !type) {
      return res.status(400).json({ message: await getSystemText("eksik-bilgi") });
    }

    // S-D1 (MP-0.10): type/priority enumları şemaya ulaşmadan 400 ile
    // reddedilir (CastError 500 döndürüyordu); masa adı da sınırlanır.
    if (!["bill", "help", "complaint", "order"].includes(type)) {
      return res.status(400).json({ message: "Geçersiz çağrı türü (bill/help/complaint/order)." });
    }
    if (!["normal", "urgent"].includes(priority)) {
      return res.status(400).json({ message: "Geçersiz öncelik (normal/urgent)." });
    }
    if (tableNumber.length > 20) {
      return res.status(400).json({ message: "Masa numarası en fazla 20 karakter olabilir." });
    }

    // MP-2.6: garson çağrısı notu en fazla 300 karakter olabilir.
    if (message.length > 300) {
      return res.status(400).json({ message: await getSystemText("not-en-fazla-300-karakter-olabilir") });
    }

    const call = await WaiterCallModel.create({
      tableNumber,
      tableSessionToken: tableSessionToken || "",
      userId,
      userName,
      type,
      message: message || "",
      priority: priority || "normal",
      status: "pending",
      createdAt: new Date(),
    });

    // MP-3.1: SSE — personel/yönetici panellerine anlık garson çağrısı olayı.
    publishToManagers("waiter_call_new", {
      id: call._id.toString(),
      tableNumber,
      type,
      priority: priority || "normal",
      message: message || "",
      userName,
    });

    return res.json(serializeWaiterCall(call));
  } catch (error) {
    console.error("Create waiter call error:", error);
    return res.status(500).json({ message: await getSystemText("cagri-olusturulurken-hata-olustu") });
  }
});

// Acknowledge waiter call (staff/manager)
router.post("/waiter-calls/:id/acknowledge", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    const call = await WaiterCallModel.findById(id);
    if (!call) {
      return res.status(404).json({ message: await getSystemText("cagri-bulunamadi") });
    }

    if (call.status !== "pending") {
      return res.status(400).json({ message: await getSystemText("bu-cagri-zaten-isleme-alinmis") });
    }

    call.status = "acknowledged";
    call.acknowledgedBy = userName;
    call.acknowledgedAt = new Date().toISOString();
    await call.save();

    return res.json(serializeWaiterCall(call));
  } catch (error) {
    console.error("Acknowledge waiter call error:", error);
    return res.status(500).json({ message: await getSystemText("cagri-onaylanirken-hata-olustu") });
  }
});

// Complete waiter call (staff/manager)
router.post("/waiter-calls/:id/complete", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    const call = await WaiterCallModel.findById(id);
    if (!call) {
      return res.status(404).json({ message: await getSystemText("cagri-bulunamadi") });
    }

    call.status = "completed";
    call.completedBy = userName;
    call.completedAt = new Date().toISOString();
    call.response = response || "";
    await call.save();

    return res.json(serializeWaiterCall(call));
  } catch (error) {
    console.error("Complete waiter call error:", error);
    return res.status(500).json({ message: await getSystemText("cagri-tamamlanirken-hata-olustu") });
  }
});

// Cancel waiter call (user can cancel own)
router.post("/waiter-calls/:id/cancel", attachAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!._id.toString();

    const call = await WaiterCallModel.findById(id);
    if (!call) {
      return res.status(404).json({ message: await getSystemText("cagri-bulunamadi") });
    }

    if (call.userId !== userId && !["staff", "manager"].includes(req.authUser!.role)) {
      return res.status(403).json({ message: await getSystemText("bu-cagriyi-iptal-edemezsiniz") });
    }

    call.status = "cancelled";
    await call.save();

    return res.json(serializeWaiterCall(call));
  } catch (error) {
    console.error("Cancel waiter call error:", error);
    return res.status(500).json({ message: await getSystemText("cagri-iptal-edilirken-hata-olustu") });
  }
});

// ============================================
// INVENTORY ENDPOINTS - Envanter Yönetimi
// ============================================

// Get all inventory items (staff/manager)
router.get("/inventory", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const items = await InventoryItemModel.find().sort({ name: 1 });
    return res.json(items.map((i) => serializeDocument(i)));
  } catch (error) {
    console.error("Get inventory error:", error);
    return res.status(500).json({ message: await getSystemText("envanter-yuklenirken-hata-olustu") });
  }
});

// Get low stock items (staff/manager)
router.get("/inventory/low-stock", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const items = await InventoryItemModel.find({
      $expr: { $lte: ["$currentStock", "$reorderPoint"] },
    }).sort({ currentStock: 1 });
    return res.json(items.map((i) => serializeDocument(i)));
  } catch (error) {
    console.error("Get low stock error:", error);
    return res.status(500).json({ message: await getSystemText("dusuk-stok-listesi-yuklenirken-hata-olustu") });
  }
});

// MP-1.4: envanter create/patch'lerinde beyaz listeli alan çıkarımı.
// movements/createdAt sunucu tarafında belirlenir, istemciden gelmez.
const INVENTORY_WRITABLE_FIELDS = [
  "name",
  "unit",
  "currentStock",
  "minStock",
  "maxStock",
  "reorderPoint",
  "costPerUnit",
  "supplier",
  "category",
  "lastRestocked",
] as const;

function pickInventoryFields(body: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};

  for (const field of INVENTORY_WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  return picked;
}

// S-O3 (MP-0.10): envanter sayısal alanları normalleştirir — şema min
// doğrulaması findByIdAndUpdate'te runValidators olmadan çalışmaz; string
// "5" veya negatif değer bu yüzden update'te geçebilirdi.
const INVENTORY_NUMBER_FIELDS = ["currentStock", "minStock", "maxStock", "reorderPoint", "costPerUnit"] as const;

function normalizeInventoryNumbers(picked: Record<string, unknown>): string | null {
  for (const field of INVENTORY_NUMBER_FIELDS) {
    if (picked[field] === undefined) {
      continue;
    }
    const parsed = typeof picked[field] === "number" ? picked[field] : Number(picked[field]);
    if (typeof picked[field] === "boolean" || !Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
      return field;
    }
    picked[field] = parsed;
  }
  return null;
}

// Create inventory item (manager)
router.post("/inventory", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const itemData = pickInventoryFields(req.body ?? {});
    const invalidField = normalizeInventoryNumbers(itemData);
    if (invalidField) {
      return res.status(400).json({ message: `Geçersiz ${invalidField} değeri (0 veya üzeri bir sayı olmalı).` });
    }
    itemData.movements = [];
    itemData.createdAt = new Date().toISOString();

    const item = await InventoryItemModel.create(itemData);
    return res.json(serializeDocument(item));
  } catch (error) {
    console.error("Create inventory item error:", error);
    return res.status(500).json({ message: await getSystemText("envanter-urunu-eklenirken-hata-olustu") });
  }
});

// Update inventory item (manager)
router.patch("/inventory/:id", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = pickInventoryFields(req.body ?? {});
    const invalidField = normalizeInventoryNumbers(updates);
    if (invalidField) {
      return res.status(400).json({ message: `Geçersiz ${invalidField} değeri (0 veya üzeri bir sayı olmalı).` });
    }
    const item = await InventoryItemModel.findByIdAndUpdate(id, { $set: updates }, { new: true });

    if (!item) {
      return res.status(404).json({ message: await getSystemText("urun-bulunamadi") });
    }

    // S-O4a: stok PATCH'i sonrası ürün bayrakları yeniden senkronlanır —
    // malzemesi geri gelen otomatik-kapatılmış ürünler tekrar satışa açılır.
    if (updates.currentStock !== undefined && item) {
      await syncProductStockFlags([item.name]);
    }

    return res.json(serializeDocument(item));
  } catch (error) {
    console.error("Update inventory item error:", error);
    return res.status(500).json({ message: await getSystemText("envanter-urunu-guncellenirken-hata-olustu") });
  }
});

// Delete inventory item (manager)
router.delete("/inventory/:id", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await InventoryItemModel.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete inventory item error:", error);
    return res.status(500).json({ message: await getSystemText("envanter-urunu-silinirken-hata-olustu") });
  }
});

// Add stock movement (staff/manager)
router.post("/inventory/:id/movement", attachAuth, restrictTo("staff", "manager"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { type, quantity, reason } = req.body;
    const userId = req.authUser!._id.toString();
    const userName = `${req.authUser!.name} ${req.authUser!.surname}`;

    // S-O1/O2/D2/D3 (MP-0.10): hareket girdisi doğrulanır — type whitelist,
    // miktar pozitif sonlu sayı ve makul üst sınır. Daha önce negatif "out"
    // stoğu ARTIRIYOR, string miktar JS birleştirme yapıyordu.
    const movementType = String(type || "");
    if (!["in", "out", "adjustment"].includes(movementType)) {
      return res.status(400).json({ message: "Geçersiz hareket türü (in/out/adjustment)." });
    }
    const qty = Number(quantity);
    if (typeof quantity === "boolean" || !Number.isFinite(qty) || qty <= 0 || qty > 1_000_000) {
      return res.status(400).json({ message: "Miktar 0'dan büyük geçerli bir sayı olmalıdır." });
    }

    const item = await InventoryItemModel.findById(id);
    if (!item) {
      return res.status(404).json({ message: await getSystemText("urun-bulunamadi") });
    }

    const movement = {
      type: movementType,
      quantity: qty,
      reason: reason || "",
      performedBy: userId,
      performedByName: userName,
      timestamp: new Date().toISOString(),
    };

    if (!item.movements) {
      item.movements = [] as any;
    }
    item.movements.push(movement as any);

    // Update current stock
    if (movementType === "in") {
      item.currentStock = Number((item.currentStock + qty).toFixed(3));
    } else if (movementType === "out") {
      item.currentStock = Math.max(0, Number((item.currentStock - qty).toFixed(3)));
    } else if (movementType === "adjustment") {
      item.currentStock = qty;
    }

    if (movementType === "in") {
      item.lastRestocked = movement.timestamp;
    }

    await item.save();

    // S-O4a (MP-0.10): stok hareketi ürün satışa açıklığını değiştirebilir —
    // malzeme geri gelen/tükenen ürünler senkron ile açılır/kapanır.
    try {
      await syncProductStockFlags([item.name]);
    } catch (syncError) {
      console.error("Stock flag sync after movement error:", syncError);
    }

    return res.json(serializeDocument(item));
  } catch (error) {
    console.error("Add stock movement error:", error);
    return res.status(500).json({ message: await getSystemText("stok-hareketi-eklenirken-hata-olustu") });
  }
});

// ============================================
// KP LEADERBOARD ENDPOINTS - Puan Liderlik Tablosu
// ============================================

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as string[]).includes(value);
}

router.get("/leaderboard", attachAuth, async (req: AuthRequest, res) => {
  try {
    const periodValue = String(req.query.period || "daily");

    if (!isLeaderboardPeriod(periodValue)) {
      return res.status(400).json({ message: await getSystemText("gecersiz-donem-daily-weekly-veya-monthly-kullanin") });
    }

    const result = await getLeaderboard(periodValue, req.authUser?._id.toString());
    return res.json(result);
  } catch (error) {
    console.error("GET /leaderboard error:", error);
    return res.status(500).json({ message: await getSystemText("liderlik-tablosu-yuklenirken-hata-olustu") });
  }
});

router.get("/leaderboard/status", attachAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const cooldownRemainingMs = getLeaderboardCooldownRemainingMs(user);

    return res.json({
      optedIn: user.leaderboardOptedIn !== false,
      cooldownRemainingMs,
      optedOutAt: user.leaderboardOptedOutAt ? new Date(user.leaderboardOptedOutAt).toISOString() : null,
    });
  } catch (error) {
    console.error("GET /leaderboard/status error:", error);
    return res.status(500).json({ message: await getSystemText("liderlik-durumu-yuklenirken-hata-olustu") });
  }
});

router.post("/leaderboard/opt-out", attachAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;

    user.leaderboardOptedIn = false;
    user.leaderboardOptedOutAt = new Date();
    await user.save();

    return res.json({
      optedIn: false,
      cooldownRemainingMs: LEADERBOARD_OPT_OUT_COOLDOWN_MS,
      optedOutAt: user.leaderboardOptedOutAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /leaderboard/opt-out error:", error);
    return res.status(500).json({ message: await getSystemText("liderlik-tablosundan-cikilirken-hata-olustu") });
  }
});

router.post("/leaderboard/opt-in", attachAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const cooldownRemainingMs = getLeaderboardCooldownRemainingMs(user);

    if (cooldownRemainingMs > 0) {
      return res.status(400).json({
        message:
          await getSystemText("liderlik-tablosundan-ciktiktan-sonra-14-gun-boyunca-tekrar-katilamazsiniz"),
        cooldownRemainingMs,
        optedOutAt: user.leaderboardOptedOutAt ? new Date(user.leaderboardOptedOutAt).toISOString() : null,
      });
    }

    user.leaderboardOptedIn = true;
    user.leaderboardOptedOutAt = null;
    await user.save();

return res.json({ optedIn: true, cooldownRemainingMs: 0 });
  } catch (error) {
    console.error("POST /leaderboard/opt-in error:", error);
    return res.status(500).json({ message: "Liderlik tablosuna katilirken hata olustu." });
  }
});

// ============================================
// SYSTEM TEXTS ENDPOINTS - Dil Yönetimi
// ============================================

router.get("/system-texts", async (_req: AuthRequest, res) => {
  try {
    const overrides = await listSystemTextOverrides();
    return res.json({ overrides: Object.fromEntries(overrides.map((item) => [item.key, item.value])) });
  } catch (error) {
    console.error("GET /system-texts error:", error);
    return res.status(500).json({ message: "Sistem metinleri yuklenirken hata olustu." });
  }
});

router.put("/system-texts/:key", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const key = String(req.params.key || "");

    if (!(key in SYSTEM_TEXTS)) {
      return res.status(404).json({ message: "Sistem metni bulunamadi." });
    }

    const value = sanitizePlainText(String(req.body.value ?? "")).slice(0, 500);

    if (!value.trim()) {
      return res.status(400).json({ message: "Metin bos olamaz." });
    }

    await SystemTextModel.updateOne({ key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
    await invalidateSystemTextCache();

    return res.json({ key, value });
  } catch (error) {
    console.error("PUT /system-texts/:key error:", error);
    return res.status(500).json({ message: "Sistem metni kaydedilirken hata olustu." });
  }
});

router.post("/system-texts/:key/reset", attachAuth, restrictTo("manager"), async (req: AuthRequest, res) => {
  try {
    const key = String(req.params.key || "");

    if (!(key in SYSTEM_TEXTS)) {
      return res.status(404).json({ message: "Sistem metni bulunamadi." });
    }

    await SystemTextModel.deleteOne({ key });
    await invalidateSystemTextCache();

    return res.json({ key, value: SYSTEM_TEXTS[key] });
  } catch (error) {
    console.error("POST /system-texts/:key/reset error:", error);
    return res.status(500).json({ message: "Sistem metni sifirlanirken hata olustu." });
  }
});

export default router;
