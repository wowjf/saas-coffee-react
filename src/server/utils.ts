import type { UserRole } from "./constants";

// İstasyon eşlemesi (GEÇİCİ sabit — Category şemasına station alanı
// eklenene kadar kategori ADLARI üzerinden çözümlenir). Adlar
// services/autoSeed.ts'teki gerçek kategori adlarıdır.
export type Station = "bar" | "mutfak";

const BAR_CATEGORIES = new Set([
  "Kahveler",
  "Bitki Çayları & Çay",
  "Soğuk İçecekler",
  "İçecekler",
  "Sıcak İçecekler",
]);

const MUTFAK_CATEGORIES = new Set([
  "Fırından Taze",
  "Tazeler & Smoothie",
  "Tuzlular & Tostlar",
  "Tatlılar",
  "Ana Yemekler",
]);

// Kategori adı → istasyon. Eşleşmeyen ad "yok" döner; istasyon filtresi
// uygulayan uçlar "yok" içeren siparişleri dışarıda bırakır (yanlış
// istasyona düşürmekten iyidir).
export function stationForCategoryName(categoryName: string): Station | "yok" {
  const name = String(categoryName || "").trim();

  if (BAR_CATEGORIES.has(name)) {
    return "bar";
  }

  if (MUTFAK_CATEGORIES.has(name)) {
    return "mutfak";
  }

  return "yok";
}

// Çoklu kategori çözümlemesi: her kategori adı için istasyon haritası.
// Koleksiyon boş/erişilemezse boş harita döner (tüm siparişler "yok"a düşer).
export async function resolveStationForCategories(
  categoryNames: string[],
): Promise<Record<string, Station | "yok">> {
  const result: Record<string, Station | "yok"> = {};

  for (const name of categoryNames) {
    const key = String(name || "").trim();
    if (!key || key in result) {
      continue;
    }
    result[key] = stationForCategoryName(key);
  }

  return result;
}

// Yardımcı: bir siparişin kalem kategorileri için istasyon haritası
// (siparişin tüm kalemleri "yok" ise sipariş istasyon filtresine takılır).
export async function resolveStationMapForOrders(
  orders: Array<{ items?: Array<{ product?: { category?: string } }> }>,
): Promise<Record<string, Station | "yok">> {
  const names = new Set<string>();

  for (const order of orders) {
    for (const item of order.items || []) {
      const category = item?.product?.category;
      if (typeof category === "string" && category.trim()) {
        names.add(category.trim());
      }
    }
  }

  return resolveStationForCategories([...names]);
}

export function toIsoString(value: Date | string | undefined | null) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString();
}

export function serializeDocument<T extends Record<string, unknown>>(doc: {
  _id: { toString(): string } | string;
  toObject?: () => T;
}) {
  const raw = doc.toObject ? doc.toObject() : (doc as unknown as T & { _id: string });
  const { _id, __v, ...rest } = raw as T & { _id?: string; __v?: number };

  return {
    ...rest,
    id: typeof doc._id === "string" ? doc._id : doc._id.toString(),
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function pickRoleLabel(role: UserRole) {
  if (role === "manager") {
    return "Yonetici";
  }

  if (role === "staff") {
    return "Personel";
  }

  return "Musteri";
}

// S-O10 (MP-0.10): kullanıcıca yazılan düz metin alanları için hafif
// sanitize — React stringleri escape ettiği için XSS bugün ulaşılamaz,
// ancak <script>/<iframe>/on* attribute gibi aktif içerik kalıcı olarak
// DB'ye yazılmasın (savunma derinliği; ileride bir dangerouslySetInnerHTML
// tek başına yeterli olurdu).
export function sanitizePlainText(value: string): string {
  return value
    .replace(/<\s*(script|iframe|object|embed|svg|math|link|meta|style)\b/gi, "&lt;")
    .replace(/\son\w+\s*=/gi, " on_neutralized=")
    .replace(/javascript\s*:/gi, "javascript_")
    .slice(0, 10_000);
}
