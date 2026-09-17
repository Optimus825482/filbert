"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";

type CariTurGirdi = "URETICI" | "TUCCAR" | "FABRIKA";
export type CariGirdi = {
  ad: string;
  tur: CariTurGirdi;
  tckn?: string;
  vergiNo?: string;
  telefon?: string;
  bolge?: string;
  notAlani?: string;
  favori?: boolean;
};

type Sonuc = { ok: boolean; hata?: string; cariId?: string };
const GECERLI_TURLER = new Set<CariTurGirdi>(["URETICI", "TUCCAR", "FABRIKA"]);

function metin(value: string | undefined, limit: number): string | null {
  const temiz = value?.trim().replace(/\s+/g, " ");
  return temiz ? temiz.slice(0, limit) : null;
}

function dogrula(girdi: CariGirdi): string | null {
  const ad = metin(girdi.ad, 120);
  const tckn = metin(girdi.tckn, 11);
  const vergiNo = metin(girdi.vergiNo, 10);
  if (!ad || ad.length < 2) return "Cari adı en az iki karakter olmalı";
  if (!GECERLI_TURLER.has(girdi.tur)) return "Geçersiz cari türü";
  if (tckn && !/^\d{11}$/.test(tckn)) return "TCKN 11 haneli olmalı";
  if (vergiNo && !/^\d{10}$/.test(vergiNo)) return "Vergi numarası 10 haneli olmalı";
  if (girdi.telefon && !metin(girdi.telefon, 30)) return "Telefon bilgisi geçersiz";
  if (girdi.bolge && !metin(girdi.bolge, 100)) return "Bölge bilgisi geçersiz";
  if (girdi.notAlani && !metin(girdi.notAlani, 1000)) return "Not en fazla 1000 karakter olabilir";
  return null;
}

function veri(girdi: CariGirdi) {
  return {
    ad: metin(girdi.ad, 120)!,
    tur: girdi.tur,
    tckn: metin(girdi.tckn, 11),
    vergiNo: metin(girdi.vergiNo, 10),
    telefon: metin(girdi.telefon, 30),
    bolge: metin(girdi.bolge, 100),
    notAlani: metin(girdi.notAlani, 1000),
    favori: Boolean(girdi.favori),
  };
}

function snapshot(kayit: { ad: string; tur: CariTurGirdi; tckn: string | null; vergiNo: string | null; telefon: string | null; bolge: string | null; notAlani: string | null; favori: boolean; aktif: boolean }) {
  return { ad: kayit.ad, tur: kayit.tur, tckn: kayit.tckn, vergiNo: kayit.vergiNo, telefon: kayit.telefon, bolge: kayit.bolge, notAlani: kayit.notAlani, favori: kayit.favori, aktif: kayit.aktif };
}

function yenile(cariId?: string) {
  revalidatePath("/cari");
  revalidatePath("/cari/hesaplar");
  revalidatePath("/");
  if (cariId) revalidatePath(`/cari/${cariId}`);
}

export async function cariOlustur(girdi: CariGirdi): Promise<Sonuc> {
  const hata = dogrula(girdi);
  if (hata) return { ok: false, hata };
  try {
    const actor = await requirePermission("CARI", "OLUSTUR");
    const kayit = await prisma.$transaction(async (tx) => {
      const cari = await tx.cariKart.create({ data: { firmaId: actor.firmaId, ...veri(girdi) } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "CARI", eylem: "OLUSTUR", hedefTipi: "CariKart", hedefId: cari.id, sonrakiVeri: snapshot(cari), aciklama: "Cari kart oluşturuldu" } });
      return cari;
    });
    yenile(kayit.id);
    return { ok: true, cariId: kayit.id };
  } catch (error) {
    console.error("cariOlustur", error);
    return { ok: false, hata: "Cari kart kaydedilemedi" };
  }
}

export async function cariGuncelle(id: string, girdi: CariGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Cari seçilmedi" };
  const hata = dogrula(girdi);
  if (hata) return { ok: false, hata };
  try {
    const actor = await requirePermission("CARI", "GUNCELLE");
    const sonuc = await prisma.$transaction(async (tx) => {
      const onceki = await tx.cariKart.findFirst({ where: { id, firmaId: actor.firmaId } });
      if (!onceki) return null;
      const sonraki = veri(girdi);
      const cari = await tx.cariKart.update({ where: { id: onceki.id }, data: sonraki });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "CARI", eylem: "GUNCELLE", hedefTipi: "CariKart", hedefId: cari.id, oncekiVeri: snapshot(onceki), sonrakiVeri: snapshot(cari), aciklama: "Cari kart bilgileri güncellendi" } });
      return cari;
    });
    if (!sonuc) return { ok: false, hata: "Cari kart bulunamadı" };
    yenile(sonuc.id);
    return { ok: true, cariId: sonuc.id };
  } catch (error) {
    console.error("cariGuncelle", error);
    return { ok: false, hata: "Cari kart güncellenemedi" };
  }
}

export async function cariAktifliginiDegistir(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Cari seçilmedi" };
  try {
    const actor = await requirePermission("CARI", "GUNCELLE");
    const sonuc = await prisma.$transaction(async (tx) => {
      const onceki = await tx.cariKart.findFirst({ where: { id, firmaId: actor.firmaId } });
      if (!onceki) return null;
      const cari = await tx.cariKart.update({ where: { id: onceki.id }, data: { aktif: !onceki.aktif } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "CARI", eylem: "GUNCELLE", hedefTipi: "CariKart", hedefId: cari.id, oncekiVeri: snapshot(onceki), sonrakiVeri: snapshot(cari), aciklama: cari.aktif ? "Cari kart aktifleştirildi" : "Cari kart pasifleştirildi" } });
      return cari;
    });
    if (!sonuc) return { ok: false, hata: "Cari kart bulunamadı" };
    yenile(sonuc.id);
    return { ok: true, cariId: sonuc.id };
  } catch (error) {
    console.error("cariAktifliginiDegistir", error);
    return { ok: false, hata: "Cari kart durumu değiştirilemedi" };
  }
}
