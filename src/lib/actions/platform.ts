"use server";

import { prisma } from "@/lib/db";
import { requireSistemYonetici, sifreHashle } from "@/lib/auth";
import { izinlerGecerli, TAM_YETKI_IZINLERI, type Izin } from "@/lib/rbac/permissions";
import { rolAdiGecerli, rolKoduOlustur } from "@/lib/rbac/rol-kodu";
import { parolaGecerli } from "@/lib/dogrulama";
import { revalidatePath } from "next/cache";

type Sonuc = { ok: boolean; hata?: string };

function ilkSezonBilgisi(simdi = new Date()) {
  // Fındık sezonu 1 Ağustos'ta başlar ve takip eden yılın 31 Temmuz'unda biter.
  // Ocak–Temmuz döneminde içinde bulunulan sezon, önceki takvim yılında başlamıştır.
  const baslangicYili = simdi.getMonth() >= 7 ? simdi.getFullYear() : simdi.getFullYear() - 1;
  const bitisYili = baslangicYili + 1;
  return {
    ad: `${baslangicYili}-${String(bitisYili).slice(-2)}`,
    baslangic: new Date(Date.UTC(baslangicYili, 7, 1)),
    bitis: new Date(Date.UTC(bitisYili, 6, 31)),
  };
}

export async function firmaKur(form: FormData): Promise<Sonuc & { firmaId?: string }> {
  const yonetici = await requireSistemYonetici();
  const unvan = String(form.get("unvan") ?? "").trim();
  const adres = String(form.get("adres") ?? "").trim();
  const telefon = String(form.get("telefon") ?? "").trim();
  const vergiNo = String(form.get("vergiNo") ?? "").trim();
  const sahipAd = String(form.get("sahipAd") ?? "").trim();
  const sahipEposta = String(form.get("sahipEposta") ?? "").trim().toLowerCase();
  const sahipSifre = String(form.get("sahipSifre") ?? "");
  if (!unvan || !adres || !telefon || !vergiNo || !sahipAd || !/^\S+@\S+\.\S+$/.test(sahipEposta) || !parolaGecerli(sahipSifre)) return { ok: false, hata: "Firma ve sahibi için tüm zorunlu alanları doğru girin; parola en az 6 karakter olmalı ve harf ile rakam içermeli" };
  const ilkSezon = ilkSezonBilgisi();
  try {
    const firmaId = await prisma.$transaction(async (tx) => {
      const firma = await tx.firma.create({ data: { unvan, adres, telefon, vergiNo, kuranSistemYoneticisiId: yonetici.id, kurulumTamamlandiAt: new Date() } });
      const sube = await tx.sube.create({ data: { firmaId: firma.id, ad: "Merkez", tip: "MERKEZ" } });
      await tx.depo.create({ data: { firmaId: firma.id, subeId: sube.id, ad: "Merkez Depo" } });
      await tx.sezon.create({ data: { firmaId: firma.id, ...ilkSezon, aktif: true } });
      await tx.kasaHesap.create({ data: { firmaId: firma.id, subeId: sube.id, ad: "Merkez Kasa", tip: "KASA", bakiyeTuru: "TL" } });
      const sahipRolu = await tx.yetkiRolu.create({ data: { firmaId: firma.id, kod: "FIRMA_SAHIBI", ad: "Firma Sahibi", sistemRolu: true, izinler: { create: [...TAM_YETKI_IZINLERI] } } });
      const sahip = await tx.kullanici.create({ data: { firmaId: firma.id, subeId: sube.id, ad: sahipAd, eposta: sahipEposta, sifreHash: await sifreHashle(sahipSifre), roller: { create: { rolId: sahipRolu.id } } } });
      await tx.auditKaydi.create({ data: { firmaId: firma.id, sistemYoneticisiId: yonetici.id, eylem: "OLUSTUR", hedefTipi: "Firma", hedefId: firma.id, sonrakiVeri: { firmaSahibiId: sahip.id } } });
      return firma.id;
    });
    return { ok: true, firmaId };
  } catch { return { ok: false, hata: "Firma kurulamadı; vergi numarası veya e-posta daha önce kullanılmış olabilir" }; }
}

export async function kurulumRoluOlustur(firmaId: string, ad: string, izinler: Izin[]): Promise<Sonuc> {
  const yonetici = await requireSistemYonetici();
  if (!rolAdiGecerli(ad) || !izinler.length || !izinlerGecerli(izinler)) return { ok: false, hata: "Rol adı en az iki harf veya rakam içermeli ve en az bir geçerli izin seçilmeli" };
  const firma = await prisma.firma.findFirst({ where: { id: firmaId, kuranSistemYoneticisiId: yonetici.id } });
  if (!firma) return { ok: false, hata: "Bu firma için kurulum yetkiniz yok" };
  try {
    await prisma.$transaction(async (tx) => {
      const rol = await tx.yetkiRolu.create({ data: { firmaId, kod: rolKoduOlustur(ad), ad: ad.trim(), izinler: { create: izinler } } });
      await tx.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "KULLANICI_YONETIMI", eylem: "YETKILENDIR", hedefTipi: "YetkiRolu", hedefId: rol.id, sonrakiVeri: { ad: rol.ad, izinler } } });
    });
    return { ok: true };
  } catch { return { ok: false, hata: "Rol kaydedilemedi. Aynı ada veya role ait koda sahip bir kayıt olabilir." }; }
}

// ─── KURULUM TANIMLARI (depo, kasa/banka, masraf türü) ──────

async function kurulumFirmasi(firmaId: string) {
  const yonetici = await requireSistemYonetici();
  const firma = await prisma.firma.findFirst({ where: { id: firmaId, kuranSistemYoneticisiId: yonetici.id } });
  if (!firma) throw new Error("YETKI_YOK");
  return yonetici;
}

export async function kurulumDepoOlustur(firmaId: string, ad: string): Promise<Sonuc> {
  if (!ad?.trim()) return { ok: false, hata: "Depo adı girilmedi" };
  try {
    const yonetici = await kurulumFirmasi(firmaId);
    const depo = await prisma.depo.create({ data: { firmaId, ad: ad.trim() } });
    await prisma.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Depo", hedefId: depo.id, sonrakiVeri: { ad: depo.ad }, aciklama: "Kurulum sırasında oluşturuldu" } });
    revalidatePath(`/platform/${firmaId}/tanimlar`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "YETKI_YOK") return { ok: false, hata: "Bu firma için kurulum yetkiniz yok" };
    console.error("kurulumDepoOlustur", e);
    return { ok: false, hata: "Bu isimde bir depo zaten kayıtlı olabilir" };
  }
}

export async function kurulumHesapOlustur(firmaId: string, g: { ad: string; tip: "KASA" | "BANKA"; bakiyeTuru?: string; bankaAdi?: string; iban?: string }): Promise<Sonuc> {
  if (!g.ad?.trim()) return { ok: false, hata: "Hesap adı girilmedi" };
  if (g.tip !== "KASA" && g.tip !== "BANKA") return { ok: false, hata: "Geçersiz hesap tipi" };
  if (g.tip === "BANKA" && !g.bankaAdi?.trim()) return { ok: false, hata: "Banka adı girilmedi" };
  try {
    const yonetici = await kurulumFirmasi(firmaId);
    const hesap = await prisma.kasaHesap.create({
      data: {
        firmaId,
        ad: g.ad.trim(),
        tip: g.tip,
        bakiyeTuru: (g.bakiyeTuru ?? "TL") as "TL",
        bankaAdi: g.tip === "BANKA" ? g.bankaAdi!.trim() : null,
        iban: g.tip === "BANKA" ? (g.iban?.trim() || null) : null,
      },
    });
    await prisma.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "KasaHesap", hedefId: hesap.id, sonrakiVeri: { ad: hesap.ad, tip: hesap.tip }, aciklama: "Kurulum sırasında oluşturuldu" } });
    revalidatePath(`/platform/${firmaId}/tanimlar`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "YETKI_YOK") return { ok: false, hata: "Bu firma için kurulum yetkiniz yok" };
    console.error("kurulumHesapOlustur", e);
    return { ok: false, hata: "Hesap kaydedilemedi" };
  }
}

export async function kurulumMasrafTuruOlustur(firmaId: string, ad: string): Promise<Sonuc> {
  if (!ad?.trim()) return { ok: false, hata: "Masraf türü adı girilmedi" };
  try {
    const yonetici = await kurulumFirmasi(firmaId);
    const kayit = await prisma.masrafTuru.create({ data: { firmaId, ad: ad.trim() } });
    await prisma.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "MasrafTuru", hedefId: kayit.id, sonrakiVeri: { ad: kayit.ad }, aciklama: "Kurulum sırasında oluşturuldu" } });
    revalidatePath(`/platform/${firmaId}/tanimlar`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "YETKI_YOK") return { ok: false, hata: "Bu firma için kurulum yetkiniz yok" };
    console.error("kurulumMasrafTuruOlustur", e);
    return { ok: false, hata: "Bu isimde bir masraf türü zaten kayıtlı" };
  }
}

// Önerilen varsayılanlar: Merkez Depo, Merkez Kasa ve yaygın masraf türleri.
// Yalnız eksik olanları ekler; tekrar çağrıldığında mevcut tanımlar korunur.
export async function kurulumVarsayilanTanimlariOlustur(firmaId: string): Promise<Sonuc> {
  try {
    const yonetici = await kurulumFirmasi(firmaId);
    await prisma.$transaction(async (tx) => {
      const depoSayisi = await tx.depo.count({ where: { firmaId } });
      if (depoSayisi === 0) {
        const depo = await tx.depo.create({ data: { firmaId, ad: "Merkez Depo" } });
        await tx.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "Depo", hedefId: depo.id, sonrakiVeri: { ad: depo.ad }, aciklama: "Kurulum varsayılanı" } });
      }
      const hesapSayisi = await tx.kasaHesap.count({ where: { firmaId } });
      if (hesapSayisi === 0) {
        const hesap = await tx.kasaHesap.create({ data: { firmaId, ad: "Merkez Kasa", tip: "KASA", bakiyeTuru: "TL" } });
        await tx.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "KasaHesap", hedefId: hesap.id, sonrakiVeri: { ad: hesap.ad, tip: hesap.tip }, aciklama: "Kurulum varsayılanı" } });
      }
      for (const ad of ["Nakliye", "Kantar", "Hamaliye", "Komisyon", "Depo", "Diğer"]) {
        const varMi = await tx.masrafTuru.findFirst({ where: { firmaId, ad } });
        if (varMi) continue;
        const kayit = await tx.masrafTuru.create({ data: { firmaId, ad } });
        await tx.auditKaydi.create({ data: { firmaId, sistemYoneticisiId: yonetici.id, modul: "TANIMLAR", eylem: "OLUSTUR", hedefTipi: "MasrafTuru", hedefId: kayit.id, sonrakiVeri: { ad }, aciklama: "Kurulum varsayılanı" } });
      }
    });
    revalidatePath(`/platform/${firmaId}/tanimlar`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "YETKI_YOK") return { ok: false, hata: "Bu firma için kurulum yetkiniz yok" };
    console.error("kurulumVarsayilanTanimlariOlustur", e);
    return { ok: false, hata: "Varsayılan tanımlar oluşturulamadı" };
  }
}
