"use server";

// Emanet: muhasebeleştir (hesap gör — manuel fiyatla satın alma) ve üreticiye iade.
import { prisma } from "@/lib/db";
import { tutarHesapla } from "@/lib/hesap";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { KG_MAKS, BIRIM_FIYAT_MAKS, gecerliSayi } from "@/lib/dogrulama";

async function emanetKalanKg(tx: Prisma.TransactionClient, emanetId: string) {
  const hareketler = await tx.emanetHareket.groupBy({ by: ["tip"], where: { emanetId }, _sum: { kg: true } });
  const kalan = hareketler.reduce((toplam, hareket) => toplam + (hareket.tip === "GIRIS" ? 1 : -1) * Number(hareket._sum.kg ?? 0), 0);
  return Math.round(kalan * 1000) / 1000;
}

async function depoEmanetStogu(tx: Prisma.TransactionClient, depoId: string) {
  const sonuc = await tx.stokHareket.aggregate({ where: { depoId, mulkiyet: "EMANET" }, _sum: { kg: true } });
  return Number(sonuc._sum.kg ?? 0);
}

export interface EmanetMuhasebeleistirGirdi {
  emanetId: string;
  kg: number;
  birimFiyat: number;
}

// ── Muhasebeleştir (Hesap Gör): emanet fındık manuel fiyatla satın alınır.
// Cari'den kg borcu düşer, TL borç yazılır; stok EMANET → KENDİ'ye döner.
export async function muhasebelestirEmanet(g: EmanetMuhasebeleistirGirdi): Promise<{ ok: boolean; hata?: string; tutar?: number }> {
  const actor = await requirePermission("EMANET", "GUNCELLE");
  if (!gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Geçerli kg girilmeli" };
  if (!gecerliSayi(g.birimFiyat, 0.0001, BIRIM_FIYAT_MAKS)) return { ok: false, hata: "Geçerli birim fiyat girilmeli" };

  const emanet = await prisma.emanet.findFirst({ where: { id: g.emanetId, cari: { firmaId: actor.firmaId } }, include: { cari: true, alimFisi: true } });
  if (!emanet) return { ok: false, hata: "Emanet bulunamadı" };
  if (emanet.durum === "KAPANDI") return { ok: false, hata: "Emanet kapalı" };

  const tutar = tutarHesapla(g.kg, g.birimFiyat);

  try {
    await prisma.$transaction(async (tx) => {
      if (!emanet.depoId) throw new Error("Emanetin kaynak deposu tanımlı değil");
      const kalan = await emanetKalanKg(tx, g.emanetId);
      if (g.kg > kalan) throw new Error(`Emanette yeterli kg yok (kalan: ${kalan} kg)`);
      const depoStok = await depoEmanetStogu(tx, emanet.depoId);
      if (depoStok < g.kg) throw new Error(`Kaynak depoda yeterli emanet stok yok (mevcut: ${depoStok} kg)`);
      await tx.emanetHareket.create({
        data: { emanetId: g.emanetId, tip: "BOZMA", kg: g.kg, tutarTl: tutar },
      });

      await tx.cariHareket.create({
        data: { cariId: emanet.cariId, yon: "ALACAK", bakiyeTuru: "FINDIK_KG", tutar: g.kg, kaynakTipi: "EMANET_BOZMA", kaynakId: g.emanetId, sezonId: emanet.sezonId, aciklama: `Emanet muhasebeleştirme (${g.kg} kg)` },
      });
      await tx.cariHareket.create({
        data: { cariId: emanet.cariId, yon: "BORC", bakiyeTuru: "TL", tutar, kaynakTipi: "EMANET_BOZMA", kaynakId: g.emanetId, sezonId: emanet.sezonId, aciklama: `Emanet satın alma: ${g.kg} kg × ${g.birimFiyat} TL` },
      });

      await tx.stokHareket.createMany({
        data: [
          { depoId: emanet.depoId, tip: "MULKIYET_DONUSUM", kg: -g.kg, mulkiyet: "EMANET", sezonId: emanet.sezonId, kaynakTipi: "EMANET_BOZMA", kaynakId: g.emanetId },
          { depoId: emanet.depoId, tip: "MULKIYET_DONUSUM", kg: g.kg, mulkiyet: "KENDI", sezonId: emanet.sezonId, randimanPuan: emanet.alimFisi?.randimanPuan ? Number(emanet.alimFisi.randimanPuan) : null, maliyetBirimTl: g.birimFiyat, kaynakTipi: "EMANET_BOZMA", kaynakId: g.emanetId },
        ],
      });

      const yeniKalan = kalan - g.kg;
      await tx.emanet.update({
        where: { id: g.emanetId },
        data: { durum: yeniKalan <= 0.0005 ? "KAPANDI" : "KISMI_BOZULDU" },
      });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "EMANET", eylem: "GUNCELLE", hedefTipi: "Emanet", hedefId: g.emanetId, sonrakiVeri: { tip: "MUHASEBELESTIRME", kg: g.kg, birimFiyat: g.birimFiyat, tutar } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/emanet");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true, tutar };
  } catch (e) {
    console.error("muhasebelestirEmanet", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.includes("yeterli") || mesaj.includes("kaynak deposu") ? mesaj : "Muhasebeleştirme sırasında hata oluştu" };
  }
}

// ── Emanet iade (üreticiye geri verilir, kg borcu azalır, stoktan EMANET düşer) ──

export interface EmanetIadeGirdi {
  emanetId: string;
  kg: number;
  aciklama?: string;
}

export async function iadeEmanet(g: EmanetIadeGirdi): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("EMANET", "GUNCELLE");
  if (!gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Geçerli iade kg girilmeli" };

  const emanet = await prisma.emanet.findFirst({ where: { id: g.emanetId, cari: { firmaId: actor.firmaId } }, include: { cari: true } });
  if (!emanet) return { ok: false, hata: "Emanet bulunamadı" };
  if (emanet.durum === "KAPANDI") return { ok: false, hata: "Emanet kapalı" };

  try {
    await prisma.$transaction(async (tx) => {
      if (!emanet.depoId) throw new Error("Emanetin kaynak deposu tanımlı değil");
      const kalan = await emanetKalanKg(tx, g.emanetId);
      if (g.kg > kalan) throw new Error(`Emanette yeterli kg yok (kalan: ${kalan} kg)`);
      const depoStok = await depoEmanetStogu(tx, emanet.depoId);
      if (depoStok < g.kg) throw new Error(`Kaynak depoda yeterli emanet stok yok (mevcut: ${depoStok} kg)`);
      await tx.emanetHareket.create({
        data: { emanetId: g.emanetId, tip: "IADE", kg: g.kg },
      });

      // kg borcu azalır
      await tx.cariHareket.create({
        data: {
          cariId: emanet.cariId,
          yon: "ALACAK",
          bakiyeTuru: "FINDIK_KG",
          tutar: g.kg,
          kaynakTipi: "EMANET_BOZMA",
          kaynakId: g.emanetId,
          sezonId: emanet.sezonId,
          aciklama: g.aciklama ?? `Emanet iade (${g.kg} kg)`,
        },
      });

      // Stoktan EMANET düş
      await tx.stokHareket.create({
        data: {
          depoId: emanet.depoId,
          tip: "MULKIYET_DONUSUM",
          kg: -g.kg,
          mulkiyet: "EMANET",
          sezonId: emanet.sezonId,
          kaynakTipi: "EMANET_BOZMA",
          kaynakId: g.emanetId,
        },
      });

      const yeniKalan = kalan - g.kg;
      await tx.emanet.update({
        where: { id: g.emanetId },
        data: { durum: yeniKalan <= 0.0005 ? "KAPANDI" : "KISMI_BOZULDU" },
      });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "EMANET", eylem: "GUNCELLE", hedefTipi: "Emanet", hedefId: g.emanetId, sonrakiVeri: { tip: "IADE", kg: g.kg } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/emanet");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("iadeEmanet", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.includes("yeterli") || mesaj.includes("kaynak deposu") ? mesaj : "İade sırasında hata oluştu" };
  }
}
