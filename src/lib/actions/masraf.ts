"use server";

// Masraf kaydı
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { Prisma } from "@/generated/prisma/client";
import { TUTAR_MAKS, gecerliSayi } from "@/lib/dogrulama";

export interface MasrafGirdi {
  tur: string; // firmanın tanımladığı masraf türü adı
  tutar: number;
  cariId?: string;
  iliskiliAlimId?: string;
  maliyeteYansit: boolean;
  aciklama?: string;
  hesapId?: string; // ödeme kasadan yapıldıysa
}

export async function createMasraf(g: MasrafGirdi): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("MASRAF", "OLUSTUR");
  if (!g.tur?.trim()) return { ok: false, hata: "Masraf türü seçilmedi" };
  if (!gecerliSayi(g.tutar, 0.001, TUTAR_MAKS)) return { ok: false, hata: "Geçerli bir tutar girilmeli" };
  const turAdi = g.tur.trim();
  const tanim = await prisma.masrafTuru.findFirst({ where: { firmaId: actor.firmaId, ad: turAdi, aktif: true } });
  if (!tanim) return { ok: false, hata: "Masraf türü bulunamadı; Ayarlar > Tanımlar bölümünden ekleyebilirsiniz" };

  try {
    const [cari, hesap, alim] = await Promise.all([
      g.cariId ? prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: actor.firmaId, aktif: true } }) : null,
      g.hesapId ? prisma.kasaHesap.findFirst({ where: { id: g.hesapId, firmaId: actor.firmaId } }) : null,
      g.iliskiliAlimId ? prisma.alimFisi.findFirst({ where: { id: g.iliskiliAlimId, cari: { firmaId: actor.firmaId } } }) : null,
    ]);
    if (g.cariId && !cari) return { ok: false, hata: "Cari bulunamadı veya pasif" };
    if (g.hesapId && (!hesap || !hesap.aktif)) return { ok: false, hata: "Hesap bulunamadı veya pasif" };
    if (hesap && hesap.bakiyeTuru !== "TL") return { ok: false, hata: "Masraf kaydı için yalnız TL hesabı kullanılabilir" };
    if (g.iliskiliAlimId && !alim) return { ok: false, hata: "Alım fişi bulunamadı" };
    await prisma.$transaction(async (tx) => {
      const masraf = await tx.masraf.create({
        data: {
          firmaId: actor.firmaId,
          tur: turAdi,
          tutar: g.tutar,
          cariId: g.cariId || null,
          iliskiliAlimId: g.iliskiliAlimId || null,
          maliyeteYansit: g.maliyeteYansit,
          aciklama: g.aciklama,
        },
      });

      if (g.hesapId) {
        await tx.finansHareket.create({
          data: {
            tip: "ODEME",
            firmaId: actor.firmaId,
            cariId: g.cariId || null,
            hesapId: g.hesapId,
            bakiyeTuru: "TL",
            tutar: g.tutar,
            iliskiliTipi: "MASRAF",
            iliskiliId: masraf.id,
            aciklama: g.aciklama ?? `Masraf: ${turAdi}`,
          },
        });
      }

      if (g.cariId) {
        await tx.cariHareket.create({
          data: {
            cariId: g.cariId,
            yon: "ALACAK",
            bakiyeTuru: "TL",
            tutar: g.tutar,
            kaynakTipi: "MASRAF",
            kaynakId: masraf.id,
            sezonId: (await tx.sezon.findFirst({ where: { firmaId: actor.firmaId, aktif: true } }))?.id,
            aciklama: g.aciklama ?? `Masraf: ${turAdi}`,
          },
        });
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "MASRAF", eylem: "OLUSTUR", hedefTipi: "Masraf", hedefId: masraf.id, sonrakiVeri: { tur: turAdi, tutar: g.tutar, cariId: g.cariId ?? null, hesapId: g.hesapId ?? null, iliskiliAlimId: g.iliskiliAlimId ?? null }, aciklama: "Masraf düzeltmesi ters finans/cari hareketi ile yapılır." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/masraf");
    revalidatePath("/cari");
    return { ok: true };
  } catch (e) {
    console.error("createMasraf", e);
    return { ok: false, hata: "Masraf kaydedilemedi" };
  }
}
