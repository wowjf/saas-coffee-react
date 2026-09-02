# Proje Bilgi Formu: Web Sitesi Profesyonelleştirme ve LTS Dönüşümü

> Bu form, web sitesi projesinin mevcut durumunu, hedeflerini ve teknik kısıtlarını anlayarak doğru bir LTS (Uzun Süreli Destek) stratejisi oluşturabilmek için hazırlanmıştır. Lütfen tüm başlıkları eksiksiz doldurun. Bilmediğiniz teknik detaylar için "Bilmiyorum" yazmanız yeterlidir.

---

## 1. PROJE KÜNYESİ VE MEVCUT DURUM

- **Web sitesi URL'si:** `http://localhost:3000` (geliştirme) — canlı domain henüz yok (`admin@bancho.cafe` domain kimliğiyle yapılandırılmış)
- **Projenin kısa açıklaması (bir cümle):** Brew & Bloom adıyla markalaşmış, müşteri / personel / yönetici olmak üzere üç farklı kullanıcı rolünü destekleyen kapsamlı bir kahve dükkanı yönetim ekosistemi.
- **Mevcut hosting / sunucu türü (paylaşımlı hosting, VPS, cloud vb.):** Yerel geliştirme ortamı; Docker Compose ile VPS/cloud'a deploy edilmeye hazır yapı mevcut.
- **Alan adı (domain) ve yönetim paneli bilgisi mevcut mu?** Domain henüz alınmamış; `bancho.cafe` veya benzeri bir domain adayı. Yönetim paneli uygulamanın içinde tam entegre.
- **Mevcut kod tabanına ait bilgiler:**
  - Kullanılan dil / framework / CMS: **TypeScript** + **React 19** (frontend) + **Express.js** (backend API) + **Vite 6** (bundler) — CMS yok, tamamen özel geliştirme.
  - Kodlar bir Git deposunda (GitHub, GitLab vb.) tutuluyor mu? Proje dizininde `.gitignore` mevcut, yerel Git geçmişi var; uzak depo bağlantısı belirsiz.
  - Veritabanı türü: **MongoDB 7** (Mongoose ORM ile). Yerel MongoDB yoksa uygulama otomatik olarak embedded `MongoMemoryServer` başlatıyor.
- **Sitenin şu anki genel durumu (kendi gözleminiz):**
  - Görünüm ve kullanıcı deneyimi: **Modern** — Tailwind CSS 4, Lucide ikonları, motion animasyonları, koyu/açık tema desteği ve çok dil (7 dil) ile profesyonel bir arayüz.
  - Hız ve performans: **Hızlı** — Vite ile optimize bundle, görsel sıkıştırma için Sharp kütüphanesi kullanılıyor. Üretim modunda static dist sunuluyor.
  - Güvenlik: SSL yok (gelişim ortamı); JWT tabanlı kimlik doğrulama ve bcrypt ile şifrelenmiş parola yönetimi mevcut. Dışarıya açık ortamda SSL zorunlu.

---

## 2. HEDEFLER VE BAŞARI KRİTERLERİ

- **Proje tamamlandığında ulaşılması gereken en önemli 3 başarı kriteri:**
  1. Müşteri, personel ve yönetici panellerinin eksiksiz ve stabil biçimde canlı ortamda çalışması (sipariş, ödeme, sadakat sistemi, rezervasyon).
  2. Güvenli HTTPS bağlantısı, düzenli yedekleme ve sıfır plansız kesinti (LTS güvenilirliği).
  3. Yöneticinin teknik bilgi gerekmeksizin ürün, kampanya, kupon ve personel yönetimini uygulama içinden yapabilmesi.
- **Hedef kitle ve trafik beklentisi:**
  - Şu anki aylık yaklaşık ziyaretçi sayısı: 0 (canlıya alınmamış, geliştirme aşamasında)
  - LTS sonrası beklenen aylık ziyaretçi sayısı: ~500–2.000 (tek şube + sadık müşteri kitlesi senaryosu)
  - Aynı anda sitede olması beklenen maksimum kullanıcı: ~30–50 (yoğun dönem; personel dahil)
- **Siteyi yayına aldıktan sonra kim yönetecek?**
  - Teknik ekip var mı, yoksa tamamen dış kaynak mı? Şu an tek geliştirici; ilerleyen dönemde dış kaynak desteği planlanabilir.
  - Varsa ekibin teknik seviyesi: **Yazılımcı** (TypeScript/Node.js/React deneyimi mevcut)
- **Projenin kaç yıl boyunca büyük bir revizyon olmadan çalışması hedefleniyor?** **3–5 yıl** (LTS hedefi; bağımlılıklar LTS sürümlere sabitlenecek)

---

## 3. TEKNİK GEREKSİNİMLER VE ALTYAPI

- **Sitenin olmazsa olmaz, kritik işlevleri nelerdir?**
  1. Müşteri üye girişi / kayıt
  2. Ürün listeleme ve sipariş oluşturma
  3. Sipariş yönetimi (personel paneli: hazır / tamamlandı akışı)
  4. Sadakat / puan sistemi ve QR kod tarama
  5. Yönetici paneli (ürün, kampanya, kupon, personel, raporlar)
  6. Masa rezervasyonu ve garson çağırma
  7. Gerçek zamanlı bildirimler
  8. Canlı destek sohbeti (müşteri ↔ personel chat)
  9. Stok / envanter takibi
  10. Abonelik planları

- **Arayüz ve tasarım tercihi:**
  - Hazır tema/şablon kullanılabilir mi, yoksa özel UI/UX tasarım şart mı? **Özel UI/UX** — tamamen özel bileşenler (CustomerPanel, StaffPanel, ManagerPanel), hazır tema kullanılmıyor.
  - Güncel bir marka kimliği (logo, renk paleti, font) mevcut mu? Proje adı **"Brew & Bloom"**; tam marka kılavuzu (logo dosyası, renk hex kodları vb.) henüz belirsiz.

- **Entegrasyon gereksinimleri (var olan/planlanan harici servisler):**
  - Ödeme altyapısı (İyzico, Stripe vb.): Şu an uygulama içi bakiye/kredi kartı simülasyonu var; gerçek ödeme entegrasyonu (İyzico/Stripe) **planlanmış ancak henüz entegre edilmemiş**.
  - E-posta servisi (Mailchimp, özel SMTP): Henüz entegre değil; siparişe sipariş/rezervasyon bildirimi için SMTP (ör: Nodemailer + SendGrid/Mailgun) gerekli.
  - CRM / ERP bağlantısı: Yok — uygulama kendi içinde CRM işlevi görüyor.
  - Kargo / lojistik API: Yok — fiziksel kafe, teslimat modeli şu an mevcut değil.
  - Yapay zeka API'leri: Yok (mevcut durumda).
  - Diğer: QR kod üretimi (`qrcode.react`), QR okuma (`html5-qrcode`) — üçüncü taraf API değil, kütüphane bazlı.

- **Ölçeklenebilirlik ihtiyacı:**
  - Anlık yoğun trafik beklenen dönemler (kampanya, bilet satışı vb.) var mı? Mutlu saat / kampanya dönemleri öngörülüyor ancak trafik pik'i küçük ölçekli kalacak.
  - Coğrafi olarak farklı bölgelere hızlı erişim (CDN) gerekli mi? Şu an hayır — tek lokasyon (şehir içi). İleride çok şubeli senaryoda CDN değerlendirilebilir.

- **Yasal uyumluluk ve güvenlik:**
  - Hangi veri koruma kanunlarına uyulmalı: **KVKK** (Türkiye) zorunlu; üye verileri, sipariş geçmişi ve ödeme bilgileri işleniyor.
  - Site üzerinden online ödeme alınacak mı? Evet, planlanıyor — gerçek ödeme entegrasyonunda **PCI-DSS** uyumlu bir ödeme aracısı (İyzico/Stripe) kullanılacak.

---

## 4. İÇERİK VE VERİ YÖNETİMİ

- **Lansman için tüm içerikler (metin, görsel, video) hazır olacak mı?**
  - Hazırsa kim tarafından girilecek? Ürün, kampanya ve kategori verileri yönetici panelinden girilebilir; başlangıç verileri `autoSeed` servisiyle otomatik yükleniyor.
  - Hazır değilse içerik üretimi için ayrı bir süreç var mı? Ürün görselleri ve tanımları geliştirici / kafe sahibi tarafından sağlanacak.

- **Mevcut siteden taşınması gereken veriler var mı?**
  - Eski blog yazıları: Yok — blog modülü mevcut değil.
  - Kullanıcı hesapları / üyelik verileri: Yok — proje sıfırdan başlıyor; canlı ortam için `autoSeed` ile temel veriler oluşturulacak.
  - Ürün / hizmet listesi: Geliştirme ortamında seed datasıyla oluşturulmuş örnek ürünler var; gerçek menü verileri kafe sahibinden alınacak.
  - Diğer: Stok, kampanya ve kupon verileri de yönetici panelinden manuel girilecek.

---

## 5. BÜTÇE VE ZAMAN PLANI

- **Bu dönüşüm projesi için ayrılmış toplam bütçe aralığı (TL/USD):** Belirtilmemiş — değerlendirme aşamasında.
- **Projenin tamamlanması için kritik bir teslim tarihi var mı (fuar, sezon açılışı vb.)?** Belirtilmemiş — canlıya alma hedefi henüz netleşmedi.
- **LTS süresince aylık/yıllık bakım ve güncelleme için sürekli bir bütçe ayrılacak mı?** Planlanıyor — sunucu / hosting bedeli + güvenlik güncellemeleri için minimum bütçe ayrılması önerilir. VPS + MongoDB + SSL için aylık ~150–400 TL tahmini maliyet öngörülüyor.

---

> **Not:** Bu form proje kod tabanı (`src/`, `server.ts`, `docker-compose.yml`, `metadata.json`, `package.json`) analiz edilerek otomatik doldurulmuştur. Bütçe, domain ve canlıya alma tarihi gibi iş kararları proje sahibi tarafından tamamlanmalıdır.
