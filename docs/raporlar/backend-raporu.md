# Bancho Cafe — Backend Kalite Denetim Raporu

**Tarih:** 02.09.2026 · **Kapsam:** `src/server/**`, `server.ts`, `src/AppContext.tsx` (realtime analizi için) · **Kod değişikliği yapılmamıştır** — yalnızca analiz ve refactor planı.

---

## 0. Yönetici Özeti

Proje tek process Express 4 + Mongoose + Vite SPA mimarisinde; 23 model, 128 endpoint ve 2 devasa route dosyasından (`api.ts` 3347 satır / `new-features.ts` 1406 satır) oluşuyor. Fonksiyonel olarak zengin ve çalışır durumda (`tsc --noEmit` temiz, 20/20 test geçiyor), ancak **üretim kararlılığı açısından 2 adet P0 risk** taşıyor:

1. **Express 4'te try/catch'siz async handler'lar**: `api.ts` içindeki **40 handler'ın 35'i** try/catch içeriyor ama kalan 40 handler (satır listesi §2.1'de) hiç içermiyor. Express 4 rejected promise'leri yakalamaz; Node 15+ varsayılanında **unhandled rejection = process crash**. `POST /orders` içinde bilinen bir `throw new Error("bazi-urunler-stokta-degil")` yolu zaten mevcut — stok dışı ürün içeren bir sipariş denemesi **sunucuyu düşürebilir**.
2. **Polling, rate limit'i yiyor**: `/api` genel limiti 600 istek/15 dk. Giriş yapmış istemci bootstrap'ı 5 sn'de bir, masa modunda table-session'ı 3 sn'de bir, personel paneli masaları 8 sn'de bir çekiyor → tek istemci ~590 istek/15 dk üretir; masa modundaki bir kullanıcı **~10 dakika içinde 429 almaya başlar** ve uygulama "donuk" görünür.

Bunların dışında en büyük yapısal borç: business logic'in route dosyalarında gömülü olması, merkezi error handler'ın olmayışı ve 128 endpoint'in tamamının tek mount noktasına bağlı olması. Aşağıda somut, adım adım ve önceliklendirilmiş (P0→P3) bir plan sunuluyor.

**Öncelik dağılımı:** P0: 4 · P1: 7 · P2: 9 · P3: 5

---

## 1. Route Yapısı ve Modüler Router Bölme Planı

### 1.1 Mevcut durum

| Dosya | Satır | Endpoint | Sorun |
|---|---|---|---|
| `src/server/routes/api.ts` | 3347 | 75 | Tek dosya; auth, sipariş, ödeme, masa, katalog, personel hepsi iç içe |
| `src/server/routes/new-features.ts` | 1406 | 53 | "Yeni özellikler" adında anlamsız gruplama; 11 farklı domain |
| **Toplam** | **4753** | **128** | |

Ek koku: `new-features.ts`, `api.ts`'in **en altında** (satır 3343-3345) `import` + `router.use(newFeaturesRouter)` ile mount ediliyor — import'lar dosyanın başında değil, altında. Ayrıca ~150 satırlık yardımcı fonksiyon (`serializeUser`, `serializeTableSession`, `buildBootstrapPayload`, `createCustomerOrderNotification` vb.) route tanımlarıyla karışmış durumda.

`api.ts` 38 import içeriyor; 23 modelin tamamına doğrudan erişiyor — dosya fiilen tüm backend'in tek noktası.

### 1.2 Hedef dosya yapısı (domain bazlı)

```
src/server/routes/
  index.ts                 # router birleştirici (tek mount noktası, değişiklik minimal)
  auth.routes.ts           # 6 endpoint
  users.routes.ts          # 14 endpoint (profil, follow, arama, yönetim)
  catalog.routes.ts        # products(4) + categories(4) + ingredients(4) = 12
  campaigns.routes.ts      # 7 endpoint (select/deselect dahil)
  orders.routes.ts         # 4 endpoint
  loyalty.routes.ts        # 3 endpoint (qr, scan/resolve, scan/redeem)
  table-sessions.routes.ts # 10 endpoint (tables + table-sessions)
  staff.routes.ts          # 4 endpoint
  notifications.routes.ts  # 5 endpoint
  push.routes.ts           # 4 endpoint
  analytics.routes.ts      # 2 endpoint (dashboard + bootstrap ayrık; bkz §5)
  logs.routes.ts           # 2 endpoint
  system.routes.ts         # 2 endpoint (reset, uploads/image buraya da alınabilir)
  reviews.routes.ts        # 4
  coupons.routes.ts        # 6
  friends.routes.ts        # 5
  gifts.routes.ts          # 4
  subscriptions.routes.ts  # 6
  chat.routes.ts           # 4
  reservations.routes.ts   # 4
  waiter-calls.routes.ts   # 5
  inventory.routes.ts      # 6
  leaderboard.routes.ts    # 4
  system-texts.routes.ts   # 3
src/server/serializers/    # serializeUser/Order/Notification/... (api.ts'ten çıkarılır)
src/server/controllers/    # her domain için controller (ince HTTP katmanı)
src/server/services/       # business logic (bkz §4)
```

`routes/index.ts` yalnızca şunu yapar (`server.ts`'teki `app.use("/api", apiRoutes)` tek satır değişir):

```ts
import { Router } from "express";
import auth from "./auth.routes";
// ... diğerleri
const router = Router();
router.use(auth, users, catalog, /* ... */);
export default router;
```

### 1.3 Göçüm (migration) stratejisi — sıralı, her adım bağımsız deploy edilebilir

1. **Adım 1 (hazırlık):** `api.ts` başındaki yardımcı fonksiyonları `src/server/serializers/` ve `src/server/services/` altına taşı (route davranışı değişmez; `tsc` rehber olur).
2. **Adım 2 (kolay gruplar):** `new-features.ts`'i 11 parçaya böl — bu dosyadaki handler'lar zaten domene göre sıralı ve birbirinden bağımsız; en düşük riskli başlangıç noktası.
3. **Adım 3:** `api.ts`'ten en az bağımlı domainleri sırayla çıkar: `push` → `logs` → `notifications` → `catalog` → `staff`.
4. **Adım 4:** Karmaşık iş mantığı içerenleri servis çıkarma ile birlikte taşı: `orders` → `table-sessions` → `users/balance` → `auth` (bkz §4 sıralaması).
5. **Her adımda:** `npm run lint && npm test` + `/api/health` smoke test. Endpoint yolları birebir korunur (istemci sıfır değişiklik).
6. **Adım 5:** Alt satırdaki `router.use(newFeaturesRouter)` hack'i tamamen kalkar; `routes/index.ts` tek birleştirici olur.

**Tahmini efor:** Adım 2-3 mekanik (~0.5 gün), Adım 4 servis çıkarma gerektirir (~2-3 gün). Toplam ~4 iş günü, tek seferde değil PR PR yapılabilir.

---

## 2. Hata Yönetimi

### 2.1 Tespitler

**a) try/catch'siz async handler'lar (P0 — crash riski).** `api.ts`'te 40 handler'da try/catch yok (new-features.ts'te ise 53/53 var — bilinçli olmayan tutarsızlık). En risklileri:

- `POST /orders` (satır 2085) — içindeki `normalizedItems.map` doğrudan `throw new Error(...)` yapıyor ve handler try/catch'siz → **unhandled rejection**.
- `PATCH /orders/:id/status` (2190), `POST /users/me/balance` (1258), `POST /auth/logout` (730), `POST /auth/session-role` (739), `GET /bootstrap` (583), `POST /table-sessions/*` grubunun bir kısmı, tüm `GET` listeleme handler'ları (`/users`, `/products`, `/campaigns`...). Tam liste analiz sırasında çıkarıldı (40 kayıt).

Express **4.21** kullanılıyor; Express 5'in "rejected promise → error middleware" davranışı yok. Node 15+ üzerinde yakalanmayan rejection process'i sonlandırır.

**b) Hata response formatı tutarsızlığı (P1).** 300+ hata response'u incelendiğinde:
- Standart şekil `res.status(X).json({ message })` — api.ts: 400×77, 500×31, 404×30, 401×28, 409×14, 403×10.
- **Tek istisna:** `POST /auth/login` `code: "INVALID_CREDENTIALS"` alanı ekliyor (satır 711) — istemcinin machine-readable hata kodu diye başvurabildiği tek yer. Diğer hiçbir endpoint hata kodu döndürmüyor.
- `getSystemText()` çağrısı api.ts'te **175**, new-features.ts'te **105** kez geçiyor — her catch bloğu DB'ye/önbelleğe bağımlı bir `await` daha yapıyor; system-texts önbelleği boşken hata path'i ekstra gecikme üretiyor.
- `console.error` 84 noktada; structured logging / request-id yok.

**c) Merkezi error handler yok (P1).** `server.ts`'te `app.use(errorHandler)` yok. Tüm hata yönetimi handler başına elle kopyalanmış durumda.

### 2.2 Öneri: merkezi error handler + ApiError sınıfı

```ts
// src/server/errors.ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,            // makine okunur: "INSUFFICIENT_BALANCE"
    message: string,
  ) { super(message); }
  static badRequest(code: string, msg: string) { return new ApiError(400, code, msg); }
  // ...401/403/404/409/500
}

// src/server/middleware/errorHandler.ts
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err instanceof ApiError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }
  if (err instanceof mongoose.Error.ValidationError) { /* 400, alan detayları */ }
  if (err instanceof mongoose.Error.CastError) { /* 400 "geçersiz id" */ }
  if (err?.name === "MulterError") { /* 400 */ }
  if (err?.code === 11000) { /* 409 duplicate */ }
  console.error(`[${req.method}] ${req.originalUrl}`, err);   // + requestId (P3)
  return res.status(500).json({ code: "INTERNAL", message: "Sunucu hatası oluştu." });
}

// src/server/middleware/asyncHandler.ts  — Express 4 için kritik
export const asyncHandler = (fn: RequestHandler) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

`server.ts`'te route mount'undan **hemen sonra** eklenir. Migration pragmatik yapılır: mevcut try/catch'ler anında sökülmez; yeni/yeniden taşınan handler'larda `asyncHandler` + `next(err)` kullanılır, eski catch blokları zamanla temizlenir. ÖNEMLİ kazanç: try/catch'siz 40 handler `asyncHandler`'a sarıldığı an crash riski ortadan kalkar — **bu tek başına P0'ın çözümüdür ve ~1 saatlik değişikliktir** (her handler'ı tek tek düzeltmeye gerek yok, `router.get(path, asyncHandler(handler))` veya router seviyesinde wrapper yeterli).

İstemci tarafı uyumu: `code` alanı **eklenir**, `message` korunur → mevcut frontend kırılmaz; login'deki mevcut `code` kullanımı genelleşir.

---

## 3. Mongoose Modelleri (23 model)

### 3.1 İyi durumda olanlar
- Tüm modellerde `timestamps: true` **tutarlı şekilde var** ✅ (23/23).
- Birkaç modelde bilinçli compound index yazılmış: `TableSession` (unique partial `{tableNumber,status:"open"}` — güzel bir desen), `ChatRoom`, `Friend` (unique compound), `Reservation`, `Review`, `WaiterCall`, `InventoryItem` ✅.
- `User.pre("save")` ile bcrypt hash, `comparePassword` metodu ✅.
- `PushSubscription.endpoint` unique ✅; `storage.ts`'in path-traversal koruması (`path.resolve` + `startsWith(UPLOAD_ROOT)`) ✅.

### 3.2 Bulgular

**a) Timestamp tutarsızlığı (P1).** Mongoose `timestamps`'in yanında ikinci bir tarih kaydı tutuluyor ve tipler karışık:
- `WaiterCall.createdAt: String, required` (model dosyasında) — hem Mongoose'un otomatik `createdAt` ile çakışıyor hem ISO string.
- `Order.timestamp` (Date) ↔ `createdAt` ikilemesi; tüm sıralama/analytics `timestamp` üzerinden.
- `Reservation.confirmedAt/cancelledAt` String, `Subscription.startDate/endDate` String, `Coupon.validFrom/validUntil` String, `Campaign.startDate/expiryDate/startTime/endTime` String, `InventoryItem` hareket `timestamp` String, `TableSession` alt-şemalarındaki `redeemedAt/expiresAt` (User.activePointReward) String.
- Sonuç: TR saat dilimi dönüşümleri (`getTurkeyDateTimeIso`) her yerde elle tekrarlanıyor; `new Date(str)` geçersiz değerlerde `Invalid Date` döndürüp sessizce bozuk kayıt yaratabiliyor.

Öneri: "display zamanı gerekmiyorsa Date sakla, serialize'da ISO string'e çevir" ilkesi. `String` kalan alanlar için `match: /^\d{4}-\d{2}-\d{2}/` veya `required`+trim validator. Bu kırıcı bir şema değişikliği olduğundan veri migration'ı isteyebilir → **P1, kendi başına bir release**.

**b) Eksik/fazla indexler (P2).**
- `Order` — leaderboard aggregation'ı `{userId, status:"completed", loyaltyPointsAwarded:{$gt:0}, timestamp:{$gte..}}` ile tarıyor; `{userId:1, status:1, timestamp:-1}` compound yok (mevcut tekil indexler birleşmiyor). Ayrıca analytics `$unwind items.product.id` tam collection scan.
- `Notification` — ana sorgu `$or:[{userId},{targetRole}] + event{$in}`; `(userId,event)` ve `(targetRole,event)` compound indexleri yok. 5 sn'lik polling ile birleşince (§5) en çok okunan koleksiyon bu.
- `Product.category` index yok (menü filtreleme `ProductModel.find()` + `sort({name:1})` her bootstrap'ta).
- `Campaign.active`/`category` index yok (`getActivePointRewardCampaigns` her loyalty summary'de taranıyor).
- `Review.orderId` unique **değil** — bir siparişen birden çok yorum eklenebiliyor (route kontrolü varsa da DB garanti etmiyor → partial unique index önerilir).
- `User.email` hem `unique` hem ayrı `index: true` → aynı alan için çift index tanımı (zararsız ama gürültü).

**c) Schema validasyon boşlukları (P2).**
- `Product.price` `min: 0` yok (negatif fiyat kaydı engellenmiyor; `POST /products` route'ta da kontrol görülmedi).
- `Order.total`, `User.balance`/`points`, `BalanceTopUp.amount` için alt sınır yok.
- `Campaign.category`/`type` serbest string — `enum` tanımsız; `"stamp_card"`, `"points_free_product"` gibi değerler kod tarafında string literal olarak dolaşıyor (`POINT_REWARD_CAMPAIGN_TYPES` lib'de). Yanlış yazım sessizce "kampanya hiçbir kurala uymaz" durumuna düşüyor.
- `Coupon.value` `min` yok; `percentage` tipi için 0-100 aralığı DB'de garanti değil (servis `calculateCouponDiscount` bunu kısmen telafi ediyor ✅).
- `User.phone` format validasyonu yok (route'ta da sadece trim).

**d) Document-içi sınırsız diziler (P2).** `User.followers`, `User.following`, `User.friends`, `Coupon.usedBy` — kullanıcı bazında sınırsız büyür; her profil okumasında tüm dizi taşınır, `POST /users/:id/follow` read-modify-write ile `save()` yapıyor (lost-update yarışı: iki eşzamanlı follow birbirini ezebilir). Özellikle `Friend` modeli zaten ayrı bir koleksiyon olarak dururken `User.friends` dizisi **ikili muhafazadır**. Öneri: follow ilişkisi için mevcut `Friend`-tarzı ayrı koleksiyon (veya `followers`'ın ayrı Edge modeli), `usedBy` için sayaca + ayrı usage koleksiyonuna geçiş; kısa vadede en azından `$addToSet`/`$pull` atomik update kullanımı.

**e) Diğer.** `BalanceTopUp.userEmail` gibi denormalize alanlar kullanıcı e-postası değişince bayatlıyor (P3, kabul edilebilir trade-off ama bilinçli olunmalı). `as any` kullanımı api.ts'te 11, new-features.ts'te 3 — `InferSchemaType` tiplerinin route katmanına taşınmasıyla azalır.

---

## 4. Servis Katmanı Eksikliği — Çıkarma Planı

### 4.1 Mevcut durum
Var olan servisler kaliteli: `loyalty.ts` (464 satır, saf hesap + DB erişim ayrımı iyi), `coupon.ts` (**yan etkisiz saf fonksiyon + birim testli — model alınacak en iyi örnek**), `leaderboard.ts`, `pushNotification.ts`, `role.ts`, `systemTexts.ts` (önbellekli, güzel), `storage.ts`, `autoSeed.ts`.

Ama kritik business logic route gövdesinde:

| Logic | Yer | Satır aralığı (yaklaşık) | Risk |
|---|---|---|---|
| Sipariş oluşturma: stok doğrulama, puan-kampanya indirimi, bakiye atomik düşümü, masa oturumu katılım kontrolü | `api.ts POST /orders` | 2085-2188 | Paralı işlem; race'e açık (bakiye `$gte` guard'ı ✅ ama kampanya `remainingUses` güncellemesi `user.save()` ile non-atomik) |
| Durum geçiş makinesi + iade + puan kazandırma | `PATCH /orders/:id/status` | 2190-2257 | Geçiş kuralları (`validTransitions`) kod içinde literal; iade `user.save()` race'li |
| Masa oturumu kur/katıl/onayla/ayrıl | `/table-sessions/*` | 2589-3190+ | ~170 satır tek handler; dedupe mantığı elle yazılmış |
| Hesap ödeme (self/split/all) | `POST /table-sessions/pay` | 3038-3186 | ~155 satır; split hesabı, oturum kapatma, BalanceTopUp kaydı — en karmaşık para akışı, **test dışı** |
| Bakiye yükleme + kayıt | `/users/me/balance`, `/users/:id/balance` | 1258-1329 | İki handler'da kopyalanmış (DRY ihlali) |
| Bildirim üretimi + push dispatch | `createCustomerOrderNotification`, `createStaffOrderNotification` | 325-394 | api.ts'te gömülü fonksiyon — servis olmalı |
| Bootstrap agregasyonu | `buildBootstrapPayload` | 419-493 | Rol bazlı dev sorgu paketi (§5 ile bağlantılı) |

### 4.2 Çıkarma planı (sıra önemlidir — para akışından başla)

1. **`services/order.ts`** — `createOrder(user, payload)`, `transitionOrder(orderId, to, actor)` (geçiş tablosu ve iade dahil), `refundOrder()`. Status geçiş tablosu `OrderStatusMachine` olarak export edilir → birim test edilir (saf fonksiyon!). 
2. **`services/payment.ts` (bakiye)** — `creditBalance`, `debitBalance` (atomik `findOneAndUpdate $gte` guard), `recordBalanceTopUp`. Mevcut iki kopya handler tek servise bağlanır.
3. **`services/tableSession.ts`** — join-or-create / approve / leave / pay(split dahil) fonksiyonları; `payTableSession` saf hesap kısmı (`computePaymentAmount`) ayrıştırılıp test edilir.
4. **`services/notification.ts`** — mevcut iki `create*Notification` fonksiyonu + `getNotificationQueryForUser` buraya taşınır; event sabitleri (`order_preparing`...) `constants.ts`'e.
5. **`services/bootstrap.ts`** — `buildBootstrapPayload` (§5'teki bölme ile birlikte).
6. Controller'lar (§1.2) yalnızca: auth doğrula → servisi çağır → serialize → `res.json`; hata `next(err)`.

Her servisin saf hesap kısımları (indirim, split, puan, geçiş geçerliliği) yan etkisiz ayrılır → §7'deki test planının girdisi olur. **Efor: ~3-4 iş günü**, ama §1'deki router bölünmesiyle aynı PR'lerde yürütülebilir.

---

## 5. Realtime: Polling → SSE/WebSocket Geçiş Planı

### 5.1 Mevcut polling envanteri (istemci)

| Kaynak | Sıklık | Endpoint | Maliyet |
|---|---|---|---|
| `AppContext.tsx:235` | **5 sn** (giriş yapmış her sekme) | `GET /bootstrap` | Rol bazlı 3-8 DB sorgusu; **manager için** tüm `users` + tüm `balanceTopUps` + son 100 log her seferinde |
| `AppContext.tsx:748` | **3 sn** (masa modu) | `GET /table-sessions/session/:token` | Oturum + siparişler |
| `TableSessionView.tsx:82` | **2 sn** (onay beklerken) | `GET /table-sessions/poll-status` | Masa sorgusu |
| `StaffPanel.tsx:145` | 8 sn | `GET /tables` | Tüm masalar + oturumları |
| `CustomerPanel.tsx:756` | 120 sn | `GET /loyalty/qr` | Ucuz |

### 5.2 30-50 eşzamanlı kullanıcı için yeterli mi?

**Kısa cevap: sınırlı ölçüde çalışır ama iki gerçek sınır var ve biri bugün bile tetikleniyor.**

1. **Rate limit çakışması (bug):** `/api` genel limiti 600/15 dk (server.ts:184-190). Masa modundaki tek istemci: 180 (bootstrap) + 300 (session) + belki 112 (staff tables) = **~590 istek/15 dk** → limite dayanır; ikinci sekme, hızlı sayfa geçişi veya staff paneliyle birlikte **429 almaya başlar** ve `refreshBootstrap` catch'inde sessizce loglanıp uygulama bayatlar. Bu, kullanıcı sayısından bağımsız olarak **tek kullanıcıda dahi** yaşanabilir.
2. **Verimlilik:** 50 kullanıcı × 12 istek/dk = 600 req/dk; bunun ~%90'ı değişen bir şey olmadan dönüyor. Manager hesabı açıkken her 5 sn'de `UserModel.find()` (tüm koleksiyon, pagination yok) + `BalanceTopUpModel.find()` (tümü) çalışıyor → kullanıcı sayısı büyüdükçe **istek başına maliyet de** büyüyor (O(n×m)). Mongo için henüz trajik değil ama node CPU (JSON serialize) ve GC baskısı ilk darboğaz olur; 50 eşzamanlıda tek process + tek core'da gecikme artışı hissedilir.

Sonuç: 30-50 kullanıcıda "çalışır ama kırılgan"; rate-limit bug'ı ve manager bootstrap maliyeti **bugün** düzeltilmeli (aşağıda 1. adım), SSE geçişi **planlanmalı**.

### 5.3 Önerilen yol: iki adımlı geçiş

**Adım 1 (hemen, SSE'siz) — darboğazları kes:**
- `/bootstrap`'ı böl: statik katalog (products/campaigns/categories) `GET /catalog` + `Cache-Control: private, max-age=30` (ya da ETag); dinamik durum `GET /me/state` (kullanıcı + siparişler + bildirimler). Polling aralığını kullandığınız verilere göre 15-30 sn'ye çıkar (mutasyon sonrası zaten `syncAfterMutation` ile anında refresh var — bu desen güzel ve korunmalı).
- Manager bootstrap'ından `users` ve `balanceTopUps`'ı çıkar → ayrı paginated endpoint (`GET /users?page=`, `GET /balance-top-ups?page=`).
- Rate limit'i polling dostu yap: bootstrap/state endpoint'lerini ayrı limit grubuna al (ör. 3000/15 dk) ya da limit'i genel 600→kullanıcı başına ağırlıklı hale getir.
- `GET /bootstrap` yanıtına `ETag` ekle → 304 ile bandwidth'i düşür.

**Adım 2 (SSE tabanlı realtime):** WebSocket yerine **SSE** önerilir — gerekçe: tek process/tek node dağıtım (docker-compose, nginx), yalnızca sunucudan istemciye push ihtiyacı (sipariş durumu, bildirim, masa oturumu değişikliği), mevcut Bearer-token auth HTTP katmanında aynen çalışır, otomatik reconnect EventSource'ta gömülü, mobil tarayıcı desteği günümüzde yeterli. Socket.io gerekirse chat yazması/görmesi için sonra eklenir.

```
GET /api/events  (attachAuth, SSE)
  event: order.updated    data: {orderId, status, ...}
  event: notification.new data: {...}
  event: table-session.updated data: {sessionToken, ...}
```

Sunucu tarafı: mevcut `createCustomerOrderNotification` / `createStaffOrderNotification` / status-transition noktalarına bir `EventBus.publish(userId | role | sessionToken, event)` çağrısı eklenir (§4.4'teki `services/notification.ts` ile aynı yer). Heartbeat 25 sn'de bir `: ping` (proxy timeout'una karşı). nginx: `proxy_buffering off` + `X-Accel-Buffering: no` + `proxy_read_timeout 5m`. İstemci: `EventSource` → ilgili context state'ini güncelle; `refreshBootstrap` yalnızca manuel/mutasyon sonrası kalır. Chat (`ChatRoom`) bir sonraki aday; waiter-call + garaj ekranı üçüncü.

**Efor:** Adım 1 ~1 gün; Adım 2 ~2-3 gün (event bus + 3 event tipi + istemci geçişi).

---

## 6. autoSeed ve Storage İncelemesi

### 6.1 `services/autoSeed.ts` (162 satır)
- `checkAndSeedInitialData()` her boot'ta `ProductModel.countDocuments()` ile boş DB kontrolü yapıp katalog + 10 masa + admin kullanıcı oluşturuyor — idempotent, hata durumunda yalnızca loglayıp boot'u kesmiyor ✅ mantıklı.
- **`BOOTSTRAP_ADMIN_PASSWORD` varsayılanı `"Admin123!"` (satır 150) — P1 güvenlik.** Ortam değişkeni yoksa zayıf bilinen şifreyle manager hesabı açılıyor; prod'da zorunlu kılınmalı (yoksa `process.exit(1)`, JWT_SECRET örneğindeki gibi). E-posta varsayılanı `admin@bancho.cafe` de env ile zorunlulaştırılmalı.
- `backfillNotificationEvents()` her boot'ta `countDocuments` ile ucuz erken çıkış ✅; migration-framework ihtiyacını şimdilik karşılıyor (P3: uzun vadede basit bir version-based migration listesi).
- Seed görselleri `seed:` şemasıyla rastgele isimle kopyalanıyor → her re-seed'te uploads'ta kopya birikebilir; yalnızca `/system/reset` temizliyor (P3).

### 6.2 `services/storage.ts` (143 satır)
- Genellikle **iyi durumda**: sharp ile 1600px/`withoutEnlargement`/webp q82, scope bazlı dizinler, `normalizeManagedImagePath` ile URL→path normalizasyonu, `path.resolve + startsWith(UPLOAD_ROOT)` ile **path traversal koruması** ✅, multer 8 MB + mimetype filtresi (api.ts) ✅.
- `/uploads` static servisinde **cache header yok** (P3): `express.static(..., { maxAge: "30d", immutable: true })` — dosya adları zaman damgalı+rastgele olduğundan güvenle cache'lenebilir; bootstrap polling'iyle birleşen görsel trafiğini ciddi azaltır.
- `clearManagedUploads` tüm dizin tarama + exclude listesi; `/system/reset` manager-only ✅. Hataları sessizce yutuyor (`catch {} // ignore`) — kabul edilebilir ama en azından `console.warn` iyi olur (P3).
- `DELETE` akışlarında (`deleteProduct` vb.) eski görsel `deleteManagedImage` ile siliniyor ✅ (route'ta doğrulandı) — orphan birikmiyor.

---

## 7. Test Kapsamı

### 7.1 Mevcut durum
3 dosya / **20 test**, tamamı saf fonksiyonlar: `campaignSchedule` (5), `coupon.calculateCouponDiscount` (7), `utils` (8). `vitest` + **`mongodb-memory-server` devDependencies'te kurulu ama hiç kullanılmıyor** — integration test altyapısı fiilen hazır, sıfır ek maliyetle kullanılabilir. CI pipeline yok (`.github/workflows` yok); `lint` = `tsc --noEmit`.

### 7.2 Test dışı kalan kritik modüller (risk sırasıyla)

1. **`POST /orders` + bakiye düşümü** — para; atomik guard'ın (`balance: {$gte: total}`) gerçekten race'i önlediği yalnızca test ile gösterilebilir.
2. **`applyCompletedOrderLoyalty` / `redeemPointCampaign` / `applyActivePointRewardToOrder`** (loyalty.ts, 464 satır) — puan/indirim matematiği; `redeemPointCampaign` içinde çok sayıda business kural (yetersiz puan, aktif ödül çakışması, stok, hedef ürün zorunluluğu) test dışı. `getPointsForCompletedItemCount` lib'i saf ve ideal ilk aday.
3. **`PATCH /orders/:id/status` durum makinesi** — geçiş tablosu + iade + `loyaltyProcessed` tek seferliklik garantisi.
4. **Auth akışı** — register validasyonları, login (kullanıcı sayımına karşı genel yanıt ✅), JWT/sessionRole geçişleri, `restrictTo`/`getEffectiveRole` (manager→staff downgrade mantığı ince).
5. **`POST /table-sessions/pay`** — self/split/all hesabı; split'te kuruş yuvarlaması ve `remainingBill` clamp'i.
6. **`services/storage`** — path traversal koruması regresyonu için 3-4 vakalık hızlı test.
7. **`autoSeed` idempotency'si**, **`auth` middleware**, **coupon route validasyonları** (servis testli, route değil: minOrderAmount, kullanım limiti, newUsersOnly).

### 7.3 Plan (P1 — para ve puan akışları öncelikli)
- **Faz 1 (soyut testler, DB yok):** durum geçiş tablosu, split/ödeme hesabı, puan formülü, `getEffectiveRole` — §4 servis çıkarma çalışmasıyla birleşir (çıkarılan saf fonksiyonlar doğrudan test edilir).
- **Faz 2 (integration, mongodb-memory-server):** `helpers/testApp.ts` — express app'i vitest içinde ayağa kaldırır (server.ts'ten `listen` ayırman gerekebilir; app export'u refactor önerisi P2'ye ekler). Sipariş oluştur→tamamla→puan; sipariş reddet→iade; bakiye yetersiz→409; coupon kullan→limit dolması.
- **Faz 3:** auth rol matrisi (customer/staff/manager × endpoint örneklemi), storage güvenlik.
- **Faz 4 (P3):** GitHub Actions: `npm run lint && npm test` + coverage eşiği (istanbul/vitest coverage provider aktif edilmeli; şu an vitest.config'te coverage ayarı yok).

---

## 8. Önceliklendirilmiş Refactor Planı (P0 → P3)

### P0 — Üretim kararlılığı (bu hafta; her biri ≤ yarım gün)
| # | İş | Dosya | Gerekçe |
|---|---|---|---|
| P0-1 | try/catch'siz 40 async handler'ı `asyncHandler` ile sar (veya Express 5'e geçiş değerlendirilir ama 5'in breaking davranışları nedeniyle wrapper önerilir) | `api.ts` (satır listesi §2.1a) | Express 4 + rejected promise = process crash; `POST /orders` içinde aktif `throw` yolu mevcut |
| P0-2 | Merkezi `errorHandler` + `ApiError` ekle (`app.use` route'lardan sonra) | yeni `middleware/errorHandler.ts`, `server.ts` | Tek tutarlı format; Mongoose/Multer/11000 eşlemesi tek yerde |
| P0-3 | Polling/rate-limit çakışmasını çöz: bootstrap bölme + limit grupları (§5.3 Adım 1) | `AppContext.tsx`, `server.ts`, `api.ts` | Tek kullanıcıda bile 429 → "uygulama dondu" algısı |
| P0-4 | `BOOTSTRAP_ADMIN_PASSWORD` varsayılanını kaldır; prod'da zorunlu kıl | `autoSeed.ts:142-150` | Bilinen zayıf şifreyle manager hesabı |

### P1 — Yapısal borç (2-4 hafta içinde, PR'lara bölünmüş)
- **P1-1** `new-features.ts`'i 11 domain router'a böl (§1.2/1.3 Adım 2) — en düşük riskli başlangıç.
- **P1-2** Servis katmanı: sırayla `order` → `payment` → `tableSession` → `notification` (§4.2).
- **P1-3** Faz 1-2 testleri: para/puan akışı + durum makinesi; `mongodb-memory-server` devreye alınır (§7.3).
- **P1-4** Hata response'larına `code` alanı getir (login'deki mevcut deseni genelleştir), catch'lerdeki `await getSystemText` çağrılarını error handler'a topla.
- **P1-5** Timestamp şema standardı: String tarih alanları için validator; yeni alanlarda Date zorunlu (§3.2a — veri migration gerektirebilir).
- **P1-6** SSE altyapısı: `GET /api/events` + event bus + order/notification/table-session eventleri (§5.3 Adım 2); sonra polling aralıklarını düşür/kaldır.
- **P1-7** `api.ts`'in kalan domainlerine bölme + alt-satır `router.use(newFeaturesRouter)` hack'inin kaldırılması (§1.3 Adım 3-5).

### P2 — Verimlilik ve veri modeli (1-2 ay)
- **P2-1** Eksik indexler: `Order {userId,status,timestamp}`, `Notification {userId,event}` + `{targetRole,event}`, `Product.category`, `Campaign.active/category` (§3.2b).
- **P2-2** Manager bootstrap/listelerde pagination (`GET /users`, balanceTopUps, logs) (§5.2).
- **P2-3** Şema validasyonları: `min:0` fiyatlar/tutarlar, `Campaign.type/category` enum, `Review.orderId` partial-unique (§3.2c).
- **P2-4** `User.followers/following/friends` dizilerinden ayrı koleksiyona geçiş; follow'da atomik `$addToSet` (§3.2d).
- **P2-5** Order iade/kampanya güncellemelerinde `user.save()` yerine atomik update'ler (§4 tablosundaki race notları).
- **P2-6** `GET /bootstrap` ETag/304; `app.ts` export'u test edilebilirlik için `server.ts`'ten ayrılır.
- **P2-7** Leaderboard aggregation'ı compound index ile destekle + (opsiyonel) 60 sn ön bellek.
- **P2-8** `api.ts`'teki 11 `as any`'in tip güvenli hale getirilmesi (serializer tipleriyle).
- **P2-9** Chat için SSE yerine WebSocket ihtiyacının netleştirilip tek realtime kanal stratejisine bağlanması.

### P3 — Cila (backlog)
- **P3-1** `/uploads` static cache header'ları (`maxAge 30d, immutable`).
- **P3-2** CI (GitHub Actions) + coverage eşiği; PR'da zorunlu lint+test.
- **P3-3** Request-id + structured logging (şu an 84 `console.error` noktası).
- **P3-4** Basit migration çerçevesi (boot'ta version listesi; `backfillNotificationEvents` oraya taşınır).
- **P3-5** Seed görsel kopyalarının re-seed'te birikmemesi (deterministik isimlendirme).

### Önerilen yürütme sırası
`P0-1 → P0-2 → P0-4 → P0-3` (hepsi küçük ve bağımsız) → `P1-1 → P1-2(order) → P1-3(Faz1) → P1-2(payment/tableSession) → P1-3(Faz2) → P1-4 → P1-5 → P1-6 → P1-7` → P2 kümesi iştah sırasına göre. Router bölme + servis çıkarma + test yazımı **aynı domain üzerinde birleşik PR'ler** halinde yürütülürse toplam efor ~4 + 4 + 3 ≈ 2-3 haftalık odaklı çalışmaya denk gelir.

---

## 9. Yöntem ve Doğrulanabilirlik Notları
- Tüm satır numaraları `orch-backend-quality` worktree'sindeki `a16cbd3` commit'i üzerinden alınmıştır.
- `npx tsc --noEmit` temiz; `npm test` → 20/20 geçer (rapor sırasında doğrulandı).
- try/catch analizi betikle (handler gövdeleri route-sınırlarına göre taranarak) yapıldı: api.ts 75 handler'dan 40'ı, new-features.ts 53 handler'ın 0'ı try/catch'siz.
- Bu rapor kod değişikliği içermeyen salt analiz çıktısıdır. Görev metninde belirtilen `/home/yusuf/Belgeler/Projeler/orch-backend-quality/backend-raporu.md` yolu bu makinede mevcut olmadığından rapor worktree köküne (`orch-backend-quality/backend-raporu.md`) yazılmıştır.
