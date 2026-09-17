"use server";

// Sevkiyat — fındığın fabrikaya sevk edilmesi:
//   Oluşturma: fabrika + kg + randıman + kaynak depo → stok çıkışı + FABRIKA_EMANET
//   Muhasebeleştir: manuel fiyat → Satis kaydı + fabrika cari TL alacak + SATILDI
//   İptal: stok iadesi + IPTAL
import { prisma } from "@/lib/db";
import { fisNoUret, tutarHesapla } from "@/lib/hesap";
import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { KG_MAKS, RANDIMAN_MAKS, gecerliSayi } from "@/lib/dogrulama";

const GECERLI_CINSLER = new Set(["GIRESUN", "LEVANT", "ORDU", "DIGER"]);

export interface SevkiyatGirdi {
  cariId: string; // fabrika
  aracId?: string;
  plaka: string;
  sofor: string;
  depoId: string; // hangi depodan alındı
  cins: "GIRESUN" | "LEVANT" | "ORDU" | "DIGER";
  kg: number;
  randimanPuan?: number; // fabrika tarafından ölçülen randıman
  aciklama?: string;
}

export async function createSevkiyat(
  g: SevkiyatGirdi
): Promise<{ ok: boolean; hata?: string; sevkiyatId?: string; fisNo?: string }> {
  const actor = await requirePermission("SEVKIYAT", "OLUSTUR");
  let aracId: string | null = null;
  let plakaSnap = (g.plaka ?? "").trim();
  let soforSnap = (g.sofor ?? "").trim();

  if (g.aracId) {
    const arac = await prisma.arac.findFirst({ where: { id: g.aracId, firmaId: actor.firmaId, aktif: true } });
    if (!arac) return { ok: false, hata: "Seçilen araç bulunamadı" };
    aracId = arac.id;
    plakaSnap = arac.plaka;
    soforSnap = arac.sofor?.trim() || soforSnap;
  }

  if (!g.cariId) return { ok: false, hata: "Fabrika seçilmedi" };
  if (!plakaSnap) return { ok: false, hata: "Plaka girilmedi" };
  if (!soforSnap) return { ok: false, hata: "Şoför adı girilmedi" };
  if (!g.depoId) return { ok: false, hata: "Sevk edilecek depo seçilmedi" };
  if (!GECERLI_CINSLER.has(g.cins)) return { ok: false, hata: "Geçersiz ürün cinsi" };
  if (!gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Geçerli kg girilmeli" };
  if (g.randimanPuan !== undefined && g.randimanPuan !== null && !gecerliSayi(g.randimanPuan, 0.01, RANDIMAN_MAKS)) {
    return { ok: false, hata: "Randıman 0-100 arasında bir rakam olmalı" };
  }

  const firma = await getCurrentFirma();
  const [cari, depo] = await Promise.all([
    prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: firma.id, aktif: true } }),
    prisma.depo.findFirst({ where: { id: g.depoId, firmaId: firma.id, aktif: true } }),
  ]);
  if (!cari) return { ok: false, hata: "Fabrika bulunamadı" };
  if (cari.tur !== "FABRIKA") return { ok: false, hata: "Sevkiyat yalnızca fabrika carisine yapılabilir" };
  if (!depo) return { ok: false, hata: "Seçilen depo bulunamadı veya pasif" };

  const sezon = await prisma.sezon.findFirst({ where: { firmaId: firma.id, aktif: true } });

  for (let deneme = 0; deneme < 3; deneme += 1) {
    try {
      const sevkiyat = await prisma.$transaction(async (tx) => {
        // Sevk anında kendi stoktan çıkış yapılır.
        const mevcutKg = await tx.stokHareket.aggregate({ where: { depoId: depo.id, mulkiyet: "KENDI" }, _sum: { kg: true } });
        if (Number(mevcutKg._sum.kg ?? 0) < g.kg) {
          throw new Error(`Depoda yeterli kendi stok yok (mevcut: ${Number(mevcutKg._sum.kg ?? 0)} kg)`);
        }

        const yil = new Date().getFullYear();
        const sayac = await tx.sevkiyat.count({ where: { firmaId: firma.id } });
        const fisNo = fisNoUret("SKY", yil, sayac + 1);

        const yeni = await tx.sevkiyat.create({
          data: {
            firmaId: firma.id,
            cariId: g.cariId,
            aracId,
            fisNo,
            tarih: new Date(),
            plaka: plakaSnap,
            sofor: soforSnap,
            durum: "FABRIKA_EMANET",
            aciklama: g.aciklama || null,
          },
        });

        await tx.sevkiyatKalem.create({
          data: {
            sevkiyatId: yeni.id,
            depoId: depo.id,
            cins: g.cins,
            kg: g.kg,
          },
        });

        await tx.stokHareket.create({
          data: {
            depoId: depo.id,
            tip: "SEVK_CIKIS",
            kg: -g.kg,
            mulkiyet: "KENDI",
            sezonId: sezon?.id,
            randimanPuan: g.randimanPuan ?? null,
            kaynakTipi: "SEVKIYAT",
            kaynakId: yeni.id,
          },
        });

        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SEVKIYAT", eylem: "OLUSTUR", hedefTipi: "Sevkiyat", hedefId: yeni.id, sonrakiVeri: { fisNo, cariId: g.cariId, depoId: depo.id, cins: g.cins, kg: g.kg, randimanPuan: g.randimanPuan ?? null, durum: "FABRIKA_EMANET" }, aciklama: "Fındık fabrikaya sevk edildi; fabrika emanet durumuna alındı." } });

        return yeni;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      revalidatePath("/");
      revalidatePath("/sevkiyat");
      revalidatePath("/stok");
      revalidatePath("/cari");
      return { ok: true, sevkiyatId: sevkiyat.id, fisNo: sevkiyat.fisNo ?? undefined };
    } catch (e) {
      const yenidenDene = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2002");
      if (yenidenDene && deneme < 2) continue;

      console.error("createSevkiyat", e);
      const mesaj = e instanceof Error ? e.message : "";
      return { ok: false, hata: mesaj.startsWith("Depoda yeterli") ? mesaj : "Kayıt sırasında hata oluştu" };
    }
  }

  return { ok: false, hata: "Kayıt sırasında hata oluştu" };
}

// ── Fabrika emanet muhasebeleştirme: manuel fiyatla satış tamamlanır ──

export async function muhasebelestirSevkiyat(
  sevkiyatId: string,
  birimFiyat: number
): Promise<{ ok: boolean; hata?: string; fisNo?: string; tutar?: number }> {
  const actor = await requirePermission("SEVKIYAT", "GUNCELLE");
  if (!sevkiyatId) return { ok: false, hata: "Sevkiyat ID gerekli" };
  if (!gecerliSayi(birimFiyat, 0.0001, 10_000_000)) return { ok: false, hata: "Geçerli birim fiyat girilmeli" };

  const firma = await getCurrentFirma();
  const sevkiyat = await prisma.sevkiyat.findFirst({
    where: { id: sevkiyatId, firmaId: firma.id },
    include: { kalemler: true, cari: true },
  });
  if (!sevkiyat) return { ok: false, hata: "Sevkiyat bulunamadı" };
  if (sevkiyat.durum !== "FABRIKA_EMANET") return { ok: false, hata: "Yalnız fabrika emanet durumundaki sevkiyatlar muhasebeleştirilebilir" };
  const kalem = sevkiyat.kalemler[0];
  if (!kalem) return { ok: false, hata: "Sevkiyat kalemi bulunamadı" };
  if (!sevkiyat.cari) return { ok: false, hata: "Sevkiyatın fabrika carisi bulunamadı" };

  const kg = Number(kalem.kg);
  const tutar = tutarHesapla(kg, birimFiyat);
  const sezon = await prisma.sezon.findFirst({ where: { firmaId: firma.id, aktif: true } });

  try {
    const sonuc = await prisma.$transaction(async (tx) => {
      // Koşullu güncelleme aynı muhasebeleştirmenin iki kez işlenmesini engeller.
      const sahiplenme = await tx.sevkiyat.updateMany({
        where: { id: sevkiyatId, firmaId: firma.id, durum: "FABRIKA_EMANET" },
        data: { durum: "SATILDI" },
      });
      if (sahiplenme.count !== 1) throw new Error("Sevkiyat başka bir işlem tarafından güncellendi");

      const yil = new Date().getFullYear();
      const sayac = await tx.satis.count({ where: { firmaId: firma.id } });
      const fisNo = fisNoUret("STY", yil, sayac + 1);

      const satis = await tx.satis.create({
        data: {
          firmaId: firma.id,
          cariId: sevkiyat.cariId!,
          fisNo,
          tarih: new Date(),
          cins: kalem.cins ?? "DIGER",
          kg,
          birimFiyat,
          tutar,
          durum: "ONAYLI",
          aciklama: `${sevkiyat.fisNo ?? sevkiyatId} sevkiyat muhasebeleştirme`,
          sevkiyatId: sevkiyat.id,
        },
      });

      await tx.satisKalem.create({
        data: { satisId: satis.id, depoId: kalem.depoId!, kg, birimFiyat, tutar },
      });

      // Fabrika cari hesabına TL alacak işlenir.
      await tx.cariHareket.create({
        data: {
          cariId: sevkiyat.cariId!,
          yon: "ALACAK",
          bakiyeTuru: "TL",
          tutar,
          kaynakTipi: "SATIS",
          kaynakId: satis.id,
          sezonId: sezon?.id,
          aciklama: `${fisNo} satış (sevk: ${sevkiyat.fisNo ?? "-"})`,
        },
      });

      await tx.auditKaydi.create({ data: { firmaId: firma.id, kullaniciId: actor.id, modul: "SEVKIYAT", eylem: "GUNCELLE", hedefTipi: "Sevkiyat", hedefId: sevkiyatId, oncekiVeri: { durum: "FABRIKA_EMANET" }, sonrakiVeri: { durum: "SATILDI", satisFisNo: fisNo, kg, birimFiyat, tutar }, aciklama: "Fabrika emaneti muhasebeleştirildi; satış fişi oluşturuldu." } });

      return { fisNo };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/sevkiyat");
    revalidatePath("/satis");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true, fisNo: sonuc.fisNo, tutar };
  } catch (e) {
    console.error("muhasebelestirSevkiyat", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.includes("başka bir işlem") ? mesaj : "Muhasebeleştirme sırasında hata oluştu" };
  }
}

// ── Sevkiyat iptal: stok iadesi ──

export async function iptalEtSevkiyat(sevkiyatId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("SEVKIYAT", "GUNCELLE");
  if (!izinVar(actor, "SEVKIYAT", "IPTAL")) return { ok: false, hata: "Sevkiyat iptal yetkiniz yok" };
  if (!sevkiyatId) return { ok: false, hata: "Sevkiyat ID gerekli" };

  const firmaId = (await getCurrentFirma()).id;
  const sevkiyat = await prisma.sevkiyat.findFirst({
    where: { id: sevkiyatId, firmaId },
    include: { kalemler: true },
  });
  if (!sevkiyat) return { ok: false, hata: "Sevkiyat bulunamadı" };
  if (sevkiyat.durum === "IPTAL") return { ok: false, hata: "Sevkiyat zaten iptal edilmiş" };
  if (sevkiyat.durum === "SATILDI") return { ok: false, hata: "Satılan sevkiyat iptal edilemez; önce satış fişini iptal edin" };

  const sezon = await prisma.sezon.findFirst({ where: { firmaId, aktif: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const sahiplenme = await tx.sevkiyat.updateMany({
        where: { id: sevkiyatId, firmaId, durum: "FABRIKA_EMANET" },
        data: { durum: "IPTAL" },
      });
      if (sahiplenme.count !== 1) throw new Error("Sevkiyat başka bir işlem tarafından güncellendi");

      for (const k of sevkiyat.kalemler) {
        await tx.stokHareket.create({
          data: {
            depoId: k.depoId!,
            tip: "DUZELTME",
            kg: Number(k.kg), // pozitif = stok iadesi
            mulkiyet: "KENDI",
            sezonId: sezon?.id,
            kaynakTipi: "SEVKIYAT",
            kaynakId: sevkiyatId,
          },
        });
      }
      await tx.auditKaydi.create({ data: { firmaId, kullaniciId: actor.id, modul: "SEVKIYAT", eylem: "IPTAL", hedefTipi: "Sevkiyat", hedefId: sevkiyatId, oncekiVeri: { durum: sevkiyat.durum }, sonrakiVeri: { durum: "IPTAL" }, aciklama: "Sevkiyat iptal edildi; stok kaynağı depoya iade edildi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/sevkiyat");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("iptalEtSevkiyat", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.includes("başka bir işlem") ? mesaj : "İptal sırasında hata oluştu" };
  }
}
