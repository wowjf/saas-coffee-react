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
