# Bancho Cafe (Brew & Bloom) — Önceliklendirilmiş Master Plan

- **Tarih:** 02.09.2026
- **Amaç:** Dört ayrı denetim raporunun (güvenlik, backend kalite, frontend mimari, QA/test) tek, önceliklendirilmiş ve uygulanabilir yol haritasına dönüştürülmesi.
- **Kural:** Bu belge yalnızca sentezdir — kod değişikliği içermez. Her madde kaynak rapora referans verir.
- **Öncelik tanımları:**
  - **P0 — Canlıya alınmadan önce düzeltilmeli** (launch blocker): finansal sahtekârlık, ayrıcalık yükseltme, anahtar sızıntısı, sunucu çökmesi/askıya kalması.
  - **P1 — İlk hafta** (≈ 09.09.2026'e kadar): yüksek güvenlik açıkları + hızlı kazanımlar.
  - **P2 — İlk ay** (≈ 02.10.2026'a kadar): yapısal borç, KVKK, verimlilik.
  - **P3 — Teknik borç** (backlog): cila, büyük mimari geçişler.

## Kaynak Raporlar

| Kısaltma | Rapor | Konum |
|---|---|---|
| **[GUV]** | Güvenlik Denetim Raporu (4 KRİTİK, 6 YÜKSEK, 9 ORTA, 9 DÜŞÜK) | `orch-security-audit/guvenlik-raporu.md` → `/home/yusuf/orca/workspaces/bancho-cafe/orch-security-audit/guvenlik-raporu.md` |
| **[BE]** | Backend Kalite Denetim Raporu (P0:4, P1:7, P2:9, P3:5) | `orch-backend-quality/backend-raporu.md` → `/home/yusuf/orca/workspaces/bancho-cafe/orch-backend-quality/backend-raporu.md` |
| **[FE]** | Frontend Mimari Denetim Raporu (14 maddelik yol haritası) | `/home/yusuf/Belgeler/Projeler/orch-frontend-arch/frontend-raporu.md` |
| **[QA]** | Test & QA Raporu (20→106 test, 1 defekt) | `orch-qa-tests/qa-raporu.md` → `/home/yusuf/orca/workspaces/bancho-cafe/orch-qa-tests/qa-raporu.md` |
| **[SIM]** | Sızma Simülasyonu Güvenlik Raporu (dinamik denetim; 7 KRİTİK, 12 ORTA, 3 DÜŞÜK — kritiklerin 5'i koordinatörce yeniden üretilerek doğrulandı) | `docs/raporlar/guvenlik-simulasyon-raporu.md` |

> Not: Görev tanımında raporların `/home/yusuf/Belgeler/Projeler/orch-*/` altında olması bekleniyordu; pratikte yalnızca frontend raporu orada, diğerleri ilgili orca worktree köklerinde yazılmış (backend raporu bunu kendi §9'unda belgeliyor).

---

## 0. Yönetici Özeti

> **Güncelleme (2026-09-03, orkestra oturumu):** MVP backend hattı tamamlandı.
> Kalite kapısı: `tsc --noEmit` temiz, **229/229 test** (vitest, exit 0), `vite build` başarılı.
> Bu oturumda kapanan maddeler: MP-2.1 (tokenVersion iptali — CSP enforce ve token ömrü kısmı hâlâ açık, kasıtlı), MP-2.2 (şifre politikası), MP-2.3 (Docker Mongo auth), MP-2.5 (masa sipariş sınırları + bakiye guard), MP-2.6 (review doğrulama + metin sınırları), MP-2.11 (timestamp standardı), MP-2.12 (indexler), MP-2.13 (pagination), MP-2.14 (şema validasyonları), MP-2.15 (atomik iade/kampanya), MP-3.1 (SSE `/api/events` + eventBus + nginx location). Ayrıca push dispatch'teki ateşle-unut promise'ler yakalanır yapıldı (unhandled rejection üretimde süreci öldürüyordu). Kalan açık: MP-2.4 (KVKK), MP-2.7 (bot önlemi), MP-2.8/2.9/2.10 (yapısal bölme/test genişletme), MP-3.x'in frontend kısmı — canlıya alma için engel değiller.
>
> **Güncelleme (2026-09-03, ikinci oturum — MVP tamamlama):** Denetimde çıkan tüm
> mantık boşlukları kapatıldı, test sayısı 203 → **229**:
> - **Sadakat QR (G1-G3):** tokenVersion iptal paritesi, tam damga (stamp_card)
>   sistemi — kazanım/eşik döngüsü/hak harcama (en ucuz birimden), 13 uçtan uca test.
> - **A1 (SSE köprüsü):** eventBus'a üreticiler bağlandı (sipariş durumu, yeni
>   sipariş, garson çağrısı, sohbet mesajı); istemci EventSource'a abone
>   (`/api/events?token=`); polling yedeğe indi (müşteri 5→30 sn, manager 15→60 sn).
> - **A2 (envanter):** sipariş tamamlamada malzeme adı eşleşmesiyle atomik stok
>   düşümü, eşik altında personel bildirimi + bağımlı ürün `inStock=false` otomatiği.
> - **A3 (kupon):** kuponlar sipariş akışına gerçek bağlandı — atomik kullanım,
>   reddedilen siparişte iade, sepette kupon kodu girişi.
> - **B temizliği:** ölü `pointsProgress`/`pointsRewardThreshold` alanları
>   kaldırıldı (B1), api.ts'teki ölü `InventoryItemModel` import'u çıkarıldı (B3),
>   abonelik `discountPercent`'i indirim zincirinin son halkası olarak gerçek
>   davranışa bağlandı (B4 — freeDelivery/priorityQueue/exclusiveProducts
>   fiziksel teslimat olmadığından bilgisel bayrak olarak kaldı).
> - İndirim zinciri nihai sırası: damga hakkı → puan kampanyası → kupon → abonelik
>   (her adım öncekinden kalan tutar üzerinde, hiçbir indirim aynı birime binmez).
>
> **Güncelleme (2026-09-03, üçüncü oturum — arayüz boşlukları kapatıldı):**
> İkinci oturumun denetiminde arayüzü hiç olmayan çalışan backend modülleri tespit
> edildi; C2 (abonelik arayüzü) kullanıcı kararıyla kapsam dışı bırakıldı, kalanlar
> tamamlandı ve hepsi ayrı commit'lerle gönderildi:
> - **C1 Garson çağrısı (3d3e9b9):** yetim kalan WaiterCallButton masa görünümüne
>   bağlandı; StaffPanel canlı sekmesinde aktif çağrı listesi + Al/Bitir.
> - **C3 Envanter (8d61875):** CMS altında malzeme yönetimi — liste, yeni malzeme,
>   stok girişi; A2 otomatik düşümü panelden yönetilebilir hale geldi.
> - **C4 Canlı destek (5d645d2):** SupportChat bileşeni; müşteri profili +
>   personel canlı sekmesi, oda listesi/yanıtlama/kapatma, bekleyen rozeti.
> - **C5 Rezervasyon (dfb9db6):** müşteri talep formu + kendi rezervasyonları;
>   personel onay/red/tamamlandı/gelmedi yönetimi.
> - **C6 Arkadaşlık + hediye (fe48191):** e-posta ile arkadaşlık akışı, bakiye
>   hediyesi gönder/kabul et; profil altında tam ekran. AppContext'e
>   syncAfterMutation expose edildi.
> - **C7+D1+D2 (d320090):** /notifications/read-all + 'Tümünü Okundu İşaretle';
>   vipThreshold → LoyaltySummary.isVip gerçek hesabı; Notification enum'una
>   inventory_low_stock (stok uyarıları personel listesine düşer).


Proje fonksiyonel olarak zengin ve büyük ölçüde çalışır durumda: `tsc --noEmit` temiz, **106/106 test geçiyor** (QA sayesinde), bcrypt + JWT + helmet + TLS 1.2/1.3 + atomik bakiye guard'ları gibi sağlam temeller var. Ancak **canlıya alınmayı engelleyen 9 madde** var: 4 kritik güvenlik açığı (kendi kendine para basma, e-postayla rol yükseltme, git geçmişinde TLS anahtarı, hediye/abonelik yarış koşulu), Express 4'te yakalanmayan async hatalardan kaynaklanan **sunucu çökme/askıda kalma** riski (QA'nın testle belgelediği DEF-1), tek kullanıcıda bile ~10 dakikada tetiklenen **429 rate-limit/polling çakışması** ve varsayılan yönetici şifresi.

Bunun altında iki büyük yapısal tema yatıyor: (1) **iş mantığının route dosyalarına ve 3 dev panel bileşenine (~13.000 satır) gömülü olması**, (2) **5 saniyede bir tam-bootstrap polling'i** ile sunucu-verisi ile istemci-state'in aynı yerde yaşaması. Bu ikisi ayrı ayrı backend ve frontend raporlarında ele alınıyor; çözümleri (router/servis bölme, bootstrap bölme + SSE, Context split + TanStack Query) P2/P3'e planlandı.

**Toplam madde sayısı:** P0: 9 · P1: 11 · P2: 20 · P3: 14

### Çapraz rapor sentezi (aynı kök neden, tek düzeltme)

| Sentez | Kaynaklar | Açıklama |
|---|---|---|
| **Async hata yönetimi** | [GUV] çekirdek · [BE P0-1, P0-2] · [QA DEF-1] | QA'nın testle kanıtladığı "stokta olmayan ürünle siparişte endpoint asılı kalıyor + unhandled rejection" bulgusu, backend'in "40 try/catch'siz handler" tespitiyle aynı kök neden. Çözüm: `asyncHandler` sarmalama + merkezi `errorHandler` (ikisi birden). → **MP-0.5 / MP-0.6** |
| **Varsayılan admin şifresi** | [GUV H-1] · [BE P0-4] · [GUV M-1] ile birleşir | `Admin123!` fallback'inin kaldırılması hem güvenlik hem backend P0. Zayıf şifre politikası (M-1) etkisini büyütüyor. → **MP-0.7** (politika: MP-2.2) |
| **Polling/rate-limit/boyut** | [BE P0-3, §5] · [FE #2, §4] · [GUV H-2] | Backend 429 çakışmasını, frontend re-render fırtınasını, güvenlik XFF sahteciliğini ayrı buldu; üçü de `/bootstrap` polling'i ve hız limiti konfigürasyonu etrafında döner. → **MP-0.9, MP-1.1, MP-1.7** |
| **CI çelişkisi** | [BE §7.1 "CI yok"] · [QA §7 "ci.yml mevcut"] | Backend raporu `.github/workflows` yok demiş; QA (daha sonra, dosya içeriğini alıntılayarak) `ci.yml`'in mevcut olduğunu doğruladı. **QA doğru kabul edilir** (Node 20; npm ci → lint → test → build). Backend'in P3-2 maddesi "CI kur" değil "CI iyileştir" olarak ele alınmalı. |
| **Test altyapısı hazır** | [BE §7] · [QA §2-3] | Backend "mongodb-memory-server kurulu ama kullanılmıyor" dedi; QA aynı altyapıyla 86 yeni test yazdı. Kalan boşluk: sipariş durum makinesi, masa ödeme (split), puan kullanımı entegrasyon testleri + UI testleri. → **MP-2.10, MP-3.12** |

---

## 1. P0 — Canlıya Alınmadan Önce Düzeltilmeli (launch blocker)

> Tahmini toplam efor: ~3-4 iş günü. Her madde küçük ve bağımsız; tek PR'lık boyutlarda.

### MP-0.1 — Müşterinin kendi bakiyesini yüklemesi (sınırsız para basma)
- **Kaynak:** [GUV C-1] · Konum: `api.ts:1258-1290` (`POST /api/users/me/balance`)
- **Sorun:** Endpoint yalnızca `attachAuth` ile korunuyor; rol/kasa kontrolü yok. Gövdeden `amount` doğrudan bakiyeye ekleniyor; `revenueAmount`/`bonusAmount` da istemciden geldiği için raporlama verisi de zehirlenebilir.
- **Yapılacak:** (1) Endpoint'i müşteri erişimine kapat; ödeme entegrasyonu (Iyzico/Stripe) gelene kadar müşteri tarafı yükleme akışı tamamen devre dışı. (2) Bakiye yüklemeyi yalnızca `POST /users/:id/balance` (staff/manager) üzerinden yap. (3) `revenueAmount`/`bonusAmount`'ı sunucu tarafında hesapla. (4) Yükleme için denetim kaydı + günlük toplam limit.
- **Kabul:** Giriş yapmış customer `POST /users/me/balance` → 403/404; bakiye değişmiyor.

### MP-0.2 — Kayıtta e-posta ile rol yükseltme
- **Kaynak:** [GUV C-2] · Konum: `api.ts:653`, `services/role.ts:24-39`, `constants.ts:3`
- **Sorun:** `resolveRoleForEmail(email)` kayıtta rol atıyor: `DEFAULT_MANAGER_EMAILS` içindeyse manager, `Staff` koleksiyonundaysa staff. E-posta hiçbir şekilde doğrulanmıyor → `yonetici@bancho.cafe` ile kayıt olan biri doğrudan manager olur; henüz kaydolmamış personelin e-postasıyla kayıt olan staff olur.
- **Yapılacak:** (1) Kayıtta rol **her zaman `customer`**; ayrıcalıklı roller yalnızca oturum açmış manager tarafından verilir. (2) E-posta doğrulama akışı planla (`emailVerified` işareti); doğrulanmamış e-posta ile rol eşlemesi yok. (3) `DEFAULT_MANAGER_EMAILS` sabitini koddan çıkar → env; bootstrap admin koşulunu "veritabanı boşsa" yerine "admin yoksa" yap (`autoSeed.ts:109-110`). (4) `PATCH /users/me` e-posta değişikliğinde yeniden doğrulama + parola teyidi iste.
- **Kabul:** Kayıt yanıtı her koşulda `role: "customer"`; sabit yönetici e-postalarıyla kayıt ayrıcalık kazanmıyor.

### MP-0.3 — TLS özel anahtarı git geçmişinde
- **Kaynak:** [GUV C-3, L-7] · Konum: commit `590225d` — `nginx/ssl/live/privkey.pem` (geçerlilik 01.08.2027)
- **Sorun:** `git show 590225d:nginx/ssl/live/privkey.pem` ile erişilebilir; sonraki commit'te silinmiş olsa da geçmişte kalıcı. Ortak IP'li sertifika (`CN=187.124.189.250`) host varlık bilgisi de ifşa ediyor.
- **Yapılacak:** (1) Let's Encrypt ile **anahtar rotasyonu**, eski anahtarı tüm ortamlardan kaldır. (2) `git filter-repo`/BFG ile geçmiş temizliği + herkesin yeniden klon alması. (3) `generate-ssl.sh` içindeki gerçek IP'yi parametrik yap [GUV L-7]. (4) Periyodik `git ls-files` gizli dosya taraması.
- **Kabul:** `git log --all -- nginx/ssl/` boş; yeni sertifika deploy edilmiş; eski sertifika iptal.

### MP-0.4 — Hediye/abonelik bakiye yarış koşulları (TOCTOU)
- **Kaynak:** [GUV C-4] · Konum: `new-features.ts:511-521` (`/gifts/send`), `:575-577` (`/gifts/:id/claim`), `:641-652` (`/subscriptions/subscribe`)
- **Sorun:** Üçü de "önce bakiyeyi oku → kontrol → ayrı `$inc`" deseni. Eşzamanlı istekler aynı eski bakiyeyi görür → negatif bakiye + sistemde var olmayan para. Kodda doğru desen zaten var (`api.ts:2157-2161`, `:3131-3135` atomik `findOneAndUpdate({ balance: { $gte: X } })`) — sadece taşıncak.
- **Yapılacak:** Üç yerde koşullu atomik güncelleme; `amount` normalizasyonu (tam sayı/2 basamak) + üst sınır; şemada `balance: { min: 0 }` kısıtı; hediye/abonelikte idempotency anahtarı değerlendir.
- **Kabul:** Paralel `gifts/send` isteklerinde toplam düşüm bakiyeyi aşınca kalanlar 400 alıyor; bakiye hiçbir koşulda negatif olmuyor (test ile kanıtlanır — MP-2.10 girdisi).

### MP-0.5 — try/catch'siz 40 async handler: crash riski
- **Kaynak:** [BE P0-1, §2.1a] · [QA DEF-1] · Konum: `api.ts` (40 handler; en risklisi `POST /orders` satır 2085)
- **Sorun:** Express 4 rejected promise'leri yakalamaz; Node 15+ üzerinde unhandled rejection = **process crash**. `POST /orders` içinde aktif `throw new Error("bazi-urunler-stokta-degil")` yolu mevcut — QA bunu testte belgeledi: endpoint yanıt yerine **asılı kalıyor** ve süreci kirletiyor.
- **Yapılacak:** `asyncHandler` wrapper (`Promise.resolve(fn).catch(next)`) — router seviyesinde veya her handler'da. Bu tek başına crash riskini ortadan kaldırır, ~1 saatlik değişiklik. Express 5'e geçiş yerine wrapper önerilir (breaking davranışlar).
- **Kabul:** Stok dışı ürünle sipariş → HTTP 400/409 + mesaj (QA'nın toleranslı testi otomatik katılaşır — MP-1.9).

### MP-0.6 — Merkezi error handler + ApiError sınıfı
- **Kaynak:** [BE P0-2, §2.2] · [QA DEF-1] · Konum: yeni `middleware/errorHandler.ts`, `server.ts`
- **Sorun:** `server.ts`'te `app.use(errorHandler)` yok; hata yönetimi handler başına elle kopyalanmış; 300+ hata response'u tek biçimli ama machine-readable `code` yalnızca login'de var.
- **Yapılacak:** `ApiError` (status + code + message) + 4 parametreli error handler (Mongoose ValidationError/CastError, Multer, 11000 duplicate eşlemesiyle); route mount'undan hemen sonra `app.use`. Mevcut try/catch'ler anında sökülmez; zamanla temizlenir. MP-0.5 ile birlikte DEF-1'in tam çözümüdür.
- **Kabul:** Bilinmeyen hata → tutarlı 500 `{"code","message"}`; `headersSent` koruması var.

### MP-0.7 — Varsayılan yönetici şifresi
- **Kaynak:** [GUV H-1] · [BE P0-4, §6.1] · Konum: `autoSeed.ts:150`, `docker-compose.yml`, `.env.example`
- **Sorun:** `BOOTSTRAP_ADMIN_PASSWORD || "Admin123!"` — env zorunlu değil; `.env.example`'de gerçek görünümlü parola. Operatör `.env` doldurmazsa yönetici hesabı herkesin bileceği şifreyle açılır. `JWT_SECRET` zorunluyken (`:?`) şifre zorunlu değil — tutarsızlık.
- **Yapılacak:** Kod fallback'ini kaldır (şifre yoksa admin oluşturma + açık hata/`exit(1)`); compose'da `${BOOTSTRAP_ADMIN_PASSWORD:?}` zorunlu; `.env.example` değerini `change-me` yap; ilk girişte şifre değişikliğine zorla.
- **Kabul:** `BOOTSTRAP_ADMIN_PASSWORD` yokken prod boot'u admin oluşturmadan hata veriyor.

### MP-0.8 — Parola sıfırlama: e-posta sayımı + çalışmayan akış
- **Kaynak:** [GUV H-6] · Konum: `api.ts:772-780`
- **Sorun:** `POST /auth/reset-password` yanıtı `success: Boolean(user)` → kayıtlı e-postaları doğrulamaya açık sayım kanalı; akış tamamen sahte (e-posta/token/parola değişikliği yok).
- **Yapılacak:** Yanıtı sabit `success: true` + genel mesaj yap; gerçek akış gelene kadar endpoint'i devre dışı bırak (404). SMTP gelince: tek kullanımlık 30 dk TTL token, sabit zamanlı karşılaştırma, parola değişince oturum düşürme (MP-2.1 ile). Kayıttaki 409 "e-posta kullanımda" bilinçli ürün kararıysa belgelendir.
- **Kabul:** Var/yok e-posta yanıtları ayırt edilemiyor.

### MP-0.9 — Polling / rate-limit çakışması: tek kullanıcıda 429
- **Kaynak:** [BE P0-3, §5] · [FE §5.1-5.3 Adım 1] · Konum: `server.ts:184-190`, `AppContext.tsx:230-240`, `api.ts buildBootstrapPayload`
- **Sorun:** `/api` genel limiti 600/15 dk. Masa modundaki tek istemci ~590 istek/15 dk üretir (bootstrap 5 sn + session 3 sn + staff tables 8 sn) → **~10 dakikada 429**, `refreshBootstrap` catch'inde sessizce loglanır, uygulama "donuk" görünür. Manager açıkken her 5 sn'de tüm `users` + `balanceTopUps` + 100 log çekiliyor (O(n×m)).
- **Yapılacak (Adım 1, SSE'siz):** (1) `/bootstrap`'ı böl: statik katalog `GET /catalog` (`Cache-Control`/ETag) + dinamik durum `GET /me/state`. (2) Manager bootstrap'ından `users`/`balanceTopUps`'ı çıkar → ayrı paginated endpoint'ler. (3) Bootstrap/state endpoint'lerini ayrı limit grubuna al (ör. 3000/15 dk). (4) İstemcide polling aralığını rol bazlı ayarla (customer 15-30 sn; mutasyon sonrası `syncAfterMutation` deseni korunarak) [FE #2'nin interval kısmı].
- **Kabul:** Masa modunda 30 dk kesintisiz kullanımda 429 yok; manager açıkken bootstrap payload'ında kullanıcı listesi yok.

### MP-0.10 — Simülasyon denetimi kritikleri (dinamik sızma bulguları)
- **Kaynak:** [SIM — hepsi çalışan sistemde kanıtlandı] · Rapor: `docs/raporlar/guvenlik-simulasyon-raporu.md`
- **S-K1 (en acil):** Sadakat QR token'ı `JWT_SECRET` ile imzalanıyor (`services/loyalty.ts:28`) ve `attachAuth` `purpose` claim'ini kontrol etmiyor → kurbanın QR'ını gören herkes hesabı ele geçirip bakiyesini çalabilir (şifre değiştirme + hediye hırsızlığı uçtan uca kanıtlandı). Düzeltme: purpose reddi + ayrı `LOYALTY_JWT_SECRET`.
- **S-K4:** Bakiye yükleme read-modify-write (`api.ts:1583`) — 5 paralel yüklemede ₺100 buharlaşıyor (koordinatörce yeniden üretildi). Düzeltme: `$inc`.
- **S-K5:** `POST /users/me/balance` staff'a açık — staff kendine sınırsız para basıp hediyeyle çıkarabiliyor (yeniden üretildi). Düzeltme: `restrictTo("manager")` + onay akışı.
- **S-K2:** Ödenmiş masa siparişi reddedilince iade yok (para kayboluyor). **S-K6:** paralel `pay`/`leave` çift kesim. **S-K7:** abonelik yarışında iadesiz kesim. **S-K3:** no-pay "yemek-kaçağı" döngüsü (ürün + sadakat puanı bedava).
- **Yapılacak:** Yukarıdaki sırayla (etki/maliyet) düzelt; her biri için sim ortamında (`scripts/sim-server.ts`) yarış senaryosunu regression testine çevir.
- **Kabul:** Sim sunucusunda aynı saldırı scriptleri tümünü reddediyor; kritik yarış senaryoları CI testlerinde.
- **DURUM GÜNCELLEMESI (03.09):** **TAMAMLANDI.** Tüm KRİTİK'ler (S-K1..K7) + ORTA batch (S-O1..O12: envanter hareket/PATCH doğrulaması, `syncProductStockFlags` yeniden açma dalı `inStockAutoClosed` işaretiyle, sipariş anı malzeme kontrolü, note 500 krş sınırı, image data-URI yasağı + 100KB cap, 5 alanda `sanitizePlainText`, e-posta değişiminde `currentPassword`, register tek 409 mesajı) + DÜŞÜK'ler (S-D1/D2/D3: hareket/enum/uzunluk doğrulamaları) düzeltildi. Sim sunucusunda 27/27 canlı doğrulama PASS; yarış senaryoları `src/server/routes/security-regression.test.ts` altında 17 vitest testine çevrildi (246/246 toplam test, tsc + build temiz). S-K3 için ayrıca `/users/:id/table-debt/settle` (manager) tahsilat ucu eklendi.

## 2. P1 — İlk Hafta

### MP-1.1 — X-Forwarded-For sahteciliği ile hız limiti atlatma
- **Kaynak:** [GUV H-2] · Konum: `nginx/conf.d/default.conf`, `server.ts:119`
- **Sorun:** nginx XFF'i **ekleyerek** iletir + `trust proxy 1` → Express istemcinin kendi gönderdiği sahte XFF'i `req.ip` alır → auth/general limitleri tamamen etkisiz (sınırsız brute force/kayıt).
- **Yapılacak:** nginx'te XFF'i üzerine yazarak ilet (`proxy_set_header X-Forwarded-For $remote_addr;`) veya `real_ip` modülü; login'de hesap bazlı kilitleme (5 başarısız → 15 dk kilit) + gecikmeli yanıt. MP-0.9'daki limit gruplamasıyla birlikte tasarla.

### MP-1.2 — `POST /coupons/:id/use` yetki kontrolü yok
- **Kaynak:** [GUV H-4] · Konum: `new-features.ts:273-288`
- **Yapılacak:** Endpoint'i kaldır; kupon kullanımını sipariş tamamlanma akışına (`PATCH /orders/:id/status` → completed) sunucu tarafı atomik göm. Kalacaksa: `restrictTo("customer")` + sahiplik + `usedCount < usageLimit` atomik koşullu güncelleme.

### MP-1.3 — Kimliksiz push endpoint'lerinin kötüye kullanımı
- **Kaynak:** [GUV H-5] · Konum: `api.ts:2380-2413`
- **Sorun:** `/push/test` kimliği doğrulanmamış istemciye herhangi bir `orderId`'nin cihazlarına bildirim gönderme imkânı veriyor; `/push/unsubscribe` hiç middleware yok — başkasının aboneliği silinebilir.
- **Yapılacak:** `/push/test` → `attachAuth` + yalnızca kendi aboneliği; `orderId` hedeflemesini kaldır/rol isteyen; `/unsubscribe` sahiplik doğrulaması; push'a özel hız limiti (ör. 10/dk).

### MP-1.4 — Mass assignment + NoSQL operatör enjeksiyonu
- **Kaynak:** [GUV M-2, M-3] · Konum: `new-features.ts:229,247,714,726,1176,1188` (create/$set:req.body) · `:362,499,872-880` (nesne girdi)
- **Yapılacak:** (1) Tüm yönetici create/patch'lerinde beyaz listeli alan çıkarımı (`api.ts POST /campaigns` iyi örnek); `$set`'e asla ham `req.body`. (2) Sorguya giren tüm dış girdileri `String(...)` ile normalleştir (login `api.ts:696` iyi örnek); Express 4'te `query parser: 'simple'`. (3) Kalıcı çözüm olarak Zod/Joi değerlendir (P2'ye not).

### MP-1.5 — Hızlı güvenlik sıkılaştırma paketi (küçük yapılandırma değişiklikleri)
- **Kaynak:** [GUV M-8, L-1, L-2] · Konum: `server.ts:200`, `auth.ts:47,72`, `.gitignore`
- **Yapılacak:** (1) `express.json` limiti 10 MB → 256 KB–1 MB (gerçekten büyük gövde gereken routera özel limit). (2) `jwt.verify(token, secret, { algorithms: ["HS256"] })` sabitlemesi; sadakat QR için ayrı `LOYALTY_JWT_SECRET` değerlendir. (3) `.vapid-keys.json` → `.gitignore`.

### MP-1.6 — Bundle: lazy loading hızlı kazanımları
- **Kaynak:** [FE #1, #3, §5] · Konum: `LoyaltyQrScanner`, `ManagerPanel.tsx`, `StaffPanel.tsx`, `vite.config.ts`
- **Sorun:** Tek chunk 1.647 KB JS (gzip 445 KB); ~%75'i müşterinin gördüğü hiçbir ekranda kullanılmıyor (`html5-qrcode` ~1.213 KB yalnızca personel tarayıcıda; `recharts` ~567 KB yalnızca yönetici dashboard'unda).
- **Yapılacak:** (1) `LoyaltyQrScanner` → `React.lazy` + dinamik `import('html5-qrcode')` (−~1,2 MB, tek başına ~%70). (2) `ManagerPanel`/`StaffPanel` lazy + route-level split. (3) `manualChunks` vendor ayrımı. Hedef: müşteri ilk yükü gzip ~445 KB → ~140-180 KB.
- **Kabul:** Build çıktısında müşteri giriş chunk'ında `html5-qrcode`/`recharts` yok; LCP ölçümü kaydedilmiş.

### MP-1.7 — AppContext re-render fırtınasını kesme
- **Kaynak:** [FE #2, §4] · Konum: `AppContext.tsx:756-829`, `:179-181`
- **Sorun:** `value` objesi memoize edilmediği için 5 sn'lik her bootstrap fetch'inde **tüm ağaç yeniden render oluyor**; `notifications` her render'da yeniden sıralanıyor; panellerde tek `useMemo`/`React.memo` yok.
- **Yapılacak:** (1) `value` → `useMemo`. (2) `notifications` sıralaması → `useMemo`. (3) Polling aralıkları rol bazlı (MP-0.9 ile uyumlu). (4) `AdminData`'yı manager dışına provider düzeyinde verme (FE §4.2 minimum adım).

### MP-1.8 — Hata response'larına `code` alanı
- **Kaynak:** [BE P1-4] · Konum: `api.ts` (login `api.ts:711` tek örnek), 175+105 `getSystemText` çağrısı
- **Yapılacak:** MP-0.6'daki `ApiError` desenini genelleştir; catch'lerdeki `await getSystemText` çağrılarını error handler'a topla (hata path'indeki ekstra gecikme kaldar). İstemci kırılmaz (`message` korunur, `code` eklenir).

### MP-1.9 — CI + test koşum iyileştirmeleri
- **Kaynak:** [QA §6-7] · Konum: `.github/workflows/ci.yml`, `vitest.config.ts`, `api.test.ts`
- **Yapılacak:** (1) CI'a `JWT_SECRET` env'i, `~/.cache/mongodb-binaries` cache'i, ayrı `tsc --noEmit` adımı, Node 20/22 matrisi. (2) `vitest.config.ts`'e `testTimeout: 15000`. (3) **MP-0.5/0.6 düzelince** DEF-1 testindeki tolerans dinleyicisini kaldır, `expect(status).toBe(400)` katı doğrulama yap. (4) Coverage ölçümü için `@vitest/coverage-v8` (hedef: `src/lib` + `src/server/services` %80+ — altyapı P1, eşik zorlaması P3).

### MP-1.10 — Hardcode kur çarpanları: fiyat doğruluğu riski
- **Kaynak:** [FE §3, §10] · Konum: `src/lib/i18n.ts` (ör. `USD: 0.037` koda gömülü)
- **Sorun:** `formatPrice` hardcode çarpanlarla çeviriyor — güncelliği garanti değil, yanlış fiyat gösterme riski. i18n kararını beklemeden düzeltilmesi gereken mantık.
- **Yapılacak:** `Intl.NumberFormat` + sunucu tarafı kur servisi (günlük kur çeken cron ya da sabit tek para birimi + dönüşümü kaldırma). Ürün kararı: çoklu para birimi gerçekten gerekiyor mu?

### MP-1.11 — Ölü kod temizliği (frontend)
- **Kaynak:** [FE #4, §4.1] · Konum: `common/Toast.tsx` (mount edilmemiş), `AppContext.tsx:329-345` (`addNotification` no-op), `:263-265` (`loginWithGoogle` her zaman throw), `ManagerPanel.tsx:3118,3719` (`{false && ...}` blokları)
- **Yapılacak:** Toast → gerçek `Toaster`'a evril ya da sil; stub'lar ya çalışsın ya kalksın; ölü blokları sil.

---

## 3. P2 — İlk Ay

### Güvenlik (orta vade paketi)

#### MP-2.1 — CSP enforce + token ömrü + iptal mekanizması
- **Kaynak:** [GUV H-3, M-6] · Konum: `server.ts:127-141`, `api.ts:74-78`, `src/lib/api.ts:11-19`
- **Yapılacak:** (1) CSP'yi zorunlu moda geçir (`reportOnly` kaldır; `scriptSrc: ["'self'"]`). (2) Access token ömrünü 2-8 saate indir + refresh mekanizması. (3) `User.tokenVersion` alanı + JWT'ye gömme + `attachAuth` kontrolü → parola değişimi/çıkış/rol düşürme tüm token'ları düşürür. (4) `httpOnly` cookie + `SameSite=Strict` taşıma modeli değerlendir (CSRF önlemi ile). Bugün bilinen XSS zinciri yok (React kaçışı + `dangerouslySetInnerHTML` 0 sonuç) — derinlik savunması.

#### MP-2.2 — Şifre politikası
- **Kaynak:** [GUV M-1] · Konum: `api.ts:608`, `:1240`
- **Yapılacak:** Min 8-10 karakter + `@zxcvbn-ts` puanlama (skor ≥ 2) + yaygın parola kara listesi + kullanıcı adı/e-posta içermeme kontrolü. MP-0.7 ile birleşince `Admin123!` sınıfı şifreler engellenir.

#### MP-2.3 — MongoDB kimlik doğrulaması
- **Kaynak:** [GUV M-4] · Konum: `docker-compose.yml`
- **Yapılacak:** `MONGO_INITDB_ROOT_USERNAME/PASSWORD` + URI credentials; healthcheck'i auth'lu bağlantıyla yap. Uzun vadede DB şifreleme (KVKK m.12).

#### MP-2.4 — KVKK uyum paketi
- **Kaynak:** [GUV M-5, §6; L-8] · Konum: kayıt akışı, arkadaş listesi (`new-features.ts:308-347`), personel arama (`api.ts:1204-1225`)
- **Yapılacak:** (1) Kayıtta aydınlatma metni + açık rıza (tarih/sürümlü kayıt). (2) "Hesabım"a VERİ TAŞIMA (JSON/CSV) + HESAP SİLME self-servisi (30 gün geri alma penceresi). (3) Puan tablosu/profil görünürlüğü opt-in rıza modeli; arkadaş listelerinden e-posta alanını kaldır. (4) Log saklama politikası (access 30 gün, hata 90 gün) + masa token'ının URL'den çıkarma [GUV L-5]. (5) Veri sorumlusu iletişim/başvuru kanalı. (6) Personel aramada projection'ı `name surname username phone avatar` ile sınırla.

#### MP-2.5 — Masa siparişleri: tahsilat + adet sınırları
- **Kaynak:** [GUV M-7] · Konum: `api.ts:2092-2166`, `:3291-3301`
- **Yapılacak:** `quantity` üst sınırı (ör. 50) + `Number.isInteger`; masa siparişinde katılımcı bakiye kontrolü veya kullanıcı başı açık borç limiti; `no-pay` çıkışında borç kapatana kadar yeni masa katılımını engelleme.

#### MP-2.6 — Review doğrulaması + metin girdisi sınırları
- **Kaynak:** [GUV M-9, L-9] · Konum: `new-features.ts:63-107` (review), `:779-823` (sohbet), `:1033-1060` (garson çağrısı)
- **Yapılacak:** Review'de sipariş sahipliği + `completed` durumu kontrolü; `comment` 1000 karakter sınırı (model+route); `productName` sunucuda çözülür; kamuya açık listede yalnızca `username`. Sohbet/garson çağrısı/not alanlarına 500-1000 karakter + kullanıcı bazlı hız limiti.

#### MP-2.7 — Kayıt bot önlemi + kalan düşük riskliler
- **Kaynak:** [GUV L-4, L-5, L-7] · Konum: `api.ts:588`, `:2756`, `nginx/generate-ssl.sh`
- **Yapılacak:** Kayıtta honeypot + IP/gün limiti veya Turnstile/hCaptcha; masa token'ını başlık/gövde ile sorgulama (log sızıntısı); IP'yi betikten çıkarma (MP-0.3 rotasyonuyla aynı PR olabilir).

### Backend yapısal borç

#### MP-2.8 — Route dosyalarını domain bazlı bölme
- **Kaynak:** [BE P1-1, P1-7, §1] · Konum: `new-features.ts` (1.406 satır/53 endpoint) → 11 domain router; `api.ts` (3.347 satır/75 endpoint) → domain router'lar + `routes/index.ts`
- **Yapılacak:** Sıra: (1) yardımcı fonksiyonlar → `serializers/`; (2) `new-features.ts`'i 11 parçaya böl (en düşük riskli); (3) `api.ts`'ten bağımlılık sırasıyla: `push` → `logs` → `notifications` → `catalog` → `staff` → karmaşık olanlar (MP-2.9 ile birleşik); (4) alt-satır `router.use(newFeaturesRouter)` hack'i kalkar. Endpoint yolları birebir korunur. Efor ~4 iş günü, PR'lara bölünmüş.

#### MP-2.9 — Servis katmanı çıkarma (para akışından başla)
- **Kaynak:** [BE P1-2, §4] · Konum: `services/order.ts` → `payment.ts` → `tableSession.ts` → `notification.ts` → `bootstrap.ts`
- **Yapılacak:** Sipariş oluşturma/durum makinesi/iade, atomik bakiye (`creditBalance`/`debitBalance` — MP-0.4'teki guard'lar buraya bağlanır), masa oturumu kur/katıl/öde (split dahil — en karmaşık para akışı, test dışı), bildirim üretimi. Saf hesap kısımları yan etkisiz ayrılır → MP-2.10'un test girdisi. Efor ~3-4 gün; MP-2.8 ile aynı PR'lerde yürütülür.

#### MP-2.10 — Test kapsamını kritik akışlara genişletme
- **Kaynak:** [BE P1-3, §7] · [QA §6] · Mevcut: 106 test (QA), `mongodb-memory-server` + supertest hazır
- **Yapılacak:** (1) Faz 1 (soyut): durum geçiş tablosu, split/ödeme hesabı, `getEffectiveRole`. (2) Faz 2 (entegrasyon): sipariş oluştur→tamamla→puan; reddet→iade; bakiye yarışı (MP-0.4'ün kanıtı); kupon limit dolması; `table-sessions/pay` split + kuruş yuvarlaması. (3) Faz 3: rol matrisi (customer/staff/manager × endpoint örneklemi), storage path-traversal regresyonu.

#### MP-2.11 — Timestamp şema standardı
- **Kaynak:** [BE P1-5, §3.2a] · Konum: `WaiterCall.createdAt` (String!), `Reservation/Coupon/Campaign/Subscription` tarih alanları (String)
- **Yapılacak:** "Date sakla, serialize'da ISO string'e çevir" ilkesi; kalan String alanlara validator (`match: /^\d{4}-\d{2}-\d{2}/`). Kırıcı şema değişikliği → kendi release'i + veri migration'ı.

#### MP-2.12 — Eksik indexler
- **Kaynak:** [BE P2-1, §3.2b] · Konum: `Order {userId,status,timestamp:-1}`, `Notification {(userId,event),(targetRole,event)}`, `Product.category`, `Campaign.active/category`, `Review.orderId` partial-unique
- **Not:** Notification en çok okunan koleksiyon (5 sn polling — MP-0.9 sonrası baskı azalır ama index yine gerekli).

#### MP-2.13 — Manager listelerinde pagination
- **Kaynak:** [BE P2-2] · [GUV L-8 ile bağlantılı]
- **Yapılacak:** `GET /users?page=`, `GET /balance-top-ups?page=`, logs — MP-0.9'daki bootstrap çıkarma işinin devamı.

#### MP-2.14 — Şema validasyonları
- **Kaynak:** [BE P2-3, §3.2c] · Konum: `Product.price` min:0, `Order.total`/`User.balance`/`points` alt sınırlar, `Campaign.type/category` enum, `Coupon.value` 0-100 (percentage), `User.phone` format
- **Not:** MP-1.4'teki Zod/Joi kararı burayla birleştirilebilir (route katmanı Zod + şema katmanı Mongoose validator).

#### MP-2.15 — Refund/kampanya güncellemelerinde atomik update
- **Kaynak:** [BE P2-5, §4 tablosu] · Konum: `PATCH /orders/:id/status` iade `user.save()`, kampanya `remainingUses` `user.save()` (non-atomik, lost-update)
- **Yapılacak:** `save()` yerine koşullu `$inc`/`findOneAndUpdate`; MP-2.9 servis çıkarma sırasında uygulanır.
- **DURUM GÜNCELLEMESI (03.09, [SIM]):** Sipariş iadesi/hediye/kupon/sadakat uçları atomik guarda geçirildi ve dinamik saldırıları reddediyor. Ancak **dışında kalan üç uç aynı sınıf açığı taşıyor**: bakiye yükleme (`save()` — paralel yüklemelerde para kaybı/bedava ürün, S-K4), abonelik (check-then-act + unique-index 500'ünde iadesiz kesim, S-K7), masa `pay`/`leave` (paralel çift kesim, S-K6). Bu madde bu üç uca taşınmadan kapanmış sayılmaz → **MP-0.10**.

### Frontend yapısal borç

#### MP-2.16 — Ortak UI: Modal + ConfirmDialog + useAsyncAction
- **Kaynak:** [FE #5, §6] · Konum: 21 modal bloğu (Manager 16, Customer 5), 28 `alert/confirm` çağrısı, StaffPanel `renderPortal`
- **Yapılacak:** `components/ui/Modal.tsx` (portal + focus trap + Escape) + `ConfirmDialog` + `useAsyncAction` (loading+error+toast). UI kit'i baştan tam yazılmaz — panel sökülürken ihtiyaç anında beslenir.

#### MP-2.17 — Ortak profil modülü (3 kopya → 1)
- **Kaynak:** [FE #6, §2.5] · Konum: Customer (57 ref) / Manager (40) / Staff (2+) panellerinde ayrı uygulanan profil/şifre/adres/ödeme/favori desenleri
- **Yapılacak:** `features/profile/*` (Main/Addresses/Payments/Favorites/Settings/History görünümleri). Tek adımda **~1.900 satır** tasarruf — en yüksek duplikasyon kârı.

#### MP-2.18 — StaffPanel'de 13 Context-bypass `apiRequest` → tek veri katmanı
- **Kaynak:** [FE #7] · Konum: `StaffPanel.tsx` (13 doğrudan çağrı)
- **Yapılacak:** Context/hook üzerinden; tutarlı hata/loading. (Tam çözüm MP-3.8 TanStack Query.)

#### MP-2.19 — ManagerPanel CMS sökümü
- **Kaynak:** [FE #8, §2.1] · Konum: `ManagerPanel.tsx` 6.294 satır; CMS bloğu ~3.141 satır (dosyanın yarısı)
- **Yapılacak:** Görünüm görünüm ayrı PR'lerle: `ProductsView` → `CampaignsView` → `IngredientsView` → `SystemTextsView` → `ChangesView` → `UsersView` → `TablesQrView`; 85 `useState`'in büyük bölümü tek görünümün private state'i olarak dosyalarına gömülür. Hedef yapı FE rapor §2.1'de hazır.

#### MP-2.20 — i18n kararı
- **Kaynak:** [FE #11, §3]
- **Sorun:** "7 dil" iddiası fiilen yanlış — `User.language` arayüzde hiç okunmuyor, `t()` yalnızca TR metin düzenleyici, çeviri verisi sıfır (TR dahil hiçbir dil için ikinci dil yok).
- **Yapılacak:** Ürün kararı: (a) TR-only ilan et — dil enumunu ve `SUPPORTED_LANGUAGES`'i temizle; **veya** (b) gerçek i18n: i18next + `SystemText` şemasına `lang` + anahtar taşıma script'i. Kur sorunu MP-1.10'da ayrı çözülür.

---

## 4. P3 — Teknik Borç (backlog)

### MP-3.1 — SSE tabanlı realtime
- **Kaynak:** [BE P1-6, §5.3 Adım 2] · `GET /api/events` (order.updated / notification.new / table-session.updated) + EventBus + heartbeat 25 sn + nginx `proxy_buffering off`; istemcide `EventSource`, polling yalnızca manuel/mutasyon sonrası. MP-0.9'daki Adım 1'i tamamlar. (~2-3 gün)

### MP-3.2 — Follow/arkadaşlık ilişkisi ayrı koleksiyona
- **Kaynak:** [BE P2-4, §3.2d] · `User.followers/following/friends` sınırsız diziler + read-modify-write `save()` yarışı → Edge modeli/`$addToSet`; `Coupon.usedBy` → sayaç + ayrı usage koleksiyonu.

### MP-3.3 — Bootstrap ETag/304 + `app.ts` export ayrımı
- **Kaynak:** [BE P2-6] · Test edilebilirlik (QA'nın supertest kurulumunu kolaylaştırır) + bant genişliği.

### MP-3.4 — Leaderboard aggregation cache
- **Kaynak:** [BE P2-7] · MP-2.12 index'i + 60 sn ön bellek.

### MP-3.5 — `as any` temizliği (backend 14 nokta)
- **Kaynak:** [BE P2-8] · `InferSchemaType` tiplerinin route/serializer katmanına taşınması.

### MP-3.6 — Realtime kanal stratejisi netleştirme
- **Kaynak:** [BE P2-9] · Chat için SSE yeterli mi / WebSocket mi — MP-3.1'den sonra tek kanal stratejisine bağla.

### MP-3.7 — Backend cila paketi
- **Kaynak:** [BE P3-1..P3-5] · (1) `/uploads` cache header'ları (`maxAge 30d, immutable` — zaman damgalı dosya adları güvenle cache'lenir). (2) CI'da coverage eşiği zorlaması (altyapı MP-1.9'da). (3) Request-id + structured logging (84 `console.error` noktası). (4) Basit migration çerçevesi (`backfillNotificationEvents` oraya taşınır). (5) Seed görsellerinde deterministik isimlendirme (re-seed kopyası birikmesin).

### MP-3.8 — TanStack Query geçişi
- **Kaynak:** [FE #9, §4.3] · Bootstrap polling → `staleTime` bazlı sorgu cache + invalidation; 40+ el yazımı mutasyon → `useMutation`; optimistic update. Kademeli: `useApp()` facad'i içte delege eder, paneller söküldükçe geçir. Ağ trafiği + state mimarisi kökten düzelir.

### MP-3.9 — CustomerPanel sökümü + App.tsx auth çıkarma
- **Kaynak:** [FE #10, §2.2, §2.4] · `features/customer/pages/*` (MenuPage, CartModal, OrdersPage...); `features/auth/*` (AuthPage/RegisterForm/LoginForm/RoleChoiceModal); mobil+masaüstü **ikizi render blokları** (`App.tsx:1041-1064` ≡ `1070-1095`) tek `AppShell`'de birleşir. `selectedProduct` URL'e taşınır.

### MP-3.10 — Zustand store'ları + Context alan bazlı ayrım
- **Kaynak:** [FE #12, §4.2] · `cartStore`, `tableSessionStore`; `SessionContext`/`CatalogContext`/`OrdersContext`/`NotificationsContext`/`AdminDataContext`. MP-3.8'den sonra doğal gelir.

### MP-3.11 — a11y paketi + tasarım token'ları + sanallaştırma
- **Kaynak:** [FE #13, §7, §5.2] · (1) Modal focus trap + Escape + `role="dialog"`; (2) icon-only butonlara `aria-label` (298 butonda neredeyse sıfır aria); (3) toast'a `aria-live="polite"`; (4) label `htmlFor` bağları; (5) `prefers-reduced-motion`; (6) `rounded-[28px]` benzeri 70+ arbitrary value → tasarım token'ları; (7) uzun listelerde `@tanstack/virtual`.

### MP-3.12 — UI + E2E test altyapısı
- **Kaynak:** [FE #14] · [QA §6] · Vitest + Testing Library ile kritik bileşenler (sipariş sepeti, sadakat ekranı); Playwright ile 2-3 mutlu-yol E2E (QR masa akışı, garson taraması — çok adımlı).

### MP-3.13 — bcrypt native + maliyet 12
- **Kaynak:** [GUV L-3] · `bcryptjs` (saf JS, yavaş doğrulama) → `bcrypt`; brute force maliyeti MP-1.1'deki kilitleme ile birlikte değerlendirilir.

### MP-3.14 — Kalan kozmetik/düşük riskliler
- **Kaynak:** [GUV L-6] (`express-rate-limit` `max` → `limit`) · [BE §6.2] (`clearManagedUploads` sessiz hata yutma → `console.warn`; `ENABLE_SEED` ölü env değişkeni) · [GUV §8] (Docker `USER node`, HSTS `preload`, OCSP stapling — opsiyonel) · [GUV H-6 not] (hata mesaj karakter kodlaması: `getSystemText` anahtarları TR karakter içermediği için mesajlar karışık — kozmetik).

---

## 5. Önerilen Yürütme Sırası

```
HAFTA 0 (P0 — canlıya almadan önce, ~3-4 iş günü):
  MP-0.5 → MP-0.6        (asyncHandler + errorHandler; DEF-1'i kapatır — en küçük, en geniş etkili)
  MP-0.7                  (admin şifresi; docker-compose + autoSeed aynı PR)
  MP-0.1 → MP-0.2         (para basma + rol yükseltme; ikisi de api.ts kayıt/bakiye bölgesi)
  MP-0.8                  (reset-password; tek endpoint)
  MP-0.4                  (atomik guard taşıma — hazır desen kopyalanıyor)
  MP-0.3                  (SSL rotasyonu + git geçmişi — operasyonel, kod dışı, paralel yürür)
  MP-0.9                  (bootstrap bölme + limit grupları; canlıya almadan 429'suz gün 1 için)
  Her maddeden sonra: npm run lint && npm test (106 test güvence) + /api/health smoke.

HAFTA 1 (P1):
  MP-1.1, MP-1.2, MP-1.3   (güvenlik: XFF, kupon, push — hepsi küçük)
  MP-1.4, MP-1.5           (girdi sıkılaştırma + yapılandırma paketi)
  MP-1.6, MP-1.7           (frontend hızlı kazançlar — tek "quick wins" PR'ı, LCP ölçümüyle)
  MP-1.8, MP-1.9, MP-1.10, MP-1.11

AY 1 (P2 — PR'lara bölünmüş):
  Güvenlik:  MP-2.1 → MP-2.2 → MP-2.3 → MP-2.7 → MP-2.5/2.6 → MP-2.4 (KVKK paketi en son, en kapsamlı)
  Backend:   MP-2.8+MP-2.9 (new-features bölme + servis çıkarma, domain domain birleşik PR'ler)
             → MP-2.10 Faz1-2 (testler çıkarılan servislerle birlikte yazılır)
             → MP-2.11..MP-2.15 (index, pagination, validasyon — bağımsız küçük PR'ler)
  Frontend:  MP-2.16 → MP-2.17 (profil modülü) → MP-2.19 (CMS sökümü, görünüm görünüm)
             → MP-2.18, MP-2.20 (i18n ürün kararı bu ay verilir)

BACKLOG (P3): iştah ve kapasite sırasına göre; MP-3.8 (TanStack Query) ve MP-3.1 (SSE)
  MP-3.9/3.10 ile birlikte düşünülür — üçü aynı "veri katmanı modernizasyonu" dilimidir.
```

**Kritik bağımlılıklar:**
- MP-1.9'daki DEF-1 testinin katılaştırılması ← MP-0.5 + MP-0.6.
- MP-2.10 Faz 2 testleri ← MP-2.9 servis çıkarma (saf fonksiyonlar test edilebilir hale gelir).
- MP-2.13 pagination ← MP-0.9 (bootstrap'tan çıkarma) ile aynı yön; ayrı PR olabilir.
- MP-2.15 atomik update'ler ← MP-2.9 (`services/order.ts` içinde uygulanır).
- MP-3.10 Context split ← MP-3.8 sonrası doğal; tersi sıra gereksiz iş üretir.

---

## 6. Korunması Gereken Varlıklar (raporların olumlu bulguları)

Refactor sırasında geri planmaması gereken mevcut iyilikler:

1. **106/106 geçen test** ve `mongodb-memory-server` + supertest altyapısı [QA] — her P0/P1 PR'ı bu güvenceyle gönderilmeli.
2. **Sipariş ve masa ödemesinde atomik bakiye guard'ları** (`api.ts:2157-2161`, `:3131-3135`) [GUV §9] — MP-0.4 bu deseni kopyalıyor, yeniden icat etmiyor.
3. **Sunucu tarafı fiyat hesaplama** (istemci fiyatına güvenilmiyor) [GUV §9].
4. **Rol hiyerarşisinin istek başına DB'den doğrulanması** (`attachAuth` + `getEffectiveRole`) [GUV §9; QA auth.test.ts ile testli] — rol düşürülmüş kullanıcı anında etkisini kaybeder (token iptali hariç — MP-2.1).
5. **Sunucu tarafı stok doğrulaması** (`POST /orders` DB'den ürün okuyor) [BE/GUV] — DEF-1 yalnızca hata **iletim** bozukluğuydu, doğrulamanın kendisi değil.
6. **`coupon.ts` servisi** — yan etkisiz saf fonksiyon + birim testli; servis katmanı çıkarılırken model alınacak en iyi örnek [BE §4.1].
7. **storage.ts path-traversal koruması** (`path.resolve + startsWith`) ve sharp ile görüntü yeniden kodlama [GUV §7; BE §6.2].
8. **Üretimde CORS zorunluluğu** (`ALLOWED_ORIGINS` `:?` ile), `server_tokens off`, TLS 1.2/1.3, HSTS [GUV §8].
9. **`syncAfterMutation` deseni** (mutasyon sonrası anında refresh) [BE §5.3] — polling aralıkları uzatılırken korunmalı.
10. **Var olan CI workflow'u** (`.github/workflows/ci.yml`) [QA §7] — Backend raporundaki "CI yok" bilgisi güncel değil; iyileştirme MP-1.9.

---

## 7. Ölçüler ve Doğrulanabilirlik

- Tüm satır referansları kaynak raporların `a16cbd3` commit'i üzerinden alınmıştır; kod değiştikçe satırlar kayabilir — madde başlıkları ve endpoint adları birincil tanımlayıcıdır.
- Kaynak raporların yöntem notları: güvenlik denetimi statik (sızma testi yok; `npm audit` ve dinamik test önerilir) [GUV]; frontend a11y bölümü kod taramasıdır (ekran okuyucu testi yok) [FE]; QA testleri `orch-qa-tests` worktree'sinde, uygulama kodu değiştirilmeden yazılmıştır (tek istisna: supertest devDependency) [QA].
- Bu planın kendi doğrulaması: dört raporun tamamı okundu, tüm P0/P1 maddeleri ve yapısal P2/P3 temaları birebir eşlendi; çapraz rapor çelişkileri (CI var/yok) açıkça işaretlendi.

*Rapor sonu. Kod değişikliği yapılmamıştır — yalnızca bu sentez belgesi üretilmiştir.*
