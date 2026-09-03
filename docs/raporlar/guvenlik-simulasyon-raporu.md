# Bancho Cafe — Sızma Simülasyonu Güvenlik Raporu (Dinamik Denetim)

> **DURUM (03.09.2026):** Bu rapordaki tüm KRİTİK (S-K1..K7), ORTA (S-O1..O12) ve DÜŞÜK (S-D1..D3) bulgular düzeltildi ve sim ortamında doğrulandı. Yarış senaryoları `src/server/routes/security-regression.test.ts` içinde regression testleridir. Ayrıntı: MASTER-PLAN MP-0.10 durum güncellemesi.

- **Denetim tarihi:** 03.09.2026
- **Yöntem:** Statik denetimin (`guvenlik-raporu.md`, 02.09.2026) üzerine **dinamik sızma testi**. Gerçek API kod tabanı (`src/server/routes/api.ts` + `new-features.ts`), izole simülasyon sunucusunda (`scripts/sim-server.ts`, `:3999`, bellek-içi MongoDB) çalıştırıldı; 4 paralel saldırı ajanı toplam ~230 HTTP senaryosu koştu (iş mantığı/stok, para akışı/yarış, kimlik doğrulama/IDOR, girdi fuzz/enjeksiyon).
- **Doğrulama:** Kritik bulgular koordinatör tarafından temiz tohumda **bizzat yeniden üretilerek** teyit edildi (aşağıda ✓ DOĞRULANDI işaretli).
- **Kod değişikliği yapılmamıştır** — yalnızca bu rapor ve `scripts/sim-server.ts` (yeniden kullanılabilir denetim aracı) üretilmiştir.

---

## 1. Yönetici Özeti

Simülasyon ortamı, statik okumada görünmeyen **yarış koşulu ve iş mantığı sınıfı 7 kritik bulgu** ortaya çıkardı. En ağırı: **sadakat QR token'ının oturum token'ı olarak geçerli olması** — kurbanın QR kodunu 180 saniye boyunca görebilen herkes hesabı tamamen ele geçirip bakiyesini çalabilir (uçtan uca kanıtlandı).

Para kaybı yaratan üç desen ortak bir köke dayanıyor: kod tabanının büyük bölümü MP-2.15 kapsamında atomik `findOneAndUpdate` guard'larına geçirilmiş ve bu uçlar (sipariş, hediye, kupon, sadakat) saldırıları **reddediyor**; ancak **bakiye yükleme, abonelik ve masa ödemesi** hâlâ read-modify-write `save()` veya check-then-act deseninde — tüm kritik yarışlar bu üç eski desende yoğunlaşıyor.

Öte yandan klasik web saldırı yüzeyi sağlam: NoSQL enjeksiyonu, prototip kirliliği, rol atlama, IDOR, token sahteciliği, replay, eşzamanlı kupon/sadakat yarışları, enumeration ve hesap kilitleme testlerinin tamamı saldırıyı geri çevirdi.

### Bulgu Matrisi

| ID | Seviye | Bulgu | Kaynak | Durum |
|----|--------|-------|--------|-------|
| S-K1 | KRİTİK | Sadakat QR token'ı Bearer olarak geçerli → tam hesap ele geçirme + para hırsızlığı | auth | ✓ DOĞRULANDI |
| S-K2 | KRİTİK | Ödenmiş masa siparişi reddedilince iade yok — müşteri parası kayboluyor | iş mantığı | kanıtlı |
| S-K3 | KRİTİK | "Yemek-kaçağı": no-pay ile sıfır ödeyip sınırsız ürün + sadakat puanı | iş mantığı | kanıtlı |
| S-K4 | KRİTİK | Bakiye yükleme read-modify-write — paralel yüklemelerde para buharlaşıyor / düşüm siliniyor | para | ✓ DOĞRULANDI |
| S-K5 | KRİTİK | Staff `POST /users/me/balance` ile kendine sınırsız para basabiliyor | para | ✓ DOĞRULANDI |
| S-K6 | KRİTİK | Masa ödemesinde paralel `pay`/`pay`+`leave` çift kesim yapıyor | para | kanıtlı |
| S-K7 | KRİTİK | Abonelik yarışında unique-index hatasında para düşülüyor ama abonelik oluşmuyor | para | kanıtlı (~%50 tekrar) |
| S-O1 | ORTA | Envanter hareketinde negatif miktar stoğu ARTIRIYOR | iş mantığı | ✓ DOĞRULANDI |
| S-O2 | ORTA | Envanter hareketinde string miktar → JS birleştirme (1000+"7"=10007) | iş mantığı | kanıtlı |
| S-O3 | ORTA | `PATCH /inventory/:id` negatif stok yazabiliyor (`runValidators` yok) | iş mantığı | kanıtlı |
| S-O4 | ORTA | Stok girişi `inStock` bayrağını geri AÇMIYOR — stok gelse de satış yok | iş mantığı | kanıtlı |
| S-O5 | ORTA | Sipariş anında malzeme rezervasyonu yok — oversell (3L süt ile 6 Latte) | iş mantığı | kanıtlı |
| S-O6 | ORTA | Masa borç kontrolü yarışması — borç > bakiye kabul ediliyor | para | kanıtlı |
| S-O7 | ORTA | Staff/manager `pay` tahsilatı hiçbir deftere yazmıyor (içeriden dolandırıcılık kapısı) | para | kanıtlı |
| S-O8 | ORTA | Sipariş `note` alanında uzunluk sınırı yok — 1MB DB'ye yazılıp tüm istemcilere taşınıyor | fuzz | ✓ DOĞRULANDI |
| S-O9 | ORTA | Ürün `image` alanı doğrulamasız — 2MB base64 saklanır, WebP dönüşümü atlanır | fuzz | kanıtlı |
| S-O10 | ORTA | 5 alanda stored HTML (ürün adı, yorum, sohbet, garson çağrısı, sistem metni) | fuzz | kanıtlı |
| S-O11 | ORTA | E-posta değişikliği şifre onayı istemiyor (S-K1 ile birleşince ele geçirme geri alınamaz) | auth | kanıtlı |
| S-O12 | ORTA | Register 409 ayrımıyla hesap envanteri sızdırıyor | auth | kanıtlı |
| S-D1 | DÜŞÜK | `quantity` string/bool coercion; geçersiz enum/ObjectId'de 500 | fuzz+iş mantığı | kanıtlı |
| S-D2 | DÜŞÜK | Kayıt alanlarında uzunluk/format tutarsızlığı (5000 karakter ad, serbest tarih biçimi) | fuzz | kanıtlı |
| S-D3 | DÜŞÜK | `adjustment` ile sınırsız stok yazımı; 7 günlük token ömrü, oturum bazlı iptal yok | iş mantığı+auth | kanıtlı |

---

## 2. KRİTİK BULGULAR

### S-K1 — Sadakat QR token'ı oturum token'ı olarak geçerli ✓ DOĞRULANDI

**Kök neden:** `attachAuth` (`src/server/middleware/auth.ts`) imza+ömür doğrular ama token'ın `purpose` claim'ini kontrol etmez; sadakat QR'ı `getLoyaltyJwtSecret()` (`src/server/services/loyalty.ts:28`) ile imzalanır ve bu fonksiyon doğrudan `process.env.JWT_SECRET` döner — **oturum token'ıyla aynı anahtar**. `resolveLoyaltyToken`'daki `purpose !== "loyalty"` kontrolü yalnızca `/api/loyalty/scan/*` yolundadır; simetrik koruma yoktur.

**Uçtan uca sömürü zinciri (kanıtlanmış sıra):**
1. Kurban `GET /api/loyalty/qr` → ekranında 180 sn TTL'li QR gösterir (omuz sörfing/ekran görüntüsü/loj sızıntısı ile gözlemlenebilir)
2. Saldırgan QR token'ını `Authorization: Bearer` olarak kullanır → `GET /api/auth/me` **200** (kurban kimliği)
3. `POST /api/users/me/password` **200** → yeni şifreyle gerçek login → **kalıcı ele geçirme**
4. `POST /api/gifts/send` ile kurban bakiyesinden kendine hediye + claim → kurban 500→100, saldırgan 0→400 (**finansal hırsızlık**)
5. `PATCH /api/users/me` ile e-posta değişikliği (S-O11 yüzünden geri alınamaz) + `logout` ile kurbanın gerçek oturumlarını düşürme

**Doğrulama (koordinatör, temiz tohum):** `GET /api/auth/me` loyalty-token Bearer ile → 200, `email=kurban@sim.test`. ✓

**Düzeltme:** (1) `attachAuth`/`attachOptionalAuth` içinde doğrulamadan sonra `purpose` claim'i taşıyan token'ı 401 ile reddet; (2) sadakat token'ını ayrı `LOYALTY_JWT_SECRET` ile imzala.

### S-K2 — Ödenmiş masa siparişi reddedilince para iade edilmiyor

**Kök neden:** `src/server/routes/api.ts:2662` — red durumunda iade `if (!order.tableSessionToken)` koşuluyla yalnızca normal siparişlere yapılır. Masa siparişi `/table-sessions/pay` ile ödendiğinde bakiye düşmüştür; sonradan red gelince iade atlanır ve sipariş masa hesabından da `status:{$ne:"rejected"}` filtresiyle düşer — **para hiçbir yerde yok**.

**Kanıt:** ₺1000 bakiye → masa siparişi ₺110 → pay (₺890) → staff red → bakiye ₺890 kalır (₺1000 olmalıydı). 2/2 tekrarlı.

**Düzeltme:** Red anında katılımcının `paidAmount` kaydıyla karşılaştırıp fiilen ödenmiş kısmı bakiyeye iade et.

### S-K3 — "Yemek-kaçağı" döngüsü: no-pay ile sınırsız ürün + sadakat puanı

**Kök neden (üçlü birleşim):** (a) masa siparişinde bakiye sipariş anında düşülmez, tamamlanmada da tahsilat emniyeti yok; (b) `leave action:"no-pay"` yalnızca kayıt tutar, yaptırım yok; (c) `applyCompletedOrderLoyalty` masa ayrımı yapmaz — teslim edilen her masa siparişi puan üretir.

**Kanıt:** ₺200 bakiyeli müşteri → masa oturumu → 4 Espresso (₺160) → preparing→ready→completed → bakiye ₺200 (hiç düşmedi), puan +400 → no-pay leave. Döngü sonsuz tekrarlanabilir; puanlar bedava ürün kampanyasında kullanılabilir.

**Düzeltme:** (1) no-pay leave'de kullanıcıyı borçlu bayrağıyla işaretle ve borç kapanana kadar masa siparişini bloke et; (2) sadakat puanını masa borcu kapanana kadar ertele; (3) ORTA-4b'deki asılı oturum sorununu çöz (boş-borçlu oturumda yabancı onaysız host olabiliyor).

### S-K4 — Bakiye yükleme read-modify-write yarışı ✓ DOĞRULANDI

**Kök neden:** `src/server/routes/api.ts:1583` — `user.balance = Math.max(0, user.balance + totalCredited); await user.save();` okunan değere göre yazar; aradaki atomik `$inc`'leri ezer.

**Kanıt A (para kaybı):** 5 paralel ₺100 yükleme → 5×200 ama bakiye ₺200–₺400 (₺500 olmalı). `BalanceTopUp` kayıtları ₺500 ciro gösterir — defter ile bakiye uyumsuz. 3/3 tekrarlı.
**Kanıt B (bedava ürün):** 4 paralel ₺40 sipariş + 1 paralel ₺100 yükleme → tüm siparişler teslim, bakiye beklenenin ₺40 üstünde (yüklemenin `save()`'i düşümleri ezer). 3/3 tekrarlı.
**Doğrulama (koordinatör):** kodlar [200×5], son bakiye ₺400 ≠ ₺500. ✓

**Düzeltme:** `UserModel.findOneAndUpdate({_id}, { $inc: { balance: totalCredited } })` — kod tabanının zaten kullandığı desen.

### S-K5 — Staff kendi hesabına sınırsız para basabiliyor ✓ DOĞRULANDI

**Kök neden:** `POST /users/me/balance` → `restrictTo("staff","manager")` (`api.ts:1528`). İstek başına ₺10.000 üst sınırı var ama istek sayısı sınırsız; staff yüklediği parayı hediye ile başka hesaba aktarıp gerçek ürüne dönüştürebilir.

**Kanıt:** staff session-role → `me/balance 10000` → 200, ₺100→₺10.100 → tekrar → ₺20.100 → ₺9.000 hediye → alıcı sipariş 201.
**Doğrulama (koordinatör):** staff `me/balance 10000` → 200, bakiye ₺10.100. ✓

**Not:** Statik raporun C-1 bulgusunun (kullanıcı self top-up) kalan kısmı — customer erişimi kapatılmış ama **staff erişimi açık kalmış**.
**Düzeltme:** `restrictTo("manager")`; staff için "onay bekleyen yükleme" kaydı (manager onaylı) modellemesi.

### S-K6 — Masa ödemesinde paralel pay çift kesim

**Kök neden:** `/table-sessions/pay` (`api.ts:3540`) ve `/table-sessions/leave` (`api.ts:3694`) ikisi de `session.save()` ile `paidAmount` yazar; bakiye düşümü ile oturum güncellemesi arasında atomiklik yok.

**Kanıt A:** ₺120 borç, 3 paralel `pay{all}` → [200,200,400], son bakiye ₺60 (₺180 olmalı; ₺240 kesildi).
**Kanıt B:** eşzamanlı `pay{all}` + `leave{action:"pay"}` → ikisi de 200/₺120, ₺300→₺60. 2/2 tekrarlı.

**Düzeltme:** Ödemeyi oturum belgesi üzerinde koşullu atomik update ile bağla (`findOneAndUpdate({sessionToken, kalanBorc >= amount}, {$inc: ...})`); `leave` yolu aynı kilidi paylaşsın.

### S-K7 — Abonelik çift kesim + unique-index hatasında para kaybı

**Kök neden:** `POST /subscriptions/subscribe` (`new-features.ts:808`) — `findOne` teklik kontrolü → bakiye düşümü → `create`; ikinci istek bakiyeyi düşer ama `create` unique `userId` index'ine takılıp 500 verir, **iade yok**.

**Kanıt:** ₺300 bakiye, 3 paralel subscribe (₺100) → [500,200,400], son bakiye ₺100 (₺200 olmalı), 1 abonelik. 8 denemenin 4'ünde tetiklendi.

**Not:** Statik rapor C-4'teki hediye tarafı (MP-2.15) kapatılmış; abonelik tarafı açık kalmış.
**Düzeltme:** Teklik koşulunu bakiye düşümünün yapıldığı atomik sorguya taşı; ya da catch'te `{$inc:{balance:planPrice}}` telafisi.

---

## 3. ORTA BULGULAR

| ID | Bulgu | Kanıt özeti | Düzeltme |
|----|-------|-------------|----------|
| S-O1 ✓ | Negatif `out` hareketi stoğu artırıyor (`new-features.ts:1552`, quantity doğrulanmaz) | Süt 3 → `out:-100` → 200 → 103 (koordinatör ✓) | `Number.isFinite(qty) && qty > 0` kontrolü |
| S-O2 | String quantity JS birleştirme; `"SONSUZ"` 500 | `in:"7"` → Süt 10007 | aynı doğrulama + tip şartı |
| S-O3 | `PATCH /inventory/:id` negatif stok (runValidators yok) | `currentStock:-999` → 200 | `{runValidators:true}` veya açık `>=0` kontrolü |
| S-O4 | (a) `in` hareketi `inStock` bayrağını geri açmıyor → satış kilidi; (b) boş-borçlu oturum asılı, yabancı onaysız host oluyor | Stok geldi, Latte hâlâ 400 OUT_OF_STOCK | `syncProductStockFlags`'e yeniden açma dalı + hareket sonrası çağrı; oturumu otomatik kapat |
| S-O5 | Sipariş anında malzeme rezervasyonu yok | 3L süt ile 2×3 Latte kabul + teslim | Siparişte `currentStock` karşılaştırması veya rezervasyon |
| S-O6 | Masa borç kontrolü check-then-act | ₺100 bakiye, 5 paralel ₺40 → ₺120 borç kabul | Katılımcı belgesine atomik `$inc` rezervasyon |
| S-O7 | Staff `pay` borcu kapatır ama tahsilat kaydı oluşmaz | `paidAmount:80`, hiçbir ödeme kaydı yok | Staff dalında `paymentMethod:"cash"` kaydı |
| S-O8 ✓ | Sipariş `note` sınırsız — 1MB DB'ye yazılır (chat 1000, garson çağrısı 300 sınırlıyken) | 1MB not → 201, aynen döner (koordinatör ✓) | 500–1000 karakter sınırı |
| S-O9 | Ürün `image` 2MB base64 kabul; `normalizeImageValue` yalnızca trim yapar; WebP akışı atlanır | 2MB data-URI → 201 | Uzunluk cap'i + şema doğrulama; data-URI'yi yasakla |
| S-O10 | Ürün adı, review, chat, garson çağrısı, sistem metni — HTML ham depolanır | `<svg onload>`/`<script>` → 201/200, GET'te birebir döner | Yazmada sanitize (React kaçırıyor ama tek `dangerouslySetInnerHTML` yeter) |
| S-O11 | E-posta değişikliği şifre onayı istemiyor (`api.ts:1080`) | `PATCH /users/me {"email":...}` → 200 | currentPassword + doğrulama bağlantısı |
| S-O12 | Register mevcut e-postada 409 — envanter sızdırır | `b@sim.test` → 409, `yok@` → 201 | Tek genel mesaj |

## 4. DÜŞÜK / BİLGİ

- **S-D1:** `quantity:"3"`/`true` kabul (toplam doğru hesaplanıyor — sözleşme gevşekliği); `waiter-calls type:"refill"`, geçersiz ObjectId chat/products'ta → 500 (400 olmalı).
- **S-D2:** `name` 5000 karakter kabul; `birthDate:"01.01.1990"` ham saklanır (ISO zorlanmıyor); telefon biçimi hata mesajıyla tutarsız.
- **S-D3:** `adjustment:1e9` sınırsız stok yazımı (staff); token ömrü 7 gün, oturum bazlı iptal yok (yalnızca global tokenVersion); sistem metni 600 karakter sessizce 500'e kesilir.

---

## 5. SAĞLAM DOĞRULANAN YÜZEYLER (saldırı reddedildi)

| Alan | Sonuç |
|---|---|
| NoSQL enjeksiyonu (login `$gt/$ne/$regex/$where`, register, kupon kodu, arama) | KAPALI — 401/400 |
| Prototip kirliliği (`__proto__`, `constructor`, `role:"manager"` enjeksiyonu, `$set` sızması) | KAPALI — whitelist düşürme |
| Rol atlama (customer → tüm manager/staff uçları, `POST /system/reset`, `users/:id/balance`, analytics, campaigns, inventory, system-texts, tables) | KAPALI — 403 |
| session-role yükseltme (customer→manager/staff, staff→manager) | KAPALI — sessiz customer / 400 |
| IDOR (orders, notifications, gifts, reservations, waiter-calls, chat, table-sessions) | KAPALI — sahiplik kontrolleri |
| Token sahteciliği (alg:none, imza değiştirme, sahte/exp) | KAPALI — 401, HS256 sabit |
| Şifre akışı + tokenVersion iptali (eski token 401), login enumeration (tekdüze 401), hesap kilitleme (5 deneme) | ÇALIŞIYOR |
| Durum makinesi replay (completed→completed/rejected, rejected→rejected/completed) | KAPALI — 400/409 |
| Eşzamanlı status geçişleri (çift completed, completed+rejected) | 1 galip — 409 |
| Çift harcama `/orders` (10 paralel ₺40, ₺100 bakiye) | 2×201, negatif yok — atomik guard |
| Kupon yarışları (aynı kullanıcı 5 paralel; 5 farklı kullanıcı limit 2; `$expr` atomik) | Sınırlar tam tuttu |
| Kupon iadesi (red sonrası hak geri gelir, yeniden kullanılabilir, `usedCount` negatifsiz) | ÇALIŞIYOR |
| Hediye claim/gönderim yarışları (10/5 paralel) | 1 kez — atomik |
| Sadakat redeem yarışı (5 paralel kampanya) | Tek düşüm |
| İstemci fiyat enjeksiyonu (`item.price:0.01`), negatif/kesirli/dev quantity, negatif fiyatlı ürün | Reddedildi — fiyat sunucudan çözülür |
| Geçersiz ObjectId (doğrulamalı uçlarda), rating 1-5 zorlaması, review sahiplik+completed şartı | KAPALI |
| Yabancı masa oturumuna sipariş/okuma/ödeme/onay | 403 |
| Masa no-pay borcu kaybolmuyor (yeniden join'de pay tahsil ediyor) | ÇALIŞIYOR (yaptırım eksikliği ayrı bulgu) |
| Taşma girdileri (`1e308`, `10001`, `-50`, `0` yükleme/hediye) | 400 |

---

## 6. ÖNCELİKLİ DÜZELTME SIRASI

1. **S-K1** loyalty token purpose reddi + ayrı secret (2 satır + env; en yüksek etki/yarar oranı)
2. **S-K4** topup `$inc` (tek satır desen değişikliği, iki yönlü kaybı kapatır)
3. **S-K7** subscribe telafi iadesi (hızlı yama) / atomik rezervasyon (kalıcı)
4. **S-K2** ödenmiş masa siparişi red iadesi
5. **S-K6** masa pay/leave tekil ödeme kilidi
6. **S-K5** `/users/me/balance` staff erişimini kapatma
7. **S-K3** no-pay yaptırımı (borçlu bayrağı + puan erteleme)
8. **S-O1/2/3** envanter hareket doğrulaması + runValidators
9. **S-O8/9** note/image boyut sınırları
10. **S-O4/5/6/7** stok senkronizasyonu, rezervasyon, tahsilat kaydı
11. **S-O10/11/12** sanitize politikası, e-posta değişim onayı, register mesajı

**Genel gözlem:** Kritik yarışların tamamı MP-2.15 atomikleştirme dalgasının **dışında kalan üç eski desende** (bakiye yükleme, abonelik, masa ödeme) yoğunlaşıyor — kalan iş, yeni desen bulmak değil, bu üç ucu mevcut desene taşımak.

---

## Ek A — Simülasyon Ortamı

`scripts/sim-server.ts`: gerçek `apiRoutes`'u MongoMemoryServer üzerinde `:3999`'dan serve eden izole denetim sunucusu. `POST /__sim/seed` (yönetici/personel/ürün/envanter/kampanya/kupon/masa tohumlar), `POST /__sim/reset` (tüm koleksiyonları temizler). Üretim/dev akışına bağlı değildir, `.env` okumaz. Yeniden denetimde kullanılabilir: `npx tsx scripts/sim-server.ts`.
