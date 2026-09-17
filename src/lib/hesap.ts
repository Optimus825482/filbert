// Sektörel kural motoru — deterministik hesaplar (AI/sesli girişler de bu kurallardan geçer)

export function tutarHesapla(kg: number, birimFiyat: number): number {
  return Math.round(kg * birimFiyat * 100) / 100;
}

/** Fiş numarası: AKY-2026-000123 */
export function fisNoUret(onEk: string, yil: number, sira: number): string {
  return `${onEk}-${yil}-${String(sira).padStart(6, "0")}`;
}

/** Firma bazlı sıralı satın alma kodu: 001, 002, ... (999 sonrası doğal büyür) */
export function satinAlmaKoduUret(sira: number): string {
  return String(sira).padStart(3, "0");
}
