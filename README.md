# ☕ Bancho Cafe — Brew & Bloom

**QR tabanlı sipariş, sadakat ve kafe operasyon yönetimi platformu.**

Bancho Cafe, **Brew & Bloom** markasıyla geliştirilen; müşteri, personel ve yönetici olmak üzere üç farklı kullanıcı rolünü destekleyen kapsamlı bir kahve dükkanı yönetim ekosistemidir. Tek kod tabanında hem müşteri deneyimini (QR menü, masa siparişi, sadakat puanı) hem de operasyonu (sipariş akışı, stok, kampanya, raporlar) yönetir.

---

## İçindekiler

- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Mimari Genel Bakış](#mimari-genel-bakis)
- [Teknoloji Yığını](#teknoloji-yigini)
- [Gereksinimler](#gereksinimler)
- [Hızlı Başlangıç (Yerel Geliştirme)](#hizli-baslangic-yerel-gelistirme)
- [Ortam Değişkenleri (.env)](#ortam-degiskenleri-env)
- [Docker ile Çalıştırma](#docker-ile-calistirma)
- [SSL Rotasyonu Talimatı](#ssl-rotasyonu-talimati)
- [Test ve Kalite Kontrol](#test-ve-kalite-kontrol)
- [Scripts Klasörü Referansı](#scripts-klasoru-referansi)
- [Kullanıcı Rolleri](#kullanici-rolleri)
- [Proje Yapısı](#proje-yapisi)
- [İlgili Dokümanlar](#ilgili-dokumanlar)

---

## Öne Çıkan Özellikler

| Alan | Yetenekler |
|---|---|
| **Sipariş** | QR kod ile masa siparişi, hızlı yeniden sipariş, sipariş durumu takibi (hazırlanıyor → hazır → tamamlandı), masa oturumu (table session) ve ortak hesap ödemesi |
| **Sadakat** | Puan toplama, puan kampanyaları, QR ile puan toplama/tanıma, sadakat liderlik tablosu (opt-in), hediye gönderme |
| **Müşteri deneyimi** | Üyelik/kayıt, profil sayfaları, takip sistemi, değerlendirme (review), favori/mutlu saat kampanyaları, 7 dil desteği (tr, en, de, fr, es, it, ru) + çoklu para birimi |
| **Operasyon** | Personel paneli (sipariş kuyruğu, garson çağrıları, canlı destek sohbeti), stok/envanter takibi ve düşük stok uyarıları |
| **Yönetim** | Ürün/kategori/malzeme yönetimi, kampanya ve kupon yönetimi, personel yönetimi, rezervasyonlar, abonelik planları, raporlar/analytics, sistem metinlerini panelden düzenleme |
| **Bildirim** | Web Push bildirimleri (VAPID), uygulama içi bildirimler, rol bazlı bildirim gönderimi |
| **Güvenlik** | JWT kimlik doğrulama, bcrypt şifre saklama, Helmet güvenlik başlıkları, CORS kısıtlama, rate limiting, CSRF'siz Bearer token modeli |

---

## Mimari Genel Bakış

Proje **tek süreçli, tam yığın (full-stack) bir TypeScript uygulamasıdır**: Express sunucusu hem REST API'yi hem de (üretimde) derlenmiş React SPA'yı sunar.

```
                        ┌──────────────────────────────────────────┐
                        │              Node.js 20 (tsx)            │
  Tarayıcı / Mobil  ──▶ │  server.ts (Express)                     │
                        │  ├── Güvenlik katmanı                    │
  │  │  │               │  │   (Helmet, CORS, Rate limit)          │
                        │  ├── REST API (/api/...)                 │
                        │  │   ├── routes/api.ts (çekirdek)        │
                        │  │   └── routes/new-features.ts (yeni)    │
  /api   /uploads   /   │  ├── Statik dosyalar                     │
  (SPA)  (görseller)    │  │   ├── Geliştirme: Vite middleware     │
                        │  │   └── Üretim: dist/ (vite build)      │
                        │  └── Uploads (/uploads → uploads/)        │
                        └───────────────┬──────────────────────────┘
                                        │ Mongoose 9
                              ┌─────────▼─────────┐
                              │  MongoDB 7        │
                              │  cafe_db          │
                              └───────────────────┘
```

**Geliştirme modunda** (`NODE_ENV != production`):
- Vite dev server, Express'e **middleware mode**'da gömülür → HMR (canlı yeniden yükleme) etkin.
- MongoDB'ye bağlanılamazsa geliştirmeye devam edebilmek için otomatik olarak gömülü **MongoMemoryServer** başlatılır (veriler kalıcı değildir, uyarıyla bildirilir).

**Üretim modunda** (`NODE_ENV=production`):
- Vite dev server kapalıdır; `dist/` altındaki derlenmiş statik dosyalar sunulur, tüm rotlar `index.html`'e düşer (SPA yönlendirmesi).
- MongoDB bağlantısı başarısızsa uygulama **açılışta durur** — bellek-içi veritabanına düşmez (veri kaybı koruması).
- `ALLOWED_ORIGINS` tanımlı ve joker karakter içermiyorsa aksi halde açılışta hata verir.

**Docker Compose dağıtımında** üç servis birlikte çalışır:

| Servis | Açıklama |
|---|---|
| `app` | Yukarıdaki Node uygulaması (Dockerfile, çok aşamalı derleme, healthcheck `/api/health`) |
| `mongodb` | `mongo:7` imajı, kalıcı `bancho_mongodb_data` volume'u, healthcheck'li |
| `nginx` | Ters vekil (reverse proxy): HTTP→HTTPS yönlendirmesi, Let's Encrypt ACME doğrulama yolu, TLS 1.2/1.3, güvenlik başlıkları, `/uploads` için 30 günlük tarayıcı önbelleği |

---

## Teknoloji Yığını

| Katman | Teknoloji | Sürüm |
|---|---|---|
| Dil | TypeScript | ~5.8 |
| Frontend | React + React DOM | 19 |
| Stil | Tailwind CSS (v4 vite eklentisi) | 4 |
| UI yardımcıları | lucide-react (ikonlar), motion (animasyon), recharts (grafikler), qrcode.react | — |
| Backend | Express | 4 |
| Veritabanı | MongoDB + Mongoose | 7 / 9 |
| Bundler / Dev server | Vite | 6 |
| Test | Vitest | 2 |
| Çalışma zamanı | Node.js | 20 |
| Bildirim | web-push (VAPID) | 3 |
| Görsel işleme | Sharp (WebP dönüşümü) | 0.34 |

---

## Gereksinimler

- **Node.js 20+** ve npm
- **MongoDB 7** — kurulum gerekmez; `npm run db:start` proje içindeki taşınabilir MongoDB'yi (`.local-mongo/`) başlatır ya da Docker kullanılır
- (Üretim/dağıtım için) Docker + Docker Compose

---

## Hızlı Başlangıç (Yerel Geliştirme)

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Ortam değişkenlerini hazırla
cp .env.example .env
# .env içinde JWT_SECRET zorunludur — güçlü bir anahtar üret:
#   openssl rand -hex 32
# Geliştirmede ALLOWED_ORIGINS=* kullanabilirsin.

# 3. Yerel MongoDB'yi başlat (proje içindeki taşınabilir kurulum)
npm run db:start

# 4. Geliştirme sunucusunu başlat
npm run dev
```

Sunucu `http://localhost:3000` adresinde açılır. İlk açılışta `autoSeed` servisi:
- eksik koleksiyonları örnek verilerle (kategoriler, ürünler, masalar, kampanyalar) doldurur,
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` ile ilk yönetici hesabını oluşturur (bkz. [.env.example](.env.example)).

Kısayol olarak `npm run dev:full` = `db:start` + `dev` tek komutta çalıştırır.

> **MongoDB yoksa:** `npm run db:start` atlanırsa uygulama geliştirme modunda otomatik olarak gömülü bir MongoMemoryServer başlatır; ancak bu veritabanı **yeniden başlatmada sıfırlanır**. Kalıcı veri için `db:start` veya Docker önerilir.

### Faydalı komutlar

| Komut | İşlev |
|---|---|
| `npm run dev` | Geliştirme sunucusu (Vite HMR + API birlikte) |
| `npm run dev:full` | MongoDB'yi başlat + geliştirme sunucusu |
| `npm run db:start` / `db:stop` | Taşınabilir yerel MongoDB'yi başlat/durdur |
| `npm run db:clean` | Yerel MongoDB verisini sil (dikkat: geri alınamaz) |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run preview` | Derlemeyi önizle |
| `npm run lint` | TypeScript tip kontrolü (`tsc --noEmit`) |
| `npm test` / `npm run test:watch` | Vitest birim testleri (tek sefer / izleme modu) |
| `npm run lan:url` | Ağ (LAN) üzerinden erişilebilen URL'leri göster |
| `npm run qr:generate` | Masa QR kodlarını üret (aşağıya bakın) |
| `npm run docker:up` | Docker Compose ile tam yığını başlat (uygulama + Mongo + Nginx) |
| `npm run docker:db` | Yalnızca MongoDB konteynerini başlat |

---

## Ortam Değişkenleri (.env)

`.env.example` şablondur; kopyalayıp doldurun. Kritik alanlar:

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `JWT_SECRET` | **Evet** | Oturum token'larını imzalayan gizli anahtar. **Tanımsızsa uygulama açılmaz.** Üretimde mutlaka `openssl rand -hex 32` benzeri rastgele bir değer kullanın. |
| `NODE_ENV` | — | `production` yapılınca: bellek-içi DB yasağı, CORS sıkılaştırması, statik `dist/` sunumu devreye girer. |
| `MONGODB_URI` | — | Varsayılan `mongodb://localhost:27017/cafe_db`. Docker içinde `mongodb://root:<password>@mongodb:27017/cafe_db?authSource=admin`. |
| `MONGO_INITDB_ROOT_USERNAME` | Docker'da **evet** | Docker MongoDB kök kullanıcı adı (varsayılan `root`). |
| `MONGO_INITDB_ROOT_PASSWORD` | Docker'da **evet** | Docker MongoDB kök parolası. Üretimde güçlü bir parola belirleyin. |
| `ALLOWED_ORIGINS` | Üretimde **evet** | Virgülle ayrılmış açık domain listesi. Üretimde joker `*` kabul edilmez; tanımsızsa uygulama açılmaz. Örn: `https://bancho.cafe,https://www.bancho.cafe` |
| `PORT` / `HOST` | — | Varsayılan `3000` / `0.0.0.0`. |
| `ENABLE_SEED` | — | İlk açılışta örnek veri yüklenmesini kontrol eder (varsayılan `true`). |
| `BOOTSTRAP_ADMIN_EMAIL` vb. | Docker'da **evet** | İlk yönetici hesabı bilgileri. Bootstrap admin **veritabanı boşken değil, sistemde hiç yönetici yokken** oluşturulur; docker-compose şifre/eposta için `.env` zorunlu tutar. **Üretimde varsayılan şifreyi mutlaka değiştirin.** |
| `DEFAULT_MANAGER_EMAILS` | — | **Kayıtta rol vermez** (güvenlik düzeltmesi MP-0.2). Yalnızca yönetici hesabının yanlışlıkla rol düşürülmesini engelleyen koruma ve bootstrap admin tanımında kullanılır. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | — | Web Push anahtarları. Tanımsızsa ilk kullanımda otomatik üretilip `.vapid-keys.json` olarak saklanır. |

---

## Docker ile Çalıştırma

```bash
# .env dosyasını hazırla (JWT_SECRET ve ALLOWED_ORIGINS zorunlu,
# eksikse docker compose anlaşılır hata verir)
cp .env.example .env

# Tam yığını derle ve başlat: app + mongodb + nginx
npm run docker:up
# veya doğrudan: docker compose up -d --build
```

- Uygulama konteyneri yalnızca ağ içinden erişilebilir (`expose: 3000`); dış dünyaya **Nginx** üzerinden 80/443 portlarından açılır.
- SSL sertifikaları repoya girmez (`nginx/ssl/live/` gitignore'dur). İlk kurulumda `nginx/generate-ssl.sh` kendinden imzalı sertifik üretir (CN için `$1` argümanı ya da `SSL_CN` env'i, varsayılan `localhost`); canlı domain alındığında aşağıdaki SSL rotasyonu talimatıyla Let's Encrypt'e geçilir.
- Kalıcı veriler `bancho_mongodb_data` ve `bancho_uploads_data` volume'larında tutulur.
- MongoDB yedeği için hazır betik: `bash scripts/backup-db.sh` (14 günlük döner arşiv).

---

## SSL Rotasyonu Talimatı

Sertifika sızıntısı, süresi dolması ya da kendinden imzalı sertifikadan geçiş durumunda aşağıdaki adımları izleyin. Örnek domain: `bancho.cafe`.

### 1. Let's Encrypt ile yeni sertifika alın (sunucuda)

```bash
# Sunucuda (VDS) certbot yoksa kurun (webroot modu, nginx çalışır haldeyken):
sudo apt-get update && sudo apt-get install -y certbot

# 80 portunu kullanan nginx duruyor; webroot ile sertifika alın.
# Docker'ın publish ettiği 80 portuna ulaşabilmek için doğrudan ana makinedeki
# bir dizine yazdırın (volume yolu compose'daki nginx html volume'uyla eşleşmeli):
sudo certbot certonly --webroot -w /opt/bancho-cafe/nginx/www \
  -d bancho.cafe -d www.bancho.cafe \
  --email admin@bancho.cafe --agree-tos --no-eff-email
```

Sertifikalar `/etc/letsencrypt/live/bancho.cafe/` altında `fullchain.pem` ve `privkey.pem` olarak oluşur.

### 2. Sertifikaları nginx'in beklediği yere kopyalayın

```bash
# Eski (sızan) sertifikaları tamamen silin, yenilerini yerleştirin:
sudo rm -f /opt/bancho-cafe/nginx/ssl/live/privkey.pem \
            /opt/bancho-cafe/nginx/ssl/live/fullchain.pem
sudo cp /etc/letsencrypt/live/bancho.cafe/fullchain.pem \
        /etc/letsencrypt/live/bancho.cafe/privkey.pem \
        /opt/bancho-cafe/nginx/ssl/live/
sudo chmod 600 /opt/bancho-cafe/nginx/ssl/live/privkey.pem
```

### 3. docker-compose'u yeniden başlatın ve doğrulayın

```bash
cd /opt/bancho-cafe
docker compose restart nginx   # yalnızca nginx yeterli; tam yeniden başlatma için:
# docker compose down && docker compose up -d

# Doğrulama: veren kuruluş Let's Encrypt olmalı, tarih taze olmalı:
echo | openssl s_client -connect 127.0.0.1:443 -servername bancho.cafe 2>/dev/null \
  | openssl x509 -noout -issuer -dates
curl -fsS https://bancho.cafe/api/health
```

### Notlar

- **Otomatik yenileme:** `sudo certbot renew` + yukarıdaki kopyalama + `docker compose restart nginx` adımlarını cron'a bağlayın (Let's Encrypt sertifikaları 90 gün geçerlidir): `echo '0 3 * * 1 root certbot renew --deploy-hook "cp /etc/letsencrypt/live/bancho.cafe/*.pem /opt/bancho-cafe/nginx/ssl/live/ && cd /opt/bancho-cafe && docker compose restart nginx"' | sudo tee /etc/cron.d/bancho-certbot`.
- **Rotasyon sonrası eski anahtar** tüm yedeklerden, dağıtım arşivlerinden ve geliştirici makinelerinden silinmelidir; anahtar repoya asla commit edilmez (`nginx/ssl/live/` gitignore'dur).
- `generate-ssl.sh` yalnızca ilk kurulum/geliştirme amaçlıdır: `./nginx/generate-ssl.sh` ya da `SSL_CN=dev.local ./nginx/generate-ssl.sh` (CN = `$1` > `SSL_CN` > `localhost`).

---

## Test ve Kalite Kontrol

```bash
npm run lint   # tsc --noEmit — tip kontrolü (CI'da da çalışır)
npm test       # Vitest — birim testleri
```

Mevcut test dosyaları:

- `src/server/services/coupon.test.ts` — kupon doğrulama/kullanma mantığı
- `src/server/utils.test.ts` — sunucu yardımcı fonksiyonları
- `src/lib/campaignSchedule.test.ts` — kampanya zamanlama mantığı

CI (GitHub Actions, `.github/workflows/ci.yml`): her push/PR'da `npm ci` → lint → test → build çalıştırılır (Node 20).

Uçtan uca akış denemek için interaktif simülatör: `npx tsx scripts/simulate-table.ts` (masa oturumu, sipariş, garson çağrısı adımlarını terminalden walkthrough eder).

---

## Scripts Klasörü Referansı

`scripts/` altında operasyonel 24 betik bulunur. En sık kullanılanlar:

### Veritabanı (yerel)

| Betik | Komut | Açıklama |
|---|---|---|
| `start-local-mongo.sh` | `npm run db:start` | Proje içindeki taşınabilir MongoDB'yi (`.local-mongo/`) başlatır; veri `.local-mongo/data` altında kalıcıdır. İsteğe bağlı argüman: `[port] [bind-ip]`. |
| `stop-local-mongo.sh` | `npm run db:stop` | Taşınabilir MongoDB'yi durdurur. |
| `start-local-mongo.ps1` | (PowerShell) | Aynı işlevin Windows karşılığı. |
| `backup-db.sh` | `bash scripts/backup-db.sh` | Docker'daki MongoDB'den `mongodump` alır → `./backups/mongodb/`; 14 günden eski yedekleri temizler. `BACKUP_DIR` ile hedef değiştirilebilir. |
| `restore-local-mongo.ps1` | (PowerShell) | Arşivlenmiş yedeği yerel Mongo'ya geri yükler (`-ArchivePath` zorunlu). |
| `pull-prod-mongo.ps1` | (PowerShell) | VDS'teki üretim Mongo'sundan yedek çeker (SSH). |

### QR / Masa Yönetimi

| Betik | Komut | Açıklama |
|---|---|---|
| `generate-table-qr.mjs` | `npm run qr:generate` | MongoDB'ye masaları oluşturur (varsayılan 1–60) ve her masa için `{baseUrl}/table/{n}` içeren QR PNG'lerini `qr-codes/` klasörüne üretir (çevrimdışı, `qrcode` paketi). `--lan` bayrağı ile LAN IP'sine göre üretir. |
| `show-lan-urls.mjs` | `npm run lan:url` | Telefonunuzdan test için geçerli LAN URL'lerini listeler. |
| `simulate-table.ts` | `npx tsx scripts/simulate-table.ts` | Interaktif uçtan uca akış simülatörü (kullanıcı → masa → sipariş → durum). |

### Seed / Veri Senkronizasyonu

| Betik | Açıklama |
|---|---|
| `seed_premium_data.js` | Kategori/ürün/malzeme/masa örnek verisini yükler (eski yöntem; normalde `autoSeed` bunu otomatik yapar). |
| `seed_premium_campaigns.js` | Örnek kampanya verisini yükler. |
| `sync-cafe-catalog.mjs` / `.mts` | Katalog (kategori/ürün/malzeme) tanımlarını veritabanıyla senkronize eder. |
| `download-seed-images.mjs` | Seed görsellerini indirip WebP'ye çevirir ve `src/server/data/seed-images/` altına koyar — bir kez çalıştırıldığında uygulama tamamen çevrimdışı çalışır. |
| `check-user.mts` | Kullanıcının ham DB rolünü/oturum rolünü denetler (rol hatalarını teşhis için). |
| `create-manager.mts` | Elle yönetici hesabı oluşturur (`BOOTSTRAP_ADMIN_*` değişkenlerinden okur). |
| `fix-manager-session.mts` | Yönetici hesabının `sessionRole` alanını onarır. |

### Dağıtım (VDS/VPS)

> ⚠️ **Güvenlik notu:** Aşağıdaki betiklerde geçmişte sunucu IP'si ve kök parola **düz metin** olarak gömülüydü. Bu betikleri kullanmadan önce kimlik bilgilerini ortam değişkenlerine/SSH anahtarına taşıyın (ayrıntı: [docs/LTS-YOL-HARITASI.md](docs/LTS-YOL-HARITASI.md)).

| Betik | Açıklama |
|---|---|
| `deploy.ps1` | SSH ile VDS'e dağıtım (PowerShell, anahtar tabanlı). |
| `vds-setup.py` / `vds-deploy.py` / `vds-deploy-tar.py` / `vds-exec.py` | Python (pexpect) tabanlı sunucu kurulum/dağıtım/uzaktan komut betikleri. |
| `start-vds-mongo-tunnel.ps1` | VDS Mongo'suna SSH tüneli açar (yerel 27018 → uzak 27017). |
| `dev-vds-db.ps1` | Tünel üzerinden VDS veritabanına bağlanan geliştirme ortamı başlatır. |

---

## Kullanıcı Rolleri

Sistemde üç rol vardır (`src/types.ts` → `UserRole`): `customer`, `staff`, `manager`.

- Kimlik doğrulama **JWT Bearer token** ile yapılır (localStorage'da tutulur, `Authorization` başlığıyla gönderilir; çerez kullanılmaz).
- **Yönetici hesapları oturum bazlı rol değiştirebilir** (`sessionRole`): bir `manager` hesabı personel (`staff`) veya müşteri (`customer`) görünümüne geçerek akışları test edebilir. Geçerli rol `authRole` olarak isteklere eklenir ve `restrictTo` middleware'i ile uç noktalar role kapatılır.

---

## Proje Yapısı

```
bancho-cafe/
├── server.ts                  # Express giriş noktası (güvenlik, CORS, DB, Vite/SSPA modları)
├── src/
│   ├── App.tsx / AppContext.tsx / main.tsx
│   │                          # React SPA kökü + global durum (auth, tema, dil)
│   ├── components/
│   │   ├── CustomerPanel.tsx  # Müşteri paneli (menü, sepet, sipariş, sadakat)
│   │   ├── StaffPanel.tsx     # Personel paneli (sipariş kuyruğu, sohbet, çağrılar)
│   │   ├── ManagerPanel.tsx   # Yönetici paneli (ürün, kampanya, raporlar, personel)
│   │   └── ...                 # Modal/bileşenler (QR tarayıcı, liderlik tablosu vb.)
│   ├── lib/                    # İstemci yardımcıları (api istemcisi, i18n, sadakat, push)
│   ├── shared/                 # Sunucu+istemci ortak sabitler (sistem metinleri)
│   ├── server/
│   │   ├── routes/
│   │   │   ├── api.ts          # Çekirdek REST uç noktaları (auth, ürün, sipariş, sadakat...)
│   │   │   └── new-features.ts # Yeni modüller (kupon, rezervasyon, envanter, sohbet...)
│   │   ├── models/             # 23 Mongoose şeması (User, Order, Campaign, ...)
│   │   ├── services/           # İş mantığı (autoSeed, loyalty, coupon, push, storage...)
│   │   ├── middleware/auth.ts  # attachAuth / restrictTo (JWT + rol)
│   │   └── data/               # Seed görselleri ve varsayılan veriler
│   └── types.ts                # Paylaşılan TypeScript tipleri
├── scripts/                    # 24 operasyonel betik (yukarıdaki tablo)
├── nginx/                      # Ters vekil yapılandırması + SSL üretim betiği
├── docker-compose.yml          # app + mongodb + nginx yığını
├── Dockerfile                  # Çok aşamalı Node 20 imajı
└── docs/
    └── LTS-YOL-HARITASI.md     # LTS (uzun süreli destek) yol haritası
```

---

## İlgili Dokümanlar

- **[docs/LTS-YOL-HARITASI.md](docs/LTS-YOL-HARITASI.md)** — Bağımlılık LTS dönemleri, canlıya alma kontrol listesi, yedekleme/izleme stratejisi, ödeme ve SMTP entegrasyon aşamaları
- **[CLAUDE.md](CLAUDE.md)** — Kod tabanı rehberi (Claude Code ve geliştiriciler için mimari, konvansiyonlar, test komutları)
- **[proje-bilgi-formu.md](proje-bilgi-formu.md)** — Proje gereksinim formu (hedefler, kısıtlar, bütçe notları)
- **[.env.example](.env.example)** — Ortam değişkenleri şablonu

---

## Lisans

Özel/internal proje. Lisanslama kararları proje sahibine aittir.
