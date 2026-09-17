"server only";

import { prisma } from "@/lib/db";

export type SesliNotGirdi = { metin: string; offlineId?: string };
export type FirmaAktoru = { id: string; firmaId: string };

export function sesliNotMetniniDogrula(metin: string): string | null {
  const temiz = metin.trim();
  if (temiz.length < 2) return null;
  return temiz.slice(0, 4_000);
}

export async function sesliNotTaslagiKaydet(actor: FirmaAktoru, girdi: SesliNotGirdi) {
  const metin = sesliNotMetniniDogrula(girdi.metin);
  if (!metin) return { ok: false as const, hata: "Sesli not metni en az iki karakter olmalı" };
  if (girdi.offlineId && !/^[a-zA-Z0-9_-]{12,128}$/.test(girdi.offlineId)) return { ok: false as const, hata: "Geçersiz offline kayıt kimliği" };

  return prisma.$transaction(async (tx) => {
    if (girdi.offlineId) {
      const mevcut = await tx.sesliNot.findUnique({ where: { offlineId: girdi.offlineId } });
      if (mevcut) {
        if (mevcut.firmaId !== actor.firmaId || mevcut.kullaniciId !== actor.id) return { ok: false as const, hata: "Offline kayıt kimliği başka bir kullanıcıya ait" };
        return { ok: true as const, notId: mevcut.id, tekrar: true };
      }
    }
    const not = await tx.sesliNot.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, hamMetin: metin, offlineId: girdi.offlineId } });
    await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SESLI_NOT", eylem: "OLUSTUR", hedefTipi: "SesliNot", hedefId: not.id, sonrakiVeri: { offlineId: not.offlineId, durum: not.durum }, aciklama: "Sesli not taslağı oluşturuldu; operasyon kaydına dönüşmesi için ayrıca onay gerekir." } });
    return { ok: true as const, notId: not.id, tekrar: false };
  });
}
