"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { izinlerGecerli, type Izin } from "@/lib/rbac/permissions";
import { rolAdiGecerli, rolKoduOlustur } from "@/lib/rbac/rol-kodu";
import { kullaniciRolleriniGuncelle } from "@/lib/actions/kullanici-yonetim";
import { Prisma } from "@/generated/prisma/client";

type Sonuc = { ok: boolean; hata?: string };
export async function rolOlustur(g: { ad: string; aciklama?: string; izinler: Izin[] }): Promise<Sonuc> { const user = await requirePermission("KULLANICI_YONETIMI", "YONET"); if (!rolAdiGecerli(g.ad) || !izinlerGecerli(g.izinler)) return { ok: false, hata: "Rol adı en az iki harf veya rakam içermeli; izinler geçerli olmalı" }; try { await prisma.$transaction(async (tx) => { const role = await tx.yetkiRolu.create({ data: { firmaId: user.firmaId, kod: rolKoduOlustur(g.ad), ad: g.ad.trim(), aciklama: g.aciklama?.trim() || null, izinler: { create: g.izinler } } }); await tx.auditKaydi.create({ data: { firmaId: user.firmaId, kullaniciId: user.id, modul: "KULLANICI_YONETIMI", eylem: "OLUSTUR", hedefTipi: "YetkiRolu", hedefId: role.id } }); }); revalidatePath("/ayarlar"); return { ok: true }; } catch { return { ok: false, hata: "Rol kaydedilemedi. Aynı ada veya role ait koda sahip bir kayıt olabilir." }; } }
export async function rolIzinleriniGuncelle(rolId: string, izinler: Izin[]): Promise<Sonuc> {
  const user = await requirePermission("KULLANICI_YONETIMI", "YONET");
  if (!izinlerGecerli(izinler)) return { ok: false, hata: "İzin seçimi geçersiz" };
  try {
    await prisma.$transaction(async (tx) => {
      const rol = await tx.yetkiRolu.findFirst({ where: { id: rolId, firmaId: user.firmaId }, include: { izinler: true } });
      if (!rol) throw new Error("ROL_YOK");
      await tx.rolIzni.deleteMany({ where: { rolId: rol.id } });
      if (izinler.length) await tx.rolIzni.createMany({ data: izinler.map((izin) => ({ rolId: rol.id, ...izin })) });
      await tx.auditKaydi.create({ data: { firmaId: user.firmaId, kullaniciId: user.id, modul: "KULLANICI_YONETIMI", eylem: "YETKILENDIR", hedefTipi: "YetkiRolu", hedefId: rol.id, oncekiVeri: { izinler: rol.izinler.map((izin) => ({ modul: izin.modul, eylem: izin.eylem })) }, sonrakiVeri: { izinler }, aciklama: "Rol izinleri güncellendi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "ROL_YOK") return { ok: false, hata: "Rol bulunamadı" };
    return { ok: false, hata: "Rol izinleri güncellenemedi" };
  }
  revalidatePath("/ayarlar"); revalidatePath("/ayarlar/roller"); return { ok: true };
}
export async function rolAktifliginiDegistir(rolId: string): Promise<Sonuc> {
  const user = await requirePermission("KULLANICI_YONETIMI", "YONET");
  try {
    await prisma.$transaction(async (tx) => {
      const rol = await tx.yetkiRolu.findFirst({ where: { id: rolId, firmaId: user.firmaId }, include: { kullanicilar: { include: { kullanici: { include: { roller: { include: { rol: true } } } } } } } });
      if (!rol) throw new Error("ROL_YOK");
      if (rol.sistemRolu) throw new Error("SISTEM_ROLU");
      if (rol.aktif) {
        const korumasiz = rol.kullanicilar.some((atama) => atama.kullanici.aktif && !atama.kullanici.roller.some((diger) => diger.rolId !== rol.id && diger.rol.aktif));
        if (korumasiz) throw new Error("KORUMASIZ_KULLANICI");
      }
      await tx.yetkiRolu.update({ where: { id: rol.id }, data: { aktif: !rol.aktif } });
      await tx.auditKaydi.create({ data: { firmaId: user.firmaId, kullaniciId: user.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "YetkiRolu", hedefId: rol.id, oncekiVeri: { aktif: rol.aktif }, sonrakiVeri: { aktif: !rol.aktif }, aciklama: "Rol aktiflik durumu değiştirildi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const kod = error instanceof Error ? error.message : "";
    if (kod === "ROL_YOK") return { ok: false, hata: "Rol bulunamadı" };
    if (kod === "SISTEM_ROLU") return { ok: false, hata: "Firma Sahibi rolü pasifleştirilemez" };
    if (kod === "KORUMASIZ_KULLANICI") return { ok: false, hata: "Bu rol pasifleştirilirse yetkisiz kalacak aktif kullanıcılar var. Önce onlara başka bir aktif rol atayın." };
    return { ok: false, hata: "Rol durumu değiştirilemedi" };
  }
  revalidatePath("/ayarlar"); revalidatePath("/ayarlar/roller"); return { ok: true };
}
/** Eski çağıranlar için tek güvenli rol-atama akışına yönlendirme. */
export async function kullaniciRolleriniAta(kullaniciId: string, rolIds: string[]): Promise<Sonuc> {
  return kullaniciRolleriniGuncelle(kullaniciId, rolIds);
}
