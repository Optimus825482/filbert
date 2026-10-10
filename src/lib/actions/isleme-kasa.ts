"use server";

/**
 * Fındık İşleme Modülü'nün kendi kasa yönetimi.
 *
 * İşleme kasası, alım modülünün kasa hesaplarından ayrıdır (`KasaHesap.modul =
 * ISLEME`). Alım modülünün kasa ekranı bu hesapları yalnızca görüntüler; ekleme,
 * düzenleme ve hareket kaydı buradan yapılır.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { Prisma, type BakiyeTuru, type HesapTip } from "@/generated/prisma/client";
import { TUTAR_MAKS, gecerliSayi } from "@/lib/dogrulama";

type Sonuc = { ok: boolean; hata?: string };

const BAKIYE_TURLERI = ["TL", "USD", "EUR", "XAU"] as const;
const HESAP_TIPLERI = ["KASA", "BANKA"] as const;
const HAREKET_TIPLERI = ["TAHSILAT", "ODEME"] as const;

export interface IslemeKasaGirdi {
  ad: string;
  tip: "KASA" | "BANKA";
  bakiyeTuru: string;
  bankaAdi?: string;
  iban?: string;
}

export interface IslemeKasaHareketGirdi {
  hesapId: string;
  tip: "TAHSILAT" | "ODEME";
  tutar: number;
  aciklama?: string;
}

function metin(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function girdiDogrula(g: IslemeKasaGirdi): string | null {
  if (!g.ad?.trim()) return "Kasa adı girilmedi";
  if (!HESAP_TIPLERI.includes(g.tip)) return "Geçersiz hesap tipi";
  if (!BAKIYE_TURLERI.includes(g.bakiyeTuru as (typeof BAKIYE_TURLERI)[number])) return "Geçersiz bakiye türü";
  if (g.tip === "BANKA" && !g.bankaAdi?.trim()) return "Banka adı girilmedi";
  return null;
}

function yenile(yollar: string[]) {
  for (const yol of yollar) revalidatePath(yol);
}

export async function islemeKasasiOlustur(g: IslemeKasaGirdi): Promise<Sonuc> {
  const hataMesaj = girdiDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };
  try {
    const actor = await requirePermission("HIZMET", "OLUSTUR");
    const hesap = await prisma.kasaHesap.create({
      data: {
        firmaId: actor.firmaId,
        ad: g.ad.trim(),
        tip: g.tip as HesapTip,
        bakiyeTuru: g.bakiyeTuru as BakiyeTuru,
        modul: "ISLEME",
        bankaAdi: g.tip === "BANKA" ? metin(g.bankaAdi) : null,
        iban: g.tip === "BANKA" ? metin(g.iban) : null,
      },
    });
    await prisma.auditKaydi.create({
      data: {
        firmaId: actor.firmaId,
        kullaniciId: actor.id,
        modul: "HIZMET",
        eylem: "OLUSTUR",
        hedefTipi: "KasaHesap",
        hedefId: hesap.id,
        sonrakiVeri: { ad: hesap.ad, tip: hesap.tip, bakiyeTuru: hesap.bakiyeTuru, modul: hesap.modul },
        aciklama: "İşleme kasası tanımlandı.",
      },
    });
    yenile(["/hizmet/kasa", "/kasa", "/hizmet/ayarlar"]);
    return { ok: true };
  } catch (e) {
    console.error("islemeKasasiOlustur", e);
    return { ok: false, hata: "İşleme kasası kaydedilemedi" };
  }
}

export async function islemeKasasiGuncelle(id: string, g: IslemeKasaGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kasa seçilmedi" };
  const hataMesaj = girdiDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };
  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const onceki = await prisma.kasaHesap.findFirst({ where: { id, firmaId: actor.firmaId, modul: "ISLEME" } });
    if (!onceki) return { ok: false, hata: "İşleme kasası bulunamadı" };
    const sonraki = {
      ad: g.ad.trim(),
      tip: g.tip as HesapTip,
      bakiyeTuru: g.bakiyeTuru as BakiyeTuru,
      bankaAdi: g.tip === "BANKA" ? metin(g.bankaAdi) : null,
      iban: g.tip === "BANKA" ? metin(g.iban) : null,
    };
    await prisma.$transaction(async (tx) => {
      await tx.kasaHesap.update({ where: { id }, data: sonraki });
      await tx.auditKaydi.create({
        data: {
          firmaId: actor.firmaId,
          kullaniciId: actor.id,
          modul: "HIZMET",
          eylem: "GUNCELLE",
          hedefTipi: "KasaHesap",
          hedefId: id,
          oncekiVeri: { ad: onceki.ad, tip: onceki.tip, bakiyeTuru: onceki.bakiyeTuru, bankaAdi: onceki.bankaAdi, iban: onceki.iban, aktif: onceki.aktif },
          sonrakiVeri: sonraki,
          aciklama: "İşleme kasası güncellendi.",
        },
      });
    });
    yenile(["/hizmet/kasa", "/kasa", "/hizmet/ayarlar"]);
    return { ok: true };
  } catch (e) {
    console.error("islemeKasasiGuncelle", e);
    return { ok: false, hata: "İşleme kasası güncellenemedi" };
  }
}

export async function islemeKasasiAktifToggle(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kasa seçilmedi" };
  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const hesap = await prisma.kasaHesap.findFirst({ where: { id, firmaId: actor.firmaId, modul: "ISLEME" } });
    if (!hesap) return { ok: false, hata: "İşleme kasası bulunamadı" };
    await prisma.$transaction(async (tx) => {
      await tx.kasaHesap.update({ where: { id }, data: { aktif: !hesap.aktif } });
      await tx.auditKaydi.create({
        data: {
          firmaId: actor.firmaId,
          kullaniciId: actor.id,
          modul: "HIZMET",
          eylem: "GUNCELLE",
          hedefTipi: "KasaHesap",
          hedefId: id,
          oncekiVeri: { aktif: hesap.aktif },
          sonrakiVeri: { aktif: !hesap.aktif },
          aciklama: "İşleme kasası durumu değiştirildi.",
        },
      });
    });
    yenile(["/hizmet/kasa", "/kasa", "/hizmet/ayarlar"]);
    return { ok: true };
  } catch (e) {
    console.error("islemeKasasiAktifToggle", e);
    return { ok: false, hata: "Kasa durumu değiştirilemedi" };
  }
}

/**
 * Kasaya tahsilat veya ödeme hareketi yazar. Tutar hesabın para biriminde
 * saklanır; cari bağlantısı kurulmaz (kasa içi hareket).
 */
export async function islemeKasaHareketiKaydet(g: IslemeKasaHareketGirdi): Promise<Sonuc> {
  if (!g.hesapId) return { ok: false, hata: "Kasa seçilmedi" };
  if (!HAREKET_TIPLERI.includes(g.tip)) return { ok: false, hata: "Geçersiz hareket tipi" };
  if (!gecerliSayi(g.tutar, 0.001, TUTAR_MAKS)) return { ok: false, hata: "Geçerli bir tutar girilmeli" };
  try {
    const actor = await requirePermission("HIZMET", "OLUSTUR");
    const hesap = await prisma.kasaHesap.findFirst({ where: { id: g.hesapId, firmaId: actor.firmaId, modul: "ISLEME" } });
    if (!hesap) return { ok: false, hata: "İşleme kasası bulunamadı" };
    if (!hesap.aktif) return { ok: false, hata: "Pasif kasaya hareket işlenemez" };
    await prisma.$transaction(async (tx) => {
      const hareket = await tx.finansHareket.create({
        data: {
          tip: g.tip,
          firmaId: actor.firmaId,
          hesapId: hesap.id,
          bakiyeTuru: hesap.bakiyeTuru,
          tutar: g.tutar,
          aciklama: metin(g.aciklama) ?? (g.tip === "TAHSILAT" ? "İşleme kasası tahsilatı" : "İşleme kasası ödemesi"),
        },
      });
      await tx.auditKaydi.create({
        data: {
          firmaId: actor.firmaId,
          kullaniciId: actor.id,
          modul: "HIZMET",
          eylem: "OLUSTUR",
          hedefTipi: "FinansHareket",
          hedefId: hareket.id,
          sonrakiVeri: { tip: g.tip, hesapId: hesap.id, bakiyeTuru: hesap.bakiyeTuru, tutar: g.tutar, aciklama: metin(g.aciklama) },
          aciklama: "İşleme kasası hareketi; ters kayıtla düzeltilebilir.",
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    yenile(["/hizmet/kasa", "/kasa", "/finans", "/hizmet"]);
    return { ok: true };
  } catch (e) {
    console.error("islemeKasaHareketiKaydet", e);
    return { ok: false, hata: "Kasa hareketi kaydedilemedi" };
  }
}