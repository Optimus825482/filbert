export const OFFLINE_KOMUT_TIPLERI = ["SESLI_NOT_TASLAGI"] as const;
export type OfflineKomutTipi = (typeof OFFLINE_KOMUT_TIPLERI)[number];
export type OfflineKomut = { id: string; sahipKullaniciId: string; tip: OfflineKomutTipi; payload: { metin: string }; createdAt: string };

export function offlineKomutuDogrula(value: unknown): OfflineKomut | null {
  if (!value || typeof value !== "object") return null;
  const komut = value as Partial<OfflineKomut>;
  if (typeof komut.id !== "string" || !/^[a-zA-Z0-9_-]{12,128}$/.test(komut.id)) return null;
  if (typeof komut.sahipKullaniciId !== "string" || !/^[a-zA-Z0-9-]{16,128}$/.test(komut.sahipKullaniciId)) return null;
  if (typeof komut.createdAt !== "string" || Number.isNaN(Date.parse(komut.createdAt))) return null;

  if (komut.tip === "SESLI_NOT_TASLAGI") {
    const p = komut.payload as Partial<{ metin?: string }>;
    if (!p || typeof p.metin !== "string") return null;
    const temiz = p.metin.trim();
    if (temiz.length < 2 || temiz.length > 4_000) return null;
    return { id: komut.id, sahipKullaniciId: komut.sahipKullaniciId, tip: komut.tip, payload: { metin: temiz }, createdAt: komut.createdAt };
  }

  return null;
}
