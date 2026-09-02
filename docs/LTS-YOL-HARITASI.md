# Bancho Cafe (Brew & Bloom) — LTS Yol Haritası

> **Amaç:** Projenin 3–5 yıl boyunca büyük bir revizyon gerektirmeden, güvenli ve tahmin edilebilir biçimde çalıştırılmasını sağlamak. Bu doküman; bağımlılık LTS dönemlerini, canlıya alma adımlarını, yedekleme/izleme stratejisini ve ödeme/e-posta entegrasyon aşamalarını tek referans altında toplar.
>
> **Kaynaklar:** `proje-bilgi-formu.md` (gereksinim formu), `metadata.json`, `package.json`, `docker-compose.yml`, `server.ts` ve `scripts/` analizi. Hedef trafik: aylık ~500–2.000 ziyaretçi, aynı anda ~30–50 kullanıcı (tek şube).

---

## İçindekiler

1. [Mevcut Durum Özeti](#1-mevcut-durum-ozeti)
2. [Bağımlılık LTS Dönemleri ve Güncelleme Stratejisi](#2-bagimlilik-lts-donemleri-ve-guncelleme-stratejisi)
3. [Canlıya Alma Kontrol Listesi](#3-canliya-alma-kontrol-listesi)
4. [Önerilen Yedekleme Stratejisi](#4-onerilen-yedekleme-stratejisi)
5. [Önerilen İzleme (Monitoring) Stratejisi](#5-onerilen-izleme-monitoring-stratejisi)
6. [Ödeme Entegrasyonu (İyzico / Stripe)](#6-odeme-entegrasyonu-iyzico--stripe)
7. [SMTP / E-posta Entegrasyonu](#7-smtp--e-posta-entegrasyonu)
8. [Önerilen `docs/` Klasör Yapısı](#8-onerilen-docs-klasor-yapisi)
9. [Yıllık Bakım Takvimi](#9-yillik-bakim-takvimi)

---

## 1. Mevcut Durum Özeti

| Konu | Durum |
|---|---|
| Ortam | Yerel geliştirme (`localhost:3000`); canlı domain henüz yok (`bancho.cafe` adayı) |
| Altyapı | Docker Compose'a hazır: `app` + `mongodb` (mongo:7) + `nginx` (80/443, TLS 1.2/1.3) — VDS deploy betikleri mevcut |
| SSL | Nginx yapılandırması hazır; `nginx/generate-ssl.sh` kendinden imzalı sertifika üretiyor. Let's Encrypt (certbot) henüz kurulmadı |
| Ödeme | Uygulama içi bakiye/kredi kartı **simülasyonu** var; gerçek entegrasyon (İyzico/Stripe) yok |
| E-posta | SMTP yok; sipariş/rezervasyon bildirimi yalnızca uygulama içi + Web Push |
| Kimlik doğrulama | JWT (Bearer) + bcrypt; rate limit ve Helmet mevcut |
| Test | 20 birim testi (Vitest) + CI (lint → test → build) ✅ |
| Bilinen riskler | (a) `scripts/vds-*.py` içinde **düz metin kök parola**; (b) `BOOTSTRAP_ADMIN_PASSWORD` varsayılanı; (c) CSP henüz report-only; (d) yedekleme cron'u kurulu değil |

---

## 2. Bağımlılık LTS Dönemleri ve Güncelleme Stratejisi

### 2.1 Çekirdek bağımlılıkların destek dönemleri

Aşağıdaki tarihler resmi destek (EOL = End of Life) takvimleridir. LTS hedefi (3–5 yıl) için **her katmanın destek penceresi içinde kalınması** gerekir.

| Katman | Mevcut sürüm | Resmi destek durumu | Notlar |
|---|---|---|---|
| **Node.js 20** | `node:20-slim` (Dockerfile), CI Node 20 | Bakım sürümü **Nisan 2026'da EOL** olmuştur (Node 20 Nisan 2024'te LTS oldu, 2 yıl bakım) | ⚠️ **En acil madde.** Node 22 (LTS, Ekim 2024 → Nisan 2027 bakım) veya ideal olarak Node 24'e (LTS) geçilmeli. `tsx`/`sharp`/`web-push` Node 22+ ile uyumludur; geçiş öncesi `npm ci && npm test && npm run build` tam set çalıştırılmalı. |
| **React 19** | `^19.0.0` | Aktif (React sürümleri takvim bazlı EOL kullanmaz; son major içinde kalınması yeterli) | React 19 kararlı; `@types/react` ile uyumlu. Major atlamalar (React 20+) ancak yeni bir özellik gerektirdiğinde ve `react-dom` + `lucide-react` + `recharts` + `motion` uyum tabloları kontrol edildikten sonra yapılmalı. |
| **Express 4 → 5** | `^4.21.2` | Express 4 bakım modunda; **Express 5** (2024 sonunda kararlı) aktif geliştirme hattı | En önemli davranış farkları: (1) async hata yönetimi — reddedilen promise'ler otomatik `next(err)`'e gider; (2) yol deseni sözdizimi (`*` → `/*splat`); (3) `req.query` getter'a döner. Bu kod tabanında `app.get("*", ...)` SPA fallback'i **mutlaka güncellenmeli**. Aşağıdaki geçiş planına bakın. |
| **Vite 6** | `^6.2.0` | Vite 6 kararlı; Vite 7 çıkmış durumda | Yalnızca derleme aracı — riski düşük. `@vitejs/plugin-react` ve `vitest` sürümleriyle birlikte hareket etmeli (Vitest 2 → 3/4 geçişi gerektirebilir). |
| **MongoDB 7** | `mongo:7` (compose) | MongoDB 7 çıkalı birkaç yıl oldu; MongoDB 8 mevcut | `mongo:7` imajı halen çalışıyor ancak yeni özellik/performans ve uzun ömür için **MongoDB 8'e** planlı geçiş önerilir (WiredTiger uyumlu, `mongodump` yedeğiyle güvenli). Mongoose 9 ikisini de destekler. |
| **Mongoose 9** | `^9.4.1` | Aktif major | Express 5 ve Node 22 ile uyumlu. Major atlamalarda breaking-change notlarını izleyin. |
| **TypeScript ~5.8** | | Aktif | `tsc --noEmit` tip kontrolü; sürüm atlamak düşük riskli ama `moduleResolution: "bundler"` davranışını etkileyebilir. |
| **Tailwind CSS 4** | `^4.1.14` (+ `@tailwindcss/vite`) | Aktif major (v3'ten köklü değişim) | Zaten yeni kuşak; özel yapılandırma dosyası yok, CSS-first. |
| **Vitest 2** | `^2.1.9` | Vitest 2 eski; Vitest 3+ mevcut | Vite sürümüyle birlikte güncellenmeli. |

> ⚠️ Bu tablodaki EOL tarihlerini **her yıl doğrulayın** (nodejs.org/en/about/previous-releases, expressjs.com, mongodb.com/support-policy). Sürüm takvimi değişebilir; kritik olan yöntemdir: *destek penceresi kapanmadan 6 ay önce planla, kapanmadan önce geçir.*

### 2.2 Express 4 → 5 geçiş planı (önerilen adımlar)

Express 5 geçişi bu kod tabanında **kontrollü ve küçük bir değişiklik kümesi** ile yapılabilir:

1. `npm install express@5` (+ `@types/express` v5 karşılığı).
2. `server.ts` içindeki SPA fallback'ini güncelle:
   - Express 4: `app.get("*", ...)`
   - Express 5: `app.get("/{*splat}", ...)` veya `/*splat` — `*` artık geçersiz.
3. Route'larda regex/wildcard kullanımı taraması: `grep -rnE "router\.(get|post|put|patch|delete)\(.*[*+?]" src/server/routes/` — varsa yeni sözdizimine çevir.
4. Async handler'ları gözden geçir: Express 5 reddedilen promise'i otomatik yakalar; mevcut `try/catch + next(err)` blokları zarar görmez, sadeleşebilir.
5. `npm test` + `npm run lint` + `npm run build` + `simulate-table.ts` ile uçtan uca doğrulama.
6. Docker imajını yeniden derleyip (`npm run docker:up`) staging'de duman testi yap.

### 2.3 Node 20 → 22 (→ 24) geçiş planı

1. Yerelde `nvm use 22` → `rm -rf node_modules package-lock.json` yerine **`npm ci`** ile temiz kurulum.
2. `sharp` (native) ve `web-push` başta olmak üzere native/erişim katmanı testleri: görsel yükleme akışını (WebP dönüşümü) ve push gönderimini elle doğrula.
3. `Dockerfile` ve `.github/workflows/ci.yml` içindeki `node:20` / `node-version: "20"` değerlerini güncelle.
4. MongoDB sürümünü aynı anda değiştirme — **her seferinde tek major** ilkesi.

### 2.4 Genel güncelleme stratejisi (LTS ilkesi)

- **Yama/minör güncellemeler** (güvenlik): aylık `npm audit` + `npm outdated` rutini; kritik CVE'de anında.
- **Major geçişleri**: her seferinde **tek major**, her zaman test → build → staging duman testi sonrası; değişiklik notu `docs/CHANGELOG.md` altına işlenir.
- **Kilit ilkesi**: `package-lock.json` commit edilir; canlıda `npm ci` kullanılır (`npm install` değil). Dockerfile zaten `npm ci` kullanıyor — korunmalı.
- **Yıllık gözden geçirme**: her yıl bu dokümanın 2.1 tablosu güncellenir (bkz. [Yıllık Bakım Takvimi](#9-yillik-bakim-takvimi)).

---

## 3. Canlıya Alma Kontrol Listesi

Sıralı bir kontrol listesi; her madde tamamlandıkça işaretleyin.

### 3.1 Domain ve DNS

- [ ] Domain satın al (`bancho.cafe` adayı; alternatifler önceden rezerve edilmeli)
- [ ] DNS A kaydı: `@` → VDS IP; `www` CNAME → kök domain (veya A kaydı)
- [ ] TTL'i ilk kurulumda düşük tut (300 sn), stabilize olduktan sonra yükselt
- [ ] İleriye dönük: `api.` alt alan adı **gerekmiyor** (aynı origin altında `/api` prefix'i kullanılıyor — CORS yüzeyi küçük kalır)

### 3.2 Sunucu (VDS) hazırlığı

- [ ] Root yerine `deploy` adında sudo kullanıcısı oluştur; **parola ile SSH'u kapat**, yalnızca anahtarla girişe izin ver (`PasswordAuthentication no`)
- [ ] `scripts/vds-*.py` içindeki **düz metin kök parolalarını kaldır** (bkz. alttaki güvenlik bölümü) — bu betikler geçmişte `root` parolasını depoda taşıdı; depoyu özel tutsanız bile temizlenmeli
- [ ] UFW: yalnız `22/tcp`, `80/tcp`, `443/tcp` açık; MongoDB (27017) **asla** dışarıya açık olmasın
- [ ] Otomatik güvenlik güncellemeleri: `unattended-upgrades` kur
- [ ] Fail2ban (SSH denemeleri için) — opsiyonel ama önerilir

### 3.3 SSL / Certbot (Let's Encrypt)

Proje Nginx'i ACME challenge yolunu (`/.well-known/acme-challenge/`) sunacak şekilde hazır; `certbot_www` volume'u compose'da tanımlı. Adımlar:

- [ ] Domain DNS'i VDS'i gösterdikten sonra ilk sertifika:
  ```bash
  # webroot modu ile (downtime yok):
  docker compose run --rm --entrypoint "certbot" nginx  # (veya sunucuda certbot)
  certbot certonly --webroot -w /var/www/certbot \
    -d bancho.cafe -d www.bancho.cafe --email admin@bancho.cafe --agree-tos
  ```
  Alternatif ve daha basit yol: sunucuya `certbot` kurup `certbot certonly --webroot ...` ile `/etc/letsencrypt` altına üretmek ve `nginx/ssl/live/` altına kopyalamak/bağlamak (nginx bunu `:ro` mount ediyor).
- [ ] `nginx/ssl/live/` altına `fullchain.pem` + `privkey.pem` yerleştir (`generate-ssl.sh`'ın kendinden imzalı sertifikasının **üzerine yaz**)
- [ ] `nginx/conf.d/default.conf` içinde `server_name _;` → `server_name bancho.cafe www.bancho.cafe;` olarak netleştir
- [ ] Yenileme otomasyonu — crontab:
  ```cron
  0 3 * * 1  certbot renew --quiet && docker compose exec nginx nginx -s reload
  ```
  (Haftada bir pazar/tatil dışı bir saatte; yukarıdaki örnek pazartesi 03:00. Let's Encrypt 90 günlük sertifikaları ~30 gün kala yeniler.)
- [ ] HTTPS yönlendirmesini doğrula: `curl -I http://bancho.cafe` → 301 → https; HSTS başlığı geliyor (nginx.conf'da mevcut)
- [ ] SSL Labs testi (ssllabs.com/ssltest) — hedef A/A+

### 3.4 Uygulama yapılandırması (.env — üretim)

- [ ] `NODE_ENV=production`
- [ ] **Gerçek `JWT_SECRET`**: `openssl rand -hex 32` çıktısı; `.env` depoya **asla** girmez (gitignore'da), yedek anahtar güvenli yerde saklanır (parola yöneticisi). Sıfırdan üretilmesi tüm oturumları geçersiz kılar — canlıda bir kez tanımla, sonra değiştirme.
- [ ] **`ALLOWED_ORIGINS=https://bancho.cafe,https://www.bancho.cafe`** — uygulama üretimde jokersiz açık liste olmadan açılmaz (kasıtlı koruma)
- [ ] `BOOTSTRAP_ADMIN_EMAIL` gerçek yönetici e-postası; **`BOOTSTRAP_ADMIN_PASSWORD` güçlü ve benzersiz** (varsayılan `Admin123!` asla kalmamalı — açılıştan sonra panelden değiştir)
- [ ] `MONGODB_URI=mongodb://mongodb:27017/cafe_db` (compose içi)
- [ ] İlk açılıştan sonra `ENABLE_SEED=false`'a çek (tekrar başlatmalarda örnek veri yüklenmesin) — **yalnızca gerçek menü verileri girildikten sonra**
- [ ] `DEFAULT_MANAGER_EMAILS` gerçek yönetici listesiyle güncelle

### 3.5 MongoDB güvenliği ve başlangıç verisi

- [ ] Mongo portu yalnız compose ağından erişilebilir (zaten `expose` — `ports` **ekleme**)
- [ ] Opsiyonel sıkılaştırma: compose'a `MONGOINITDB_ROOT_USERNAME/PASSWORD` + `MONGODB_URI=mongodb://kullanici:sifre@mongodb:27017/cafe_db?authSource=admin` ekle
- [ ] Gerçek menü: kafe sahibinden ürün/kategori/fiyat listesi al → yönetici panelinden gir (`autoSeed` örnek verisini **sil**, `sync-cafe-catalog` betikleri yerine panel kullanımı önerilir)
- [ ] Masa sayısını gerçek mekâna göre ayarla: `npm run qr:generate -- --count <N> --base-url https://bancho.cafe`
- [ ] QR kodları bastır ve masalara yerleştir (`qr-codes/` klasörü)

### 3.6 Bildirim ve tarayıcı izinleri

- [ ] VAPID anahtar çiftini üret ve `.env`'e sabitle (canlıda `.vapid-keys.json` volume'da kalabilir ama env daha taşınabilir):
  `npx web-push generate-vapid-keys`
- [ ] `metadata.json` `requestFramePermissions` (geolocation, camera) — kamera izni yalnızca HTTPS altında çalışır; QR tarayıcı akışını canlıda test et
- [ ] Service worker + push aboneliğini gerçek bir Android/iOS cihazda doğrula

### 3.7 Yasal / KVKK

- [ ] Gizlilik politikası ve kullanıcı sözleşmesi sayfaları (üyelik verisi, sipariş geçmişi, ödeme simülasyonu verisi işleniyor)
- [ ] KVKK aydınlatma metni + veri sorumlusu bilgisi; mağaza (yedek) silme/aktarım talepleri için bir süreç tanımla (kullanıcı verisini silme/aktarma uç noktası henüz yok — iş maddesi olarak açılmalı)
- [ ] Çerez politikası — uygulama çerez kullanmıyor (Bearer/localStorage); yine de yerel depama yazılan token'ı politika metninde belgele
- [ ] Online ödeme açıldığında: PCI-DSS uyumlu aracı (İyzico/Stripe) kullanıldığını ve kart verisinin sistemde saklanmadığını belgele (Bölüm 6)

### 3.8 Son duman testi (canlı)

- [ ] `https://bancho.cafe` açılıyor, HTTP→HTTPS yönlendiriyor
- [ ] Kayıt/giriş → sipariş → personel onayı → sadakat puanı tam döngü
- [ ] QR masa akışı: QR tara → masa oturumu → ortak hesap → kapat
- [ ] Push bildirimi gerçek cihaza geliyor
- [ ] `GET /api/health` 200 dönüyor (uptime izleme için kullanılacak)
- [ ] Yedek cron'u çalışmış ve `backups/` altında dosya var
- [ ] `docker compose ps` → üç servis healthy

### 3.9 Bilinen güvenlik temizliği (canlıya almadan önce)

| Risk | Yapılacak |
|---|---|
| `scripts/vds-setup.py`, `vds-exec.py`, `vds-deploy.py`, `vds-deploy-tar.py` içinde düz metin `root` parolası | Parolaları betiklerden tamamen kaldır; SSH anahtarı + `deploy.ps1` akışına geç. Geçmişte parola depoya işlendiyse **parolayı değiştir** ve gerekiyorsa tarih temizliği değerlendir. |
| `BOOTSTRAP_ADMIN_PASSWORD` varsayılanı | Üretimde güçlü, benzersiz parola; ilk girişte değiştir |
| CSP report-only | Canlıda 2–4 hafta rapor izle → ihlal kalmayınca `server.ts` içindeki Helmet CSP'yi enforcing'e geçir (`reportOnly: false`) |
| `express-rate-limit` in-memory store | Tek konteynerde yeterli; yatay ölçekleme olursa Redis store'a geç |

---

## 4. Önerilen Yedekleme Stratejisi

### 4.1 Neyi yedekliyoruz?

| Veri | Nerede | Yöntem | Sıklık | Saklama |
|---|---|---|---|---|
| MongoDB (`cafe_db`) | `bancho_mongodb_data` volume | `mongodump --gzip` | **Günde 1 (gece 03:30)** | 14 günlük döner (yerel) |
| Haftalık tam kopya | — | Aynı arşiv | Haftada 1 | **30 gün** (off-site) |
| Yüklenen görseller | `bancho_uploads_data` volume | `tar` arşivi | Haftada 1 | 30 gün |
| `.env` + VAPID anahtarları | VDS | Şifreli kopya (parola yöneticisi) | Değişiklikte | Süresiz (güvenli yerde) |
| Nginx/SSL yapılandırması | Repo + `nginx/ssl/live/` | Repo (yapılandırma) + sertifika yeniden üretilebilir | Değişiklikte | Repo |

### 4.2 Hazır araç: `scripts/backup-db.sh`

Depodaki betik zaten `mongodump --archive --gzip` ile yedek alıyor, 14 günden eskiyi siliyor. **Eksik olan tek şey zamanlama ve off-site kopya.** Önerilen kurulum:

```bash
# 1) Yedek dizini (volume dışında, disk dolarsa Mongo etkilenmesin)
mkdir -p /srv/cafe/backups/mongodb

# 2) crontab (VDS'te, deploy kullanıcısı)
30 3 * * *  cd /srv/cafe/app && BACKUP_DIR=/srv/cafe/backups/mongodb bash scripts/backup-db.sh >> /srv/cafe/backups/backup.log 2>&1
0  4 * * 0  tar -czf /srv/cafe/backups/uploads_$(date +\%Y\%m\%d).tar.gz /var/lib/docker/volumes/bancho_uploads_data/_data
```

### 4.3 Off-site (3-2-1 kuralının minimum'u)

Yerel yedek, VDS'in diskini kaybederseniz işe yaramaz. En az **bir** dış kopya:

- **Basit yol:** haftalık arşivi başka bir bulut depolamaya taşıyan cron:
  ```bash
  # örnek: rclone ile S3/B2/Wasabi'ye
  0 5 * * 0  rclone copy /srv/cafe/backups/mongodb remote:bancho-backups/mongodb --max-age 8d
  ```
- **Alternatif:** `scripts/pull-prod-mongo.ps1` ile geliştirme makinesine periyodik çekim (elle tetiklenir; otomatik değil).
- Restore provası: **çeyrekte bir** `restore-local-mongo.ps1` (veya `mongorestore --archive --gzip`) ile bir yedeği sandbox ortamına geri yükleyip doğrula — test edilmemiş yedek, yedek değildir.

### 4.4 MongoDB Atlas alternatifi

Bakım yükünü azaltmak istenirse: MongoDB Atlas'ın ücretsiz/uygun katmanı (otomatik günlük snapshot + point-in-time restore). Tek şube ölçeğinde (aylık ~500–2.000 ziyaretçi) küçük bir ücretli katman yeterli olur; o zaman `MONGODB_URI` Atlas bağlantı dizesine döner, yerel Mongo konteyneri ve yedek cron'u devre dışı kalır. Maliyet/bakım dengesi iş kararıdır — LTS açısından iki seçenek de kabul edilebilir.

---

## 5. Önerilen İzleme (Monitoring) Stratejisi

### 5.1 Minimum set (ücretsiz, kurulması saatler içinde)

| Katman | Araç | Ne izler |
|---|---|---|
| Dışarıdan erişim | **UptimeRobot / Uptimia** (ücretsiz katman) | `https://bancho.cafe/api/health` 1 dk'da bir → HTTP 200 değilse e-posta bildirimi |
| Süreç | Docker healthcheck (mevcut) | `app` konteyneri `/api/health` 30 sn'de bir — compose otomatik yeniden başlatır (`restart: unless-stopped`) |
| Disk | Basit cron uyarısı | Yedek diskin dolması en yaygın sessiz arızadır: `% > 85`'te e-posta at |
| Günlük | `docker compose logs -f app` + log rotasyonu | Hata ayıklama; Docker json-file driver'ına `max-size`/`max-file` sınırları ekle (compose'ta yok — eklenmeli) |

**`/api/health` zaten var** (Dockerfile healthcheck'i onu kullanıyor) — dış izleme için ayrıca kod gerekmiyor.

### 5.2 Önerilen genişletme (iş büyürse)

- **Grafana Cloud ücretsiz katmanı / Better Stack**: Prometheus metrikleri + log toplama; Nginx erişim loglarından yanıt süresi/5xx oranı.
- **Sentry** (ücretsiz katman yeterli): frontend `ErrorBoundary`'den (`src/components/ErrorBoundary.tsx` mevcut) ve Express hata middleware'inden exception toplar — LTS boyunca sessiz hataları görünür kılar.
- **MongoDB izleme**: `mongosh` ile basit kontrol (`db.serverStatus().connections`) veya Atlas'ın built-in metrikleri.
- Nginx log formatına `$request_time` ekle → yavaş uç noktaları görünür kıl.

### 5.3 Bildirim kanalları

Operasyon ekibi küçük olduğu için: e-posta (SMTP kurulduktan sonra, Bölüm 7) + tercihen Telegram botu (kurulumu 10 dk, ücretsiz cron uyarıları için ideal). Kritik eşikler:

- `/api/health` 2 kez üst üste hata → anında bildirim
- Disk %85 → bildirim; %95 → acil
- Yedek cron'u 24 saat içinde dosya üretmediyse → bildirim (yedek varlığını da izleyen basit `find -mtime` kontrolü)

---

## 6. Ödeme Entegrasyonu (İyzico / Stripe)

> Bilgi formu notu: şu an **uygulama içi bakiye/kredi kartı simülasyonu** var; gerçek sağlayıcı seçimi yapılmalı. Türkiye pazarı + TL işlemler için **İyzico** birincil aday; uluslararası müşteri beklentisi oluşursa **Stripe** eklenir.

### 6.1 Sağlayıcı karar kriterleri

| Kriter | İyzico | Stripe |
|---|---|---|
| TL / yerel kartlar | ✅ Güçlü (yerel işlemci, 3D Secure zorunlu akışlarına alışık) | ✅ ama TL settlement farklılaşabilir |
| Komisyon | İşlem bazında ~%2,5–3,5 + sabit (güncel tarifeye bak) | Benzer aralık + döviz dönüşümü |
| Abonelik (planlar) | Subscriptions API mevcut | Subscriptions çok olgun — `Subscription` modeliyle (Bölüm 6.3) daha az iş |
| Entegrasyon yükü | Form/redirect tabanlı (iFrame — PCI yükü düşük) | Checkout Session / Payment Element (PCI yükü düşük) |
| Ön ödeme/bakiye | Doğrudan çekim odaklı | Stripe Treasury hariç benzer |

**Öneri:** Tek Türkiye lokasyonu + TL → **İyzico** ile başla; mimariyi sağlayıcı-bağımsız kur (aşağıdaki 6.3) ki Stripe sonra eklenebilsin.

### 6.2 Aşamalar

**Aşama 1 — Hazırlık (kod tabanında)**
1. Yeni servis dosyası: `src/server/services/payment.ts` — arayüz (interface) tanımla: `createCheckout(orderId, amount, currency)`, `verifyWebhook(payload, signature)`, `refund(paymentId)`. Sağlayıcıya özgü kod bu arayüzün arkasında kalır.
2. Webhook uç noktası: `POST /api/payments/webhook` (imza doğrulamalı, rate limit dışında tutulacak şekilde ayarlanmalı — sağlayıcı IP kısıtlaması ekle).
3. `Order` modeline ödeme alanları: `paymentProvider`, `paymentId`, `paymentStatus` (`pending|paid|failed|refunded`).
4. Mevcut simülasyonu `PAYMENT_MODE=simulated|iyzico` env'i ile yaşat — geliştirme ortamı sahte sağlayıcıda kalsın.

**Aşama 2 — İyzico kurulumu**
5. İyzico hesabı aç (şirket/şahıs evrakları) → API anahtarı üret (`sandbox` ile başla).
6. `iyzico` npm paketi (resmi) veya REST API entegrasyonu; önerilen akış: **Checkout Form** (redirect/iFrame) — kart verisi uygulamanıza hiç girmez → PCI-DSS kapsamı minimumda kalır.
7. 3D Secure zorunluluğu: Türkiye'de işlemci tarafında yönetilir; webhook'ta `paid` onayı bekleyip sipariş durumunu ancak onay sonra `confirm` et.
8. Sandbox'ta tam döngü testi: sipariş → ödeme → webhook → sadakat puanı → bakiye/masa kapatma.

**Aşama 3 — Canlı geçiş**
9. KVKK/metin güncellemeleri (Bölüm 3.7), iade politikası sayfası.
10. Canlı anahtarlar `.env`'e (sandbox/canlı `PAYMENT_MODE` ile ayrılır).
11. İlk hafta günlük mutabakat kontrolü: İyzico panel toplamı vs `Order` modeli `paid` toplamı.
12. İade akışını panelden tetiklenebilir yap (yönetici paneline "iade" butonu — `refund()` arayüzü).

**Aşama 4 — Stripe (uluslararası ihtiyaç olursa)**
13. Aynı arayüz altına Stripe Payment Element implementasyonu; `paymentProvider` alanı zaten ayrımı taşır.
14. Çoklu para birimi (i18n'de `SUPPORTED_CURRENCIES` mevcut — fiyatlama katmanı buna göre genişletilir).

### 6.3 Mevcut modellerle ilişki

- `BalanceTopUp` modeli → bakiye yükleme işlemleri sağlayıcı ödemesine bağlanır.
- `Subscription` / `SubscriptionPlanModel` → abonelik planları İyzico/Stripe abonelik ürünlerine eşlenir (webhook ile senkronize edilir: `invoice.paid`, `subscription.cancelled` vb.).
- Sadakat puanı (`applyCompletedOrderLoyalty`) yalnızca `paymentStatus=paid` sonrası tetiklenmeli — çift puan/iptal iadesi senaryosu iş mantığına eklenmeli.

---

## 7. SMTP / E-posta Entegrasyonu

### 7.1 Neden gerekli?

- Sipariş/rezervasyon onay e-postaları
- Şifre sıfırlama akışının gerçek bir kanalı — `/api/auth/reset-password` bugün talebi yalnızca **yerel olarak kabul ediyor** (MVP; sistem metin anahtarı: "bu-mvp-surumunde-sifre-sifirlama-talebi-lokal-olarak-kabul-edildi"). SMTP kurulunca bu uç nokta gerçek e-posta gönderimine bağlanmalı.
- İzleme uyarıları (Bölüm 5.3) ve yedek raporları
- Kampanya duyuruları (ileride; toplu gönderim için ayrı araç)

### 7.2 Önerilen kurgu

| Bileşen | Öneri |
|---|---|
| Kütüphane | **Nodemailer** (de facto standart, TS tipleri mevcut) |
| Servis | Başlangıç: **Brevo (eski Sendinblue) ücretsiz katmanı** (~300 e-posta/gün) veya **Resend** (geliştirici dostu, API anahtarı yeterli). SMTP klasik'i: SendGrid/Mailgun. Türkiye'den gönderimde TLS/587 sorunsuz çalışır. |
| Kimlik doğrulama | SMTP kullanıcı/şifre **veya** API anahtarı → `.env`'de; asla repoya |
| Gönderen adresi | `noreply@bancho.cafe` — domain alındıktan sonra SPF + DKIM + DMARC kayıtları DNS'e eklenmeli (ücretsiz katmanlarda bile desteklenir; spam klasörüne düşmemenin tek garantisi) |

### 7.3 Aşamalar

1. **Domain sonrası:** DNS'e SPF (`v=spf1 include:<sağlayıcı> ~all`), DKIM (sağlayıcının verdiği CNAME'ler) ve DMARC (`v=DMARC1; p=quarantine; rua=mailto:admin@bancho.cafe`) kayıtları.
2. **Kod:** `src/server/services/email.ts` — `sendMail({to, subject, template, data})`; HTML şablonlar `src/server/emails/` altında basit ve markalı (Tailwind'i e-postada kullanma — inline CSS).
3. **Ayarlar** `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
4. **Tetik noktaları (aşamalı):**
   - 1. aşama: şifre sıfırlama + kritik hata bildirimleri
   - 2. aşama: sipariş onayı (müşteriye) + yeni sipariş (yöneticiye; push zaten var — e-posta yedek kanal)
   - 3. aşama: rezervasyon onayı/hatırlatma (rezervasyondan 2 saat önce cron)
5. **Test:** mailtrap.io tarzı sandbox SMTP ile geliştirmede gerçek kutuya düşmeden doğrula; canlıda kendi adreslerine prova gönderimi.
6. **Kota izleme:** ücretsiz katman limitlerinde kalınıp kalınmadığı aylık kontrol edilmeli (izleme paneline eklenebilir).

---

## 8. Önerilen `docs/` Klasör Yapısı

Bu doküman `docs/LTS-YOL-HARITASI.md` olarak kuruldu. Proje büyüdükçe önerilen tam yapı:

```
docs/
├── README.md                 # Doküman indeksi (doküman başına tek satır açıklama)
├── LTS-YOL-HARITASI.md       # Bu dosya — canlıya alma, yedek, izleme, entegrasyon planı
├── DEPLOYMENT.md             # Adım adım VDS kurulum günlüğü (sunucu, DNS, certbot, compose)
├── OPERATIONS.md             # Operasyon el kitabı: yedek geri yükleme, restart prosedürleri,
│                             #   sık hatalar ve çözümleri, iletişim zinciri
├── API.md                    # REST uç noktası kataloğu (api.ts + new-features.ts; örnek istek/yanıt)
├── ARCHITECTURE.md           # Mimari karar kayıtları (ADR formatında: bağlam → karar → sonuç)
├── SECURITY.md               # Güvenlik gözden geçirme notları, CSP enforcing geçiş planı,
│                             #   insident müdahale adımları
├── CHANGELOG.md              # Sürüm/bakım günlüğü (major geçişler, yama notları)
└── runbooks/                 # Tekrar edilebilir operasyon tarifleri (opsiyonel)
    ├── restore-backup.md     #   yedekten geri yükleme provası adımları
    └── rotate-secrets.md     #   JWT_SECRET / VAPID / SMTP rotasyonu prosedürü
```

**Kurallar:** her doküman Türkçe; tarihli değişiklik notu içerir; kod referansları `dosya:satır` formatında; LTS-YOL-HARITASI yıllık gözden geçirilir (aşağıda).

---

## 9. Yıllık Bakım Takvimi

| Periyot | İş |
|---|---|
| **Haftalık** (otomatik) | MongoDB yedek cron'u; uploads arşivi; certbot yenileme (otomatik) |
| **Aylık** | `npm audit` + `npm outdated` → güvenlik yamaları; yedek dosyalarının varlık kontrolü; disk kullanımı |
| **Üç aylık** | Restore provası (bir yedek sandbox'a geri yüklenir); SSL Labs kontrolü; panelden kullanıcı/istek hacmine bakıp rate limit ayarlarını gözden geçir |
| **Altı aylık** | Bağımlılık major sürümleri gözden geçir (bu dokümanın 2.1 tablosunu güncelle); Docker imaj tabanını yeniden derle |
| **Yıllık** | LTS planının tümü gözden geçir; Node.js/Express/Mongo destek pencerelerini doğrula; KVKK metinleri ve yedek saklama süreleri gözden geçir; doküman indeksini yenile |

---

*Son güncelleme: 2026-09-02 — bu doküman `orch-docs-lts` worktree'inde hazırlandı; canlıya alma çalışması başlarken Bölüm 3 kontrol listesi kopyalanıp ilerleme olarak işaretlenmeli.*
