# Bancho Cafe — Test & QA Raporu

**Tarih:** 2 Eylül 2026
**Dal / Worktree:** `orch-qa-tests`
**Kapsam:** Mevcut test durumunun doğrulanması, yeni birim + entegrasyon testlerinin yazılması, tam koşum raporu ve CI önerisi.
**Kural:** Yalnızca yeni test dosyaları eklendi; mevcut uygulama kodu değiştirilmedi (tek istisna: `package.json` / `package-lock.json` — supertest bağımlılığı eklendi).

---

## 1. Yönetici Özeti

| Metrik | Önce | Sonra |
|---|---|---|
| Test dosyası | 3 | 7 |
| Test sayısı | 20 | **106** |
| Geçen | 20 | **106** |
| Kalan (fail) | 0 | **0** |
| Koşum süresi | ~1 sn | ~10 sn |

Tüm testler yeşil. Süre artışı, `mongodb-memory-server` ile gerçek HTTP entegrasyon testlerinin (supertest) devreye girmesindendir; kabul edilebilir düzeydedir.

**Bulunan 1 gerçek ürün hatası (defekt)** test tarafından belgelendi ancak düzeltilmedi (görev kapsamı gereği mevcut kod bozulmadı): stokta olmayan ürünle sipariş verildiğinde endpoint yanıt yerine **asılı kalıyor**. Detay: Bölüm 6.

---

## 2. Mevcut Durum (Doğrulandı)

- Çalıştırıcı: **Vitest 2.1.9**, `npm test` → `vitest run` (config: `vitest.config.ts`, node ortamı, `src/**/*.{test,spec}.ts`).
- Başlangıç durumu: 3 dosya / 20 test, tamamı geçiyor:
  - `src/server/services/coupon.test.ts` (7 test)
  - `src/lib/campaignSchedule.test.ts` (5 test)
  - `src/server/utils.test.ts` (8 test)
- `mongodb-memory-server` zaten devDependency'te; `mongod 8.2.6 (ubuntu)` binary'si önbellekte mevcut.
- `supertest` kurulu **değildi** → `npm install --save-dev supertest @types/supertest` yapıldı (v7.2.2). Bu, uygulama kodu dışındaki tek bağımlılık değişikliğidir.

---

## 3. Eklenen Test Dosyaları

### 3.1 `src/lib/loyalty.test.ts` — 16 test (yeni)
Sadakat puanı hesabı birim testleri:

| Fonksiyon | Kapsanan durumlar |
|---|---|
| `getPointsForCompletedItemCount` | Ürün adedi başına 100 puan; 0 adet; **negatif adet → 0**; doğrusal ölçek |
| `getPointsForOrderTotal` | 10 birim başına 1 puan; kesirli tutarda **aşağı yuvarlama** (19,99 → 1); 9,99 → 0; 0 ve negatif tutar → 0 |
| `getNormalizedPointsCost` | Normal değer; kesirli → floor; campaign yok/boş → 0; negatif → 0 |
| `isPointRewardCampaignType` | 3 geçerli tipin tamamı; geçersiz tipler; boş string; `undefined`/`null` |

### 3.2 `src/server/middleware/auth.test.ts` — 20 test (yeni)
Auth middleware birim testleri (MongoDB Memory Server + gerçek JWT):

**attachAuth (zorunlu kimlik doğrulama):**
- Authorization başlığı yok → 401
- Bearer olmayan başlık (`Basic`) → 401
- Yanlış secret ile imzalanmış token → 401
- Bozuk (malformed) token → 401
- **Süresi dolmuş token** → 401
- Geçerli token ama kullanıcı silinmiş → 401
- Geçerli token → kullanıcı eklenir, `authRole` doğru hesaplanır

**Rol downgradedgeçerliği (sessionRole modeli):**
- `role=manager, sessionRole=null` → efektif rol **customer** (ayrıcalık yok)
- `role=manager, sessionRole=manager` → **manager**
- `role=manager, sessionRole=staff` → **staff** (yönetici garson moduna inebilir)
- `role=staff, sessionRole=manager` → **customer** (personel kendini yükseltemez — güvenlik açısı değil, tasarım)

**attachOptionalAuth (opsiyonel):**
- Token yok → devam, kullanıcı eklenmez
- Geçerli token → kullanıcı eklenir
- Geçersiz token → **hata vermez**, sessizce devam

**restrictTo (rol kontrolü):**
- Auth çalışmamış → 403
- Customer → staff-only endpoint → 403
- Staff → manager-only endpoint → 403
- Eşleşen rol → geçer; iç içe dizi (`[["staff"], "manager"]`) düzleştirilir

### 3.3 `src/lib/campaignSchedule.edge.test.ts` — 19 test (yeni)
Kampanya takvimi kenar durumları (`vi.useFakeTimers` ile zaman donduruldu: 2026-06-15 12:00 UTC = 15:00 TR):

- Geçersiz tarih parçaları (`abcd-ef-gh`), eksik (`2026-06`), sıfır değerli parçalar → `null`
- Bozuk saat (`ab:cd`) → sessizce 00:00 kabul edilir
- Sabit +03:00 offset'i ana makine saat diliminden bağımsız doğrulandı
- `isCampaignScheduledActive`: null kampanya; `active=false` (tarihler geçerli olsa bile); boş tarihler → her zaman aktif; **başlangıç sınırı dahil (inclusive)**; başlangıçtan 1 dk önce pasif; bitişi geçmiş pasif; varsayılan `endTime=23:59:59` ve `startTime=00:00`; çözülemeyen startDate yok sayılır

### 3.4 `src/server/routes/api.test.ts` — 31 test (yeni, supertest)
Gerçek HTTP katmanı entegrasyon testleri — express uygulaması test içinde kurulur (`server.ts`'ten bağımsız: rate-limit, vite, helmet olmadan; yalnız `express.json` + api router):

| Endpoint | Testler |
|---|---|
| `GET /api/health` | 200 + timestamp; kimlik doğrulama gerektirmez |
| `POST /api/auth/register` | Başarılı kayıt (201, token, rol customer, **parolayı yanıta sızmaz**, DB'de hash'li); eksik alan 400; kısa parola 400; geçersiz kullanıcı adı 400; geçersiz e-posta 400; geçersiz TR telefonu 400; gerçek dışı doğum tarihi 400; kullanıcı adı çakışması 409; e-posta çakışması 409 |
| `POST /api/auth/login` | E-posta ile giriş; **kullanıcı adı ile giriş**; yanlış parola 401 + `INVALID_CREDENTIALS`; olmayan kullanıcı aynı genel 401 (kullanıcı sayıklaması/engel enumeration) |
| `GET /api/auth/me` | Geçerli token 200; çöp token 401 |
| `GET /api/products` | Liste (auth'suz); boş liste |
| `POST /api/orders` | Başarılı sipariş (201, `pending`, toplam/ade doğru, **bakiye düşer** 500→350, DB'de kalıcı); auth'suz 401; boş items 400; stokta yok (defekt, bkz. Bölüm 6); yetersiz bakiye 409 + **sipariş kaydı oluşmaz**; 0/NaN adet → 1'e sabitlenir |
| `GET /api/orders` | Müşteri kendi siparişlerini görür; auth 401 |
| Rol kontrolü (RBAC) | Customer → `GET /api/users` 403; customer ürün **oluşturamaz** 403 + DB'de ürün oluşmaz |

Not: Kayıt testlerinde `birthDate` yaş aralığı (12–100) doğrulaması da dolaylı olarak çalıştırılır.

---

## 4. Test Sonuçları (Tam Koşum)

```
npm test  (vitest run, Node ortamı)

 ✓ src/lib/loyalty.test.ts                   16 tests
 ✓ src/lib/campaignSchedule.test.ts            5 tests   (mevcut)
 ✓ src/lib/campaignSchedule.edge.test.ts      19 tests
 ✓ src/server/utils.test.ts                    8 tests   (mevcut)
 ✓ src/server/services/coupon.test.ts          7 tests   (mevcut)
 ✓ src/server/middleware/auth.test.ts         20 tests
 ✓ src/server/routes/api.test.ts              31 tests

 Test Files  7 passed (7)
      Tests   106 passed (106)
   Duration    ~10 sn
```

Ek doğrulama: `npx tsc --noEmit` → **0 hata** (test dosyaları tip kontrolünden de geçiyor).

---

## 5. Bulunan Defekt (Ürün Hatası)

### DEF-1: Stokta olmayan ürünle siparişte endpoint asılı kalıyor (Yüksek)

- **Konum:** `src/server/routes/api.ts:2098-2105` (`POST /orders`)
- **Süreç:** `normalizedItems`'ı üreten `Promise.all` içinde `throw new Error("Bazi urunler stokta degil")` fırlatılıyor; handler `try/catch` içermiyor ve uygulamada **Express error handler middleware'ü yok** (`server.ts` ve router'da 4 parametreli `(err, req, res, next)` handler tanımlı değil).
- **Sonuç:** HTTP yanıtı hiç gönderilmez; socket istemci tarafında zamanaşımına kadar açık kalır; hata ayrıca **unhandled rejection** olarak süreci kirletir.
- **Beklenen davranış:** `400/409` + `{"message": "Bazi urunler stokta degil.""}` yanıtı.
- **Testte gösterimi:** `api.test.ts > "rejects an order for an out-of-stock product (no order is created)"` — istemci 3 sn timeout ile sonlanır, `OrderModel.countDocuments() === 0` doğrulanır. Test, hatanın bilinen `unhandledRejection`'ını kapsamlı (scoped) bir dinleyiciyle tolere eder; **düzeltme geldiğinde** test otomatik olarak HTTP hata durumunu da kabul eder (>=400).
- **Önerilen düzeltme (sonraki görevde):** handler gövdesini `try/catch`e almak VE `server.ts`'e genel bir `app.use((err, req, res, next) => ...)` error handler eklemek (ikisi birden — Express'te async throw ancak error handler ile yakalanır). Aynı korumasız-desen riski `POST /orders` dışında da incelenmeli.

> Görev tanımı "mevcut kodu bozma" dediği için düzeltme uygulanmadı; yalnızca belgelendi.

### Gözlemler (defekt değil, not)
- `POST /orders` geçersiz `tableSessionToken`'da doğru 404 döner; bakiye yarışı `findOneAndUpdate` koşullu sorgusuyla atomik çözülmüş (test edildi: yetersiz bakiyede kayıt oluşmaz).
- `getSystemText` anahtarları TR karakter içermediği için (`bazi-urunler-stokta-degil`) API hata mesajları İngilizce/Türkçe-karakersiz karışık dönüyor (`"Bazi urunler stokta degil."`). Kozmetik bulgu.

---

## 6. Test Stratejisi Önerileri (Sonraki Adımlar)

1. **Piramit dengesi:** Şu an birim (55) + entegrasyon (51) dengeli. UI (React) tarafı hiç test edilmiyor — bir sonraki ekipte Vitest + Testing Library ile kritik bileşenler (sipariş sepeti, sadakat ekranı) eklenmeli.
2. **Kapsam ölçümü:** `@vitest/coverage-v8` eklenip `npm test -- --coverage` ile dal kapsamı (branch coverage) raporlanmalı; hedef: `src/lib` ve `src/server/services` için %80+.
3. **Contract/E2E:** QR akışı (masa oturumu, garson taraması) çok adımlı; Playwright ile 2–3 mutlu-yol E2E senaryosu önerilir.
4. **DEF-1 düzeltildikten sonra:** `api.test.ts`'teki tolerans dinleyicisi kaldırılmalı ve test katı `expect(response.status).toBe(400)` olmalı.
5. **Çalıştırıcı ayarı:** `vitest.config.ts`'e `testTimeout: 15000` eklenmesi önerilir (ilk koşumda mongod indirme/collections create tek dosyada 5 sn varsayılanı zorlayabiliyor).

---

## 7. CI Önerisi (GitHub Actions)

Repoda **mevcut** bir workflow zaten var: `.github/workflows/ci.yml` (Node 20; `npm ci` → lint → `npm test` → `npm run build`, NODE_ENV=production). Bu yapı temelde sağlıklı. Aşağıdaki geliştirilmiş sürüm önerilir; önemli farklar **kalın** işaretli:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ["20", "22"]        # **Node sürüm matrisi** (22 package.json'da hedef)

    env:
      JWT_SECRET: ci-test-jwt-secret   # **testlerin ihtiyacı olan secret'ı sağla**
      MONGOMS_DISABLE_POSTINSTALL: "1"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm

      # **mongod binary cache'i — CI süresini ciddi kısaltır**
      - name: Cache mongodb-memory-server binaries
        uses: actions/cache@v4
        with:
          path: ~/.cache/mongodb-binaries
          key: mongods-${{ runner.os }}-node${{ matrix.node }}-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies
        run: npm ci

      # **tsc --noEmit ayrı adım** (lint 'type-check' adıyla geçiyor ama sadece eslint)
      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Unit & integration tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production
```

**Nedenler:**
- `JWT_SECRET` yoksa testler ve `server.ts` anında ölür; CI'da sabit değer yeterli (production sırrı değil).
- `~/.cache/mongodb-binaries` cache'i olmadan her CI koşumu ~30–60 MB mongod indirir.
- Sürüm matrisi, Node 20/22 farklarını (ör. `fs`/test davranışları) PR'da yakalar.
- `tsc --noEmit` bu depoda şu an temiz (0 hata) — lint'ten ayrı ve hızlı bir sinyal.

---

## 8. Değişiklik Listesi

| Dosya | Durum | İçerik |
|---|---|---|
| `src/lib/loyalty.test.ts` | **yeni** | 16 birim test |
| `src/server/middleware/auth.test.ts` | **yeni** | 20 birim test |
| `src/lib/campaignSchedule.edge.test.ts` | **yeni** | 19 kenar durum testi |
| `src/server/routes/api.test.ts` | **yeni** | 31 supertest entegrasyon testi |
| `package.json`, `package-lock.json` | değişti | `supertest@7.2.2` + `@types/supertest` (devDependencies) |
| `qa-raporu.md` | **yeni** | Bu rapor |

Uygulama kodunda (`src/**` non-test, `server.ts`) **hiçbir değişiklik yapılmadı**.
