import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { SYSTEM_TEXTS } from "../../shared/system-texts.js";
import { getSystemText } from "../services/systemTexts.js";

/**
 * İş kuralı hatası: HTTP durum kodu + makine tarafından okunabilir `code` +
 * kullanıcıya gösterilecek Türkçe `message`. Route'lar
 * `throw new ApiError(400, "PRODUCT_OUT_OF_STOCK", "...")` gibi fırlatır;
 * merkezi errorHandler bunu birebir yanıta çevirir (MP-0.6).
 *
 * MP-1.8: `message` yerine bir `systemTextKey` verilebilir (herhangi bir
 * kurucu argümanı `sys:` önekiyle). Böylece route catch'leri
 * `await getSystemText(...)` çağrısı yapmadan hatayı next()'e aktarır;
 * systemText çözümlemesi (DB override + varsayılan) tek yerde, errorHandler
 * içinde yapılır — hata path'ine ekstra DB çağrısı girmemiş olur çünkü
 * getSystemText önbellekli yükleyiciyi kullanır.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly systemTextKey: string | null;

  constructor(status: number, code: string, message: string) {
    const systemTextKey = message.startsWith("sys:") ? message.slice(4) : null;
    super(systemTextKey ? systemTextKey : message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.systemTextKey = systemTextKey;
  }
}

const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "Dosya boyutu çok büyük (en fazla 8 MB).",
  LIMIT_UNEXPECTED_FILE: "Beklenmeyen bir dosya alanı gönderildi.",
  LIMIT_FILE_COUNT: "Çok fazla dosya gönderildi.",
};

function duplicateKeyMessage(error: {
  keyValue?: Record<string, unknown>;
  keyPattern?: Record<string, unknown>;
  message?: unknown;
}) {
  // Tercih edilen yol: sürücünün verdiği keyValue/keyPattern. Bazı hata
  // yollarında yalnızca mesaj gelir; oradan "index: username_1" kalıbını çıkar.
  let key = Object.keys(error.keyValue ?? error.keyPattern ?? {})[0];

  if (!key && typeof error.message === "string") {
    const match = error.message.match(/index:\s*(?:cafe_db\.\w+\.)?([A-Za-z0-9_]+?)_\d+/);
    key = match?.[1];
  }

  if (key === "username") {
    return "Bu kullanıcı adı zaten kullanımda.";
  }
  if (key === "email") {
    return "Bu e-posta adresi zaten kullanımda.";
  }
  return "Bu kayıt zaten mevcut.";
}

function isDuplicateKeyError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate?.code === 11000 || (typeof candidate?.message === "string" && candidate.message.includes("E11000"));
}

/**
 * Hata path'indeyiz — yanıt her koşulda gönderilmelidir. systemText
 * çözümlemesi (a) kendi patlarsa, (b) DB'ye bağlanamadığı için mongoose'un
 * sorgu tamponunda takılırsa (bağlantı yoksa promise hiç sonuçlanmaz) DB
 * override'ını beklemeden varsayılan metne düş (MP-1.8).
 */
async function resolveSystemTextMessage(key: string) {
  const fallback = SYSTEM_TEXTS[key] ?? key;

  try {
    return await Promise.race([
      getSystemText(key),
      new Promise<string>((resolve) => setTimeout(() => resolve(fallback), 500)),
    ]);
  } catch {
    return fallback;
  }
}

/**
 * Merkezi hata yönetimi (MP-0.6). next(error)'ye düşen her şeyi (asyncHandler
 * sarmalayıcısından gelen redler dahil) tutarlı bir JSON yanıtına çevirir.
 * server.ts'te API route'larının mount edildiği yerin hemen sonrasına eklenir.
 */
export const errorHandler: ErrorRequestHandler = async (error, _req, res, next) => {
  // Yanıt zaten gönderildiyse Express'in varsayılan sonlandırıcısına bırak:
  // gönderilmiş bir yanıta ikinci bir yazım denemesi süreci kilitler.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    // MP-1.8: mesaj bir systemText anahtarına işaret ediyorsa (sys: öneki)
    // burada çözümle — route catch'lerindeki ekstra await kalkar.
    const message = error.systemTextKey
      ? await resolveSystemTextMessage(error.systemTextKey)
      : error.message;
    res.status(error.status).json({ code: error.code, message });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: error.message });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ code: "INVALID_ID", message: "Geçersiz kimlik (ID) değeri." });
    return;
  }

  if (error instanceof multer.MulterError) {
    res.status(400).json({
      code: "UPLOAD_ERROR",
      message: MULTER_MESSAGES[error.code] ?? error.message,
    });
    return;
  }

  if (isDuplicateKeyError(error)) {
    res.status(409).json({ code: "DUPLICATE_KEY", message: duplicateKeyMessage(error as never) });
    return;
  }

  // body-parser bozuk JSON gövdesinde status=400 işaretli SyntaxError üretir.
  if (error instanceof SyntaxError && (error as { status?: unknown }).status === 400) {
    res.status(400).json({ code: "INVALID_JSON", message: "İstek gövdesi geçerli bir JSON değil." });
    return;
  }

  console.error("[errorHandler] Unhandled error:", error);
  res.status(500).json({ code: "INTERNAL_ERROR", message: "Sunucuda beklenmeyen bir hata oluştu." });
};
