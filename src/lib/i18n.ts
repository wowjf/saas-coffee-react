import { t } from "../shared/system-texts";
export const SUPPORTED_LANGUAGES = {
  tr: t("turkce"),
  en: 'English',
  de: 'Deutsch',
  fr: t("francais"),
  es: 'Español',
  it: 'Italiano',
  ru: 'Русский',
};

// MP-1.10: Coklu para birimi goruntuleme kaldirildi (urun karari: sabit TL).
// Onceki hardcode kur carpanlari (USD: 0.037 vb.) guncelligi garanti
// olmayan, yanlis fiyat gosterme riski tasiyan bir donusum yapiyordu.
const tlPriceFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(price: number): string {
  return tlPriceFormatter.format(price);
}
