"use server";

/**
 * Doğrudan ESC/POS etiket baskısı sunucu aksiyonları.
 *
 * Baskı, Next sunucusunun çalıştığı makineden yapılır; yani yazıcının bağlı
 * olduğu bilgisayarda `pnpm start`/`next dev` çalışıyor olmalıdır.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { tarihSaat } from "@/lib/format";
import {
  etiketProfiliGecerliMi,
  findikIslemeAyarlariniCoz,
  yaziciHedefTanimi,
  yaziciYapilandirildiMi,
  type EtiketProfili,
} from "@/lib/findik-isleme";
import { escposGonder, windowsYazicilariniListele } from "@/lib/yazici/gonder";
import {
  hizmetEtiketiOlustur,
  testEtiketiVerisi,
  type EtiketVerisi,
} from "@/lib/yazici/escpos";

type Sonuc<T = Record<string, unknown>> =
  | ({ ok: true; hata?: never } & T)
  | { ok: false; hata: string; [key: string]: unknown };

const EN_FAZLA_KOPYA = 10;

/** Windows'a kurulu yazıcı kuyruklarını listeler (ayarlar ekranı için). */
export async function yazicilariListele(): Promise<Sonuc<{ adlar: string[] }>> {
  try {
    await requirePermission("HIZMET", "GORUNTULE");
    const sonuc = await windowsYazicilariniListele();
    if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
    return { ok: true, adlar: sonuc.adlar };
  } catch (e) {
    console.error("yazicilariListele", e);
    return { ok: false, hata: (e as Error).message || "Yazıcı listesi okunamadı" };
  }
}

function kayittanEtiketVerisi(
  kayit: {
    siraNo: string;
    musteriAdi: string;
    telefon: string;
    kilo: unknown;
    kirma: boolean;
    kavurma: boolean;
    paketleme: boolean;
    paketTipi: string | null;
    paketAdedi: number | null;
    odemeDurumu: string;
    toplamTutar: unknown;
    notlar: string | null;
    createdAt: Date;
  },
  firmaAdi: string
): EtiketVerisi {
  return {
    firmaAdi,
    siraNo: kayit.siraNo,
    musteriAdi: kayit.musteriAdi,
    telefon: kayit.telefon,
    kilo: Number(kayit.kilo).toFixed(2),
    islemler: { kirma: kayit.kirma, kavurma: kayit.kavurma, paketleme: kayit.paketleme },
    paketTipi: kayit.paketTipi,
    paketAdedi: kayit.paketAdedi,
    odemeDurumu: kayit.odemeDurumu,
    toplamTutar: Number(kayit.toplamTutar).toFixed(2),
    tarihSaatStr: tarihSaat(kayit.createdAt),
    notlar: kayit.notlar,
  };
}

/**
 * Talebin etiketini doğrudan yazıcıya gönderir. Kopya sayısı en fazla 10'dur;
 * her kopya ayrı bir baskı işi olarak gönderilir.
 */
export async function hizmetEtiketiYazdir(
  hizmetId: string,
  kopyaSayisi = 1
): Promise<Sonuc<{ hedef: string; kopyaSayisi: number }>> {
  if (!hizmetId) return { ok: false, hata: "Talep seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id: hizmetId, firmaId: actor.firmaId },
    });
    if (!kayit) return { ok: false, hata: "Talep kaydı bulunamadı" };

    const firma = await getCurrentFirma();
    const ayarlar = findikIslemeAyarlariniCoz(firma.ayarlar);
    if (!yaziciYapilandirildiMi(ayarlar.yazici)) {
      return {
        ok: false,
        hata: "Doğrudan yazıcı hedefi tanımlı değil. Ayarlar → Fındık İşleme bölümünden yazıcı seçin.",
      };
    }

    const profil: EtiketProfili = etiketProfiliGecerliMi(kayit.etiketProfili)
      ? kayit.etiketProfili
      : ayarlar.etiketProfili;

    const adet = Math.min(EN_FAZLA_KOPYA, Math.max(1, Math.trunc(kopyaSayisi) || 1));
    const veri = kayittanEtiketVerisi(kayit, firma.unvan);

    for (let kopya = 1; kopya <= adet; kopya++) {
      const bayt = hizmetEtiketiOlustur(veri, profil, ayarlar.yazici.kodSayfasi);
      const sonuc = await escposGonder(ayarlar.yazici, bayt);
      if (!sonuc.ok) {
        return {
          ok: false,
          hata: adet > 1 ? `${kopya}. kopya gönderilemedi: ${sonuc.hata}` : sonuc.hata,
        };
      }
    }

    await prisma.hizmetIslemi.update({
      where: { id: kayit.id },
      data: { etiketBasildiSayisi: { increment: adet } },
    });

    revalidatePath(`/hizmet/${kayit.id}/etiket`);
    revalidatePath("/hizmet");
    return { ok: true, hedef: yaziciHedefTanimi(ayarlar.yazici), kopyaSayisi: adet };
  } catch (e) {
    console.error("hizmetEtiketiYazdir", e);
    return { ok: false, hata: (e as Error).message || "Etiket yazdırılamadı" };
  }
}

/**
 * Tarayıcı üzerinden (Bluetooth) yapılan baskı tamamlandıktan sonra etiket
 * sayacını artırır. Baskı istemcide gerçekleştiği için sunucu yalnızca kaydı
 * günceller; bayt üretimi veya yazıcı erişimi yapılmaz.
 */
export async function etiketBaskisiKaydet(
  hizmetId: string,
  kopyaSayisi = 1
): Promise<Sonuc<{ etiketBasildiSayisi: number }>> {
  if (!hizmetId) return { ok: false, hata: "Talep seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const kayit = await prisma.hizmetIslemi.findFirst({
      where: { id: hizmetId, firmaId: actor.firmaId },
      select: { id: true },
    });
    if (!kayit) return { ok: false, hata: "Talep kaydı bulunamadı" };

    const adet = Math.min(EN_FAZLA_KOPYA, Math.max(1, Math.trunc(kopyaSayisi) || 1));
    const guncel = await prisma.hizmetIslemi.update({
      where: { id: kayit.id },
      data: { etiketBasildiSayisi: { increment: adet } },
      select: { etiketBasildiSayisi: true },
    });

    revalidatePath(`/hizmet/${kayit.id}/etiket`);
    revalidatePath("/hizmet");
    return { ok: true, etiketBasildiSayisi: guncel.etiketBasildiSayisi };
  } catch (e) {
    console.error("etiketBaskisiKaydet", e);
    return { ok: false, hata: (e as Error).message || "Etiket sayacı güncellenemedi" };
  }
}

/** Ayarlar ekranından örnek etiket basar (yazıcı kurulumunu doğrulamak için). */
export async function yaziciTestEtiketiYazdir(): Promise<Sonuc<{ hedef: string }>> {
  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const firma = await getCurrentFirma();
    const ayarlar = findikIslemeAyarlariniCoz(firma.ayarlar);
    if (!yaziciYapilandirildiMi(ayarlar.yazici)) {
      return { ok: false, hata: "Önce yazıcı hedefini seçip ayarları kaydedin." };
    }
    void actor;

    const bayt = hizmetEtiketiOlustur(
      testEtiketiVerisi(firma.unvan),
      ayarlar.etiketProfili,
      ayarlar.yazici.kodSayfasi
    );
    const sonuc = await escposGonder(ayarlar.yazici, bayt);
    if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
    return { ok: true, hedef: yaziciHedefTanimi(ayarlar.yazici) };
  } catch (e) {
    console.error("yaziciTestEtiketiYazdir", e);
    return { ok: false, hata: (e as Error).message || "Test etiketi yazdırılamadı" };
  }
}
