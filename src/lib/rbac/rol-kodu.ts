/**
 * İnsan tarafından girilen rol adından, veritabanındaki benzersiz rol kodunu
 * üretir. Türkçe harfleri kaybetmeden ASCII karşılığına çevirir; böylece
 * "Şoför" gibi adlar anlamsız veya boş bir koda dönüşmez.
 */
export function rolKoduOlustur(ad: string): string {
  const turkceKarsiliklar: Record<string, string> = {
    ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
  };
  const ascii = ad.trim().replace(/[çÇğĞıİöÖşŞüÜ]/g, (harf) => turkceKarsiliklar[harf]);
  const kod = ascii
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return kod || "ROL";
}

/** Boşluk ve sembollerden ibaret rol adlarını veri katmanında da engeller. */
export function rolAdiGecerli(ad: string): boolean {
  return ad.trim().length >= 2 && /[\p{L}\p{N}]/u.test(ad);
}
