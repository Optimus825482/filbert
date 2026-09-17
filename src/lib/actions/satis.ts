"use server";

// Bağımsız tüccar satışı — net kg + manuel birim fiyat.
// Fabrika satışı sevkiyat muhasebeleştirmesiyle oluşur (bkz. sevkiyat.ts).
import { prisma } from "@/lib/db";
import { fisNoUret, tutarHesapla } from "@/lib/hesap";
import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { KG_MAKS, BIRIM_FIYAT_MAKS, gecerliSayi } from "@/lib/dogrulama";

export interface SatisGirdi {
  cariId: string;
  cins: "GIRESUN" | "LEVANT" | "ORDU" | "DIGER";
  kg: number;
  birimFiyat: number;
  depoId: string;
  aciklama?: string;
  durum?: "TASLAK" | "ONAYLI";
}

const GECERLI_CINSLER = new Set(["GIRESUN", "LEVANT", "ORDU", "DIGER"]);

async function depoKendiStogu(tx: Prisma.TransactionClient, depoId: string) {
  const sonuc = await tx.stokHareket.aggregate({
    where: { depoId, mulkiyet: "KENDI" },
    _sum: { kg: true },
  });
  return Number(sonuc._sum.kg ?? 0);
}

export async function createSatis(g: SatisGirdi): Promise<{ ok: boolean; hata?: string; fisId?: string; fisNo?: string }> {
  const actor = await requirePermission("SATIS", "OLUSTUR");
  if (g.durum === "ONAYLI" && !izinVar(actor, "SATIS", "ONAYLA")) return { ok: false, hata: "Onaylı satış oluşturma yetkiniz yok" };
  if (!g.cariId) return { ok: false, hata: "Müşteri seçilmedi" };
  if (!g.depoId) return { ok: false, hata: "Satış için depo seçilmedi" };
  if (!GECERLI_CINSLER.has(g.cins)) return { ok: false, hata: "Geçersiz ürün cinsi" };
  if (!gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Geçerli kg girilmeli" };
  if (!gecerliSayi(g.birimFiyat, 0.0001, BIRIM_FIYAT_MAKS)) return { ok: false, hata: "Geçerli birim fiyat girilmeli" };

  const firma = await getCurrentFirma();
  const cari = await prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: firma.id, aktif: true } });
  if (!cari) return { ok: false, hata: "Müşteri bulunamadı" };

  const durum = g.durum ?? "TASLAK";
  const sezon = await prisma.sezon.findFirst({ where: { firmaId: firma.id, aktif: true } });
  const tutar = tutarHesapla(g.kg, g.birimFiyat);

  for (let deneme = 0; deneme < 3; deneme += 1) {
    try {
      const satis = await prisma.$transaction(async (tx) => {
        const yil = new Date().getFullYear();
        const sayac = await tx.satis.count({ where: { firmaId: firma.id } });
        const fisNo = fisNoUret("STY", yil, sayac + 1);

        const depo = await tx.depo.findFirst({ where: { id: g.depoId, firmaId: firma.id, aktif: true } });
        if (!depo) throw new Error("Seçilen depo bulunamadı veya pasif");

        if (durum === "ONAYLI") {
          const mevcutKg = await depoKendiStogu(tx, depo.id);
          if (mevcutKg < g.kg) {
            throw new Error(`Yetersiz stok (depo: ${mevcutKg.toFixed(1)} kg, gerekli: ${g.kg.toFixed(1)} kg)`);
          }
        }

        const yeni = await tx.satis.create({
          data: {
            firmaId: firma.id,
            cariId: g.cariId,
            fisNo,
            tarih: new Date(),
            cins: g.cins,
            kg: g.kg,
            birimFiyat: g.birimFiyat,
            tutar,
            durum,
            aciklama: g.aciklama ?? null,
          },
        });

        await tx.satisKalem.create({
          data: {
            satisId: yeni.id,
            depoId: depo.id,
            kg: g.kg,
            birimFiyat: g.birimFiyat,
            tutar,
          },
        });

        if (durum === "ONAYLI") {
          await tx.cariHareket.create({
            data: {
              cariId: g.cariId,
              yon: "ALACAK",
              bakiyeTuru: "TL",
              tutar,
              kaynakTipi: "SATIS",
              kaynakId: yeni.id,
              sezonId: sezon?.id,
              aciklama: `${fisNo} satış fişi`,
            },
          });

          await tx.stokHareket.create({
            data: {
              depoId: depo.id,
              tip: "SATIS_CIKIS",
              kg: -g.kg,
              mulkiyet: "KENDI",
              sezonId: sezon?.id,
              kaynakTipi: "SATIS",
              kaynakId: yeni.id,
            },
          });
        }
        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SATIS", eylem: "OLUSTUR", hedefTipi: "Satis", hedefId: yeni.id, sonrakiVeri: { fisNo, cariId: g.cariId, kg: g.kg, tutar, durum }, aciklama: "Satış fişi oluşturuldu." } });

        return yeni;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      revalidatePath("/");
      revalidatePath("/satis");
      revalidatePath("/cari");
      revalidatePath("/stok");
      return { ok: true, fisId: satis.id, fisNo: satis.fisNo! };
    } catch (e) {
      const yenidenDene = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2002");
      if (yenidenDene && deneme < 2) continue;

      console.error("createSatis", e);
      const mesaj = e instanceof Error ? e.message : "";
      return { ok: false, hata: mesaj.startsWith("Yetersiz stok") || mesaj.includes("depo") ? mesaj : "Kayıt sırasında hata oluştu" };
    }
  }

  return { ok: false, hata: "Kayıt sırasında hata oluştu" };
}

// ── Satış onaylama (TASLAK → ONAYLI) ──

export async function onaylaSatis(satisId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("SATIS", "ONAYLA");
  const firma = await getCurrentFirma();
  const satis = await prisma.satis.findFirst({
    where: { id: satisId, firmaId: firma.id },
    include: { kalemler: true },
  });
  if (!satis) return { ok: false, hata: "Satış bulunamadı" };
  if (satis.durum !== "TASLAK") return { ok: false, hata: `Satış durumu "${satis.durum}" — sadece TASLAK onaylanabilir` };
  // Sevkiyat kaynaklı satışlar zaten onaylı oluşturulur; bağımsız satış onayı burada.
  if (satis.sevkiyatId) return { ok: false, hata: "Bu satış bir sevkiyat muhasebeleştirmesidir; sevkiyat üzerinden yönetilir" };

  const firmaId = satis.firmaId;
  const sezon = await prisma.sezon.findFirst({ where: { firmaId, aktif: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const kalemler = await tx.satisKalem.findMany({ where: { satisId } });
      if (kalemler.length === 0 || kalemler.some((kalem) => !kalem.depoId)) {
        throw new Error("Satış kaleminde depo tanımlı değil");
      }
      for (const kalem of kalemler) {
        const depo = await tx.depo.findFirst({ where: { id: kalem.depoId!, firmaId, aktif: true } });
        if (!depo) throw new Error("Satış kalemindeki depo bulunamadı veya pasif");
        const mevcutKg = await depoKendiStogu(tx, depo.id);
        if (mevcutKg < Number(kalem.kg)) {
          throw new Error(`Yetersiz stok (depo: ${mevcutKg.toFixed(1)} kg, gerekli: ${Number(kalem.kg).toFixed(1)} kg)`);
        }
      }

      const sahiplenme = await tx.satis.updateMany({ where: { id: satisId, durum: "TASLAK" }, data: { durum: "ONAYLI" } });
      if (sahiplenme.count !== 1) throw new Error("Satış başka bir işlem tarafından onaylandı veya değiştirildi");

      await tx.cariHareket.create({
        data: {
          cariId: satis.cariId,
          yon: "ALACAK",
          bakiyeTuru: "TL",
          tutar: satis.tutar,
          kaynakTipi: "SATIS",
          kaynakId: satis.id,
          sezonId: sezon?.id,
          aciklama: `${satis.fisNo} satış fişi`,
        },
      });

      for (const kalem of kalemler) {
        await tx.stokHareket.create({
          data: {
            depoId: kalem.depoId!,
            tip: "SATIS_CIKIS",
            kg: -Number(kalem.kg),
            mulkiyet: "KENDI",
            sezonId: sezon?.id,
            kaynakTipi: "SATIS",
            kaynakId: satis.id,
          },
        });
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SATIS", eylem: "ONAYLA", hedefTipi: "Satis", hedefId: satisId, oncekiVeri: { durum: satis.durum }, sonrakiVeri: { durum: "ONAYLI" }, aciklama: "Satış onaylandı ve stok/cari hareketleri oluşturuldu." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/satis");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("onaylaSatis", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.startsWith("Yetersiz stok") || mesaj.includes("depo") || mesaj.startsWith("Satış başka") ? mesaj : "Onaylama sırasında hata oluştu" };
  }
}

// ── Satış iptal ──

export async function iptalEtSatis(satisId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("SATIS", "IPTAL");
  const firma = await getCurrentFirma();
  const satis = await prisma.satis.findFirst({
    where: { id: satisId, firmaId: firma.id },
    include: { kalemler: true },
  });
  if (!satis) return { ok: false, hata: "Satış bulunamadı" };

  if (satis.durum === "IPTAL") return { ok: false, hata: "Satış zaten iptal edilmiş" };
  if (satis.sevkiyatId) return { ok: false, hata: "Bu satış bir sevkiyat muhasebeleştirmesidir; satış iptali sevkiyat akışında yönetilir" };

  const firmaId = satis.firmaId;
  const sezon = await prisma.sezon.findFirst({ where: { firmaId, aktif: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const sahiplenme = await tx.satis.updateMany({ where: { id: satisId, durum: satis.durum }, data: { durum: "IPTAL" } });
      if (sahiplenme.count !== 1) throw new Error("Satış başka bir işlem tarafından değiştirildi");

      // Cari hareketi tersine çevir
      if (satis.durum === "ONAYLI") {
        await tx.cariHareket.create({
          data: {
            cariId: satis.cariId,
            yon: "BORC", // ALACAK'ın tersi
            bakiyeTuru: "TL",
            tutar: satis.tutar,
            kaynakTipi: "SATIS",
            kaynakId: satis.id,
            sezonId: sezon?.id,
            aciklama: `${satis.fisNo} satış iptal`,
          },
        });

        // Stok iadesi, çıkışın yapıldığı kayıtlı depoya döner.
        for (const kalem of satis.kalemler) {
          if (!kalem.depoId) throw new Error("Satış kaleminde depo tanımlı değil");
          await tx.stokHareket.create({
            data: {
              depoId: kalem.depoId,
              tip: "DUZELTME",
              kg: Number(kalem.kg), // pozitif = stok iadesi
              mulkiyet: "KENDI",
              sezonId: sezon?.id,
              kaynakTipi: "SATIS",
              kaynakId: satis.id,
            },
          });
        }
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SATIS", eylem: "IPTAL", hedefTipi: "Satis", hedefId: satisId, oncekiVeri: { durum: satis.durum }, sonrakiVeri: { durum: "IPTAL" }, aciklama: "Satış silinmedi; iptal ve karşı hareketler kaydedildi." } });
    });

    revalidatePath("/");
    revalidatePath("/satis");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("iptalEtSatis", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.startsWith("Satış başka") ? mesaj : "İptal sırasında hata oluştu" };
  }
}
