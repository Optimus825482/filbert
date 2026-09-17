"use server";

// Avans oluşturma (nakit / ayni / fındık karşılığı)
//   NAKIT → kasa/banka çıkışı + cari ALACAK
//   AYNI → stok çıkışı + cari ALACAK
//   FINDIK_KARSILIGI → kg borç kaydı + cari ALACAK
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { KG_MAKS, TUTAR_MAKS, gecerliSayi } from "@/lib/dogrulama";

export interface AvansGirdi {
  cariId: string;
  tur: "NAKIT" | "AYNI" | "FINDIK_KARSILIGI";
  tutarTl: number;
  bakiyeTuru: "TL" | "USD" | "EUR" | "XAU";
  tutarDoviz?: number;
  aciklama?: string;
  hesapId?: string; // NAKIT ise ödemenin çıkacağı kasa/banka
  depoId?: string;  // AYNI ise stok çıkışı yapılacak depo
  kg?: number;       // AYNI: kaç kg; FINDIK_KARSILIGI: kaç kg borç
  kullaniciId?: string;
}

export async function createAvans(g: AvansGirdi): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("AVANS", "OLUSTUR");
  if (!(["NAKIT", "AYNI", "FINDIK_KARSILIGI"] as const).includes(g.tur)) return { ok: false, hata: "Geçersiz avans tipi" };
  if (!(["TL", "USD", "EUR", "XAU"] as const).includes(g.bakiyeTuru)) return { ok: false, hata: "Geçersiz para birimi" };
  if (!g.cariId) return { ok: false, hata: "Üretici seçilmedi" };
  if (!gecerliSayi(g.tutarTl, 0.001, TUTAR_MAKS)) return { ok: false, hata: "Geçerli bir tutar girilmeli" };
  if (g.bakiyeTuru !== "TL" && !gecerliSayi(g.tutarDoviz, 0.001, TUTAR_MAKS)) {
    return { ok: false, hata: "Döviz/altın avansında döviz tutarı girilmeli" };
  }
  if (g.tur === "NAKIT" && !g.hesapId) return { ok: false, hata: "Nakit avansta kasa/banka seçilmeli" };
  if (g.tur === "AYNI" && !g.depoId) return { ok: false, hata: "Ayni avansta depo seçilmeli" };
  if (g.tur === "AYNI" && !gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Ayni avansta geçerli kg girilmeli" };
  if (g.tur === "FINDIK_KARSILIGI" && !gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Fındık karşılığı avansta geçerli kg girilmeli" };

  const [cari, hesap, depo, sezon] = await Promise.all([
    prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: actor.firmaId, aktif: true } }),
    g.hesapId ? prisma.kasaHesap.findFirst({ where: { id: g.hesapId, firmaId: actor.firmaId, aktif: true } }) : null,
    g.depoId ? prisma.depo.findFirst({ where: { id: g.depoId, firmaId: actor.firmaId, aktif: true } }) : null,
    prisma.sezon.findFirst({ where: { firmaId: actor.firmaId, aktif: true } }),
  ]);
  if (!cari) return { ok: false, hata: "Üretici bulunamadı veya pasif" };
  if (g.hesapId && !hesap) return { ok: false, hata: "Kasa/banka hesabı bulunamadı veya pasif" };
  if (g.depoId && !depo) return { ok: false, hata: "Depo bulunamadı veya pasif" };
  if (g.tur === "NAKIT" && hesap && hesap.bakiyeTuru !== g.bakiyeTuru) return { ok: false, hata: `Hesap para birimi ${hesap.bakiyeTuru}; avans para birimi ${g.bakiyeTuru} olmalı` };

  try {
    await prisma.$transaction(async (tx) => {
      if (g.tur === "AYNI" && g.depoId && g.kg) {
        const stok = await tx.stokHareket.aggregate({ where: { depoId: g.depoId, mulkiyet: "KENDI" }, _sum: { kg: true } });
        if (Number(stok._sum.kg ?? 0) < g.kg) throw new Error("Depoda yeterli kendi stok yok");
      }
      const avans = await tx.avans.create({
        data: {
          cariId: g.cariId,
          tur: g.tur,
          tutarTl: g.tutarTl,
          bakiyeTuru: g.bakiyeTuru,
          tutarDoviz: g.tutarDoviz,
          aciklama: g.aciklama,
          kalanTl: g.tutarTl,
        },
      });

      // Cari ALACAK
      await tx.cariHareket.create({
        data: {
          cariId: g.cariId,
          yon: "ALACAK",
          bakiyeTuru: g.bakiyeTuru,
          tutar: g.bakiyeTuru === "TL" ? g.tutarTl : g.tutarDoviz!,
          kaynakTipi: "AVANS",
          aciklama: g.aciklama ?? (g.tur === "NAKIT" ? "Nakit avans" : g.tur === "AYNI" ? "Ayni avans" : "Fındık karşılığı avans"),
        },
      });

      // Nakit: kasadan çıkış
      if (g.tur === "NAKIT" && g.hesapId) {
        await tx.finansHareket.create({
          data: {
            tip: "ODEME",
            firmaId: actor.firmaId,
            cariId: g.cariId,
            hesapId: g.hesapId,
            bakiyeTuru: g.bakiyeTuru,
            tutar: g.bakiyeTuru === "TL" ? g.tutarTl : g.tutarDoviz!,
            iliskiliTipi: "AVANS",
            aciklama: g.aciklama ?? "Nakit avans ödemesi",
          },
        });
      }

      // Ayni: stoktan çıkış
      if (g.tur === "AYNI" && g.depoId && g.kg) {
        await tx.stokHareket.create({
          data: {
            depoId: g.depoId,
            tip: "SATIS_CIKIS",
            kg: -g.kg,
            mulkiyet: "KENDI",
            sezonId: sezon?.id,
            maliyetBirimTl: g.kg > 0 ? g.tutarTl / g.kg : null,
            kaynakTipi: "AVANS",
          },
        });
      }

      // Fındık karşılığı: kg borç kaydı
      if (g.tur === "FINDIK_KARSILIGI" && g.kg) {
        await tx.cariHareket.create({
          data: {
            cariId: g.cariId,
            yon: "BORC",
            bakiyeTuru: "FINDIK_KG",
            tutar: g.kg,
            kaynakTipi: "AVANS",
            aciklama: g.aciklama ?? "Fındık karşılığı avans (kg borç)",
          },
        });
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "AVANS", eylem: "OLUSTUR", hedefTipi: "Avans", hedefId: avans.id, sonrakiVeri: { cariId: g.cariId, tur: g.tur, tutarTl: g.tutarTl, hesapId: g.hesapId ?? null, depoId: g.depoId ?? null, kg: g.kg ?? null }, aciklama: "Avans kaydı oluşturuldu; finansal düzeltmeler ters kayıt yaklaşımıyla yapılır." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/avans");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("createAvans", e);
    return { ok: false, hata: e instanceof Error && e.message === "Depoda yeterli kendi stok yok" ? e.message : "Avans kaydedilemedi" };
  }
}
