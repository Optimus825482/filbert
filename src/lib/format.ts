// Türkçe sayı/tarih formatları
// Not: Prisma Decimal dahil her türlü sayısal değer kabul edilir (Number() ile çevrilir)
type Sayisal = number | string | { toString(): string } | null | undefined;

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
const sayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const kgFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });

export function paraTL(v: Sayisal): string {
  if (v === null || v === undefined) return "—";
  return tl.format(Number(v));
}

export function paraBirim(v: Sayisal, tur: string): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  switch (tur) {
    case "TL":
      return tl.format(n);
    case "USD":
      return `$${sayi.format(n)}`;
    case "EUR":
      return `€${sayi.format(n)}`;
    case "XAU":
      return `${kgFmt.format(n)} gr`;
    case "FINDIK_KG":
      return `${kgFmt.format(n)} kg`;
    default:
      return sayi.format(n);
  }
}

export function kg(v: Sayisal): string {
  if (v === null || v === undefined) return "—";
  return `${kgFmt.format(Number(v))} kg`;
}

export function puan(v: Sayisal): string {
  if (v === null || v === undefined) return "—";
  return sayi.format(Number(v));
}

export function tarih(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
}

export function tarihSaat(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

export function gunFarki(d: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

/**
 * Türkçe klavye girişini sayıya çevirir.
 * Noktalı üçlü gruplar binlik ayraçtır ("1.234" = 1234); gruplamasız
 * noktalı ondalık giriş de desteklenir ("1234.56" = 1234.56).
 */
export function sayiCevir(v: string | null | undefined): number {
  if (!v) return 0;
  const t = v.trim().replace(/\s/g, "");
  if (!t) return 0;

  if (t.includes(",")) {
    return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
  }

  const turkceBinlikAyiracli = /^-?\d{1,3}(?:\.\d{3})+$/.test(t);
  return Number(turkceBinlikAyiracli ? t.replace(/\./g, "") : t) || 0;
}

export const BAKIYE_ETIKET: Record<string, string> = {
  TL: "Türk Lirası",
  USD: "Dolar",
  EUR: "Euro",
  XAU: "Altın (gr)",
  FINDIK_KG: "Fındık (kg)",
};
