"use server";

import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { hizmetSiraNoUret, tutarHesapla } from "@/lib/hesap";
import { getFirmaSmsAyarlari, sablonDoldur, smsGonder } from "@/lib/sms/sms-servisi";
import type { HizmetDurumu } from "@/generated/prisma/client";

export interface HizmetKaydiGirdi {
  musteriAdi: string;
  telefon: string;
  kilo: number;
  kirma?: boolean;
  kavurma?: boolean;
  paketleme?: boolean;
  paketTipi?: string;
  paketAdedi?: number;
  cariId?: string;
  hizmetTipiId?: string;
  birimFiyatManuel?: number;
  toplamTutarManuel?: number;
  notlar?: string;
  smsGonderilsin?: boolean;
}

type Sonuc<T = Record<string, unknown>> =
  | ({ ok: true; hata?: never } & T)
  | { ok: false; hata: string; [key: string]: unknown };

function yenile() {
  revalidatePath("/hizmet");
  revalidatePath("/hizmet/yeni");
  revalidatePath("/finans");
  revalidatePath("/");
}

function islemleriFormatla(kirma?: boolean, kavurma?: boolean, paketleme?: boolean): string {
  const islemler: string[] = [];
  if (kirma) islemler.push("Kırma");
  if (kavurma) islemler.push("Kavurma");
  if (paketleme) islemler.push("Vakumlu Paketleme");
  return islemler.length > 0 ? islemler.join(" + ") : "Hizmet";
}

// ─── YENİ HİZMET KAYDI OLUŞTURMA ───────────────────────────

export async function createHizmetKaydi(
  g: HizmetKaydiGirdi
): Promise<Sonuc<{ id?: string; siraNo?: string; smsGitti?: boolean }>> {
  if (!g.musteriAdi?.trim()) return { ok: false, hata: "Müşteri adı soyadı girilmedi" };
  if (!g.telefon?.trim()) return { ok: false, hata: "Müşteri telefon numarası girilmedi" };
  if (!g.kilo || g.kilo <= 0) return { ok: false, hata: "Geçerli bir kilo girilmeli (0'dan büyük olmalı)" };

  const kirma = Boolean(g.kirma);
  const kavurma = Boolean(g.kavurma);
  const paketleme = Boolean(g.paketleme);

  if (!kirma && !kavurma && !paketleme) {
    return { ok: false, hata: "En az bir hizmet (Kırma, Kavurma veya Paketleme) seçilmelidir" };
  }

  try {
    const actor = await requirePermission("HIZMET", "OLUSTUR");
    const firma = await getCurrentFirma();

    // Hizmet tipi veya birim fiyat belirleme
    let birimFiyat = Number(g.birimFiyatManuel ?? 0);
    let hizmetTipiAdi = islemleriFormatla(kirma, kavurma, paketleme);

    if (g.hizmetTipiId) {
      const seciliTip = await prisma.hizmetTipi.findFirst({
        where: { id: g.hizmetTipiId, firmaId: firma.id, aktif: true },
      });
      if (seciliTip) {
        hizmetTipiAdi = seciliTip.ad;
        if (g.birimFiyatManuel === undefined || g.birimFiyatManuel === null) {
          birimFiyat = Number(seciliTip.varsayilanBirimFiyat);
        }
      }
    }

    const toplamTutar =
      g.toplamTutarManuel !== undefined && g.toplamTutarManuel !== null
        ? Number(g.toplamTutarManuel)
        : tutarHesapla(g.kilo, birimFiyat);

    // Atomik Sıra Numarası Üretimi (0001 ile başlayan 4 rakamlı sıra numarası)
    const kayit = await prisma.$transaction(async (tx) => {
      // HizmetSiraSayaci kaydını atomik olarak arttır
      const sayac = await tx.hizmetSiraSayaci.upsert({
        where: { firmaId: firma.id },
        create: { firmaId: firma.id, sonSira: 1 },
        update: { sonSira: { increment: 1 } },
      });

      const siraSayisi = sayac.sonSira;
      const siraNo = hizmetSiraNoUret(siraSayisi);

      const yeni = await tx.hizmetIslemi.create({
        data: {
          firmaId: firma.id,
          siraNo,
          siraSayisi,
          musteriAdi: g.musteriAdi.trim(),
          telefon: g.telefon.trim(),
          kilo: g.kilo,
          kirma,
          kavurma,
          paketleme,
          paketTipi: g.paketTipi?.trim() || null,
          paketAdedi: g.paketAdedi && g.paketAdedi > 0 ? Number(g.paketAdedi) : null,
          cariId: g.cariId?.trim() || null,
          hizmetTipiId: g.hizmetTipiId ?? null,
          hizmetTipiAdi,
          birimFiyat,
          toplamTutar,
          notlar: g.notlar?.trim() || null,
          durum: "SIRAYA_ALINDI",
          olusturanKullaniciId: actor.id,
        },
      });

      return yeni;
    });

    // Kayıt SMS gönderimi (Otomatik veya seçili ise)
    let smsGitti = false;
    const smsAyari = await getFirmaSmsAyarlari(firma.id);
    const smsGonderimIstendi = g.smsGonderilsin ?? smsAyari.otomatikGirisSms;

    if (smsGonderimIstendi && (smsAyari.aktif || smsAyari.saglayici === "TEST")) {
      try {
        const mesajMetni = sablonDoldur(smsAyari.kayitSablonu, {
          musteri_adi: kayit.musteriAdi,
          telefon: kayit.telefon,
          sira_no: kayit.siraNo,
          kilo: String(kayit.kilo),
          hizmetler: hizmetTipiAdi,
          tutar: String(kayit.toplamTutar),
          firma_adi: firma.unvan,
        });

        const sonuc = await smsGonder(firma.id, kayit.telefon, mesajMetni);
        if (sonuc.basarili) {
          smsGitti = true;
          await prisma.hizmetIslemi.update({
            where: { id: kayit.id },
            data: { girisSmsGonderildi: true },
          });
        }
      } catch (smsErr) {
        console.error("Giriş SMS hatası:", smsErr);
      }
    }

    yenile();
    return {
      ok: true,
      id: kayit.id,
      siraNo: kayit.siraNo,
      smsGitti,
    };
  } catch (e) {
    console.error("createHizmetKaydi", e);
    return { ok: false, hata: "Hizmet kaydı oluşturulamadı" };
  }
}

// ─── DURUM GÜNCELLEME ──────────────────────────────────────

export async function updateHizmetDurumu(
  id: string,
  yeniDurum: HizmetDurumu,
  smsGonderilsinMi: boolean = false
): Promise<Sonuc<{ smsGitti?: boolean }>> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id, firmaId: actor.firmaId },
    });
    if (!kayit) return { ok: false, hata: "İşlem kaydı bulunamadı" };

    const updateData: Record<string, unknown> = { durum: yeniDurum };
    const now = new Date();

    if (yeniDurum === "HAZIRLANIYOR" && !kayit.hazirlaniyorAt) {
      updateData.hazirlaniyorAt = now;
    } else if (yeniDurum === "TAMAMLANDI" && !kayit.tamamlandiAt) {
      updateData.tamamlandiAt = now;
    } else if (yeniDurum === "TESLIM_EDILDI" && !kayit.teslimAt) {
      updateData.teslimAt = now;
    }

    let smsGitti = false;

    // Tamamlandı durumuna geçişte SMS gönderimi
    if (yeniDurum === "TAMAMLANDI" && smsGonderilsinMi) {
      const firma = await getCurrentFirma();
      const smsAyari = await getFirmaSmsAyarlari(actor.firmaId);

      const mesaj = sablonDoldur(smsAyari.tamamlandiSablonu, {
        musteri_adi: kayit.musteriAdi,
        telefon: kayit.telefon,
        sira_no: kayit.siraNo,
        kilo: String(kayit.kilo),
        hizmetler: kayit.hizmetTipiAdi || islemleriFormatla(kayit.kirma, kayit.kavurma, kayit.paketleme),
        tutar: String(kayit.toplamTutar),
        firma_adi: firma.unvan,
      });

      const smsSonuc = await smsGonder(actor.firmaId, kayit.telefon, mesaj);
      if (smsSonuc.basarili) {
        smsGitti = true;
        updateData.tamamlandiSmsGonderildi = true;
      }
    }

    await prisma.hizmetIslemi.update({
      where: { id },
      data: updateData,
    });

    yenile();
    return { ok: true, smsGitti };
  } catch (e) {
    console.error("updateHizmetDurumu", e);
    return { ok: false, hata: "Durum güncellenemedi" };
  }
}

// ─── TOPLU DURUM GÜNCELLEME ────────────────────────────────

export async function topluHizmetDurumuGuncelle(
  ids: string[],
  yeniDurum: HizmetDurumu,
  smsGonderilsinMi: boolean = false
): Promise<Sonuc<{ guncellenenAdet: number; smsGonderilenAdet: number }>> {
  if (!ids || ids.length === 0) return { ok: false, hata: "Hiçbir kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayitlar = await prisma.hizmetIslemi.findMany({
      where: { id: { in: ids }, firmaId: actor.firmaId },
    });

    if (kayitlar.length === 0) return { ok: false, hata: "Seçili kayıtlar bulunamadı" };

    const now = new Date();
    const updateData: Record<string, unknown> = { durum: yeniDurum };
    if (yeniDurum === "HAZIRLANIYOR") updateData.hazirlaniyorAt = now;
    if (yeniDurum === "TAMAMLANDI") updateData.tamamlandiAt = now;
    if (yeniDurum === "TESLIM_EDILDI") updateData.teslimAt = now;

    await prisma.hizmetIslemi.updateMany({
      where: { id: { in: ids }, firmaId: actor.firmaId },
      data: updateData,
    });

    let smsGonderilenAdet = 0;
    if (yeniDurum === "TAMAMLANDI" && smsGonderilsinMi) {
      const firma = await getCurrentFirma();
      const smsAyari = await getFirmaSmsAyarlari(actor.firmaId);

      for (const k of kayitlar) {
        try {
          const mesaj = sablonDoldur(smsAyari.tamamlandiSablonu, {
            musteri_adi: k.musteriAdi,
            telefon: k.telefon,
            sira_no: k.siraNo,
            kilo: String(k.kilo),
            hizmetler: k.hizmetTipiAdi || islemleriFormatla(k.kirma, k.kavurma, k.paketleme),
            tutar: String(k.toplamTutar),
            firma_adi: firma.unvan,
          });
          const res = await smsGonder(actor.firmaId, k.telefon, mesaj);
          if (res.basarili) {
            smsGonderilenAdet += 1;
            await prisma.hizmetIslemi.update({
              where: { id: k.id },
              data: { tamamlandiSmsGonderildi: true },
            });
          }
        } catch (err) {
          console.error("Toplu SMS hata:", err);
        }
      }
    }

    yenile();
    return { ok: true, guncellenenAdet: kayitlar.length, smsGonderilenAdet };
  } catch (e) {
    console.error("topluHizmetDurumuGuncelle", e);
    return { ok: false, hata: "Toplu işlem gerçekleştirilemedi" };
  }
}

// ─── TOPLU SMS GÖNDERİMİ (HAZIRLANANLAR İÇİN) ─────────────────

export async function topluSmsGonder(
  ids: string[]
): Promise<Sonuc<{ basariliAdet: number; hataliAdet: number }>> {
  if (!ids || ids.length === 0) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayitlar = await prisma.hizmetIslemi.findMany({
      where: { id: { in: ids }, firmaId: actor.firmaId },
    });

    const firma = await getCurrentFirma();
    const smsAyari = await getFirmaSmsAyarlari(actor.firmaId);

    let basariliAdet = 0;
    let hataliAdet = 0;

    for (const k of kayitlar) {
      try {
        const mesaj = sablonDoldur(smsAyari.tamamlandiSablonu, {
          musteri_adi: k.musteriAdi,
          telefon: k.telefon,
          sira_no: k.siraNo,
          kilo: String(k.kilo),
          hizmetler: k.hizmetTipiAdi || islemleriFormatla(k.kirma, k.kavurma, k.paketleme),
          tutar: String(k.toplamTutar),
          firma_adi: firma.unvan,
        });

        const sonuc = await smsGonder(actor.firmaId, k.telefon, mesaj);
        if (sonuc.basarili) {
          basariliAdet += 1;
          await prisma.hizmetIslemi.update({
            where: { id: k.id },
            data: { tamamlandiSmsGonderildi: true },
          });
        } else {
          hataliAdet += 1;
        }
      } catch {
        hataliAdet += 1;
      }
    }

    yenile();
    return { ok: true, basariliAdet, hataliAdet };
  } catch (e) {
    console.error("topluSmsGonder", e);
    return { ok: false, hata: "Toplu SMS gönderimi sırasında hata oluştu" };
  }
}

// ─── ETİKET YAZDIRILDI SAYACI ──────────────────────────────

export async function etiketYazdirildi(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };
  try {
    await prisma.hizmetIslemi.update({
      where: { id },
      data: { etiketBasildiSayisi: { increment: 1 } },
    });
    return { ok: true };
  } catch {
    return { ok: false, hata: "Yazdırma sayacı güncellenemedi" };
  }
}

// ─── TEKİL SMS TEKRAR GÖNDERME ─────────────────────────────

export async function hizmetSmsTekrarGonder(
  id: string,
  tip: "KAYIT" | "TAMAMLANDI"
): Promise<Sonuc<{ mesajId?: string }>> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id, firmaId: actor.firmaId },
    });
    if (!kayit) return { ok: false, hata: "Kayıt bulunamadı" };

    const firma = await getCurrentFirma();
    const smsAyari = await getFirmaSmsAyarlari(actor.firmaId);
    const sablon = tip === "KAYIT" ? smsAyari.kayitSablonu : smsAyari.tamamlandiSablonu;

    const mesaj = sablonDoldur(sablon, {
      musteri_adi: kayit.musteriAdi,
      telefon: kayit.telefon,
      sira_no: kayit.siraNo,
      kilo: String(kayit.kilo),
      hizmetler: kayit.hizmetTipiAdi || islemleriFormatla(kayit.kirma, kayit.kavurma, kayit.paketleme),
      tutar: String(kayit.toplamTutar),
      firma_adi: firma.unvan,
    });

    const sonuc = await smsGonder(actor.firmaId, kayit.telefon, mesaj);
    if (!sonuc.basarili) {
      return { ok: false, hata: sonuc.hata || "SMS gönderilemedi" };
    }

    if (tip === "KAYIT") {
      await prisma.hizmetIslemi.update({
        where: { id },
        data: { girisSmsGonderildi: true },
      });
    } else {
      await prisma.hizmetIslemi.update({
        where: { id },
        data: { tamamlandiSmsGonderildi: true },
      });
    }

    yenile();
    return { ok: true, mesajId: sonuc.mesajId };
  } catch (e) {
    console.error("hizmetSmsTekrarGonder", e);
    return { ok: false, hata: "SMS gönderilemedi" };
  }
}

// ─── KAYIT İPTALİ ──────────────────────────────────────────

export async function iptalHizmetKaydi(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "IPTAL");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id, firmaId: actor.firmaId },
    });
    if (!kayit) return { ok: false, hata: "Kayıt bulunamadı" };
    if (kayit.durum === "IPTAL") return { ok: false, hata: "Kayıt zaten iptal edilmiş" };

    await prisma.hizmetIslemi.update({
      where: { id },
      data: { durum: "IPTAL" },
    });

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("iptalHizmetKaydi", e);
    return { ok: false, hata: "İşlem iptal edilemedi" };
  }
}

// ─── TAHSİLAT & KASA HAREKETİ ─────────────────────────────

export interface HizmetTahsilatGirdi {
  hizmetId: string;
  odemeYontemi: "NAKIT" | "POS" | "HAVALE" | "VERESIYE";
  kasaHesapId?: string;
  tutar?: number;
  aciklama?: string;
  teslimEt?: boolean;
}

export async function hizmetTahsilatKaydet(g: HizmetTahsilatGirdi): Promise<Sonuc> {
  if (!g.hizmetId) return { ok: false, hata: "Hizmet seçilmedi" };
  if (!g.odemeYontemi) return { ok: false, hata: "Ödeme yöntemi seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id: g.hizmetId, firmaId: actor.firmaId },
    });
    if (!kayit) return { ok: false, hata: "Hizmet kaydı bulunamadı" };

    const tahsilTutar = g.tutar && g.tutar > 0 ? g.tutar : Number(kayit.toplamTutar);

    if (g.odemeYontemi !== "VERESIYE") {
      if (!g.kasaHesapId) {
        return { ok: false, hata: "Tahsilat için bir Kasa veya Banka hesabı seçmelisiniz" };
      }
      const kasa = await prisma.kasaHesap.findFirst({
        where: { id: g.kasaHesapId, firmaId: actor.firmaId, aktif: true },
      });
      if (!kasa) return { ok: false, hata: "Seçilen kasa/hesap bulunamadı" };

      await prisma.$transaction(async (tx) => {
        // Finans Hareketi oluştur (Gelir / Tahsilat)
        const finans = await tx.finansHareket.create({
          data: {
            tip: "TAHSILAT",
            firmaId: actor.firmaId,
            cariId: kayit.cariId ?? null,
            hesapId: g.kasaHesapId!,
            bakiyeTuru: "TL",
            tutar: tahsilTutar,
            iliskiliTipi: "HIZMET",
            iliskiliId: kayit.id,
            durum: "ONAYLI",
            aciklama:
              g.aciklama?.trim() ||
              `#${kayit.siraNo} Fındık Hizmet Bedeli (${kayit.musteriAdi})`,
          },
        });

        // Hizmet kaydını güncelle
        await tx.hizmetIslemi.update({
          where: { id: kayit.id },
          data: {
            odemeDurumu: "ODENDI",
            odemeYontemi: g.odemeYontemi,
            kasaHesapId: g.kasaHesapId,
            finansHareketId: finans.id,
            tahsilatAt: new Date(),
            tahsilEdilenTutar: tahsilTutar,
            ...(g.teslimEt ? { durum: "TESLIM_EDILDI", teslimAt: new Date() } : {}),
          },
        });
      });
    } else {
      // Veresiye / Açık Hesap
      await prisma.hizmetIslemi.update({
        where: { id: kayit.id },
        data: {
          odemeDurumu: "VERESIYE",
          odemeYontemi: "VERESIYE",
          ...(g.teslimEt ? { durum: "TESLIM_EDILDI", teslimAt: new Date() } : {}),
        },
      });
    }

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("hizmetTahsilatKaydet", e);
    return { ok: false, hata: "Tahsilat kaydedilemedi" };
  }
}

// ─── HİZMET FORMU & MODAL SEÇENEKLERİ (CARİ & KASA LİSTESİ) ───

export async function getHizmetFormSecenekleri() {
  try {
    const firma = await getCurrentFirma();
    const [cariler, kasalar] = await Promise.all([
      prisma.cariKart.findMany({
        where: { firmaId: firma.id, aktif: true },
        select: { id: true, ad: true, telefon: true, tur: true },
        orderBy: { ad: "asc" },
        take: 300,
      }),
      prisma.kasaHesap.findMany({
        where: { firmaId: firma.id, aktif: true },
        select: { id: true, ad: true, tip: true },
        orderBy: { ad: "asc" },
      }),
    ]);

    return {
      cariler: cariler.map((c) => ({
        id: c.id,
        ad: c.ad,
        telefon: c.telefon || "",
        tur: c.tur,
      })),
      kasalar: kasalar.map((k) => ({
        id: k.id,
        ad: k.ad,
        tip: k.tip,
      })),
    };
  } catch {
    return { cariler: [], kasalar: [] };
  }
}
