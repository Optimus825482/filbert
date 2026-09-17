"use server";

// Tanımlar — depo, kasa/banka hesabı, kullanıcı, araç, personel, sezon, firma CRUD
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma, type HesapTip, type BakiyeTuru } from "@/generated/prisma/client";

type Sonuc = { ok: boolean; hata?: string };

// ─── Yardımcılar ────────────────────────────────────────────

async function firmaGetir() {
  return getCurrentFirma();
}

function yenile() {
  revalidatePath("/ayarlar");
  revalidatePath("/");
}

function mesajVer(e: unknown, varsayilan: string): string {
  if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
    return "Bu kayıt zaten mevcut (benzersiz alan çakışması)";
  }
  return e instanceof Error && e.message === "Firma bulunamadı" ? e.message : varsayilan;
}

const BAKIYE_TURLERI = ["TL", "USD", "EUR", "XAU"] as const;
const HESAP_TIPLERI = ["KASA", "BANKA"] as const;
const ARAC_TIPLERI = ["KAMYON", "TIR", "PIKAP", "MINIVAN"] as const;
const GOREVLER = ["SOFOR", "KANTAR", "HAMALI", "DEPOCI", "SAHA"] as const;

function metin(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

// ─── DEPO ───────────────────────────────────────────────────

export async function createDepo(g: { ad: string; subeId?: string }): Promise<Sonuc> {
  if (!g.ad?.trim()) return { ok: false, hata: "Depo adı girilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const depo = await prisma.depo.create({
      data: { firmaId: actor.firmaId, ad: g.ad.trim(), subeId: metin(g.subeId) },
    });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Depo", hedefId: depo.id, sonrakiVeri: { ad: depo.ad, subeId: depo.subeId, aktif: depo.aktif } } });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("createDepo", e);
    return { ok: false, hata: mesajVer(e, "Depo kaydedilemedi") };
  }
}

export async function updateDepo(id: string, g: { ad: string; subeId?: string }): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Depo seçilmedi" };
  if (!g.ad?.trim()) return { ok: false, hata: "Depo adı girilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const onceki = await prisma.depo.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!onceki) return { ok: false, hata: "Depo bulunamadı" };
    const sonraki = { ad: g.ad.trim(), subeId: metin(g.subeId) };
    await prisma.$transaction(async (tx) => {
      await tx.depo.update({ where: { id }, data: sonraki });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "Depo", hedefId: id, oncekiVeri: { ad: onceki.ad, subeId: onceki.subeId, aktif: onceki.aktif }, sonrakiVeri: sonraki } });
    });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updateDepo", e);
    return { ok: false, hata: mesajVer(e, "Depo güncellenemedi") };
  }
}

export async function toggleDepoAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Depo seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const depo = await prisma.depo.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!depo) return { ok: false, hata: "Depo bulunamadı" };
    await prisma.$transaction(async (tx) => { await tx.depo.update({ where: { id }, data: { aktif: !depo.aktif } }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "Depo", hedefId: id, oncekiVeri: { ad: depo.ad, subeId: depo.subeId, aktif: depo.aktif }, sonrakiVeri: { ad: depo.ad, subeId: depo.subeId, aktif: !depo.aktif }, aciklama: "Depo aktiflik durumu değiştirildi" } }); });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("toggleDepoAktif", e);
    return { ok: false, hata: "Depo durumu değiştirilemedi" };
  }
}

// ─── KASA / BANKA HESABI ────────────────────────────────────

export interface KasaHesapGirdi {
  ad: string;
  tip: "KASA" | "BANKA";
  bakiyeTuru: string;
  bankaAdi?: string;
  iban?: string;
}

function kasaHesapDogrula(g: KasaHesapGirdi): string | null {
  if (!g.ad?.trim()) return "Hesap adı girilmedi";
  if (!HESAP_TIPLERI.includes(g.tip)) return "Geçersiz hesap tipi";
  if (!BAKIYE_TURLERI.includes(g.bakiyeTuru as (typeof BAKIYE_TURLERI)[number])) return "Geçersiz bakiye türü";
  if (g.tip === "BANKA" && !g.bankaAdi?.trim()) return "Banka adı girilmedi";
  return null;
}

export async function createKasaHesap(g: KasaHesapGirdi): Promise<Sonuc> {
  const hataMesaj = kasaHesapDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const hesap = await prisma.kasaHesap.create({
      data: {
        firmaId: actor.firmaId,
        ad: g.ad.trim(),
        tip: g.tip as HesapTip,
        bakiyeTuru: g.bakiyeTuru as BakiyeTuru,
        bankaAdi: g.tip === "BANKA" ? metin(g.bankaAdi) : null,
        iban: g.tip === "BANKA" ? metin(g.iban) : null,
      },
    });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "KasaHesap", hedefId: hesap.id, sonrakiVeri: { ad: hesap.ad, tip: hesap.tip, bakiyeTuru: hesap.bakiyeTuru, bankaAdi: hesap.bankaAdi, iban: hesap.iban, aktif: hesap.aktif } } });
    yenile();
    revalidatePath("/finans");
    return { ok: true };
  } catch (e) {
    console.error("createKasaHesap", e);
    return { ok: false, hata: mesajVer(e, "Hesap kaydedilemedi") };
  }
}

export async function updateKasaHesap(id: string, g: KasaHesapGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Hesap seçilmedi" };
  const hataMesaj = kasaHesapDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const onceki = await prisma.kasaHesap.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!onceki) return { ok: false, hata: "Hesap bulunamadı" };
    const sonraki = {
        ad: g.ad.trim(),
        tip: g.tip as HesapTip,
        bakiyeTuru: g.bakiyeTuru as BakiyeTuru,
        bankaAdi: g.tip === "BANKA" ? metin(g.bankaAdi) : null,
        iban: g.tip === "BANKA" ? metin(g.iban) : null,
    };
    await prisma.$transaction(async (tx) => { await tx.kasaHesap.update({ where: { id }, data: sonraki }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "KasaHesap", hedefId: id, oncekiVeri: { ad: onceki.ad, tip: onceki.tip, bakiyeTuru: onceki.bakiyeTuru, bankaAdi: onceki.bankaAdi, iban: onceki.iban, aktif: onceki.aktif }, sonrakiVeri: sonraki } }); });
    yenile();
    revalidatePath("/finans");
    return { ok: true };
  } catch (e) {
    console.error("updateKasaHesap", e);
    return { ok: false, hata: mesajVer(e, "Hesap güncellenemedi") };
  }
}

export async function toggleKasaHesapAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Hesap seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const hesap = await prisma.kasaHesap.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!hesap) return { ok: false, hata: "Hesap bulunamadı" };
    const onceki = { ad: hesap.ad, tip: hesap.tip, bakiyeTuru: hesap.bakiyeTuru, bankaAdi: hesap.bankaAdi, iban: hesap.iban, aktif: hesap.aktif }, sonraki = { ...onceki, aktif: !hesap.aktif };
    await prisma.$transaction(async (tx) => { await tx.kasaHesap.update({ where: { id }, data: { aktif: !hesap.aktif } }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "KasaHesap", hedefId: id, oncekiVeri: onceki, sonrakiVeri: sonraki } }); });
    yenile();
    revalidatePath("/finans");
    return { ok: true };
  } catch (e) {
    console.error("toggleKasaHesapAktif", e);
    return { ok: false, hata: "Hesap durumu değiştirilemedi" };
  }
}

export async function toggleKullaniciAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Kullanıcı seçilmedi" };

  try {
    const actor = await requirePermission("KULLANICI_YONETIMI", "YONET");
    await prisma.$transaction(async (tx) => {
      const kullanici = await tx.kullanici.findFirst({ where: { id, firmaId: actor.firmaId }, include: { roller: { include: { rol: true } } } });
      if (!kullanici) throw new Error("KULLANICI_YOK");
      if (kullanici.id === actor.id && kullanici.aktif) throw new Error("KENDI_HESABI");
      if (kullanici.aktif && kullanici.roller.some((atama) => atama.rol.sistemRolu && atama.rol.kod === "FIRMA_SAHIBI")) throw new Error("FIRMA_SAHIBI");
      await tx.kullanici.update({ where: { id: kullanici.id }, data: { aktif: !kullanici.aktif } });
      if (kullanici.aktif) await tx.oturum.updateMany({ where: { kullaniciId: kullanici.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "Kullanici", hedefId: kullanici.id, oncekiVeri: { ad: kullanici.ad, telefon: kullanici.telefon, rol: kullanici.rol, aktif: kullanici.aktif }, sonrakiVeri: { ad: kullanici.ad, telefon: kullanici.telefon, rol: kullanici.rol, aktif: !kullanici.aktif }, aciklama: kullanici.aktif ? "Kullanıcı pasifleştirildi ve açık oturumları kapatıldı" : "Kullanıcı aktifleştirildi" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    yenile();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "KULLANICI_YOK") return { ok: false, hata: "Kullanıcı bulunamadı" };
    if (e instanceof Error && e.message === "KENDI_HESABI") return { ok: false, hata: "Kendi hesabınızı pasifleştiremezsiniz" };
    if (e instanceof Error && e.message === "FIRMA_SAHIBI") return { ok: false, hata: "Firma Sahibi hesabı pasifleştirilemez" };
    console.error("toggleKullaniciAktif", e);
    return { ok: false, hata: "Kullanıcı durumu değiştirilemedi" };
  }
}

// ─── ARAÇ ───────────────────────────────────────────────────

export interface AracGirdi {
  plaka: string;
  marka?: string;
  tip?: string;
  sofor?: string;
}

function aracDogrula(g: AracGirdi): string | null {
  if (!g.plaka?.trim()) return "Plaka girilmedi";
  if (g.tip && !ARAC_TIPLERI.includes(g.tip as (typeof ARAC_TIPLERI)[number])) return "Geçersiz araç tipi";
  return null;
}

export async function createArac(g: AracGirdi): Promise<Sonuc> {
  const hataMesaj = aracDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const arac = await prisma.arac.create({
      data: {
        firmaId: actor.firmaId,
        plaka: g.plaka.trim().toLocaleUpperCase("tr-TR"),
        marka: metin(g.marka),
        tip: g.tip ?? "KAMYON",
        sofor: metin(g.sofor),
      },
    });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Arac", hedefId: arac.id, sonrakiVeri: { plaka: arac.plaka, marka: arac.marka, tip: arac.tip, sofor: arac.sofor, aktif: arac.aktif } } });
    yenile();
    revalidatePath("/sevkiyat");
    return { ok: true };
  } catch (e) {
    console.error("createArac", e);
    return { ok: false, hata: mesajVer(e, "Araç kaydedilemedi") };
  }
}

export async function updateArac(id: string, g: AracGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Araç seçilmedi" };
  const hataMesaj = aracDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const onceki = await prisma.arac.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!onceki) return { ok: false, hata: "Araç bulunamadı" };
    const sonraki = {
        plaka: g.plaka.trim().toLocaleUpperCase("tr-TR"),
        marka: metin(g.marka),
        tip: g.tip ?? "KAMYON",
        sofor: metin(g.sofor),
    };
    await prisma.$transaction(async (tx) => { await tx.arac.update({ where: { id }, data: sonraki }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "Arac", hedefId: id, oncekiVeri: { plaka: onceki.plaka, marka: onceki.marka, tip: onceki.tip, sofor: onceki.sofor, aktif: onceki.aktif }, sonrakiVeri: sonraki } }); });
    yenile();
    revalidatePath("/sevkiyat");
    return { ok: true };
  } catch (e) {
    console.error("updateArac", e);
    return { ok: false, hata: mesajVer(e, "Araç güncellenemedi") };
  }
}

export async function toggleAracAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Araç seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const arac = await prisma.arac.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!arac) return { ok: false, hata: "Araç bulunamadı" };
    const onceki={plaka:arac.plaka,marka:arac.marka,tip:arac.tip,sofor:arac.sofor,aktif:arac.aktif},sonraki={...onceki,aktif:!arac.aktif}; await prisma.$transaction(async(tx)=>{await tx.arac.update({where:{id},data:{aktif:!arac.aktif}});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Arac",hedefId:id,oncekiVeri:onceki,sonrakiVeri:sonraki}})});
    yenile();
    revalidatePath("/sevkiyat");
    return { ok: true };
  } catch (e) {
    console.error("toggleAracAktif", e);
    return { ok: false, hata: "Araç durumu değiştirilemedi" };
  }
}

// ─── PERSONEL ───────────────────────────────────────────────

export interface PersonelGirdi {
  ad: string;
  telefon?: string;
  gorev?: string;
  tckn?: string;
}

function personelDogrula(g: PersonelGirdi): string | null {
  if (!g.ad?.trim()) return "Personel adı girilmedi";
  if (g.gorev && !GOREVLER.includes(g.gorev as (typeof GOREVLER)[number])) return "Geçersiz görev";
  if (g.tckn?.trim() && !/^\d{11}$/.test(g.tckn.trim())) return "TCKN 11 haneli olmalı";
  return null;
}

export async function createPersonel(g: PersonelGirdi): Promise<Sonuc> {
  const hataMesaj = personelDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const personel = await prisma.personel.create({
      data: {
        firmaId: actor.firmaId,
        ad: g.ad.trim(),
        telefon: metin(g.telefon),
        gorev: g.gorev ?? "SAHA",
        tckn: metin(g.tckn),
      },
    });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Personel", hedefId: personel.id, sonrakiVeri: { ad: personel.ad, telefon: personel.telefon, gorev: personel.gorev, tckn: personel.tckn, aktif: personel.aktif } } });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("createPersonel", e);
    return { ok: false, hata: mesajVer(e, "Personel kaydedilemedi") };
  }
}

export async function updatePersonel(id: string, g: PersonelGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Personel seçilmedi" };
  const hataMesaj = personelDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor=await requirePermission("TANIMLAR","GUNCELLE"); const onceki=await prisma.personel.findFirst({where:{id,firmaId:actor.firmaId}}); if(!onceki)return {ok:false,hata:"Personel bulunamadı"}; const sonraki={
        ad: g.ad.trim(),
        telefon: metin(g.telefon),
        gorev: g.gorev ?? "SAHA",
        tckn: metin(g.tckn),
    }; await prisma.$transaction(async tx=>{await tx.personel.update({where:{id},data:sonraki});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Personel",hedefId:id,oncekiVeri:{ad:onceki.ad,telefon:onceki.telefon,gorev:onceki.gorev,tckn:onceki.tckn,aktif:onceki.aktif},sonrakiVeri:sonraki}})});
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updatePersonel", e);
    return { ok: false, hata: mesajVer(e, "Personel güncellenemedi") };
  }
}

export async function togglePersonelAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Personel seçilmedi" };

  try {
    const actor=await requirePermission("TANIMLAR","GUNCELLE"); const personel = await prisma.personel.findFirst({ where: { id, firmaId:actor.firmaId } });
    if (!personel) return { ok: false, hata: "Personel bulunamadı" };
    const onceki={ad:personel.ad,telefon:personel.telefon,gorev:personel.gorev,tckn:personel.tckn,aktif:personel.aktif},sonraki={...onceki,aktif:!personel.aktif};await prisma.$transaction(async tx=>{await tx.personel.update({where:{id},data:{aktif:!personel.aktif}});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Personel",hedefId:id,oncekiVeri:onceki,sonrakiVeri:sonraki}})});
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("togglePersonelAktif", e);
    return { ok: false, hata: "Personel durumu değiştirilemedi" };
  }
}

// ─── SEZON ──────────────────────────────────────────────────

export interface SezonGirdi {
  ad: string;
  baslangic: string; // YYYY-MM-DD
  bitis: string; // YYYY-MM-DD
}

function sezonDogrula(g: SezonGirdi): string | null {
  if (!g.ad?.trim()) return "Sezon adı girilmedi";
  if (!g.baslangic) return "Başlangıç tarihi girilmedi";
  if (!g.bitis) return "Bitiş tarihi girilmedi";
  const bas = new Date(g.baslangic);
  const bit = new Date(g.bitis);
  if (Number.isNaN(bas.getTime()) || Number.isNaN(bit.getTime())) return "Geçersiz tarih";
  if (bit <= bas) return "Bitiş tarihi başlangıçtan sonra olmalı";
  return null;
}

export async function createSezon(g: SezonGirdi): Promise<Sonuc> {
  const hataMesaj = sezonDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const sezon = await prisma.sezon.create({
      data: {
        firmaId: actor.firmaId,
        ad: g.ad.trim(),
        baslangic: new Date(g.baslangic),
        bitis: new Date(g.bitis),
        aktif: false,
      },
    });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Sezon", hedefId: sezon.id, sonrakiVeri: { ad: sezon.ad, baslangic: sezon.baslangic.toISOString(), bitis: sezon.bitis.toISOString(), aktif: sezon.aktif } } });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("createSezon", e);
    return { ok: false, hata: mesajVer(e, "Sezon kaydedilemedi") };
  }
}

export async function updateSezon(id: string, g: SezonGirdi): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Sezon seçilmedi" };
  const hataMesaj = sezonDogrula(g);
  if (hataMesaj) return { ok: false, hata: hataMesaj };

  try {
    const actor=await requirePermission("TANIMLAR","GUNCELLE"), onceki=await prisma.sezon.findFirst({where:{id,firmaId:actor.firmaId}}); if(!onceki)return {ok:false,hata:"Sezon bulunamadı"}; const sonraki={ad:g.ad.trim(),baslangic:new Date(g.baslangic),bitis:new Date(g.bitis)}; await prisma.$transaction(async tx=>{await tx.sezon.update({where:{id},data:sonraki});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Sezon",hedefId:id,oncekiVeri:{ad:onceki.ad,baslangic:onceki.baslangic.toISOString(),bitis:onceki.bitis.toISOString(),aktif:onceki.aktif},sonrakiVeri:{ad:sonraki.ad,baslangic:sonraki.baslangic.toISOString(),bitis:sonraki.bitis.toISOString(),aktif:onceki.aktif}}})});
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updateSezon", e);
    return { ok: false, hata: mesajVer(e, "Sezon güncellenemedi") };
  }
}

export async function toggleSezonAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Sezon seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const sonuc = await prisma.$transaction(async (tx) => {
      const sezon = await tx.sezon.findFirst({ where: { id, firmaId: actor.firmaId } });
      if (!sezon) return { ok: false, hata: "Sezon bulunamadı" };

      if (sezon.aktif) {
        const aktifSayisi = await tx.sezon.count({ where: { firmaId: actor.firmaId, aktif: true } });
        if (aktifSayisi <= 1) return { ok: false, hata: "Tek aktif sezon pasifleştirilemez" };
      } else {
        // Aktifleştirirken diğer sezonları pasifleştir — tek aktif sezon kuralı
        await tx.sezon.updateMany({ where: { firmaId: actor.firmaId, aktif: true }, data: { aktif: false } });
      }

      await tx.sezon.update({ where: { id: sezon.id }, data: { aktif: !sezon.aktif } });
      await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Sezon",hedefId:id,oncekiVeri:{ad:sezon.ad,baslangic:sezon.baslangic.toISOString(),bitis:sezon.bitis.toISOString(),aktif:sezon.aktif},sonrakiVeri:{ad:sezon.ad,baslangic:sezon.baslangic.toISOString(),bitis:sezon.bitis.toISOString(),aktif:!sezon.aktif}}});
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!sonuc.ok) return sonuc;

    yenile();
    return { ok: true };
  } catch (e) {
    console.error("toggleSezonAktif", e);
    return { ok: false, hata: "Sezon durumu değiştirilemedi" };
  }
}

// ─── MASRAF TÜRÜ ────────────────────────────────────────────

export async function createMasrafTuru(g: { ad: string }): Promise<Sonuc> {
  if (!g.ad?.trim()) return { ok: false, hata: "Masraf türü adı girilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "OLUSTUR");
    const kayit = await prisma.masrafTuru.create({ data: { firmaId: actor.firmaId, ad: g.ad.trim() } });
    await prisma.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "MasrafTuru", hedefId: kayit.id, sonrakiVeri: { ad: kayit.ad, aktif: kayit.aktif } } });
    yenile();
    revalidatePath("/masraf");
    return { ok: true };
  } catch (e) {
    console.error("createMasrafTuru", e);
    return { ok: false, hata: mesajVer(e, "Masraf türü kaydedilemedi") };
  }
}

export async function updateMasrafTuru(id: string, g: { ad: string }): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Masraf türü seçilmedi" };
  if (!g.ad?.trim()) return { ok: false, hata: "Masraf türü adı girilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const onceki = await prisma.masrafTuru.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!onceki) return { ok: false, hata: "Masraf türü bulunamadı" };
    const sonraki = { ad: g.ad.trim() };
    await prisma.$transaction(async (tx) => {
      await tx.masrafTuru.update({ where: { id }, data: sonraki });
      // Tarihsel masraf kayıtlarında görünen tür adı da güncellenir.
      await tx.masraf.updateMany({ where: { firmaId: actor.firmaId, tur: onceki.ad }, data: { tur: sonraki.ad } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "MasrafTuru", hedefId: id, oncekiVeri: { ad: onceki.ad, aktif: onceki.aktif }, sonrakiVeri: { ...sonraki, aktif: onceki.aktif } } });
    });
    yenile();
    revalidatePath("/masraf");
    return { ok: true };
  } catch (e) {
    console.error("updateMasrafTuru", e);
    return { ok: false, hata: mesajVer(e, "Masraf türü güncellenemedi") };
  }
}

export async function toggleMasrafTuruAktif(id: string): Promise<Sonuc> {
  if (!id) return { ok: false, hata: "Masraf türü seçilmedi" };

  try {
    const actor = await requirePermission("TANIMLAR", "GUNCELLE");
    const kayit = await prisma.masrafTuru.findFirst({ where: { id, firmaId: actor.firmaId } });
    if (!kayit) return { ok: false, hata: "Masraf türü bulunamadı" };
    await prisma.$transaction(async (tx) => {
      await tx.masrafTuru.update({ where: { id }, data: { aktif: !kayit.aktif } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "MasrafTuru", hedefId: id, oncekiVeri: { ad: kayit.ad, aktif: kayit.aktif }, sonrakiVeri: { ad: kayit.ad, aktif: !kayit.aktif }, aciklama: "Masraf türü aktiflik durumu değiştirildi" } });
    });
    yenile();
    revalidatePath("/masraf");
    return { ok: true };
  } catch (e) {
    console.error("toggleMasrafTuruAktif", e);
    return { ok: false, hata: "Masraf türü durumu değiştirilemedi" };
  }
}

// ─── FİRMA (sadece düzenleme) ───────────────────────────────

export async function updateFirma(g: {
  unvan: string;
  vergiNo?: string;
  vergiDairesi?: string;
  adres?: string;
  telefon?: string;
}): Promise<Sonuc> {
  if (!g.unvan?.trim()) return { ok: false, hata: "Firma ünvanı girilmedi" };
  if (g.adres !== undefined && !g.adres.trim()) return { ok: false, hata: "Firma adresi girilmedi" };
  if (g.telefon !== undefined && !g.telefon.trim()) return { ok: false, hata: "Firma telefonu girilmedi" };

  try {
    const actor = await requirePermission("AYARLAR", "GUNCELLE");
    const firma = await firmaGetir();
    const sonraki = {
      unvan: g.unvan.trim(),
      vergiNo: metin(g.vergiNo),
      vergiDairesi: metin(g.vergiDairesi),
      adres: g.adres?.trim() ?? firma.adres,
      telefon: g.telefon?.trim() ?? firma.telefon,
    };
    await prisma.$transaction(async (tx) => {
      await tx.firma.update({ where: { id: firma.id }, data: sonraki });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "AYARLAR", eylem: "GUNCELLE", hedefTipi: "Firma", hedefId: firma.id, oncekiVeri: { unvan: firma.unvan, vergiNo: firma.vergiNo, vergiDairesi: firma.vergiDairesi, adres: firma.adres, telefon: firma.telefon }, sonrakiVeri: sonraki } });
    });
    yenile();
    return { ok: true };
  } catch (e) {
    console.error("updateFirma", e);
    return { ok: false, hata: mesajVer(e, "Firma bilgileri güncellenemedi") };
  }
}
