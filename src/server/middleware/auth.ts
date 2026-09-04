import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/User";
import StaffModel from "../models/Staff";
import { normalizeEmail } from "../utils";
import type { UserRole } from "../../types";
import { getSystemText } from "../services/systemTexts";

export interface AuthRequest extends Request {
  authUser?: any;
  authRole?: UserRole;
  authStaffRole?: string;
}

// Personel rolü (ünvan): garson/bar/mutfak/mudur. Boş string "unvan
// tanımlanmamış" demektir — eski kayıtlar ve eski token'lar için tüm
// personel görünümlerine erişilebilen eski davranış korunur.
export type StaffRole = "garson" | "bar" | "mutfak" | "mudur" | "";

const VALID_STAFF_ROLES: readonly string[] = ["garson", "bar", "mutfak", "mudur", ""];

export function isValidStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && VALID_STAFF_ROLES.includes(value);
}

// Vardiya sistemiyle birlikte personel hesapları müşteri moduna inemez:
// staff yalnız sessionRole="staff" iken staff etkisi görür (aksi halde
// sessionRole ne olursa olsun personel etkisi KORUNUR — müşteri değil);
// manager yalnız manager|staff oturumuna inebilir, customer hedefi reddedilir
// (session-role ucu 403 döner). getEffectiveRole güvenilir değilse çağıranlar
// bu fonksiyonu değil /api/auth/session-role yanıtını baz alır.
export function getEffectiveRole(user: any): UserRole {
  const accountRole = (user?.role || "customer") as UserRole;

  if (accountRole === "customer") {
    return "customer";
  }

  if (accountRole === "manager") {
    if (user?.sessionRole === "manager" || user?.sessionRole === "staff") {
      return user.sessionRole;
    }
    // "customer" hedefi artık personel/müdür hesapları için geçerli değil;
    // geçersiz sessionRole'da güvenli öntanımlı etki staff'dır (müşteri değil).
    return "staff";
  }

  if (accountRole === "staff") {
    // Personel hesabı müşteri olarak devam edemez: sessionRole eşleşmese
    // bile etkin rol staff kalır.
    return "staff";
  }

  return "customer";
}

function readBearerToken(req: Request) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

// Personel ünvanı çözümleme: mümkünse JWT payload'daki staffRole claim'i
// kullanılır (her istekte ekstra DB okumu engeller); claim yoksa (giriş
// öncesi üretilmiş eski token'lar) role staff/manager ise Staff
// koleksiyonundan (email ile) okunur. Ünvanın kalıcı kaynağı Staff
// koleksiyonudur — User şeması ünvan taşımaz.
export function resolveStaffRoleFromClaim(claim?: unknown): StaffRole | null {
  return isValidStaffRole(claim) ? claim : null;
}

export async function fetchStaffRole(user: any): Promise<StaffRole> {
  if (!user || (user.role !== "staff" && user.role !== "manager") || !user.email) {
    return "";
  }

  const staff = await StaffModel.findOne({ email: normalizeEmail(user.email) }).lean();
  const staffRole = (staff as { staffRole?: unknown } | null)?.staffRole;
  return isValidStaffRole(staffRole) ? staffRole : "";
}

export async function attachAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = readBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: await getSystemText("yetkilendirme-gerekli") });
  }

  try {
    // MP-1.5: algoritma sabitlenir — token başlığındaki "alg" claim'ine
    // güvenilmez (none/asimetrik karıştırma saldırılarına kapı kapanır).
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as {
      userId: string;
      tokenVersion?: number;
      purpose?: string;
      staffRole?: unknown;
    };

    // S-K1 (MP-0.10): oturum token'ı "purpose" claim'i taşımaz. Taşıyan
    // token (ör. sadakat QR'ı) ayrık bir amaç için üretilmiştir ve oturum
    // olarak KULLANILAMAZ — QR'ı gören biri hesabı devralmasın.
    if (decoded.purpose) {
      return res.status(401).json({ message: await getSystemText("gecersiz-veya-suresi-dolmus-oturum") });
    }

    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: await getSystemText("oturum-bulunamadi") });
    }

    // MP-2.1: token iptali — token'daki versiyon kullanici dokumanindan
    // geride kaldiysa oturum dusurulmustur (parola degisikligi/logout/rol dususu).
    // Eski (versiyonsuz) token'lar 0 kabul edilerek geriye donuk uyumludur.
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: await getSystemText("oturum-guncel-degil") });
    }

    req.authUser = user;
    req.authRole = getEffectiveRole(user);
    // Personel ünvanı: claim varsa onu, yoksa Staff koleksiyonuna düş.
    // authStaffRole yalnız staff/manager etkili oturumlarda anlamlıdır.
    if (req.authRole === "staff" || req.authRole === "manager") {
      req.authStaffRole = resolveStaffRoleFromClaim(decoded.staffRole) ?? (await fetchStaffRole(user));
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: await getSystemText("gecersiz-veya-suresi-dolmus-oturum") });
  }
}

export async function attachOptionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    // MP-1.5: algoritma sabitlenir (attachAuth ile aynı gerekçe).
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as {
      userId: string;
      tokenVersion?: number;
      purpose?: string;
      staffRole?: unknown;
    };

    // S-K1 (MP-0.10): purpose taşıyan token (ör. sadakat QR'ı) opsiyonel
    // auth'ta da sessizce yok sayılır — kimlik olarak bağlanamaz.
    if (decoded.purpose) {
      req.authUser = undefined;
      req.authRole = undefined;
      req.authStaffRole = undefined;
      return next();
    }

    const user = await UserModel.findById(decoded.userId);

    // MP-2.1: iptal edilmis token opsiyonel auth'ta da sessizce reddedilir.
    if (user && (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      req.authUser = undefined;
      req.authRole = undefined;
      req.authStaffRole = undefined;
      return next();
    }

    req.authUser = user;
    req.authRole = user ? getEffectiveRole(user) : undefined;
    if (user && (req.authRole === "staff" || req.authRole === "manager")) {
      req.authStaffRole = resolveStaffRoleFromClaim(decoded.staffRole) ?? (await fetchStaffRole(user));
    }
  } catch (error) {
    req.authUser = undefined;
    req.authRole = undefined;
    req.authStaffRole = undefined;
  }

  return next();
}

export function restrictTo(...roles: (string | string[])[]) {
  const flattenedRoles = roles.flat();
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !req.authRole || !flattenedRoles.includes(req.authRole)) {
      return res.status(403).json({ message: await getSystemText("bu-islem-icin-yetkiniz-yok") });
    }

    return next();
  };
}

// Personel ünvanı (garson/bar/mutfak/mudur) kısıtı. attachAuth'in
// req.authStaffRole'a yazdığı değer (JWT claim > DB fallback) kontrol edilir.
// Boş ünvan tanımsız sayılır — ünvan isteyen uçlar tanımsız ünvana izin
// vermez (eski kayıtlar tüm personel GÖRÜNÜRLÜK uçlarına erişir, ünvan
// gerektiren işlemlere değil).
export function restrictToStaffRole(...staffRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const staffRole = req.authStaffRole ?? "";
    const isManager = req.authRole === "manager";

    if (
      !req.authUser ||
      (!isManager && (req.authRole !== "staff" || !staffRoles.includes(staffRole) || staffRole === ""))
    ) {
      return res.status(403).json({ message: await getSystemText("bu-islem-icin-mudur-yetkisi-gerekli") });
    }

    return next();
  };
}

// "manager hesabı VEYA (staff etkili oturum + belirtilen ünvan)" guard'ı.
// Rezervasyon onayı gibi eylemler müdür/yönetici ünvanlı personele ve
// manager hesaplarına açıktır; sıradan garson/bar/mutfak personeli alamaz.
export function restrictToManagerOrStaffRole(...staffRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const staffRole = req.authStaffRole ?? "";

    if (
      !req.authUser ||
      req.authRole === "customer" ||
      (req.authRole !== "manager" && !(req.authRole === "staff" && staffRoles.includes(staffRole) && staffRole !== ""))
    ) {
      return res.status(403).json({ message: await getSystemText("bu-islem-icin-mudur-yetkisi-gerekli") });
    }

    return next();
  };
}
