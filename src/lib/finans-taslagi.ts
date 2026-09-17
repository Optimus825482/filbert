"server only";

import { prisma } from "@/lib/db";
import type { FirmaAktoru } from "@/lib/sesli-not";
import { Prisma } from "@/generated/prisma/client";

export type FinansTaslagiGirdi = { sesliNotId: string; cariId: string; onerilenTip?: "ODEME" | "TAHSILAT" | "MASRAF" | "BELIRSIZ"; onerilenTutar?: number; onerilenParaBirimi?: "TL" | "USD" | "EUR" | "XAU"; onerilenAciklama?: string };
export async function finansTaslagiOlustur(actor: FirmaAktoru, girdi: FinansTaslagiGirdi) {
  const [not, cari] = await Promise.all([prisma.sesliNot.findFirst({ where: { id: girdi.sesliNotId, firmaId: actor.firmaId, kullaniciId: actor.id } }), prisma.cariKart.findFirst({ where: { id: girdi.cariId, firmaId: actor.firmaId, aktif: true } })]);
  if (!not) return { ok: false as const, hata: "Sesli not bulunamadı veya size ait değil" };
  if (!cari) return { ok: false as const, hata: "Cari bulunamadı veya pasif" };
  if (girdi.onerilenTutar !== undefined && !(girdi.onerilenTutar > 0)) return { ok: false as const, hata: "Önerilen tutar pozitif olmalı" };
  const reminder = new Date(Date.now() + 60 * 60 * 1_000);
  try {
    const taslak = await prisma.$transaction(async (tx) => {
      const mevcut = await tx.finansTaslagi.findUnique({ where: { sesliNotId: not.id } });
      if (mevcut) return mevcut;
      const created = await tx.finansTaslagi.create({ data: { firmaId: actor.firmaId, cariId: cari.id, sesliNotId: not.id, olusturanId: actor.id, onerilenTip: girdi.onerilenTip ?? "BELIRSIZ", onerilenTutar: girdi.onerilenTutar, onerilenParaBirimi: girdi.onerilenParaBirimi, onerilenAciklama: girdi.onerilenAciklama?.trim() || null, hatirlatmaAt: reminder } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SESLI_NOT", eylem: "OLUSTUR", hedefTipi: "FinansTaslagi", hedefId: created.id, sonrakiVeri: { cariId: cari.id, sesliNotId: not.id, onerilenTip: created.onerilenTip, onerilenTutar: created.onerilenTutar?.toString() ?? null, hatirlatmaAt: reminder.toISOString() }, aciklama: "Sesli finans taslağı inceleme için oluşturuldu; finans defterine henüz yazılmadı." } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ok: true as const, taslakId: taslak.id };
  } catch { return { ok: false as const, hata: "Finans taslağı oluşturulamadı" }; }
}
