// "+90 5-- --- -- --" kalıbına zorlayan telefon maskesi. Yalnızca rakam
// kabul eder, otomatik gruplama yapar ve fazla haneleri kırpar. Ulusal kısım
// daima 5 ile başlar ve 10 hanedir: 3-3-2-2 gruplanır ("+90 505 123 45 67").
const TR_PHONE_NATIONAL_DIGITS = 10; // 5XXXXXXXXX

export function formatTurkeyPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  // Yapıştırılan "+90"/"90"/"0" öneklerini sıyır
  if (digits.startsWith("90")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // Ulusal kısım 5 ile başlamak zorunda; 0-4 ile başlayan haneleri at.
  digits = digits.replace(/^[0-4]+/, "");
  digits = digits.slice(0, TR_PHONE_NATIONAL_DIGITS);

  if (!digits) return "";

  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)]
    .filter(Boolean)
    .join(" ");

  return `+90 ${groups}`;
}

// Maskeli görünümden doğrulama için E.164 biçimini çıkarır
// ("905XXXXXXXXX" — 12 hane). Eksik/geçersizse boş string döner.
export function parseTurkeyPhone(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  const national = digits.startsWith("90") ? digits.slice(2) : digits;
  if (national.length !== TR_PHONE_NATIONAL_DIGITS || !national.startsWith("5")) return "";
  return `90${national}`;
}

export function isTurkeyPhoneComplete(masked: string): boolean {
  return parseTurkeyPhone(masked).length === 2 + TR_PHONE_NATIONAL_DIGITS;
}
