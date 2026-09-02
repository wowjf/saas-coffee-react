import { normalizeEmail } from "../utils.js";

/**
 * Guvenlik (MP-0.2): Kayitta e-posta ile rol atama akisi kapatildi — kayit
 * yapan herkes customer olur, ayricalikli roller yalnizca oturum acmis bir
 * manager tarafindan verilir.
 *
 * `resolveRoleForEmail` kaldirildi; bu dosya artik yalnizca ortam
 * degiskenlerinden gelen yonetici e-postalarini icerir. Sabit
 * `DEFAULT_MANAGER_EMAILS` listesi koddan cikarildi (guvenlik raporu C-2):
 * yalnizca `DEFAULT_MANAGER_EMAILS` ve `BOOTSTRAP_ADMIN_EMAIL` env
 * degiskenleri tanınır. `isConfiguredManagerEmail` yeni rol ATAMAZ; sadece
 * mevcut yonetici hesabinin yanlislikla role dusurulmesini engelleyen
 * PATCH korumalarinda kullanilir.
 */
function getConfiguredManagerEmails() {
  const fromEnv = process.env.DEFAULT_MANAGER_EMAILS
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  return new Set([
    ...(fromEnv || []),
    ...(bootstrapAdminEmail ? [bootstrapAdminEmail] : []),
  ]);
}

export function isConfiguredManagerEmail(email: string) {
  return getConfiguredManagerEmails().has(normalizeEmail(email));
}
