// Sunucu tarafı doğrulama yardımcıları.
//
// Tüm kullanıcı girdileri için makul üst sınır uygular; böylece 1e308 gibi
// taşan değerler veritabanına ulaşmadan anlaşılır bir hatayla reddedilir.
// Zod eklemeden ortak kuralları tek yerde tutar.

/** Sayısal üst sınırlar (iş alanına uygun güvenlik tavanları). */
export const KG_MAKS = 50_000_000; // 50.000 ton
export const GRAM_MAKS = 1_000_000; // 1 ton numune
export const TUTAR_MAKS = 1_000_000_000_000; // 1 trilyon TL
export const BIRIM_FIYAT_MAKS = 10_000_000; // kg/adet başına 10 milyon TL
export const RANDIMAN_MAKS = 100; // randıman puanı %100
export const ORAN_MAKS = 1; // %100
export const KALEM_MAKS = 500; // tek belgedeki satır sayısı

/** Değerin sonlu ve [min, max] aralığında olduğunu doğrular. */
export function gecerliSayi(deger: unknown, min: number, max: number): deger is number {
  return typeof deger === "number" && Number.isFinite(deger) && deger >= min && deger <= max;
}

/** Pozitif ve üst sınırlı sayı (0 hariç). */
export function gecerliPozitifSayi(deger: unknown, max: number): deger is number {
  return gecerliSayi(deger, Number.MIN_VALUE, max) && deger > 0;
}

/** Dizi uzunluğunu belge başına sınırlar. */
export function kalemSayisiGecerli<T>(kalemler: readonly T[] | undefined | null): kalemler is readonly T[] {
  return Array.isArray(kalemler) && kalemler.length > 0 && kalemler.length <= KALEM_MAKS;
}

/** Parola kuralı: en az 6 karakter ve en az bir harf ile bir rakam. */
export function parolaGecerli(parola: unknown): parola is string {
  return typeof parola === "string" && parola.length >= 6 && /\p{L}/u.test(parola) && /[0-9]/.test(parola);
}

/** Parola kuralı için kullanıcıya gösterilen hata iletisi. */
export const PAROLA_HATASI = "Parola en az 6 karakter olmalı ve harf ile rakam içermeli";
