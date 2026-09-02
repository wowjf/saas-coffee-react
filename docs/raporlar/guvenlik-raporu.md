# Bancho Cafe (Brew & Bloom) — Güvenlik Denetim Raporu

- **Denetim tarihi:** 02.09.2026
- **Denetlenen kod tabanı:** `orch-security-audit` worktree (commit `a16cbd3`)
- **Kapsam:** `src/server/routes/api.ts` (3347 satır / 76 endpoint), `src/server/routes/new-features.ts` (1406 satır / 53 endpoint), `src/server/middleware/auth.ts`, `server.ts`, `src/server/services/*`, `src/server/models/*`, dosya yükleme (`multer` + `sharp`), Docker/nginx yapılandırması, git geçmişi.
- **Yöntem:** Statik kod incelemesi (manuel satır bazlı), yapılandırma ve git geçmişi analizi. Çalışan sistem üzerinde sızma testi **yapılmamıştır**; tüm bulgular kod okumaya dayanır.
- **Kod değişikliği yapılmamıştır** — yalnızca bu rapor üretilmiştir.

---

## 1. Yönetici Özeti

Projenin temel güvenlik pratiği birçok açıdan olumluudur: bcrypt ile şifre saklama, JWT zorunlu kılma, üretimde açık CORS reddi, helmet, atomic bakiye guard'ları, sharp ile görüntü yeniden kodlama, TLS 1.2/1.3 ve HSTS içeren nginx yapılandırması mevcuttur.

Ancak denetim **4 KRİTİK** düzeyde bulgu ortaya koymuştur. Bunlardan en önemlileri:

1. **Herhangi bir giriş yapmış kullanıcının kendi bakiyesini kendisi yükleyebilmesi** (`POST /api/users/me/balance`) — ödeme entegrasyonu olmadan sınırsız "para basma".
2. **Kayıt sırasında e-posta ile rol ataması** — bilinen/sabit yönetici e-postaları (`admin@bancho.cafe`, `yonetici@bancho.cafe`) ile kayıt olan biri doğrudan **manager** rolü kazanabilir; e-posta doğrulaması olmadığı için personel e-postaları üzerinden de hesap ele geçirme mümkündür.
3. **TLS özel anahtarının git geçmişine işlenmesi** — `nginx/ssl/live/privkey.pem` sonraki commit'te silinmiş olsa da geçmişte hâlâ okunabilir durumdadır (geçerlilik 01.08.2027'ye kadar, ortak IP'li sertifika).
4. **Hediye/abonelik akışlarında TOCTOU yarış koşulları** — eşzamanlı isteklerle bakiye çoğaltma/negatif bakiye.

Bunun altında hız limitinin `X-Forwarded-For` sahteciliğiyle atlatılabilmesi, CSP'nin hâlâ `reportOnly` olması, 7 gün süreli ve iptal edilemeyen JWT'lerin `localStorage`'da tutulması ve kapsamlı KVKK açıkları (aydınlatma metni yok, veri taşıma/silme hakkı yok) yer almaktadır.

### Bulgı Özet Matrisi

| ID | Seviye | Başlık | Konum |
|----|--------|--------|-------|
| C-1 | KRİTİK | Kullanıcının kendi bakiyesini yüklemesi (kendi kendine para basma) | `api.ts:1258-1290` |
| C-2 | KRİTİK | Kayıtta e-posta tabanlı rol yükseltme (doğrulanmamış e-posta → manager/staff) | `api.ts:653`, `role.ts:24-39`, `constants.ts:3` |
| C-3 | KRİTİK | TLS özel anahtarı git geçmişinde | commit `590225d`, `nginx/ssl/live/privkey.pem` |
| C-4 | KRİTİK | Hediye/abonelik bakiye yarış koşulları (TOCTOU) | `new-features.ts:511-521`, `new-features.ts:641-652` |
| H-1 | YÜKSEK | Varsayılan/örtük yönetici şifreleri | `autoSeed.ts:150`, `docker-compose.yml`, `.env.example` |
| H-2 | YÜKSEK | X-Forwarded-For sahteciliği ile hız limiti atlatma | `nginx/conf.d/default.conf`, `server.ts:119` |
| H-3 | YÜKSEK | CSP hâlâ reportOnly + JWT localStorage'ta, 7 gün, iptalsiz | `server.ts:127-141`, `api.ts:74-78`, `src/lib/api.ts:11-19` |
| H-4 | YÜKSEK | `POST /coupons/:id/use` — rol/yetki kontrolü yok, kupon sabotajı | `new-features.ts:273-288` |
| H-5 | YÜKSEK | Kimliksiz push kötüye kullanımı (`/push/test`, `/push/unsubscribe`) | `api.ts:2380-2413` |
| H-6 | YÜKSEK | `reset-password` e-posta sayımı + çalışmayan akış | `api.ts:772-780` |
| M-1 | ORTA | Zayıf şifre politikası (min 6 karakter, karmaşıklık yok) | `api.ts:608`, `api.ts:1240` |
| M-2 | ORTA | Yönetici endpoint'lerinde ham gövde ile mass assignment | `new-features.ts:229,247,714,726,1176,1188` |
| M-3 | ORTA | NoSQL operatör enjeksiyonu ve e-posta sayımı (arkadaş/hediye/rezervasyon) | `new-features.ts:362,499,872-880` |
| M-4 | ORTA | MongoDB kimlik doğrulaması yok (docker ağı içinde) | `docker-compose.yml` |
| M-5 | ORTA | KVKK: aydınlatma metni, veri taşıma/silme hakkı, açık rıza yok | bkz. §6 |
| M-6 | ORTA | Oturum yaşam döngüsü: parola değişimi token'ı geçersiz kılmıyor | `api.ts:74-78`, `auth.ts:47` |
| M-7 | ORTA | Masa siparişlerinde bakiye tahsilatı yok + sınırsız adet → sınırsız borç | `api.ts:2092-2166` |
| M-8 | ORTA | Genel JSON gövde limiti 10 MB | `server.ts:200` |
| M-9 | ORTA | Değerlendirme (review) sisteminde satın alma doğrulaması ve uzunluk sınırı yok | `new-features.ts:63-107` |
| L-1 | DÜŞÜK | JWT algoritma sabitlenmesi yok; sadakat QR aynı secret'ı kullanıyor | `auth.ts:47`, `loyalty.ts:25-27` |
| L-2 | DÜŞÜK | `.vapid-keys.json` gitignore'da yok | `.gitignore`, `vapid.ts:5` |
| L-3 | DÜŞÜK | bcryptjs maliyeti 10 (JS gerçekleme, yavaş doğrulama) | `User.ts:139-145` |
| L-4 | DÜŞÜK | Kayıt akışında captcha yok; hesap çöpütlüğü | `api.ts:588` |
| L-5 | DÜŞÜK | Masa oturum token'ı URL yolunda (log sızıntısı) | `api.ts:2756` |
| L-6 | DÜŞÜK | `express-rate-limit` v8'de `max` seçeneği deprecated | `server.ts:184-198` |
| L-7 | DÜŞÜK | Genel IP'nin repoda ifşası (`187.124.189.250`) | `nginx/generate-ssl.sh` |
| L-8 | DÜŞÜK | Personel aramasında aşırı veri ifşası (telefon, doğum tarihi, adresler) | `api.ts:1204-1225` |
| L-9 | DÜŞÜK | Garson çağrısı / sohbet / not alanlarında spam'e açık sınırsız girdi | `new-features.ts:779-823,1033-1060` |

---

## 2. KRİTİK Bulgular

### C-1 — Kullanıcı kendi bakiyesini kendisi yükleyebiliyor (sınırsız para basma)

- **Konum:** `src/server/routes/api.ts:1258-1290` (`POST /api/users/me/balance`)
- **Seviye:** KRİTİK (finansal sahtekârlık, iş mantığı)
- **Açıklama:** Endpoint yalnızca `attachAuth` ile korunuyor; **rol/kasa kontrolü yok**. Gövdeden gelen `amount` (≤ 10.000) doğrudan kullanıcının bakiyesine ekleniyor. Hiçbir ödeme sağlayıcısı, kasa onayı veya fiş doğrulaması yok.
- **İstismar:** Giriş yapmış herhangi bir müşteri:
  ```http
  POST /api/users/me/balance
  { "amount": 10000 }
  ```
  isteğini dilediği kadar tekrarlayarak sınırsız bakiye oluşturur, ardından bu bakiyeyle sipariş verir. Ayrıca `revenueAmount` ve `bonusAmount` da istemciden geldiği için (`api.ts:1271-1272`) analitik/raporlama verisi de zehirlenebilir (10.000 TL yükleme 1 TL "ciro" olarak kaydedilebilir).
- **Öneri:**
  1. Bu endpoint'i istemciden tamamen kaldırın; bakiye yüklemeyi yalnızca `POST /users/:id/balance` (`staff/manager`, `api.ts:1292`) üzerinden, kasa rolü ile yapın.
  2. Gerçek ödeme entegrasyonu (Iyzico/Stripe) gelene kadar müşteri tarafı "yükleme" akışını tamamen devre dışı bırakın.
  3. `revenueAmount`/`bonusAmount` alanlarını istemci gövdesinden hesaplamayın; sunucu tarafında belirleyin.
  4. Yükleme işlemleri için denetim kaydı (kim, ne zaman, hangi IP) tutun ve tutar üst sınırını genel değil günlük toplam bazında limitleyin.

### C-2 — Kayıt sırasında e-posta ile rol yükseltme (doğrulanmamış e-posta → manager/staff)

- **Konum:** `src/server/routes/api.ts:653` (`resolveRoleForEmail(email)` çağrısı), `src/server/services/role.ts:24-39`, `src/server/constants.ts:3`
- **Seviye:** KRİTİK (ayrıcalık yükseltme, hesap ele geçirme)
- **Açıklama:** Kayıt akışı, e-posta adresine göre rol atıyor:
  - E-posta `DEFAULT_MANAGER_EMAILS` içindeyse (`admin@bancho.cafe`, `yonetici@bancho.cafe` — koda gömülü) → **manager**,
  - `Staff` koleksiyonunda kayıtlıysa → **staff/manager**.
  E-posta adresinin sahibi **hiçbir şekilde doğrulanmıyor** (SMTP entegrasyonu yok, `proje-bilgi-formu.md` da bunu doğruluyor).
- **İstismar senaryoları:**
  1. Saldırgan `yonetici@bancho.cafe` ile kayıt olur → doğrudan manager hesabı kazanır. (`admin@bancho.cafe` bootstrap admin tarafından alınmış olsa bile ikinci sabit adres büyük olasılıkla boştur.)
  2. Yönetici, henüz sisteme kaydolmamış bir çalışanı `POST /api/staff` ile personel listesine ekler → saldırgan o çalışanın e-posta adresiyle kayıt olur → **staff rolü** kazanır (sipariş durumları, müşteri araması, masa kapatma yetkileri).
  3. Bootstrap admin yalnızca veritabanı **tamamen boşken** oluşturuluyor (`autoSeed.ts:109-110` — `productCount > 0` ise erken dönüş). Ürünler dolu ama admin silinmiş bir veritabanında `admin@bancho.cafe` serbest kalır.
- **Öneri:**
  1. Kayıt sırasında rol atamasını **her zaman `customer`** yapın; ayrıcalıklı roller yalnızca oturum açmış bir manager tarafından verilsin.
  2. E-posta doğrulama zorunlu kılın (işaret: `emailVerified`); doğrulanmamış e-posta ile hiçbir rol eşlemesi yapılmamalı.
  3. `DEFAULT_MANAGER_EMAILS` sabitini koddan çıkarıp yalnızca ortam değişkenine taşıyın; bootstrap admin'i "veritabanı boşsa" yerine "admin yoksa" koşuluna bağlayın.
  4. Ayrıcalıklı bir hesabın e-posta değişikliğinde yeniden doğrulama + mevcut parola isteyin (`PATCH /users/me` bugün e-postayı doğrulamadan değiştirebiliyor, `api.ts:883-893`).

### C-3 — TLS özel anahtarı git geçmişine işlenmiş

- **Konum:** Commit `590225d` — `nginx/ssl/live/privkey.pem` ve `nginx/ssl/live/fullchain.pem` (sonraki `a16cbd3` ile silindi, ancak **geçmişte hâlâ okunabilir**)
- **Doğrulama:** `git show 590225d:nginx/ssl/live/privkey.pem` → `BEGIN PRIVATE KEY` içeriği erişilebilir; sertifika `CN=187.124.189.250`, geçerlilik 01.08.2026–01.08.2027.
- **Seviye:** KRİTİK (kriptografik anahtar sızıntısı)
- **Etki:** Anahtar elde eden biri, nginx'e giden trafiği aktif olarak (MITM) çözemez (PFS varsayımıyla), ancak anahtar sızdığı için sertifika **güvenilir sayılamaz**; ayrıca geçmişin her klonunda kalıcı olarak ifşa durumundadır. Sertifika ortak IP'ye bağlanmış olduğundan host'unuz için de varlık bilgisi ifşası söz konusudur.
- **Öneri:**
  1. Anahtarı **rotasyon** yapın: Let's Encrypt ile yeni sertifika alın, eski anahtarı tüm ortamlarda kaldırın.
  2. Git geçmişini temizleyin (`git filter-repo` veya BFG) ve tüm gizli bilgileri içeren commit'leri yeniden yazın; uzak depo erişimi olan herkesin yeni klon almasını sağlayın.
  3. `nginx/ssl/` yolu zaten `.gitignore`'da; ayrıca `git ls-files` ile periyodik gizli dosya taraması yapın.
  4. `generate-ssl.sh` içindeki gerçek IP'yi çıkarıp parametrik yapın (bkz. L-7).

### C-4 — Hediye ve abonelik akışlarında bakiye yarış koşulu (TOCTOU)

- **Konum:**
  - `src/server/routes/new-features.ts:511-521` (`POST /gifts/send` — bakiye kontrolü sonra ayrı `$inc`)
  - `src/server/routes/new-features.ts:575-577` (`POST /gifts/:id/claim` — `$inc: { balance: gift.amount }`)
  - `src/server/routes/new-features.ts:641-652` (`POST /subscriptions/subscribe` — kontrol sonra `$inc`)
- **Seviye:** KRİTİK (finansal bütünlük)
- **Açıklama:** Üçü de "önce `req.authUser.balance` oku → kontrol et → ayrı `updateOne({ $inc })`" deseni kullanıyor. `req.authUser` istek başında yüklenmiş kalıcı bir dokümandır; eşzamanlı istekler hepsinde aynı (eski) bakiyeyi görür. Buna karşılık `POST /orders` ve `table-sessions/pay` doğru biçimde atomik `findOneAndUpdate({ balance: { $gte: X } }, { $inc })` kullanıyor (`api.ts:2157-2161`, `api.ts:3131-3135`) — desen kodda var, uygulanmamış.
- **İstismar:** 100 TL bakiyeli kullanıcı tek sekmede 10 paralel `POST /gifts/send {amount:100}` gönderir → hepsi kontrolü geçer → bakiye **-900**'e düşer ve 10 ayrı 100 TL'lik hediye doğar; alıcı hesap bunları claim edince sistemde var olmayan 1000 TL oluşur. Abonelikte aynı desenle ücretsiz çoklu abonelik alınabilir.
- **Öneri:** Üç yerde de koşullu atomik güncellemeye geçin:
  ```ts
  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!updated) return res.status(400).json({ message: "Yetersiz bakiye" });
  ```
  Ayrıca `amount` değerini `Number.isInteger`/2 ondalık basamakla normalleştirin ve üst sınır ekleyin; şema düzeyinde `balance: { min: 0 }` kısıtı ve `Gift`/`Subscription` üzerinde kullanıcı başına eşsizlik (idempotency anahtarı) değerlendirin.

---

## 3. YÜKSEK Bulgular

### H-1 — Varsayılan / örtük yönetici şifreleri

- **Konum:**
  - `src/server/services/autoSeed.ts:150` — `process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!"` (ortam değişkeni **zorunlu değil**, sadece fallback)
  - `docker-compose.yml` — `BOOTSTRAP_ADMIN_PASSWORD: ${BOOTSTRAP_ADMIN_PASSWORD:-Admin123!}` (aynı varsayılan)
  - `.env.example` — gerçek görünümlü `AdminPassword2026!` değeri repoda kayıtlı
- **Seviye:** YÜKSEK
- **Etki:** Operatör `.env` dosyasını doldurmazsa yönetici hesabı herkesin bilebileceği `Admin123!` şifresiyle açılır. `docker-compose.yml` içinde `JWT_SECRET` ve `ALLOWED_ORIGINS` zorunlu kılınmışken (`:?` sözdizimi) şifre zorunlu kılınmamış — tutarsızlık.
- **Öneri:** `BOOTSTRAP_ADMIN_PASSWORD` için de `${VAR:?message}` zorunluluğu ekleyin; kod seviyesindeki `"Admin123!"` fallback'ini tamamen kaldırın (şifre yoksa admin oluşturma + açık hata verin); ilk açılışta rastgele şifre üretip yalnızca sunucu log'una bir kez yazmak alternatiftir; `.env.example` içindeki gerçek parola benzeri değeri `change-me` ile değiştirin. Bootstrap admin'in ilk girişte şifre değişikliğine zorlanmasını sağlayın.

### H-2 — X-Forwarded-For sahteciliği ile hız limiti atlatma

- **Konum:**
  - `nginx/conf.d/default.conf` — `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (hem `/` hem `/uploads/` bloğunda)
  - `server.ts:119` — `app.set("trust proxy", 1)`
- **Seviye:** YÜKSEK
- **Açıklama:** nginx istemcinin gönderdiği `X-Forwarded-For` (XFF) başlığını **ekleyerek** (append) iletir. `trust proxy = 1` olduğunda Express, XFF zincirinin güvenilen tek hop'tan (nginx) sonraki değerini — yani istemcinin kendi gönderdiği en soldaki değeri — `req.ip` olarak alır. İstemci her istekte farklı bir sahte XFF göndererek hız limiti anahtarını değiştirir.
- **Etki:** `authLimiter` (30/15 dk) ve `generalApiLimiter` (600/15 dk) tamamen etkisizleşir: dağıtık olmayan tek bir kaynak IP'den bile sınırsız oturum açma denemesi (brute force), sınırsız kayıt (hesap çöpütlüğü) ve sınırsız API kullanımı mümkün olur. `express-rate-limit`'in v8'deki `validations.trustProxy` uyarısı da bu yanlış yapılandırmayı işaretler.
- **Öneri:** Tek proxy katmanı olduğu için nginx'te XFF'i **üzerine yazarak** iletin: `proxy_set_header X-Forwarded-For $remote_addr;` (veya `real_ip` modülü + `set_real_ip_from` iç katman tanımı). `X-Real-IP` zaten `$remote_addr` olarak gönderiliyor; uygulama tarafında hız limiti `keyGenerator`'ında `x-real-ip` başlığını kullanmak da alternatiftir. Brute force'a derinlemesine savunma için oturum açma tarafında hesap bazlı kilitleme (5 başarısız deneme → 15 dk kilit) ve gecikmeli yanıt ekleyin.

### H-3 — CSP hâlâ `reportOnly` + uzun ömürlü, iptal edilemeyen JWT `localStorage`'ta

- **Konum:**
  - `server.ts:127-141` — `contentSecurityPolicy: { reportOnly: true, ... }` (kod yorumu "raporlar temizlenince zorlanacak" diyor; **hâlâ açık**)
  - `api.ts:74-78` — `expiresIn: "7d"`, içinde `jti`/oturum sürümü yok
  - `src/lib/api.ts:11-19` — token `localStorage`'da
- **Seviye:** YÜKSEK (birleşik XSS etki alanı)
- **Açıklama:** React varsayılan olarak kaçış yaptığı için bugün bilinen bir XSS zinciri yoktur (koddaki `dangerouslySetInnerHTML` kullanımı: **0 sonuç**). Ancak tek bir XSS olması durumunda: (a) CSP yalnızca rapor üretir, engellemez; (b) token 7 gün geçerlidir ve `localStorage`'tan okunabilir; (c) `POST /auth/logout` yalnızca `sessionRole` sıfırlar (`api.ts:730-737`), token'ı geçersiz kılmaz; (d) parola değiştirme (`api.ts:1227-1256`) da eski token'ları düşürmez.
- **Öneri:**
  1. CSP'yi zorunlu moda geçirin (`reportOnly` kaldırın; gerekirse `Content-Security-Policy-Report-Only` başlığını ayrıca, paralel bir direktif setiyle bir süre daha çalıştırın). `scriptSrc: ["'self'"]` üretimde zaten yeterli görünüyor.
  2. Token ömrünü kısaltın (ör. 2–8 saat access token) ve bir refresh mekanizması ekleyin; User şemasına `tokenVersion` alanı ekleyip JWT'ye koyup `attachAuth` içinde kontrol edin — böylece parola değişimi/çıkış tüm token'ları düşürür.
  3. `httpOnly` cookie + `SameSite=Strict` taşıma modeline geçiş değerlendirin (CORS `credentials: false` bugün buna izin verecek şekilde kuruludur; değişiklik CSRF önlemi de ister — bkz. not).
  4. `logout`'ta sadakat QR'sında olduğu gibi sunucu tarafı iptal listesi (kısa TTL'li `jti` redlist) değerlendirin.

### H-4 — `POST /coupons/:id/use` — yetki kontrolü yok, kupon sabotajı

- **Konum:** `src/server/routes/new-features.ts:273-288`
- **Seviye:** YÜKSEK
- **Açıklama:** Endpoint yalnızca `attachAuth` ile korunuyor ("internal, called when order is completed" yorumuna rağmen genel API'de açık). Şunları yapabilir:
  - **Herhangi bir** kuponun `usedCount`'unu keyfi sayıda artırıp `usageLimit`'i tüketerek kampanyayı herkese karşı tüketebilir (sabotaj),
  - Kendini `usedBy` listesine ekleyerek kendi kullanımını **engelleyebilir** (kullanıcı experience bozma),
  - Geçersiz/bilinmeyen `id` değerleriyle keşif yapabilir.
  Sipariş tamamlandığında gerçek kullanım sunucu tarafında zaten ayrı bir yerde işlenmiyor — kupon indirimi `POST /orders` akışına bağlı değil; bu endpoint güvenilir bir kaynak olarak tasarlanmamalı.
- **Öneri:** Endpoint'i tamamen kaldırın ve kupon kullanımını sipariş tamamlanma akışına (`PATCH /orders/:id/status` → `completed`) sunucu tarafı, tek atomik işlem olarak gömün. Kalacaksa: `restrictTo("customer")` + sipariş sahipliği doğrulaması + `usedCount`'un `usageLimit`'i aşamayacağı atomik koşullu güncelleme (`findOneAndUpdate({ _id, $expr: { $lt: ["$usedCount", "$usageLimit"] } }, ...)`) ekleyin.

### H-5 — Kimliksiz push endpoint'lerinin kötüye kullanımı

- **Konum:**
  - `api.ts:2388-2413` — `POST /push/test` (`attachOptionalAuth`): kimliği doğrulanmamış bir istemci, gövdede `orderId` vererek **herhangi bir siparişin** cihazlarına bildirim gönderebilir
  - `api.ts:2380-2386` — `POST /push/unsubscribe` (hiç middleware yok): bilinen endpoint URL'si ile **başkasının** push aboneliğini silebilir
- **Seviye:** YÜKSEK (spam/rahatsız etme, servis bozma)
- **Etki:** Sipariş token'ları QR menü akışından tahmin edilebilir/erişilebilir olduğundan, saldırgan müşterilere sınırsız sahte "siparişiniz hazır" bildirimi gönderebilir (kimlik avı için zemin) veya personelin aboneliklerini silerek operasyonel bildirimleri düşürebilir.
- **Öneri:** `/push/test`'i `attachAuth` + kendi aboneliğine/emasilsine sınırlayın; `orderId` hedeflemesini kaldırın ya da personel rolü isteyin. `/push/unsubscribe` için en azından aboneliğin sahibi olduğunu doğrulayın (endpoint + userId eşleşmesi) veya kimliği doğrulanmamış silmeyi tamamen kaldırın. Push aboneliklerine özel ayrı bir hız limiti (ör. 10/dk) ekleyin.

### H-6 — Parola sıfırlama: e-posta sayımı + çalışmayan akış

- **Konum:** `api.ts:772-780`
- **Seviye:** YÜKSEK
- **Açıklama:** `POST /auth/reset-password` yanıtı `success: Boolean(user)` döndürüyor — kayıtlı e-postaları birebir doğrulamaya açık sayım (enumeration) kanalı. Ayrıca akış tamamen sahte: herhangi bir e-posta gönderimi, token üretimi ya da parola değişikliği yok ("MVP'de lokal olarak kabul edildi" mesajı).
- **Öneri:** Yanıtı her zaman aynı yapın (`success: true` sabit + genel mesaj). Gerçek akış gelene kadar endpoint'i devre dışı bırakın (404). SMTP entegrasyonu yapıldığında: tek kullanımlık, kısa TTL'li (ör. 30 dk) sıfırlama token'ı, yanıt öncesi sabit zamanlı karşılaştırma, parola değişince tüm oturumların düşürülmesi (bkz. H-3) uygulayın. Kayıt endpoint'indeki 409 "e-posta zaten kullanımda" (`api.ts:650`) da benzer sayım kanalıdır; ürün kararı olarak kabul edilebilir ama parola sıfırlama ile tutarsızdır — belgelendirin.

---

## 4. ORTA Bulgular

### M-1 — Zayıf şifre politikası

- **Konum:** `api.ts:608-610` (kayıt), `api.ts:1240-1242` (değiştirme)
- Minimum 6 karakter; karmaşıklık, yasak parola listesi, OWASP parola gücü kontrolü yok. `Admin123!` gibi varsayılanlarla birleşince (H-1) etkisi büyür.
- **Öneri:** Minimum 8–10 karakter + `zxcvbn`/`@zxcvbn-ts` benzeri puanlama (skor ≥ 2), yaygın parola kara listesi, kullanıcı adı/e-posta içermeme kontrolü.

### M-2 — Yönetici endpoint'lerinde ham gövde ile mass assignment

- **Konum:**
  - `new-features.ts:214-235` — `POST /coupons`: `CouponModel.create(req.body)` (koddan gelen `couponData` mutasyonu dışında doğrulama yok)
  - `new-features.ts:238-257` — `PATCH /coupons/:id`: `$set: updates` (ham gövde; `usedCount`, `usedBy`, `createdAt` dahil her alan üzerine yazılabilir)
  - `new-features.ts:712-720` — `POST /subscriptions/plans`: `create(req.body)`
  - `new-features.ts:723-737` — `PATCH /subscriptions/plans/:id`: `$set: req.body`
  - `new-features.ts:1170-1182`, `new-features.ts:1185-1199` — envanter create/patch: aynı desen
- **Seviye:** ORTA (manager token'ı ele geçirildiğinde hasarı büyütür; şema dışı alan enjeksiyonu da mümkündür)
- **Öneri:** Beyaz listeli alan çıkarımı (explicit picking) uygulayın — `api.ts` içindeki `POST /campaigns` (1648-1708) bu konuda iyi bir örnektir; aynı deseni taşıyın. Zod/Joi şema doğrulaması eklemek kalıcı çözümdür. `$set`'e asla doğrudan `req.body` vermeyin. `PATCH /users/:id` (1391-1445) doğru biçimde yalnızca `role` alıyor — iyi.

### M-3 — NoSQL operatör enjeksiyonu ve e-posta sayımı

- **Konum:**
  - `new-features.ts:362` — `UserModel.findOne({ email: friendEmail })`: `friendEmail` doğrudan `req.body`'den; `{"$regex": "..."}` gibi bir nesne gönderilebilir (Express'in varsayılan `qs` gövde ayrıştırıcısı iç içe nesne üretir). Regex ile e-posta keşfi + 404/200 ayrımı sayım
  - `new-features.ts:499` — `POST /gifts/send` `recipientEmail` aynı şekilde
  - `new-features.ts:870-888` — `GET /reservations`: `req.query.date`/`req.query.status` nesne olabilir (`?date[$ne]=x` → operatör enjeksiyonu; staff/manager rolü gerekli)
- **Öneri:** Tüm dış girdileri sorguya sokmadan `String(...)` ile normalleştirin (`api.ts:696` login'de güzelce yapılmış — buraya taşısın). Express 4'te `query parser: 'simple'` ayarı nesne sorgularını engeller. Mongoose şema `strict` modu alan filtresi yapar ama `$ne`/`$regex` değer seviyesinde operatör olduğu için string'e cast etmeden güvenli değildir.

### M-4 — MongoDB kimlik doğrulamasız

- **Konum:** `docker-compose.yml` — `MONGODB_URI: mongodb://mongodb:27017/cafe_db` (kullanıcı/şifre yok), `mongo:7` imajı varsayılan auth'suz.
- **Seviye:** ORTA (portlar `expose` ile iç ağla sınırlı, `ports` ile host'a açılmamış — iyi; ancak aynı Docker ağındaki herhangi bir ele geçirilmiş konteyner/compromised komşu servis veritabanına tam erişir; host'taki her süreç de `mongodb:27017`'ye ağ seviyesinde ulaşabilir olma riski değerlendirilmeli).
- **Öneri:** `MONGO_INITDB_ROOT_USERNAME/PASSWORD` ile auth açın, URI'ye credentials ekleyin; `restart: unless-stopped` ile birlikte healthcheck'i auth'lu bağlantıyla yapın. Uzun vadede veritabanı şifrelemesi (KMIP/LUKS) değerlendirin (KVKK m.12 veri güvenliği).

### M-5 — KVKK uyum açıkları

Ayrıntılar §6'da; özetle: aydınlatma metni/açık rıza yok, veri taşıma (m.11/VERİ TAŞIMA) hakkı karşılanmıyor, kullanıcı self-servis hesap silme yok (yalnızca manager `DELETE /users/:id`), arkadaş listesi e-posta ifşası, 12 yaş alt kontrolü var (olumlu) ancak açık rıza mekanizması yok, log'lar kişisel veri içeriyor ve saklama politikası tanımsız.

### M-6 — Oturum yaşam döngüsü

- **Konum:** `api.ts:74-78`, `auth.ts:39-62`
- Parola değişimi, rol düşürme (`PATCH /users/:id` rol değiştiriyor ama eski token aynı kalıyor → düşürülen staff 7 gün daha staff yetkisiyle gezebilir, çünkü rol `attachAuth`'ta her istekte DB'den okunuyor — **rol değişimi anında etkili**, iyi; ancak `sessionRole` mekanizması `getEffectiveRole`'de doğru işletiliyor) ve çıkış; hiçbiri token'ı geçersiz kılmıyor. Token çalındığında 7 gün pencere.
- **Öneri:** H-3'teki `tokenVersion` önerisi bu bulgunun da çözümüdür. Ek olarak hassas işlemlerde (rol değişikliği, e-posta değişikliği) yeniden kimlik doğrulama (parola teyidi) isteyin.

### M-7 — Masa siparişlerinde tahsilat yok + sınırsız adet

- **Konum:** `api.ts:2092-2166` — `quantity` üst sınırsız (`Math.max(1, Number(item.quantity) || 1)`, 2107); `tableSessionToken` varsa bakiye tahsilatı hiç yapılmıyor (2155-2166); `POST /table-sessions/leave` `action: "no-pay"` ile borç bırakarak çıkış serbest (3291-3301).
- **Seviye:** ORTA (iş riski + kötüye kullanım): müşteri masaya oturup sınırsız adette sipariş verip ödemeden ayrılabilir; kasa `pay` ile kapatana kadar borç_askıda kalır. Ayrıca adet tam sayıya zorlanmıyor (2.5 adet → kesirli toplamlar).
- **Öneri:** `quantity` için üst sınır (ör. 50) ve `Number.isInteger` kontrolü; masa siparişinde de sipariş anında katılımcı bakiyesi/kredisi kontrolü veya en azından kullanıcı başı açık borç limiti; `no-pay` çıkışında kullanıcıyı işaretleyip yeni masa katılımını borç kapatana kadar engelleme.

### M-8 — Genel gövde limiti 10 MB

- **Konum:** `server.ts:200` — `express.json({ limit: "10mb" })`
- Tüm JSON endpoint'leri için 10 MB aşırı büyük; nginx `client_max_body_size 12M` ile uyumlu olarak hatasız geçer. CPU/bant genişliği tabanlı DoS vektörü. Görüntü yükleme zaten `multer` ile ayrı işleniyor (8 MB, `api.ts:59-72`).
- **Öneri:** `express.json` limitini 256 KB–1 MB'a çekin; `/uploads/image` için multipart limit'ini multer zaten yönetiyor. Sohbet/rezervasyon gibi büyük gövde gerçekten gerekiyorsa o router'a özel limit tanımlayın.

### M-9 — Değerlendirme sistemi doğrulaması

- **Konum:** `new-features.ts:63-107`
- `orderId`/`productId` kullanıcının gerçek siparişine ait mi kontrolü yok (sahte/2. günde silinmiş başkalarının siparişine review yazılabilir), `comment`/`staffComment` uzunluk sınırı yok (model `maxlength` da yok — `Review.ts`), `productName` istemciden güveniliyor. `GET /reviews/product/:productId` (40-49) kimliksiz ve tam ad + soyad gösteriyor (bkz. M-5/L-8).
- **Öneri:** Sipariş sahipliği + sipariş durumu `completed` kontrolü; `comment` için 1000 karakter sınırı (model + route); `productName`'i sunucuda ürün kaydından çözün; kamuya açık listede yalnızca `username` gösterin.

---

## 5. DÜŞÜK Bulgular

### L-1 — JWT algoritma sabitlenmesi ve secret yeniden kullanımı
`auth.ts:47` ve `auth.ts:72` — `jwt.verify(token, secret)` çağrılarında `algorithms` belirtilmemiş. `jsonwebtoken@9`'da string secret yalnızca HMAC ailesiyle doğrulanabildiğinden algoritma karışıklığı (confusion) bugün istismar edilebilir değil; yine de `jwt.verify(token, secret, { algorithms: ["HS256"] })` sabitlemesi savunma derinliği sağlar. Sadakat QR token'ları (`loyalty.ts:25-27`, 151-176) ana JWT secret'ını paylaşıyor — `purpose` alanı ayrımı iyi bir pratik, ancak ayrı bir `LOYALTY_JWT_SECRET` daha temiz bir izolasyon olur. TTL 180 saniye (iyi).

### L-2 — `.vapid-keys.json` gitignore'da yok
`src/server/config/vapid.ts:5` dosyayı `process.cwd()` altına yazıyor; `.gitignore` bunu kapsamıyor (`.env*` hariç). Bugün izlenmiyor (`git ls-files` doğrulandı) ama yanlışlıkla commit edilme riski var. `.vapid-keys.json` satırını `.gitignore`'a ekleyin; dosya push özel anahtarıdır — sızması halinde saldırgan site adına push gönderebilir.

### L-3 — bcryptjs, maliyet 10
`User.ts:139-145` — 10 tur kabul edilebilir (OWASP minimumu); bcryptjs saf JS olduğundan doğrulama yavaştır (oturum açma endpoint'inde CPU tüketimi — H-2 ile birleşince brute force maliyeti düşer). `bcrypt` (native) paketine geçiş ve maliyet 12 değerlendirin.

### L-4 — Kayıt akışında bot önlemi yok
`api.ts:588` — H-2 düzeltilse bile IP başına 30 kayıt/15 dk sınırsız hesap üretimine izin verir. Honeypot alanı + davranışsal limit (aynı IP/gün başına kayıt sayısı) veya Turnstile/hCaptcha ekleyin.

### L-5 — Masa oturum token'ı URL yolunda
`api.ts:2756` — `GET /table-sessions/session/:token` token'ı nginx erişim log'larına düşürür (log'lara erişimi olan taraf oturum bilgisi görebilir). Token'ı `Authorization` dışı bir başlıkla veya gövdeyle sorgulamak log sızıntısını azaltır. `poll-status` (2821-2854) katılımcı olmayanlara masanın oturum var/yok bilgisini sızdırıyor — bilgi ifşası düşük etkili.

### L-6 — `express-rate-limit` v8'de `max` deprecated
`server.ts:184-198` — `limit` adını kullanın (v8'de `max` hâlâ destekleniyor ama uyarı üretiyor; `node_modules` içi doğrulama: `limit: passedOptions.max ?? 5`).

### L-7 — Genel IP ifşası
`nginx/generate-ssl.sh` — CN olarak `187.124.189.250` gömülü; `proje-bilgi-formu.md` altyapı detayları içeriyor. Betiği argümanlı yapın; formu repodan çıkarıp özel saklayın.

### L-8 — Personel aramasında aşırı veri ifşası
`api.ts:1204-1225` — `/users/search` (staff) tam `serializeUser` döndürüyor: telefon, doğum tarihi, adresler, ödeme yöntemi meta verileri dahil. Amaç telefonla müşteri bulmaksa projection'ı `name surname username phone avatar` ile sınırlayın (KVKK m.4 veri minimizasyonu).

### L-9 — Sınırsız metin girdileri
`new-features.ts:779-823` (sohbet mesajı), `new-features.ts:1033-1060` (garson çağrısı `message`), `api.ts:2177` (sipariş `not`), hediye `message` — hepsi sınırsız. 500–1000 karakter sınırı + (sohbet/garson çağrısı için) kullanıcı bazlı hız limiti ekleyin. `bio` alanında 200 karakter sınırı zaten var (`api.ts:923`) — iyi örnek.

---

## 6. KVKK Uyum Değerlendirmesi

| Gereklilik | Durum | Kanıt / Konum |
|---|---|---|
| Şifrelerin güvenli saklanması | **Sağlanıyor** | `User.ts:139-145` bcrypt(10); `serializeUser` parolayı tüm yanıtlardan çıkarıyor (`api.ts:88-101`) |
| Veri minimizasyonu (m.4) | **Kısmen** | Kayıtta telefon + doğum tarihi zorunlu (588-601); arkadaş listesi e-postaları ifşa ediyor (`new-features.ts:308-316, 334-347`); personel araması L-8 |
| Doğru ve güncel olma (m.5) | Sorun yok | Kullanıcı kendi profilini güncelleyebiliyor |
| Veri güvenliği (m.12) | **Eksik** | C-1..C-4, M-4; ayrıca veritabanı şifrelemesi yok |
| Aydınlatma yükümlülüğü (m.10) | **Sağlanmıyor** | Repoda aydınlatma metni / kvkk sayfası / çerez politikası bileşeni yok (`src/components` taraması boş); kayıt formunda rıza metni yok |
| Açık rıza (m.6) | **Sağlanmıyor** | Puan liderlik tablosu için opt-out var (olumlu, `new-features.ts:1306-1348`) ancak diğer paylaşımlar (kamuya açık profil, takipçi listeleri) için rıza akışı yok; profil gizlilik ayarları var (`User.ts:83-93`) — opt-out esaslı, KVKK'da açık rıza opt-in olmalı |
| Veri taşımak hakkı (m.11) | **Sağlanmıyor** | Kullanıcının kendi verisini dışa aktarma endpoint'i yok (yalnızca yönetim paneli görüntülüyor) |
| Silinme hakkı (m.7) | **Kısmen** | Self-servis hesap silme yok; yalnızca manager `DELETE /users/:id` (`api.ts:1447-1479` — ilgili kayıtları kaskad siliyor, iyi) |
| İlgili kişinin hakları başvuru kanalı | **Sağlanmıyor** | Veri sorumlusu iletişim/başvuru formu yok |
| Çerez politikası | **Sağlanmıyor** | Oturum localStorage/Authorization taşıyıcısıyla yönetiliyor (çerez kullanılmıyor — sadeleşme), ancak Web Push + Service Worker (`public/sw.js`) bildirim rızası tarayıcı düzeyinde; yine de politika metni gerekli |
| Kişisel veri içeren log'lar | **Risk** | `console.error(..., error)` hata log'ları; `ChangeLog` kullanıcı adı/işlem detayı sınırsız saklanıyor; nginx access log'ları IP + masa token'ı (L-5) — saklama süresi tanımlı değil |

**Önerilen yol haritası (KVKK):**
1. Kayıt akışına KVKK aydınlatma metni + açık rıza onayı ekleyin (rıza kaydını tarih/sürümlü saklayın).
2. "Hesabım" bölümüne VERİ TAŞIMA (JSON/CSV dışa aktarma) ve HESAP SİLME self-servis butonları ekleyin; silme isteğinde 30 gün bekleme + geri alma penceresi uygulayın.
3. Puan tablosu/profil görünürlüğü için opt-in rıza modeline geçin; arkadaş listelerinden e-posta alanını kaldırın (kullanıcı adı yeterli).
4. Log saklama politikası tanımlayın (ör. access log 30 gün, hata log'u 90 gün) ve masa token'ının URL'den çıkarın (L-5).
5. Veri sorumlusu iletişim bilgisi ve başvuru sürecini siteye ekleyin; VERBİS kaydı süreçlerini işletin.

---

## 7. Dosya Yükleme Güvenliği (Ayrıntılı)

`POST /uploads/image` (`api.ts:786-820`) + `storage.ts`:

| Kontrol | Durum | Not |
|---|---|---|
| Boyut limiti | ✅ | multer 8 MB (`api.ts:62`); nginx 12M ile uyumlu |
| MIME filtresi | ⚠️ | `file.mimetype.startsWith("image/")` (`api.ts:65`) — istemci kontrollü başlık; ancak **sharp yeniden kodladığı** için politika yürütülür (`storage.ts:61-70`) |
| İçerik doğrulama/zararlı temizliği | ✅ | WebP'e dönüşüm payload'ları etkisizleştirir; SVG yüklense bile rasterize edilir |
| Dekompresyon bombası | ✅ (kısmen) | sharp varsayılan `limitInputPixels` (~263 MP) aktif |
| Dosya adı güvenliği | ✅ | Sunucu üretimi: `Date.now()-random8hex.webp` (`storage.ts:57`); path traversal yüzeyi yok |
| Kapsam (scope) yetkilendirmesi | ✅ | avatar herkese, diğerleri manager (`api.ts:804-806`) |
| Statik sunum | ✅ | `/uploads` express.static (`server.ts:201`); uzantı → içerik tipi güvenli (.webp) |
| Silme güvenliği | ✅ | `deleteManagedImage` regex + `path.resolve` kök kontrolü (`storage.ts:82-94`) — traversal'a karşı iyi |
| Kalıntı temizliği | ⚠️ | `clearManagedUploads` (`storage.ts:97-143`) yalnızca `system/reset`'te çalışır |
| Zayıf nokta | ⚠️ | `avatar`/`image` alanları serbest metin kabul ediyor (`normalizeImageValue`, `api.ts:163-165`): kullanıcı avatar'ını keyfi harici URL yapabilir → harici içerik sızıntısı/mixed-content; `isManagedImagePath` yalnızca silmede. **Öneri:** kabul anında `/uploads/...webp` veya boşlukla sınırlayın. |

Genel değerlendirme: dosya yükleme zinciri **tasarım olarak sağlıklı**; yukarıdaki URL kısıtı ve (opsiyonel) `sharp` üzerinde `failOn` sıkılaştırması dışında acil işlem gerekmez.

---

## 8. Docker / Nginx Yapılandırması

**İyi uygulananlar:** üretimde `ALLOWED_ORIGINS` zorunlu + wildcard reddi (`server.ts:150-160`, `docker-compose.yml` `:?`), MongoDB dışa kapalı (`expose`), nginx `server_tokens off`, TLSv1.2/1.3 + modern cipher listesi, HSTS `max-age=31536000; includeSubDomains`, X-Frame-Options/nosniff/Referrer-Policy, HTTP→HTTPS yönlendirmesi, ACME dizini ayrık, healthcheck'ler mevcut.

**Bulgular:**
- **C-3 / H-1 / H-2 / M-4 / L-7** yukarıda.
- `NODE_ENV=production` Dockerfile'da gömülü (iyi); `ENABLE_SEED` env değişkeni **hiçbir yerde okunmuyor** (ölü yapılandırma — ya kullanın ya kaldırın; `autoSeed` koşulsuz çalışıyor).
- Runner imajı root kullanıcısıyla çalışıyor. `USER node` + `chown node uploads` ekleyin (container kaçışı etkisini azaltır).
- HSTS `preload` değil (opsiyonel iyileştirme); OCSP stapling kapalı (opsiyonel).

---

## 9. Olumlu Bulgular (korunması gerekenler)

1. **Oturum açma yanıtında genel hata** — kullanıcı sayımı önlenmiş (`api.ts:708-714`).
2. **Atomik bakiye guard'ları** sipariş ve masa ödemesinde (`api.ts:2157-2161`, `3131-3135`) — deseni C-4'teki yerlere taşıyın.
3. **Sunucu tarafı fiyat hesaplama** — sipariş toplamı istemci fiyatı kullanmıyor, DB'den ürün okunuyor (`api.ts:2098-2124`).
4. **Rol hiyerarşisi istek başına DB'den doğrulanıyor** (`attachAuth` + `getEffectiveRole`, `auth.ts:39-62`) — rol düşürülmüş kullanıcı bir sonraki istekte yeni rolünü alır.
5. **Doğrulayıcı/regex kaçışlı arama** — `escapeRegExp` (`api.ts:155-157`) kategori ve kullanıcı aramasında kullanılmış.
6. **Kayıt doğrulamaları** — kullanıcı adı regex, TR telefon biçimi, yaş aralığı, e-posta biçimi (`api.ts:599-641`).
7. **`POST /notifications` kapatılmış** (2280-2282), `POST /users/me/points` 403 (1330-1336) — bilinçli kapatma iyi.
8. **Sipariş durum geçiş makinesi** (2209-2218) — geçersiz geçişler reddediliyor.
9. **`trust proxy` ayarı bilinçli** (yalnız değer yanlış bağlanmış, bkz. H-2).
10. **Ölçekli bootstrap koruması** — `isConfiguredManagerEmail` sabit yönetici hesabının düşürülmesini engelliyor (`api.ts:1413-1415`).

---

## 10. Önceliklendirilmiş Düzeltme Yol Haritası

**Hemen (0–3 gün):**
1. C-1: `POST /users/me/balance`'ı müşteri erişimine kapat.
2. C-2: Kayıtta rol atamasını kaldır (`resolveRoleForEmail` çağrısını `customer` sabitiyle değiştir).
3. C-3: SSL anahtar rotasyonu + git geçmişi temizliği.
4. H-1: Varsayılan admin şifre fallback'lerini kaldır, compose'u `:?` ile zorla.
5. H-6: `reset-password` yanıtından `success: Boolean(user)` kaldır.

**Kısa vade (1–2 hafta):**
6. C-4: Hediye/abonelik akışlarına atomik bakiye guard'ı taşı.
7. H-2: nginx XFF üzerine-yaz + hesap bazlı kilitleme.
8. H-4: `/coupons/:id/use` kaldır/sıkılaştır.
9. H-5: push endpoint'lerini kimlik zorunlu hale getir.
10. M-2/M-3: beyaz listeli alan çıkarımı + tüm gövde/query girdilerinde string normalizasyonu.

**Orta vade (2–6 hafta):**
11. H-3: CSP enforce + kısa token + `tokenVersion` iptal mekanizması.
12. M-1: parola politikası; M-4: Mongo auth; M-7/M-8/M-9 iş mantığı sıkılaştırma; L-2 `.vapid-keys.json` ignore.
13. KVKK paketi (§6): aydınlatma metni + rıza, VERİ TAŞIMA/silme self-servisi, e-posta ifşasının kaldırılması, log saklama politikası.

---

*Rapor sonu. Denetim yalnızca statik analizle sınırlıdır; dinamik sızma testi, bağımlılık zafiyet taraması (`npm audit`) ve altyapı düzeyi kontroller sonraki adımlar arasında önerilir.*
