"use server";

import { prisma } from "@/lib/db";
import { sifreHashle } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { parolaGecerli, PAROLA_HATASI } from "@/lib/dogrulama";

type Girdi = { ad: string; eposta: string; parola?: string; telefon?: string; rolIds: string[] };
type Sonuc = { ok: boolean; hata?: string };

function dogrula(g: Girdi) {
  if (!g.ad.trim() || !/^\S+@\S+\.\S+$/.test(g.eposta.trim())) return "Ad ve geçerli e-posta gerekli";
  if (g.parola !== undefined && !parolaGecerli(g.parola)) return PAROLA_HATASI;
  if (!g.rolIds.length) return "En az bir yetki grubu seçilmeli";
  return null;
}

export async function kullaniciHesabiOlustur(g: Girdi): Promise<Sonuc> {
  const hata = dogrula(g); if (hata || !g.parola) return { ok: false, hata: hata ?? "Parola gerekli" };
  const actor = await requirePermission("KULLANICI_YONETIMI", "YONET");
  const sifreHash = await sifreHashle(g.parola);
  try {
    await prisma.$transaction(async (tx) => {
      const roller = await tx.yetkiRolu.findMany({ where: { id: { in: g.rolIds }, firmaId: actor.firmaId, aktif: true }, select: { id: true, kod: true, sistemRolu: true } });
      if (roller.length !== new Set(g.rolIds).size) throw new Error("GECERSIZ_ROL");
      // Firma Sahibi rolü yalnız platform provizyonu tarafından verilir; kullanıcı
      // yönetimiyle kendine/başkasına TAM_YETKI atanarak root'a çıkılamaz.
      if (roller.some((r) => r.sistemRolu && r.kod === "FIRMA_SAHIBI")) throw new Error("SAHIP_ATAMA");
      const kullanici = await tx.kullanici.create({ data: { firmaId: actor.firmaId, ad: g.ad.trim(), eposta: g.eposta.trim().toLowerCase(), telefon: g.telefon?.trim() || null, sifreHash, roller: { createMany: { data: roller.map(r => ({ rolId: r.id })) } } } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "OLUSTUR", hedefTipi: "Kullanici", hedefId: kullanici.id, sonrakiVeri: { ad: kullanici.ad, eposta: kullanici.eposta, rolIds: g.rolIds } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/ayarlar"); return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "GECERSIZ_ROL") return { ok: false, hata: "Geçersiz veya pasif yetki grubu seçimi" };
    if (error instanceof Error && error.message === "SAHIP_ATAMA") return { ok: false, hata: "Firma Sahibi rolü kullanıcı yönetiminden atanamaz" };
    return { ok: false, hata: "Kullanıcı kaydedilemedi; e-posta daha önce kullanılmış olabilir" };
  }
}

export async function kullaniciRolleriniGuncelle(kullaniciId: string, rolIds: string[]): Promise<Sonuc> {
  const actor = await requirePermission("KULLANICI_YONETIMI", "YONET");
  if (!rolIds.length) return { ok: false, hata: "Kullanıcıya en az bir yetki grubu atanmalı" };
  try {
    await prisma.$transaction(async tx => {
      const target = await tx.kullanici.findFirst({ where: { id: kullaniciId, firmaId: actor.firmaId }, include: { roller: { include: { rol: true } } } });
      const roller = await tx.yetkiRolu.findMany({ where: { id: { in: rolIds }, firmaId: actor.firmaId, aktif: true }, select: { id: true, kod: true, sistemRolu: true } });
      if (!target) throw new Error("KULLANICI_YOK");
      if (roller.length !== new Set(rolIds).size) throw new Error("GECERSIZ_ROL");
      const sahipRolu = target.roller.find((atama) => atama.rol.sistemRolu && atama.rol.kod === "FIRMA_SAHIBI");
      if (sahipRolu && !rolIds.includes(sahipRolu.rolId)) throw new Error("SAHIP_ROLU");
      // Firma Sahibi rolü yalnız platform provizyonuyla verilir; güncelleme yoluyla atanamaz.
      if (roller.some((r) => r.sistemRolu && r.kod === "FIRMA_SAHIBI")) throw new Error("SAHIP_ATAMA");
      await tx.kullaniciRol.deleteMany({ where: { kullaniciId: target.id } });
      await tx.kullaniciRol.createMany({ data: roller.map(r => ({ kullaniciId: target.id, rolId: r.id })) });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "KullaniciRol", hedefId: target.id, oncekiVeri: { rolIds: target.roller.map(r => r.rolId) }, sonrakiVeri: { rolIds } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const kod = error instanceof Error ? error.message : "";
    if (kod === "KULLANICI_YOK") return { ok: false, hata: "Kullanıcı bulunamadı" };
    if (kod === "GECERSIZ_ROL") return { ok: false, hata: "Geçersiz veya pasif yetki grubu seçimi" };
    if (kod === "SAHIP_ROLU") return { ok: false, hata: "Firma Sahibi rolü bu kullanıcıdan kaldırılamaz" };
    if (kod === "SAHIP_ATAMA") return { ok: false, hata: "Firma Sahibi rolü kullanıcı yönetiminden atanamaz" };
    return { ok: false, hata: "Kullanıcı yetkileri güncellenemedi" };
  }
  revalidatePath("/ayarlar"); return { ok: true };
}

export async function kullaniciParolasiniYenile(kullaniciId: string, parola: string): Promise<Sonuc> {
  const actor = await requirePermission("KULLANICI_YONETIMI", "YONET");
  if (!parolaGecerli(parola)) return { ok: false, hata: PAROLA_HATASI };
  const hedef = await prisma.kullanici.findFirst({ where: { id: kullaniciId, firmaId: actor.firmaId } });
  if (!hedef) return { ok: false, hata: "Kullanıcı bulunamadı" };
  await prisma.$transaction(async (tx) => {
    await tx.kullanici.update({ where: { id: hedef.id }, data: { sifreHash: await sifreHashle(parola) } });
    await tx.oturum.updateMany({ where: { kullaniciId: hedef.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "Kullanici", hedefId: hedef.id, aciklama: "Kullanıcı parolası yenilendi; mevcut oturumlar sonlandırıldı." } });
  });
  revalidatePath("/ayarlar");
  return { ok: true };
}
