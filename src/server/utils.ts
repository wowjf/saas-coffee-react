import type { UserRole } from "./constants";

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
