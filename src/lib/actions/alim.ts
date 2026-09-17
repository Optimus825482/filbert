"use server";

// Alım fişi: müstahsil + kg + (opsiyonel) randıman rakamı; emanet veya peşin.
// Emanet alımda fiyat yoktur — fiyat, cari karttan muhasebeleştirme (hesap gör)
// anında girilir. Peşin alımda manuel birim fiyat girilir.
import { prisma } from "@/lib/db";
import { fisNoUret, satinAlmaKoduUret, tutarHesapla } from "@/lib/hesap";
import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { KG_MAKS, RANDIMAN_MAKS, BIRIM_FIYAT_MAKS, gecerliSayi } from "@/lib/dogrulama";

const GECERLI_CINSLER = new Set(["GIRESUN", "LEVANT", "ORDU", "DIGER"]);
const GECERLI_MULKIYETLER = new Set(["KENDI", "EMANET"]);

export interface AlimGirdi {
  cariId: string;
  depoId: string;
  cins: "GIRESUN" | "LEVANT" | "ORDU" | "DIGER";
  kg: number;
  randimanPuan?: number;
  mulkiyet: "KENDI" | "EMANET";
  bolge?: string;
  // Yalnız peşin (KENDİ) alımda: manuel birim fiyat.
  birimFiyatManuel?: number;
  // avans mahsubu
  avansMahsupId?: string;
  avansMahsupTutar?: number;
  durum: "TASLAK" | "ONAYLI";
}

export async function createAlimFisi(g: AlimGirdi): Promise<{ ok: boolean; hata?: string; fisId?: string; fisNo?: string; satinAlmaKodu?: string }> {
  const actor = await requirePermission("ALIM", "OLUSTUR");
  if (g.durum === "ONAYLI" && !izinVar(actor, "ALIM", "ONAYLA")) return { ok: false, hata: "Onaylı alım oluşturma yetkiniz yok" };
  if (!g.cariId) return { ok: false, hata: "Müstahsil seçilmedi" };
  if (!g.depoId) return { ok: false, hata: "Alım için depo seçilmedi" };
  if (!GECERLI_CINSLER.has(g.cins)) return { ok: false, hata: "Geçersiz ürün cinsi" };
  if (!GECERLI_MULKIYETLER.has(g.mulkiyet)) return { ok: false, hata: "Geçersiz mülkiyet türü" };
  if (!gecerliSayi(g.kg, 0.001, KG_MAKS)) return { ok: false, hata: "Geçerli kg girilmeli" };
  if (g.randimanPuan !== undefined && g.randimanPuan !== null && !gecerliSayi(g.randimanPuan, 0.01, RANDIMAN_MAKS)) {
    return { ok: false, hata: "Randıman 0-100 arasında bir rakam olmalı" };
  }

  // Peşin alımda fiyat zorunlu; emanet alımda fiyat girilmez.
  let birimFiyat: number | null = null;
  let tutar: number | null = null;
  if (g.mulkiyet === "KENDI") {
    if (!gecerliSayi(g.birimFiyatManuel, 0.0001, BIRIM_FIYAT_MAKS)) return { ok: false, hata: "Peşin alım için birim fiyat girilmeli" };
    birimFiyat = g.birimFiyatManuel;
    tutar = tutarHesapla(g.kg, birimFiyat);
  }

  const firma = await getCurrentFirma();
  const [sezon, depo, cari] = await Promise.all([
    prisma.sezon.findFirst({ where: { firmaId: firma.id, aktif: true } }),
    prisma.depo.findFirst({ where: { id: g.depoId, firmaId: firma.id, aktif: true } }),
    prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: firma.id, aktif: true } }),
  ]);
  if (!depo) return { ok: false, hata: "Seçilen depo bulunamadı veya pasif" };
  if (!cari) return { ok: false, hata: "Müstahsil bulunamadı" };

  // ── Avans mahsup kontrolü ──
  if (g.avansMahsupId && g.avansMahsupTutar && g.avansMahsupTutar > 0) {
    const avans = await prisma.avans.findFirst({ where: { id: g.avansMahsupId, cariId: g.cariId, cari: { firmaId: firma.id } } });
    if (!avans || avans.durum !== "ACIK") return { ok: false, hata: "Avans bulunamadı, kapalı veya seçilen üreticiye ait değil" };
    if (g.avansMahsupTutar > Number(avans.kalanTl)) return { ok: false, hata: "Mahsup tutarı avans bakiyesinden büyük olamaz" };
    if (tutar !== null && g.avansMahsupTutar > tutar) return { ok: false, hata: "Mahsup tutarı fiş tutarından büyük olamaz" };
  }

  // Fiş numarası, satın alma kodu, sayım ve ekleme aynı seri işlemde yürür.
  for (let deneme = 0; deneme < 3; deneme += 1) {
    try {
      const fis = await prisma.$transaction(async (tx) => {
        const yil = new Date().getFullYear();
        const sayac = await tx.alimFisi.count({ where: { firmaId: firma.id } });
        const fisNo = fisNoUret("AKY", yil, sayac + 1);
        const satinAlmaKodu = satinAlmaKoduUret(sayac + 1);

        if (g.avansMahsupId && g.avansMahsupTutar && g.avansMahsupTutar > 0) {
          const avans = await tx.avans.findFirst({ where: { id: g.avansMahsupId, cariId: g.cariId, durum: "ACIK", cari: { firmaId: firma.id } } });
          if (!avans) throw new Error("Avans bulunamadı, kapalı veya seçilen üreticiye ait değil");
          if (g.avansMahsupTutar > Number(avans.kalanTl)) throw new Error("Mahsup tutarı avans bakiyesinden büyük olamaz");
        }

        const puan = g.randimanPuan ?? null;
        const yeni = await tx.alimFisi.create({
          data: {
            firmaId: firma.id,
            fisNo,
            satinAlmaKodu,
            cariId: g.cariId,
            depoId: depo.id,
            sezonId: sezon?.id,
            tarih: new Date(),
            cins: g.cins,
            kg: g.kg,
            randimanPuan: puan,
            randimanDurumu: puan !== null ? "TAMAM" : "BEKLIYOR",
            birimFiyat,
            tutar,
            bolge: g.bolge,
            mulkiyetKaynak: g.mulkiyet,
            durum: g.durum,
            // Taslakta seçilen avans mahsubu fişte hatırlanır; onaylandığında
            // uygulanır. Doğrudan onaylı oluşturulan fişte mahsup anında işlenir.
            avansMahsupId: g.avansMahsupId ?? null,
            avansMahsupTutar: g.avansMahsupTutar ?? null,
            // Onaylayan kimliği istemciden alınmaz.
            onaylayanId: g.durum === "ONAYLI" ? actor.id : undefined,
          },
        });

        if (g.durum === "ONAYLI") {
          await createOnayliHareketler(tx, yeni, { mulkiyet: g.mulkiyet, bolge: g.bolge, avansMahsupId: g.avansMahsupId, avansMahsupTutar: g.avansMahsupTutar }, sezon?.id, depo.id, puan, birimFiyat, tutar, g.kg);
        }
        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "ALIM", eylem: "OLUSTUR", hedefTipi: "AlimFisi", hedefId: yeni.id, sonrakiVeri: { fisNo, satinAlmaKodu, cariId: g.cariId, kg: g.kg, randimanPuan: puan, tutar, durum: g.durum, mulkiyet: g.mulkiyet }, aciklama: "Alım fişi oluşturuldu." } });

        return yeni;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      revalidatePath("/");
      revalidatePath("/alim");
      revalidatePath("/emanet");
      revalidatePath("/cari");
      return { ok: true, fisId: fis.id, fisNo: fis.fisNo, satinAlmaKodu: fis.satinAlmaKodu };
    } catch (e) {
      const yenidenDene = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2002");
      if (yenidenDene && deneme < 2) continue;

      console.error("createAlimFisi", e);
      return { ok: false, hata: "Kayıt sırasında hata oluştu" };
    }
  }

  return { ok: false, hata: "Kayıt sırasında hata oluştu" };
}

// ── ONAYLI hareketlerini oluşturan yardımcı (create + onayla'da ortak) ──
async function createOnayliHareketler(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  fis: { id: string; cariId: string; fisNo: string; mulkiyetKaynak: string },
  g: { mulkiyet: "KENDI" | "EMANET"; bolge?: string; avansMahsupId?: string; avansMahsupTutar?: number },
  sezonId: string | undefined,
  depoId: string,
  puan: number | null,
  birimFiyat: number | null,
  tutar: number | null,
  kg: number,
) {
  if (g.mulkiyet === "KENDI" && tutar !== null) {
    await tx.cariHareket.create({
      data: { cariId: fis.cariId, yon: "BORC", bakiyeTuru: "TL", tutar, kaynakTipi: "ALIM", kaynakId: fis.id, sezonId, aciklama: `${fis.fisNo} peşin alım` },
    });
  } else {
    const emanet = await tx.emanet.create({ data: { alimFisiId: fis.id, cariId: fis.cariId, depoId, sezonId, durum: "ACIK" } });
    await tx.emanetHareket.create({ data: { emanetId: emanet.id, tip: "GIRIS", kg } });
    await tx.cariHareket.create({
      data: { cariId: fis.cariId, yon: "BORC", bakiyeTuru: "FINDIK_KG", tutar: kg, kaynakTipi: "ALIM", kaynakId: fis.id, sezonId, aciklama: `${fis.fisNo} emanet alım` },
    });
  }
  await tx.stokHareket.create({
    data: { depoId, tip: "ALIM_GIRIS", kg, mulkiyet: g.mulkiyet, sezonId, bolge: g.bolge, randimanPuan: puan, maliyetBirimTl: g.mulkiyet === "KENDI" ? birimFiyat : null, kaynakTipi: "ALIM", kaynakId: fis.id },
  });
  if (g.avansMahsupId && g.avansMahsupTutar && g.avansMahsupTutar > 0) {
    await tx.avansMahsup.create({
      data: { avansId: g.avansMahsupId, hedefTipi: "ALIM", hedefId: fis.id, tutarTl: g.avansMahsupTutar },
    });
    const avans = await tx.avans.findFirst({ where: { id: g.avansMahsupId, cariId: fis.cariId, durum: "ACIK" } });
    if (!avans) throw new Error("Mahsup avansı bulunamadı veya üretici eşleşmiyor");
    const yeniKalan = Number(avans.kalanTl) - g.avansMahsupTutar;
    await tx.avans.update({
      where: { id: avans.id },
      data: { kalanTl: yeniKalan, durum: yeniKalan <= 0.005 ? "KAPANDI" : "ACIK" },
    });
  }
}

// ── Alım fişi onaylama (TASLAK → ONAYLI) ──

export async function onaylaAlimFisi(fisId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("ALIM", "ONAYLA");
  const firma = await getCurrentFirma();
  const fis = await prisma.alimFisi.findFirst({
    where: { id: fisId, cari: { firmaId: firma.id } },
  });
  if (!fis) return { ok: false, hata: "Fiş bulunamadı" };
  if (fis.durum !== "TASLAK") return { ok: false, hata: `Fiş durumu "${fis.durum}" — sadece TASLAK onaylanabilir` };
  if (fis.mulkiyetKaynak === "KENDI" && (fis.birimFiyat === null || fis.tutar === null)) {
    return { ok: false, hata: "Peşin alım fişinde birim fiyat eksik; fiş güvenli onaylanamaz" };
  }

  const [sezon, depo] = await Promise.all([
    prisma.sezon.findFirst({ where: { firmaId: firma.id, aktif: true } }),
    prisma.depo.findFirst({ where: { id: fis.depoId ?? "", firmaId: firma.id, aktif: true } }),
  ]);
  if (!depo) return { ok: false, hata: "Alım fişinin deposu bulunamadı veya pasif" };

  try {
    await prisma.$transaction(async (tx) => {
      const sahiplenme = await tx.alimFisi.updateMany({ where: { id: fisId, durum: "TASLAK" }, data: { durum: "ONAYLI" } });
      if (sahiplenme.count !== 1) throw new Error("Fiş başka bir işlem tarafından onaylandı veya değiştirildi");
      await createOnayliHareketler(
        tx,
        fis,
        {
          mulkiyet: fis.mulkiyetKaynak,
          // Taslak oluşturulurken seçilen avans mahsubu onay anında uygulanır.
          avansMahsupId: fis.avansMahsupId ?? undefined,
          avansMahsupTutar: fis.avansMahsupTutar ? Number(fis.avansMahsupTutar) : undefined,
        },
        sezon?.id,
        depo.id,
        fis.randimanPuan ? Number(fis.randimanPuan) : null,
        fis.birimFiyat !== null ? Number(fis.birimFiyat) : null,
        fis.tutar !== null ? Number(fis.tutar) : null,
        Number(fis.kg),
      );
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "ALIM", eylem: "ONAYLA", hedefTipi: "AlimFisi", hedefId: fisId, oncekiVeri: { durum: fis.durum }, sonrakiVeri: { durum: "ONAYLI" }, aciklama: "Alım fişi onaylandı ve bağlı hareketler oluşturuldu." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/alim");
    revalidatePath("/emanet");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("onaylaAlimFisi", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.startsWith("Fiş başka") ? mesaj : "Onaylama sırasında hata oluştu" };
  }
}

// ── Alım fişi iptal ──

export async function iptalEtAlimFisi(fisId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("ALIM", "IPTAL");
  const firma = await getCurrentFirma();
  const fis = await prisma.alimFisi.findFirst({ where: { id: fisId, cari: { firmaId: firma.id } } });
  if (!fis) return { ok: false, hata: "Fiş bulunamadı" };
  if (fis.durum === "IPTAL") return { ok: false, hata: "Fiş zaten iptal edilmiş" };

  if (!fis.depoId) return { ok: false, hata: "Alım fişinin depo bilgisi yok; güvenli iptal yapılamaz" };

  try {
    await prisma.$transaction(async (tx) => {
      const sahiplenme = await tx.alimFisi.updateMany({ where: { id: fisId, durum: fis.durum }, data: { durum: "IPTAL" } });
      if (sahiplenme.count !== 1) throw new Error("Fiş başka bir işlem tarafından değiştirildi");

      if (fis.durum === "ONAYLI") {
        const kg = Number(fis.kg);
        // Stok ters kaydı
        await tx.stokHareket.create({
          data: {
            depoId: fis.depoId!,
            tip: "DUZELTME",
            kg: -kg,
            mulkiyet: fis.mulkiyetKaynak,
            sezonId: fis.sezonId,
            kaynakTipi: "ALIM",
            kaynakId: fis.id,
          },
        });

        if (fis.mulkiyetKaynak === "KENDI") {
          await tx.cariHareket.create({
            data: {
              cariId: fis.cariId,
              yon: "ALACAK",
              bakiyeTuru: "TL",
              tutar: fis.tutar ?? 0,
              kaynakTipi: "ALIM",
              kaynakId: fis.id,
              sezonId: fis.sezonId,
              aciklama: `${fis.fisNo} alım iptal`,
            },
          });
        } else {
          await tx.cariHareket.create({
            data: {
              cariId: fis.cariId,
              yon: "ALACAK",
              bakiyeTuru: "FINDIK_KG",
              tutar: kg,
              kaynakTipi: "ALIM",
              kaynakId: fis.id,
              sezonId: fis.sezonId,
              aciklama: `${fis.fisNo} emanet alım iptal`,
            },
          });
          // Yalnız bu alım fişinin oluşturduğu emaneti kapat.
          const emanet = await tx.emanet.findUnique({ where: { alimFisiId: fis.id }, select: { id: true } });
          if (!emanet) throw new Error("Bu emanet alımı için kaynak emanet kaydı bulunamadı; güvenli iptal yapılamaz");
          const emanetHareketleri = await tx.emanetHareket.groupBy({
            by: ["tip"], where: { emanetId: emanet.id }, _sum: { kg: true },
          });
          const kalanKg = emanetHareketleri.reduce((toplam, hareket) => toplam + (hareket.tip === "GIRIS" ? 1 : -1) * Number(hareket._sum.kg ?? 0), 0);
          if (Math.abs(kalanKg - kg) > 0.0005) {
            throw new Error("Bu emanet alımı üzerinde sonraki işlem var; fiş iptali güvenli değil");
          }
          await tx.emanetHareket.create({
            data: { emanetId: emanet.id, tip: "IADE", kg },
          });
          await tx.emanet.update({ where: { id: emanet.id }, data: { durum: "KAPANDI" } });
        }
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "ALIM", eylem: "IPTAL", hedefTipi: "AlimFisi", hedefId: fisId, oncekiVeri: { durum: fis.durum }, sonrakiVeri: { durum: "IPTAL" }, aciklama: "Alım fişi silinmedi; iptal ve karşı hareketler kaydedildi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/alim");
    revalidatePath("/emanet");
    revalidatePath("/cari");
    revalidatePath("/stok");
    return { ok: true };
  } catch (e) {
    console.error("iptalEtAlimFisi", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj.startsWith("Fiş başka") || mesaj.includes("güvenli iptal") || mesaj.includes("sonraki işlem") ? mesaj : "İptal sırasında hata oluştu" };
  }
}

// ── Randıman girişi (yalnız puan rakamı; fiyat etkisi yoktur) ──

export async function randimanGir(fisId: string, puan: number): Promise<{ ok: boolean; hata?: string; puan?: number }> {
  const actor = await requirePermission("RANDIMAN", "GUNCELLE");
  if (!fisId) return { ok: false, hata: "Fiş ID gerekli" };
  if (!gecerliSayi(puan, 0.01, RANDIMAN_MAKS)) return { ok: false, hata: "Randıman 0-100 arasında bir rakam olmalı" };

  const fis = await prisma.alimFisi.findFirst({ where: { id: fisId, cari: { firmaId: actor.firmaId } } });
  if (!fis) return { ok: false, hata: "Fiş bulunamadı" };
  if (fis.durum === "IPTAL") return { ok: false, hata: "İptal edilmiş fişe randıman girilemez" };
  if (fis.randimanDurumu === "TAMAM" && fis.randimanPuan !== null) {
    return { ok: false, hata: "Bu fişin randımanı zaten girilmiş" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sahiplenme = await tx.alimFisi.updateMany({
        where: { id: fis.id, randimanDurumu: "BEKLIYOR" },
        data: { randimanPuan: puan, randimanDurumu: "TAMAM" },
      });
      if (sahiplenme.count !== 1) throw new Error("RANDIMAN_ZATEN_ISLENDI");

      // Stok hareketi varsa puanı oraya da yansıt.
      await tx.stokHareket.updateMany({
        where: { kaynakTipi: "ALIM", kaynakId: fis.id },
        data: { randimanPuan: puan },
      });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "RANDIMAN", eylem: "GUNCELLE", hedefTipi: "AlimFisi", hedefId: fis.id, oncekiVeri: { randimanDurumu: fis.randimanDurumu, randimanPuan: fis.randimanPuan ? Number(fis.randimanPuan) : null }, sonrakiVeri: { randimanDurumu: "TAMAM", randimanPuan: puan }, aciklama: "Randıman puanı girildi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/randiman");
    revalidatePath("/alim");
    revalidatePath("/cari");
    return { ok: true, puan };
  } catch (e) {
    console.error("randimanGir", e);
    const mesaj = e instanceof Error ? e.message : "";
    return { ok: false, hata: mesaj === "RANDIMAN_ZATEN_ISLENDI" ? "Bu fişin randımanı başka bir işlem tarafından zaten girildi" : "Randıman kaydı sırasında hata oluştu" };
  }
}
