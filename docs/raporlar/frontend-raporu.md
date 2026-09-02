# Bancho Cafe — Frontend Mimari Denetim Raporu

**Tarih:** 02.09.2026 · **Kapsam:** `orch-frontend-arch` worktree (commit `a16cbd3`) · **Kod değişikliği yok — yalnızca analiz**

---

## 0. Yönetici Özeti

Proje fonksiyonel olarak zengin (QR sipariş, sadakat, masa oturumu, kampanya, CMS) ancak frontend mimarisi **tek yönlü monolit** pattern'inde: 3 dev panel bileşeni (~13.000 satır), tek dev Context (844 satır, ~70 export), **sıfır code-splitting** ve **gerçekte var olmayan bir i18n katmanı**. En kritik üç bulgu:

1. **Bundle tamamen tek parça: 1.647 KB JS (gzip 445 KB).** Bunun ~1.213 KB'ı yalnızca personel QR tarayıcısında lazım olan `html5-qrcode` (zxing dahil), ~567 KB'ı yalnızca yönetici dashboard'unda lazım olan `recharts`. Müşteri, hiç görmeyeceği kodu indiriyor. Hiç `React.lazy` / `import()` yok.
2. **5 saniyede bir tam "bootstrap" polling'i:** giriş yapmış her kullanıcı, her 5 saniyede products + campaigns + categories + orders + notifications (+ yöneticiyse tüm users, logs, balanceTopUps) setini yeniden çekiyor; Context value'su memoize edilmediği için her fetch'te **tüm ağaç yeniden render oluyor**. Panellerde tek bir `useMemo`/`React.memo` bile yok.
3. **"7 dil" iddiası fiilen yanlış:** `User.language` alanı (7 dilli enum) veritabanında duruyor ama arayüzde **hiçbir yerde okunmuyor**; dil değiştirici UI yok; `t()` fonksiyonu yalnızca Türkçe metinlerin yönetici tarafından düzenlenmesine yarıyor (metin editörü, çeviri sistemi değil).

Aşağıda bileşen bileşen somut bölünme planı, hedef klasör yapısı ve önceliklendirilmiş yol haritası var. Önerilen strateji: **"büyük yeniden yazma değil, dilim dilim çıkarma"** — her adım bağımsız ship edilebilir.

---

## 1. Mevcut Durum Metrikleri

| Dosya | Satır | useState | useMemo/memo | Doğrudan `apiRequest` | Görünümler (iç routing) |
|---|---|---|---|---|---|
| `src/components/ManagerPanel.tsx` | 6.294 | **85** | 0 | 6 | dashboard / staff / cms×7 alt görünüm / profile×13 alt görünüm |
| `src/components/CustomerPanel.tsx` | 4.599 | 36 | 0 | 5 | home / campaigns / orders / notifications / profile×11 alt görünüm / table-session |
| `src/components/StaffPanel.tsx` | 2.022 | 36 | 0 | **13** | live / tables / query / profile |
| `src/App.tsx` | 1.191 | 20 | 0 | 0 | auth / rol seçimi / mobil+masaüstü çift render |
| `src/AppContext.tsx` | 844 | ~25 state | 0 (value memo'suz) | — | — |
| `src/shared/system-texts.ts` | 1.461 (1.434 anahtar) | — | — | — | — |

Routing kütüphanesi **yok**; sekme yönetimi `useState<string>` + `AnimatePresence key={activeTab + role}` ile, masa URL'i (`/masa-12/session/xxx`) elle `popstate` parse edilerek çözülmüş (`AppContext.tsx:154-177`).

Sunucu tarafı da benzer eğilimde ama kapsam dışı: `src/server/routes/api.ts` 3.347 satır / 75 route, `new-features.ts` 1.406 satır / 53 route.

---

## 2. Monolith Bileşenler — Somut Bölünme Planı

### 2.1 `ManagerPanel.tsx` (6.294 satır) → `features/manager/`

Dosyanın iç yapısı zaten bölünmeye hazır — `if (activeTab === ...)` blokları fiilen bağımsız sayfalar. Ölçülen blok boyutları:

| Blok | Satır aralığı (yaklaşık) | Boyut |
|---|---|---|
| `if (activeTab === 'cms')` | 2400–5540 | **~3.141 satır** (dosyanın yarısı) |
| `if (activeTab === 'profile')` | 5540–6294 | ~755 |
| `if (activeTab === 'dashboard')` | 1506–2179 | ~674 |
| `if (activeTab === 'staff')` | 2179–2400 | ~222 |
| Modül üstü yardımcılar + `TableQrManagement` | 99–459 | ~360 |

CMS alt görünüm sayacı: `products / campaigns / ingredients / languages / changes / users / tables / dashboard` (ayrıca `{false && ...}` ile ölü bloklar — 3118 ve 3719 satırlarında devre dışı bırakılmış iki görünüm daha var, bunlar ya silinmeli ya koşul sabitinden arındırılmalı).

**Hedef yapı:**

```
src/features/manager/
  ManagerPanel.tsx            # ~80 satır: sekme → sayfa eşlemesi (Router'a taşınsa elenir)
  pages/
    DashboardPage.tsx         # getChartData/getPeriodBounds/getPeriodLabel ile birlikte (~674)
    StaffPage.tsx             # ~222
    CmsPage.tsx              # ~100: cmsView yönlendiricisi
    ProfilePage.tsx           # ~755 → 2.5'teki ortak ProfileModule'e delege
  cms/
    ProductsView.tsx          # ürün listesi + kart + filtre (~700, productManagementView dahil)
    ProductFormModal.tsx      # editingProduct/editProductData state'i buraya iner
    CampaignsView.tsx         # + createEmptyCampaign (~320)
    IngredientsView.tsx       # + AVAILABLE_INGREDIENTS (~90)
    SystemTextsView.tsx       # 'languages' görünümü + LANG_GROUP_LABELS (~95)
    ChangesView.tsx           # log filtreleri (~105)
    UsersView.tsx             # kullanıcı yönetimi (~160)
    TablesQrView.tsx          # TableQrManagement (~210) + downloadQR → lib/qr.ts
  hooks/
    useDashboardStats.ts      # dashboardStats/statsLoading fetch
    useManagerAction.ts       # resolveErrorMessage + runManagerAction (26 kullanım noktası)
  constants.ts                # USER_ROLE_OPTIONS, ICON_MAP, getRoleLabel/getGenderLabel
```

**State yerleşimi:** 85 `useState`'in büyük bölümü **tek görünümün private state'i** ve o görünümle birlikte dosyaya gömülmeli (örn. `editingProduct` → `ProductFormModal`, `dateRange/customStartDate` → `DashboardPage`, `langSearchQuery/langGroupFilter/langOverrides` → `SystemTextsView`). Context'ten kalması gerekenler yalnızca sunucu verisi (products, campaigns, users...) — bunlar da 4. bölümdeki store'a gider. `profileView` union tipi (13 üye) `features/profile` modülüne taşınmalı — aynı tip CustomerPanel'de de kopyalanmış durumda.

### 2.2 `CustomerPanel.tsx` (4.599 satır) → `features/customer/`

Zaten iki sağlıklı alt bileşen var: `OrderNotificationCard` (91) ve `DynamicIslandHeader` (167-336) — bunlar dosyadan çıkarma için hazır. Ana gövde `let content = null; if (activeTab === ...)` zinciri.

```
src/features/customer/
  CustomerPanel.tsx           # sekme yönlendiricisi (~60)
  layout/DynamicIslandHeader.tsx
  components/OrderNotificationCard.tsx
  pages/
    MenuPage.tsx             # home: kategori listesi + ürün grid + sepet özeti (~1.200)
    ProductCard.tsx          # ürün kartı + favori + puan yıldızları
    CartModal.tsx            # showCartModal/orderNote state'i ile (~250)
    CampaignsPage.tsx        # fırsatlar + sadakat (~500)
    OrdersPage.tsx           # ordersView hub/list + sipariş detayı (~600)
    NotificationsPage.tsx    # + selectedNotificationId (~300)
    TableSessionPanel.tsx    # 'table-session' sekmesi (görünümün kendisi TableSessionView'de)
  wallet/
    TopUpModal.tsx           # showTopUpModal/topUpAmount
    LoyaltyQrModal.tsx       # showQR/loyaltyQr/isQrLoading/qrError + loadLoyaltyQr hook
  profile/ → features/profile (ortak modül, bkz. 2.5)
  constants.ts               # SUPPORT_PHONE_HREF, INGREDIENT_ICONS, ICON_MAP (Manager'la birleştir → src/components/icons/categoryIcons.ts)
  hooks/useLoyaltyQr.ts      # 120 sn polling içeren efekt
```

**State yerleşimi:** sepet (`cart`) global kalmalı (masa modu + sipariş akışı erişiyor) ama `orderNote`, `menuView`, `searchQuery`, `showInStockOnly`, `category` tamamen MenuPage'e aittir. `selectedProduct` ProductCard ile birlikte `useState`'e değil URL'e (query/param) taşınmalı — sayfa yenilenince seçim kayboluyor.

### 2.3 `StaffPanel.tsx` (2.022 satır) → `features/staff/`

En küçük panel ama en dağınık state: masa takibi, walk-in misafir, garson kataloğu, canlı siparişler, sadakat tarayıcı ve profil tek bileşende; 13 doğrudan `apiRequest` çağrısı Context'i bypass ediyor.

```
src/features/staff/
  StaffPanel.tsx             # yönlendirici (~50)
  pages/
    LiveOrdersPage.tsx       # orderFilter/orderSearch/rejectModal (~460)
    TablesPage.tsx           # tables/fetchTables(8 sn polling)/tableFilter/tableSearch (~600)
    TableDetailSheet.tsx     # selectedTable + misafir ekleme + host arama
    QueryPage.tsx            # barkod/sipariş sorgu (~125)
    ProfilePage.tsx          # → ortak ProfileModule
  waiter/
    WaiterCatalog.tsx        # showWaiterCatalog/waiterCart/waiterSearchQuery
  loyalty/
    ScannerPanel.tsx         # showScanner/scanResult/topupAmount + LoyaltyQrScanner entegrasyonu
  hooks/
    useTables.ts             # fetchTables + 8 sn polling + self-heal
    useUserSearch.ts         # hostSearch* VE guestSearch* — aynı logic'in iki kopyası tek hook'a
```

`renderPortal` yardımcısı StaffPanel'e özel; genel `Modal` bileşenine (5. bölüm) taşınınca ortadan kalkar.

### 2.4 `App.tsx` (1.191 satır) → `app/` + `features/auth/`

İçerik: auth ekranları (register 7 alan + login), rol seçim diyaloğu, toast, sekme tanımları ve **aynı panel-render bloğunun mobil/masaüstü için iki kopyası** (1041-1064 ve 1070-1095 — satır satır aynı `role === ... && <XPanel/>` zinciri).

```
src/app/
  App.tsx                    # ~150: provider'lar + layout + role→panel eşlemesi
  AppShell.tsx               # tek render bloğu (mobil/masaüstü farkı CSS'te)
  providers/AppProviders.tsx # ErrorBoundary + Store + SystemTexts + Toast
  navigation/useTabs.ts      # customerTabs/staffTabs/managerTabs + activeTab (URL'e taşınır)
src/features/auth/
  AuthPage.tsx               # giriş/kayıt sekmeli ekran (~400)
  RegisterForm.tsx           # 7 alan + validasyon (phone/birthDate state'leri burada)
  LoginForm.tsx
  RoleChoiceModal.tsx        # pendingSessionChoice/sessionChoiceLoading
```

`App.tsx:75-130`'daki bildirim-toast'ı `components/notifications/NotificationToast.tsx`'e çıkarmak App'i ~60 satır hafifletir. Register alanları (7 `useState`) `RegisterForm` içinde tek `useReducer`/`react-hook-form` state'ine iner.

### 2.5 Ortak Profil Modülü (3 panelde üçüncü kopya)

`profileView`, `profileDraft`, `passwordDraft`, `addressDraft`, `paymentDraft`, `saveProfileInfo`, `changePassword`, `toggleFavorite`, `handleImageUpload` desenleri Customer (57 referans), Manager (40) ve Staff (2+ kopya profil formu) panellerinde **ayrı ayrı uygulanmış**. Manager'daki `profileView` union'ı 13 üyeli, Customer'daki 11 üyeli — neredeyse aynı.

```
src/features/profile/
  ProfilePage.tsx            # görünüm yönlendiricisi; kullanıcının rolü fark etmez
  views/MainView.tsx          # menü kartları (adres, ödeme, favori, ayar...)
  views/AddressesView.tsx     # addressDraft state'i ile
  views/PaymentsView.tsx
  views/FavoritesView.tsx
  views/SettingsView.tsx      # profil bilgisi + şifre değiştir (StaffPanel:1770'deki blok buraya)
  views/HistoryView.tsx       # orders-history / topups-history (rol bazlı)
```

Bu tek adım, üç panelin **~1.900 satırını** ortadan kaldırır ve en yüksek kârlı duplikasyon giderimi.

---

## 3. i18n — Gerçek Durum: "7 dil" İddiası Doğru Değil

**Bulgu: çok dillilik UI katmanında mevcut değil; elde olan şey "yönetici metin düzenleyici".**

Kanıt zinciri:

- `src/types.ts:129` — `User.language` alanı 7 dilli enum tanımlıyor (`tr|en|de|fr|es|it|ru`); `src/server/models/User.ts:25` aynı enum default `"tr"`.
- **Ancak** `user.language` / `settings.language` arayüz kodunda **hiç okunmuyor** (grep: 0 sonuç). Sunucu saklıyor, istemci kullanmıyor.
- `src/lib/i18n.ts` (38 satır) bir i18n motoru değil: sadece dil listesi + **hardcode kur** tablosu (`USD: 0.037` gibi — güncelliği garanti değil, çarpanlar koda gömülü) + `formatPrice`. Dil listesindeki etiketler bile karışık: `t("turkce")` ve `t("francais")` sistem metninden gelirken `English/Deutsch/Español/...` literal.
- `t(key)` (`system-texts.ts:1459`) = `overrides[key] ?? SYSTEM_TEXTS[key] ?? key` → tek dil (TR), override mekanizması yalnızca TR metnin **düzenlenmesine** izin veriyor. `SystemText` MongoDB modeli de `key→value` (tek değer, dil sütunu yok).
- ManagerPanel CMS'teki "Dil Yönetimi" görünümü (3796+) başlığını rağmen **çeviri yönetimi değil metin editörü**: "X / 1434 metin düzenlendi" sayacı, grup filtreleri (musteri/yonetici/sistem/...) — hepsi Türkçe metinler.
- `index.html` `<html lang="tr">` sabit; runtime'da güncellenmiyor.
- Hardcode TR string'ler `t()` dışında da var: Customer ~26, Manager ~20, Staff ~6 özellik (`label:`, `title:`, `placeholder:` pattern'leri). `t()` kullanan çağrılar: Manager 201, Customer 121, Staff 85, App 37 — yani katalog **kısmen** kapsanmış.

**Eksik çevirilerin konumu:** "Çeviri dosyası" diye bir şey yok — 1.434 anahtarlık tek TR sözlük (`src/shared/system-texts.ts`, `extract-texts.py` tarafından üretilmiş). Çeviri eklenecekse sıfırdan dil bazlı katman gerekli; "eksik çeviri listesi" sorusunun cevabı **"hepsi"** (en dışında TR dahil hiçbir dil için veri yok).

**Öneri:** Ya (a) iddiayı bırakıp ürünü TR-only ilan edin — dil enumunu ve `SUPPORTED_LANGUAGES`'i temizleyin; ya da (b) gerçek i18n: `i18next` + `react-i18next`, namespace'ler feature bazlı (`customer.json`, `manager.json`...), dil tercihi `user.language`'dan okunur, `SystemText` şemasına `lang` alanı eklenir, `t()` sarmalanır (katalog anahtarları slug tabanlı olduğundan taşıma script'i yazılabilir). Kur dönüşümü için `Intl.NumberFormat` + sunucu tarafı kur servisi (günlük kur çeken cron) şart — mevcut hardcode çarpanlar yanlış fiyat gösterme riski.

---

## 4. `AppContext.tsx` (844 satır) — Splitting ve Re-Render Analizi

### 4.1 Yapısal sorunlar

1. **Tek Context, ~70 export:** auth (user/role/token), 10+ koleksiyon (products, orders, campaigns, ingredients, categories, staff, users, notifications, balanceTopUps, recentChanges), sepet, masa oturumu (6 state) ve **40+ mutasyon fonksiyonu** aynı value'da. `useApp()` çağıran **her** bileşen bu value'daki **her** değişiklikten haberdar.
2. **`value` objesi memoize edilmemiş** (`AppContext.tsx:756-829`): provider her render'ında yeni obje → `Object.is` karşılaştırması hep başarısız → tüm consumer'lar her seferinde yeniden render. `useMemo` AppContext'te 0 kez kullanılmış.
3. **5 saniyelik tam-bootstrap polling'i** (`AppContext.tsx:230-240`): giriş yapmış her kullanıcı tüm evreni çekiyor. Yönetici oturumunda payload'a **tüm kullanıcı listesi + 100 log + tüm bakiye hareketleri** dahil (`api.ts` `buildBootstrapPayload`). Her 5 sn'de: (a) ağ trafiği, (b) 10+ `setState` → provider render → value yeni → **ağacın tamamı yeniden render**. Müşteri ekranında yazı yazarken 5 sn'de bir input olmasa da ağır listeler yeniden çiziliyor.
4. **Her mutasyon tam refetch:** 40+ fonksiyon aynı kalıbı tekrarlıyor — `apiRequest(...)` + `syncAfterMutation()` (tam bootstrap). Bir ürün adı değişince tüm evren tekrar indiriliyor. Bu kalıp elle kopyalanmış durumda (satır 443-640 arası ~200 satır boyunca aynı 8 satırlık blok).
5. **`notifications` her render'da yeniden sıralanıyor** (`AppContext.tsx:179-181`) — `useMemo` yok.
6. **`any` tipleri:** `tableSession: any; tableMetrics: any; tableOrders: any[]` (satır 98-100) — tip güvenliği masa modunda sıfır.
7. **Ölü kod:** `addNotification` no-op stub (329-345, parametreleri `void`'leyip boş promise dönüyor). `loginWithGoogle` her zaman throw ediyor (263-265).
8. **URL parse'ı Context içinde** (154-177): routing sorumluluğu state katmanına gömülmüş; `history.replaceState` + sahte `PopStateEvent` dispatch'leri (660, 711, 738) kırılgan.

### 4.2 Önerilen splitting

Context'i **alan bazlı** parçala (aynı dosya boyunca):

| Parça | İçerik | Tüketici |
|---|---|---|
| `SessionContext` | user, role, isAuthReady, login/logout/register, setSessionRole | her yer (küçük, seyrek değişir) |
| `CatalogContext` | products, categories, campaigns, ingredients | müşteri menü + yönetici CMS |
| `OrdersContext` | orders, create/update/delete | canlı sipariş + siparişlerim |
| `NotificationsContext` | notifications + işlemleri | bildirim sekmesi + toast |
| `AdminDataContext` | staff, users, recentChanges, balanceTopUps | **yalnızca manager** |
| `CartStore` (zustand) | cart + sepete özel eylemler | menü + sepet modal |
| `TableSessionStore` | masa modunun 6 state'i + eylemleri | TableSessionView |

Aynı anda hepsi gerekmez — **minimum yüksek etkili adım**: (1) `value`'yu `useMemo`'ya al, (2) `AdminData`'yı manager dışındakilere provider düzeyinde hiç vermemek, (3) sepeti ayrı store'a çıkarmak.

### 4.3 Zustand/Jotai vs mevcut Context — tavsiye

**Öneri: Zustand (ara süreç) + TanStack Query (veri katmanı).** Gerekçe:

- Sorunun kökü state kütüphanesi eksikliği değil, **sunucu-verisi ile istemci-state'in aynı yerde olması**. React Context'in zayıf noktası tam da bu: value'daki tek alan değişince tüm subscriber'lar tetiklenir; selector yoktur. Zustand **selector bazlı abonelik** verir (`useStore(s => s.cart)`) — 4.1'deki 1. ve 2. maddeleri yapısal olarak çözer, yeni bağımlılık maliyeti ~1-2 KB.
- Jotai de çözer ama atom tasarımı, mevcut koleksiyon bazlı modele Zustand store'larından daha fazla yeniden modelleme gerektirir.
- **Sunucu verisi için asıl hedef TanStack Query**: 5 sn'lik tam-bootstrap polling'i yerine `staleTime` bazlı sorgu invalidation'ı, mutasyon sonrası hedefli refetch, optimistic update ve cache geçer `isLoading` state'leri gelir; 40+ el yazımı mutasyon fonksiyonu `useMutation`'a iner. Ağ trafiği ve re-render yükü birlikte düşer.
- Geçiş kademeli yapılabilir: önce `useApp()`'yi içte Zustand/TanStack'e delege eden bir facade bırak, paneller sökülürken tek tek geçir. "Big bang" gerekmez.

Ek hızlı kazanımlar: `notifications` sıralaması `useMemo`; polling interval'ları role göre ayarla (customer 15-30 sn yeter, canlı operasyon sekmeleri staff/manager'da zaten kendi 8 sn polling'ini yapıyor — **çift polling** var); masa oturumu tiplerini `types.ts`'teki gerçek arayüzlere bağla.

---

## 5. Performans — Bundle ve Yükleme Analizi

### 5.1 Mevcut bundle (üretim build'i alındı)

```
dist/assets/index-CfgV4BIZ.js   1.647 KB   (gzip 445 KB)
dist/assets/index-BSswk6gO.css    307 KB   (gzip  43 KB)
```

Vite uyarısı: "Some chunks are larger than 500 kB". **Tek chunk — code splitting yok** (kaynakta `lazy`/`import()`/`Suspense` grep: 0).

Rollup istatistiklerinden modül bazlı dağılım (rendered boyut):

| Kaynak | Boyut | Not |
|---|---|---|
| `html5-qrcode` (zxing dahil) | **~1.213 KB** | Yalnızca `LoyaltyQrScanner` (personel sadakat tarama) kullanıyor |
| `src/` (proje kodu) | ~984 KB | ManagerPanel 342 + CustomerPanel 260 + StaffPanel 113 + system-texts 74 + App 56 + TableSessionView 54 |
| `recharts` (+d3, decimal.js, redux-toolkit) | ~567 KB | Yalnızca ManagerPanel dashboard |
| `react-dom` | ~548 KB | kaçınılmaz |
| `motion-dom` + `framer-motion` | ~378 KB | her yerde |
| `tailwind-merge` | ~97 KB | `cn()` yardımcısından |
| `lucide-react` | ~55 KB | named import sayesinde tree-shake çalışıyor ✅ |
| `qrcode.react` | ~44 KB | QR üretimi (müşteri + yönetici) |

**Yorum:** müşterinin ilk yükünde indirilen JS'in ~%75'i müşterinin gördüğü hiçbir ekranda kullanılmıyor (yönetici panelleri + recharts + personel tarayıcı). `date-fns` bundle'a girmemiş (tree-shake ✅).

### 5.2 Lazy loading planı (etki sırasıyla)

1. **`LoyaltyQrScanner`'ı `React.lazy` + `import('html5-qrcode')` ile dinamik yükle** → ~1.2 MB kazanç, tek başına bundle'ı ~%70 küçültür. Tarayıcı ancak "Sadakat Tara" butonuna basınca indirilir.
2. **`ManagerPanel` route/lazy** → recharts + 342 KB kaynak kodu müşteriden kalkar. `DashboardPage` içindeki grafikler ayrıca lazy alınabilir.
3. **`StaffPanel` lazy** — personel rolü altına.
4. `manualChunks` ile vendor ayrımı (`react-vendor`, `motion`, `charts`) → önbellek isabetli sürümler.
5. **`AnimatePresence key={activeTab + role}`** her sekme değişiminde panel bileşenini **unmount/remount** ediyor (App.tsx:1046, 1078) — form state'i ve scroll kaybolur, ani render maliyeti yüksek. Sekme içi geçişleri `mode="wait"` yerine layout koruyucu hale getir.
6. **Tailwind arbitrary value şişkinliği:** `rounded-[24px]/[28px]/[32px]`, `shadow-[0_8px_30px...]` pattern'leri panellerde 70+ kez tekrarlı (Customer 34, Manager 30, Staff 7). Bunlar tasarım token'larına (`rounded-card` vb. `@theme` tanımı) inince hem CSS küçülür hem tutarlılık gelir.
7. Liste sanallaştırma: ürün/sipariş/user listeleri düz `.map` (Manager 39, Customer 15, Staff 18 map bloğu) — yüzlerce satırda `react-window`/`@tanstack/virtual` düşün.

**Hedef:** ilk yük (müşteri, gzip) ~445 KB'den ~140-180 KB'a inebilir (react-dom + motion + müşteri kodu + token'lanmış CSS).

---

## 6. Kod Tekrarı — Ortak UI Çıkarma Planı

### 6.1 Ölçülen tekrarlar

| Desen | Kanıt | Önerilen bileşen |
|---|---|---|
| **Profil/ayarlar modülü** | 3 panelde ayrı uygulama (2.5) | `features/profile/*` (~1.900 satır tasarruf) |
| **Modal iskeleti** | `fixed inset-0` blok: Manager 16, Customer 5; StaffPanel `renderPortal` + `modal-root` özel çözümü | `components/ui/Modal.tsx` (portal + kapatma + odak yönetimi) |
| **Form alanları** | 122 `<input>` + 22 `<select>` + 10 `<textarea>`, tutarlı yükseklik/kenarlık kalıpları | `Field.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx` |
| **Hata/feedback kalıbı** | Manager'da `resolveErrorMessage`+`runManagerAction` (26 kullanım); Customer/Staff'ta aynı amaç için elle try/catch | `useAsyncAction` hook'u (loading+error+toast) |
| **Native `alert`/`confirm`** | **28 çağrı** (Manager 14, Staff 13, Customer 1) — engelleyici, mobilde çirkin, test edilemez | `ConfirmDialog.tsx` + `useConfirm` |
| **Stat kartı** | `bg-white border rounded shadow` kutuları 25+ | `StatCard.tsx` (başlık+değer+trend ikonu) |
| **Filtre çubuğu** | search+chip-filter ikilisi ürün/kampanya/kategori/malzeme/log/masa listelerinin hepsinde | `ListToolbar.tsx` (arama + aktif filtre sayısı + chip'ler) |
| **Boş durum / yükleme** | her listede elle tekrar | `EmptyState.tsx`, `Skeleton.tsx` (mevcut `LoadingScreen` tam sayfa; liste için değil) |
| **Toast** | `common/Toast.tsx` (ToastProvider + useToast) **hiç mount edilmiyor** — ölü kod; App.tsx kendi bildirim-toast'ını yazmış | tek `Toaster` — bildirim-toast'ı ile birleştir |
| **ICON_MAP** | Manager ve Customer'da ayrı `Record<string, LucideIcon>` kopyaları | `components/icons/categoryIcons.ts` tek kaynak |
| **QR indirme** | `TableQrManagement.downloadQR` içinde canvas işlemleri (~115 satır) | `lib/qr.ts` |

### 6.2 Önerilen ortak UI katmanı

```
src/components/ui/
  Modal.tsx  ConfirmDialog.tsx  Input.tsx  Select.tsx  Textarea.tsx  Field.tsx
  StatCard.tsx  ListToolbar.tsx  EmptyState.tsx  Skeleton.tsx  Badge.tsx  Button.tsx
src/hooks/
  useAsyncAction.ts  useDebounce.ts  useMediaQuery.ts (App'teki isMobile resize listener buraya)
```

Bu katman, üç panel sökülürken ihtiyaç anında beslenmeli ("önce çıkart, sonra kullan" sırası paneller için de geçerli — UI kit'i baştan tam yazmayın).

---

## 7. Erişilebilirlik (a11y) — Temel Kontrol

**Not: bu bölüm kod taramasıdır; ekran okuyucu/klavye testi yapılmadı.**

| Kontrol | Durum |
|---|---|
| `aria-*` / `role` kullanımı | **Neredeyse sıfır:** Customer 2, Manager 0, Staff 0, App 0 (298 buton içinde) |
| `<html lang>` | `lang="tr"` sabit ✅ (ama dil değişimi yok, 3. bölüm) |
| Semantik HTML | `<main>` var (App); `<nav>` BottomNav'da yok; Staff panelde semantik etiket 0 |
| Icon-only butonlar | `title` bazen var, `aria-label` pratikte yok (örn. DynamicIslandHeader'daki Trophy/QrCode butonları `title` ile yetiniyor) |
| Görsel `alt` | 29 `<img>`'ın bir kısmında var (Manager 11, Customer 8) — tutarsız |
| Modal davranışı | Focus trap yok, `Escape` ile kapatma **yok** (grep: 0 `onKeyDown`/Escape), açılışta odak taşınmıyor, arka plan scroll kilidi elle |
| Form etiketleri | `<label>`'lar mevcut (Manager 59, Customer 49) ama `htmlFor` bağlantıları sistematik değil |
| Dokunma hedefi | `w-8 h-8` (32px) ikon butonlar yaygın — WCAG 2.5.5 (44px) altı |
| `prefers-reduced-motion` | Yok; her sekme geçişi animasyonlu (motion) |
| Canlı bölgeler | Toast/bildirimler `aria-live` olmadan render ediliyor |

**Öncelikli düzeltmeler:** (1) Modal'a focus trap + Escape + `role="dialog"`/`aria-modal`; (2) icon-only butonlara `aria-label`; (3) toast'a `aria-live="polite"`; (4) form label'larını `htmlFor`/`id` ile bağla; (5) global `prefers-reduced-motion` medya sorgusu.

---

## 8. Önceliklendirilmiş Refactor Yol Haritası

> K = Kolay (≤1 gün) · O = Orta (1-3 gün) · B = Büyük (hafta ölçeği, dilimlenebilir)

| # | Öncelik | İş | Efor | Kazanç / Risk |
|---|---|---|---|---|
| 1 | **P0** | `LoyaltyQrScanner`'ı lazy + dinamik `import('html5-qrcode')` | K | Bundle −~1.2 MB (—%70). Risk: yok |
| 2 | **P0** | AppContext `value`'su `useMemo`; `notifications` sıralaması `useMemo`; rol bazlı polling aralığı (customer ≥15 sn) | K | Re-render fırtınasını keser. Risk: yok |
| 3 | **P0** | `ManagerPanel`/`StaffPanel` `React.lazy` + route-level split + `manualChunks` | K-O | Müşteri ilk yükü ~%60 küçülür |
| 4 | **P1** | Ölü kod temizliği: `Toast.tsx` (mount edilmemiş) → gerçek Toaster'a evril; `addNotification` stub'ı; `{false && ...}` blokları; `loginWithGoogle` stub'ı | K | Anlaşılırlık |
| 5 | **P1** | `Modal` + `ConfirmDialog` + `useAsyncAction` — 28 `alert/confirm` ve 21 modal bloğu tek düzene | O | UX + test edilebilirlik + ~k yüzlerce satır |
| 6 | **P1** | **Ortak `features/profile`** — 3 kopyayı tek modüle indir (2.5) | O-B | ~1.900 satır tasarruf; en yüksek duplikasyon kârı |
| 7 | **P1** | StaffPanel'de 13 Context-bypass `apiRequest` → tek veri katmanı (4.3) | O | Tutarlı hata/loading |
| 8 | **P2** | ManagerPanel CMS sökümü (2.1) — görünüm görünüm ayrı PR'lerle (Products → Campaigns → ...) | B | En büyük dosya yarıya iner; her adım ship edilebilir |
| 9 | **P2** | TanStack Query geçişi: bootstrap polling → sorgu cache + invalidation; 40 mutasyon → `useMutation` | B | Ağ trafiği ve state mimarisi kökten düzelir |
| 10 | **P2** | CustomerPanel sökümü (2.2) + App.tsx auth çıkarma (2.4) + çift render bloğunu birleştirme | B | Sürdürülebilirlik |
| 11 | **P2** | i18n kararı (3. bölüm): TR-only ilan **veya** i18next + dil bazlı katalog; kur için `Intl`+servis | O-B | Ürün pozisyonuna bağlı |
| 12 | **P3** | Zustand store'ları (cart, masa oturumu) + Context'lerin alan bazlı ayrımı (4.2) | O-B | 9'dan sonra doğal gelir |
| 13 | **P3** | a11y paketi (7. bölüm) + tasarım token'ları (`rounded-[28px]` → sınıflar) + liste sanallaştırma | O | Kalite teknik borcu |
| 14 | **P3** | Test altyapısı: bugün 2 test dosyası var; çıkarılan modüller birim, kritik akışlar (sipariş, ödeme) E2E | B | Refactor güvenliği |

**Önerilen sıra:** 1→2→3 bir "hızlı kazanç" PR'ı (1-2 gün, ölçülebilir LCP iyileşmesi); 4-5 ikinci sprint; 6 üçüncü; 8-10 paralel dilimler halinde; 9 bunlarla iç içe ilerleyebilir.

---

## 9. Hedef Klasör Yapısı (Bitmiş Hal)

```
src/
  app/                          # uygulama iskeleti
    App.tsx  AppShell.tsx  providers/AppProviders.tsx
    navigation/useTabs.ts
  features/
    auth/        AuthPage  RegisterForm  LoginForm  RoleChoiceModal
    customer/    CustomerPanel.tsx  layout/  components/  pages/(MenuPage, CampaignsPage,
                 OrdersPage, NotificationsPage, ...)  wallet/  constants.ts  hooks/
    staff/       StaffPanel.tsx  pages/(LiveOrdersPage, TablesPage, QueryPage, ...)
                 waiter/  loyalty/  hooks/(useTables, useUserSearch)
    manager/     ManagerPanel.tsx  pages/(DashboardPage, StaffPage, CmsPage, ProfilePage)
                 cms/(ProductsView, CampaignsView, IngredientsView, SystemTextsView,
                      ChangesView, UsersView, TablesQrView)  hooks/  constants.ts
    profile/     ProfilePage.tsx  views/(Main, Addresses, Payments, Favorites, Settings, History)
    table/       TableSessionView + masa oturumu mantığı (components/table'tan göçer)
  components/
    ui/          Modal  ConfirmDialog  Button  Input  Select  Textarea  Field  StatCard
                 ListToolbar  EmptyState  Skeleton  Badge
    icons/       categoryIcons.ts
    notifications/  NotificationToast.tsx
  stores/        cartStore.ts  tableSessionStore.ts        (zustand)
  api/           client.ts  queries/(products, orders, ...)  mutations/...   (tanstack query)
  lib/           utils  api (fetch çekirdeği)  qr  loyalty  pushClient  format(currency)
  shared/        system-texts.ts  types
```

Yerleşim kuralı: **feature klasörü kendi sayfa/alt bileşen/hook/constant'ını içerir; `components/ui` yalnızca feature-agnostik parçalar; sunucu verisi `api/` + `stores/` altında merkezileşir.** Mevcut `src/components/*Modal.tsx` gibi tek dosyalar sahipli feature'larına göçer (örn. `ReviewModal` → `features/customer/`).

---

## 10. Ek Gözlemler (kapsam dışı ama not düşüldü)

- `vite.config.ts`'te code-splitting/`manualChunks` yapılandırması yok; `build` script'i sade — rol bazlı giriş noktaları (multi-entry) da bir seçenek.
- `vitest` mevcut ama yalnızca 2 test dosyası (`campaignSchedule.test.ts`, `src/server/utils.test.ts`); refactor güvencesi zayıf — yol haritası 14.
- Sunucu tarafı benzer monolit eğiliminde (`api.ts` 3.347 satır / 75 route + `new-features.ts` 1.406 / 53) — ayrı bir backend denetimi önerilir.
- `formatPrice`'taki hardcode kur çarpanları fiyatlama hatası üretebilir; en kısa vadede düzeltilmesi gereken mantık (i18n kararı beklemeden).
- Mobil/masaüstü için App.tsx'teki ikizi render blokları (`1041-1064` ≡ `1070-1095`) tek `AppShell`'de birleşmeli.
