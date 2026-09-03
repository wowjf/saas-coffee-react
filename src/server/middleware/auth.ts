import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/User";
import type { UserRole } from "../../types";
import { getSystemText } from "../services/systemTexts";

export interface AuthRequest extends Request {
  authUser?: any;
  authRole?: UserRole;
}

export function getEffectiveRole(user: any): UserRole {
  const accountRole = (user?.role || "customer") as UserRole;

  if (accountRole === "customer") {
    return "customer";
  }

  if (accountRole === "manager") {
    if (user?.sessionRole === "manager" || user?.sessionRole === "staff") {
      return user.sessionRole;
    }
    return "customer";
  }

  return user?.sessionRole === accountRole ? accountRole : "customer";
}

function readBearerToken(req: Request) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
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
    };

    // S-K1 (MP-0.10): purpose taşıyan token (ör. sadakat QR'ı) opsiyonel
    // auth'ta da sessizce yok sayılır — kimlik olarak bağlanamaz.
    if (decoded.purpose) {
      req.authUser = undefined;
      req.authRole = undefined;
      return next();
    }

    const user = await UserModel.findById(decoded.userId);

    // MP-2.1: iptal edilmis token opsiyonel auth'ta da sessizce reddedilir.
    if (user && (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      req.authUser = undefined;
      req.authRole = undefined;
      return next();
    }

    req.authUser = user;
    req.authRole = user ? getEffectiveRole(user) : undefined;
  } catch (error) {
    req.authUser = undefined;
    req.authRole = undefined;
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
