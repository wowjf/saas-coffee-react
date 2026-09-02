# CLAUDE.md — Bancho Cafe (Brew & Bloom) Kod Tabanı Rehberi

Bu rehber, Claude Code (ve diğer AI destekli araçlar) ile bu depoda çalışırken doğru bağlamı kurmak için hazırlanmıştır. İnsan geliştiriciler için de geçerli bir mimari özetidir.

---

## Komutlar

```bash
npm run dev          # Geliştirme sunucusu (tsx server.ts) — Vite HMR gömülü, :3000
npm run dev:full     # db:start + dev
npm run db:start     # Taşınabilir yerel MongoDB (.local-mongo/) başlat
npm run db:stop      # Yerel MongoDB'yi durdur
npm run db:clean     # Yerel MongoDB verisini sil (tehlikeli)
npm run lint         # tsc --noEmit — tip kontrolü (lint yok, bu bir alias)
npm test             # vitest run — birim testleri (tek seferlik)
npm run test:watch   # vitest — izleme modu
npm run build        # vite build → dist/
npm run docker:up    # docker compose up -d --build (app + mongodb + nginx)
```

- **Testler Vitest ile** çalışır (`vitest.config.ts`): `src/**/*.{test,spec}.ts` desenini tarar, node ortamı, globals açık.
- **"lint" aslında tip kontrolüdür** (`tsc --noEmit`); ESLint yapılandırması bağımlılıklarda mevcut ama `lint` script'ine bağlı değildir. CI (`.github/workflows/ci.yml`) npm ci → lint → test → build sırasını çalıştırır (Node 20).

## Mimari — Tek Süreçli Tam Yığın

`server.ts` tek giriş noktasıdır ve Express + Vite'ı **tek HTTP sunucusunda** birleştirir:

1. `dotenv.config()` → `JWT_SECRET` yoksa **anında çıkış** (kod 1).
2. `connectDatabase()` → Mongoose ile MongoDB'ye bağlanır (5 sn seçim zaman aşımı).
   - Geliştirme modunda başarısızsa: gömülü `MongoMemoryServer` yedek devreye girer (kalıcı değil, uyarılır).
   - Üretim modunda başarısızsa: **sistem çıkar** — yedek yok.
3. `checkAndSeedInitialData()` + `backfillNotificationEvents()` → ilk veri tohumlama (`autoSeed` servisi, `ENABLE_SEED` ile kontrol edilir; `BOOTSTRAP_ADMIN_*` env'lerinden yönetici hesabı açar).
4. Middleware zinciri (sıra önemlidir):
   - `trust proxy 1` (Nginx arkası gerçek IP)
   - **Helmet** — CSP *report-only* modda (SPA/kamera/QR akışlarını bozmamak için; raporlar temizlenince enforcing'e geçirilecek)
   - **CORS** — `ALLOWED_ORIGINS` (virgülle ayrılmış). Üretimde joker `*` veya boş liste → açılışta çıkış. Kimlik bilgileri kapalı (Bearer header modeli, çerez yok).
   - **express-rate-limit** — `/api/auth` 30 istek/15 dk; genel `/api` 600/15 dk.
   - `express.json({ limit: "10mb" })` (base64 görsel yüklemeleri için)
   - `/uploads` → `express.static(getUploadRoot())` (yönetilen görseller)
5. `/api` → `src/server/routes/api.js` (çekirdek) + içinden `new-features.js` mount edilir.
6. Geliştirme: Vite **middleware mode** (HMR; `DISABLE_HMR=true` ile kapatılır). Üretim: `express.static(dist)` + her şey `index.html`'e düşer (SPA fallback).

### Yol Haritası (route dosyaları)

- **`src/server/routes/api.ts` (~3350 satır)** — çekirdek uç noktalar:
  - Kimlik: `/api/auth/*` (login, register, me, logout, reset-password, session-role)
  - Katalog: `/api/products`, `/api/categories`, `/api/ingredients`
  - Sipariş: `/api/orders`, `/api/orders/:id/status`
  - Masa: `/api/tables`, `/api/table-sessions/*` (join-or-create, pay, poll-status, force-close…)
  - Sadakat: `/api/loyalty/qr`, `/api/loyalty/scan/*`
  - Bildirim/Push: `/api/notifications/*`, `/api/push/*` (VAPID)
  - Yönetim: `/api/users*`, `/api/staff*`, `/api/campaigns*`, `/api/analytics/dashboard`, `/api/uploads/image`, `/api/system/reset`, `/api/health`
- **`src/server/routes/new-features.ts` (~1400 satır)** — yeni modüller, `api.ts` içinden mount edilir:
  - Kuponlar (`/api/coupons*`), rezervasyon (`/api/reservations*`), envanter (`/api/inventory*`), sohbet (`/api/chat/*`), arkadaşlık (`/api/friends*`), hediyeler (`/api/gifts*`), değerlendirme (`/api/reviews*`), liderlik tablosu (`/api/leaderboard*`), garson çağrıları (`/api/waiter-calls*`), abonelikler (`/api/subscriptions*`), sistem metinleri (`/api/system-texts*`)

Yeni bir REST uç noktası eklerken: önce doğru dosyayı seç (çekirdek mi yeni modül mü), sonra `attachAuth`/`attachOptionalAuth` + `restrictTo("role")` zincirini uygula.

### Modeller (`src/server/models/`)

23 Mongoose şeması. Hepsi default export eder. Önemliler:

`User` (rol, sessionRole, sadakat puanları, bakiye), `Order`, `Product`, `Category`, `Ingredient`, `Campaign`, `Coupon`, `Staff`, `Table`, `TableSession` (ortak masa oturumu), `Reservation`, `WaiterCall`, `ChatRoom`, `Friend`, `Gift`, `Review`, `Subscription` (+ `SubscriptionPlanModel` named export), `InventoryItem`, `Notification`, `PushSubscription`, `SystemText` (panelden düzenlenebilir metinler), `ChangeLog`, `BalanceTopUp`.

Şemaları değiştirirken migration yok — autoSeed yalnızca eksik belge oluşturur, mevcut alanları güncellemez. Alan eklerken eski belgelerde `undefined` kalacağını hesaba kat.

### Servisler (`src/server/services/`)

| Servis | Sorumluluk |
|---|---|
| `autoSeed.ts` | İlk açılış veri tohumlama + yönetici bootstrap + bildirim geri-doldurma |
| `loyalty.ts` | Puan toplama/harcama, sadakat QR token üretimi/doğrulaması, kampanya ödülü uygulama |
| `coupon.ts` | Kupon doğrulama/kullanma (testli) |
| `pushNotification.ts` | Web Push gönderimi (kullanıcıya/siparişe/role/aboneliğe) |
| `storage.ts` | Görsel yükleme: Sharp ile WebP dönüşümü, kapsam bazlı (`ImageScope`) dizin yönetimi |
| `role.ts` | `DEFAULT_MANAGER_EMAILS` ile rol çözümleme |
| `systemTexts.ts` | Panelden düzenlenebilir sistem metinleri (DB'den okur) |
| `leaderboard.ts` | Sadakat liderlik tablosu hesapları |

### Middleware

`src/server/middleware/auth.ts`:
- `attachAuth` — Bearer JWT doğrular, `req.authUser` + `req.authRole` ekler.
- `attachOptionalAuth` — token varsa ekler, yoksa geçer.
- `restrictTo(...roles)` — rol kısıtı.
- `getEffectiveRole` mantığı: `manager` hesapları `sessionRole` ile staff/customer'a inebilir; `staff` hesabı yalnızca sessionRole eşleşirse yetkili, aksi halde customer muamelesi görür. **Rol değişikliği davranışını bozmayın** — panel görünümleri bu mantığa dayanır.

### Frontend

- `src/main.tsx` → `App.tsx`: rol/oturum durumuna göre `CustomerPanel` / `StaffPanel` / `ManagerPanel`'den birini render eder; `BottomNav` ile rol değiştirme, `TableSessionView` ile QR masa akışı.
- `AppContext.tsx` — global durum: auth, tema (koyu/açık), dil, bildirimler.
- `src/lib/api.ts` — `fetch` sarmalayıcı; `ApiRequestError`; token'ı `Authorization: Bearer` başlığından ekler.
- `src/lib/i18n.ts` — 7 dil (tr, en, de, fr, es, it, ru) + para birimleri (`SUPPORTED_LANGUAGES`, `SUPPORTED_CURRENCIES`).
- `src/shared/system-texts.ts` — DB'denoverride edilebilen varsayılan arayüz metinleri (`SystemTextsProvider` ile sağlanır).
- Paneller **çok büyüktür** (`ManagerPanel.tsx` ~6300, `CustomerPanel.tsx` ~4600 satır) — büyük yeniden düzenleme yapmadan önce ilgili bölümü okuyun; bileşenler tek dosyada iç içe tanımlıdır.

### Ortam / Konfigürasyon

- `src/server/config/vapid.ts` — VAPID anahtarları: env > `.vapid-keys.json` > otomatik üret (dosyaya yaz).
- Zorunlu env'ler ve anlamları için `.env.example` ve README'deki tabloya bakın.
- Docker Compose: `app` (healthcheck `/api/health`) + `mongodb` (mongo:7, healthcheck'li) + `nginx` (80/443, ACME yolu, TLS). SSL sertifikaları repoya girmez (`nginx/ssl/live/` gitignore).

## Kritik Konvansiyonlar

1. **ESM her yerde** — `package.json` `"type": "module"`; importlarda `.js` uzantısı TS dosyalarından yapılırken korunur (`./routes/api.js` gibi). Yeni dosyalar da bu desene uymalı.
2. **Türkçe kullanıcıya dönük metinler** — API hata mesajları ve arayüz metinleri Türkçe'dir (ya da `systemTexts` üzerinden DB'den gelir). Yeni kullanıcıya görünür metinlerde mevcut dili koruyun; doğrudan string gömmek yerine mümkünse `system-texts` mekanizmasını kullanın.
3. **Kimlik doğrulama çerez değil Bearer'dır** — `credentials: false`; CSRF koruması bu modele göre tasarlanmıştır. Çok oturumlu davranış (sessionRole) yönetici test akışlarının temelidir.
4. **Üretim güvenlik kapıları açılışta çalışır** — `JWT_SECRET` yok / üretimde `ALLOWED_ORIGINS` joker ya da boş / üretimde Mongo erişilemez → `process.exit(1)`. Bu kasıtlı davranıştır, "düzeltmeyin".
5. **CSP report-only'dir** — `server.ts` içindeki Helmet yapılandırması bilinçli olarak gözlem modundadır; enforcing'e geçiş ayrı bir iş olarak takip edilmeli.
6. **Görseller WebP'ye dönüştürülür** — yükleme `multer` (bellek, 8 MB, yalnız `image/*`) + `storage.ts`/Sharp akışı ile işler; `/uploads` kökü `getUploadRoot()` üzerinden belirlenir.
7. **Tarih serileştirme** — API yanıtlarında `toIsoString` ile ISO string'e çevrilir (`serializeDocument` yardımcıları `src/server/utils.ts`). Yeni uç noktalarda aynı kalıbı izleyin.
8. **Sürüm sabitleme** — bağımlılıklar LTS planına göre yönetilir (bkz. `docs/LTS-YOL-HARITASI.md`); Express 4 → 5 geçişi gibi büyük sürüm atlamaları planlı yapılmalı.

## Test Yazma Kalıbı

- Vitest + globals: `describe/it/expect` import gerekmez.
- İyi örnekler: `src/server/services/coupon.test.ts` (servis mantığı), `src/lib/campaignSchedule.test.ts` (saf fonksiyonlar), `src/server/utils.test.ts`.
- DB gerektiren testlerde `mongodb-memory-server` devDependency olarak mevcuttur (uygulamanın kendi yedek mekanizmasıyla aynı paket).
- CI'da test çalışmadan önce derleme yapılmaz; testler TS olarak doğrudan vitest ile koşar.

## Sık Yapılan İşler

- **Yeni REST uç noktası**: doğru route dosyası → auth middleware → model/serializer → (gerekirse) panel bileşeninde `api.ts` istemcisi güncelle.
- **Yeni model**: `src/server/models/` altında şema; `autoSeed`/seed betiklerini ve `types.ts`'yi kontrol et.
- **Yeni arayüz metni**: mümkünse `system-texts` anahtarı ekle (varsayılan `src/shared/system-texts.ts`, panelden override edilebilir).
- **Yeni betik**: `scripts/` altına; One-shot `.mjs`/`.mts` olarak, `.env` okuyan betikler `dotenv/config` ile başlamalı.
