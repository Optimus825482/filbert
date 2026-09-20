"use server";

import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { smsGonder } from "@/lib/sms/sms-servisi";
import type { SmsSaglayici } from "@/lib/sms/types";

type Sonuc = { ok: boolean; hata?: string };

function yenile() {
  revalidatePath("/ayarlar");
  revalidatePath("/hizmet");
  revalidatePath("/hizmet/yeni");
}

// ─── HİZMET TİPİ TANIMLARI ──────────────────────────────────

export interface HizmetTipiGirdi {
  ad: string;
  kirma?: boolean;
  kavurma?: boolean;
  paketleme?: boolean;
  varsayilanBirimFiyat: number;
  sira?: number;
}

export async function createHizmetTipi(g: HizmetTipiGirdi): Promise<Sonuc & { id?: string }> {
  if (!g.ad?.trim()) return { ok: false, hata: "Hizmet adı girilmedi" };
  if (g.varsayilanBirimFiyat < 0) return { ok: false, hata: "Birim fiyat negatif olamaz" };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const tip = await prisma.hizmetTipi.create({
      data: {
        firmaId: actor.firmaId,
        ad: g.ad.trim(),
        kirma: Boolean(g.kirma),
        kavurma: Boolean(g.kavurma),
        paketleme: Boolean(g.paketleme),
        varsayilanBirimFiyat: g.varsayilanBirimFiyat,
        sira: g.sira ?? 0,
        aktif: true,
      },
    });

    await prisma.auditKaydi.create({
      data: {
        firmaId: actor.firmaId,
        kullaniciId: actor.id,
        modul: "TANIMLAR",
        eylem: "OLUSTUR",
        hedefTipi: "HizmetTipi",
        hedefId: tip.id,
        sonrakiVeri: { ad: tip.ad, fiyat: String(tip.varsayilanBirimFiyat) },
      },
    });

    yenile();
    return { ok: true, id: tip.id };
  } catch (e) {
    console.error("createHizmetTipi", e);
    return { ok: false, hata: "Hizmet tipi kaydedilemedi (aynı isimde kayıt olabilir)" };
  }
}

export async function updateHizmetTipi(id: string, g: HizmetTipiGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };
  if (!g.ad?.trim()) return { ok: false, hata: "Hizmet adı girilmedi" };
  if (g.varsayilanBirimFiyat < 0) return { ok: false, hata: "Birim fiyat negatif olamaz" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const onceki = await prisma.hizmetTipi.findFirst({
      where: { id, firmaId: actor.firmaId },
    });
    if (!onceki) return { ok: false, hata: "Hizmet tipi bulunamadı" };

    const sonraki = {
      ad: g.ad.trim(),
      kirma: Boolean(g.kirma),
      kavurma: Boolean(g.kavurma),
      paketleme: Boolean(g.paketleme),
      varsayilanBirimFiyat: g.varsayilanBirimFiyat,
      sira: g.sira ?? onceki.sira,
    };

    await prisma.$transaction(async (tx) => {
      await tx.hizmetTipi.update({ where: { id }, data: sonraki });
      await tx.auditKaydi.create({
        data: {
          firmaId: actor.firmaId,
          kullaniciId: actor.id,
          modul: "TANIMLAR",
          eylem: "GUNCELLE",
          hedefTipi: "HizmetTipi",
          hedefId: id,
          oncekiVeri: { ad: onceki.ad, fiyat: String(onceki.varsayilanBirimFiyat) },
          sonrakiVeri: { ad: sonraki.ad, fiyat: String(sonraki.varsayilanBirimFiyat) },
        },
      });
    });

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updateHizmetTipi", e);
    return { ok: false, hata: "Hizmet tipi güncellenemedi" };
  }
}

export async function toggleHizmetTipiAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const tip = await prisma.hizmetTipi.findFirst({
      where: { id, firmaId: actor.firmaId },
    });
    if (!tip) return { ok: false, hata: "Hizmet tipi bulunamadı" };

    await prisma.hizmetTipi.update({
      where: { id },
      data: { aktif: !tip.aktif },
    });

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("toggleHizmetTipiAktif", e);
    return { ok: false, hata: "Hizmet tipi durumu değiştirilemedi" };
  }
}

// ─── SMS AYARLARI ───────────────────────────────────────────

export interface SmsAyariGirdi {
  aktif: boolean;
  saglayici: SmsSaglayici;
  apiUrl?: string;
  kullaniciAdi?: string;
  sifre?: string;
  baslik?: string;
  kayitSablonu: string;
  tamamlandiSablonu: string;
  otomatikGirisSms: boolean;
}

export async function updateSmsAyarlari(g: SmsAyariGirdi): Promise<Sonuc> {
  try {
    const actor = await requirePermission("AYARLAR", "GUNCELLE");
    const firmaId = actor.firmaId;

    await prisma.smsAyari.upsert({
      where: { firmaId },
      create: {
        firmaId,
        aktif: g.aktif,
        saglayici: g.saglayici,
        apiUrl: g.apiUrl?.trim() || null,
        kullaniciAdi: g.kullaniciAdi?.trim() || null,
        sifre: g.sifre?.trim() || null,
        baslik: g.baslik?.trim() || null,
        kayitSablonu: g.kayitSablonu.trim(),
        tamamlandiSablonu: g.tamamlandiSablonu.trim(),
        otomatikGirisSms: g.otomatikGirisSms,
      },
      update: {
        aktif: g.aktif,
        saglayici: g.saglayici,
        apiUrl: g.apiUrl?.trim() || null,
        kullaniciAdi: g.kullaniciAdi?.trim() || null,
        sifre: g.sifre?.trim() || null,
        baslik: g.baslik?.trim() || null,
        kayitSablonu: g.kayitSablonu.trim(),
        tamamlandiSablonu: g.tamamlandiSablonu.trim(),
        otomatikGirisSms: g.otomatikGirisSms,
      },
    });

    await prisma.auditKaydi.create({
      data: {
        firmaId,
        kullaniciId: actor.id,
        modul: "AYARLAR",
        eylem: "GUNCELLE",
        hedefTipi: "SmsAyari",
        hedefId: firmaId,
        sonrakiVeri: { saglayici: g.saglayici, aktif: g.aktif },
      },
    });

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updateSmsAyarlari", e);
    return { ok: false, hata: "SMS ayarları kaydedilemedi" };
  }
}

export async function testSmsGonder(aliciTelefon: string): Promise<Sonuc & { mesajId?: string }> {
  if (!aliciTelefon?.trim()) return { ok: false, hata: "Telefon numarası girilmedi" };

  try {
    const actor = await requirePermission("AYARLAR", "GORUNTULE");
    const firma = await getCurrentFirma();

    const sonuc = await smsGonder(
      actor.firmaId,
      aliciTelefon.trim(),
      `Filbert SMS Entegrasyon Testi: SMS ayarlarınız başarıyla yapılandırılmıştır. (${firma.unvan})`
    );

    if (sonuc.basarili) {
      return { ok: true, mesajId: sonuc.mesajId };
    }
    return { ok: false, hata: sonuc.hata || "SMS gönderilemedi" };
  } catch (e) {
    console.error("testSmsGonder", e);
    return { ok: false, hata: "Test SMS gönderilirken hata oluştu" };
  }
}
