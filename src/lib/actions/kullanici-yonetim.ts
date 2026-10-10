"use server";

import { prisma } from "@/lib/db";
import { sifreHashle } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { parolaGecerli, PAROLA_HATASI } from "@/lib/dogrulama";

/** Kullanıcının giriş sonrası açılacak modülü. Varsayılan alım modülüdür. */
type VarsayilanModul = "ALIM" | "ISLEME";

type Girdi = { ad: string; eposta: string; parola?: string; telefon?: string; rolIds: string[]; varsayilanModul?: VarsayilanModul };
type Sonuc = { ok: boolean; hata?: string };

/** Firma Sahibi sistem rolü firmadaki tüm yetkilere sahiptir. */
function sahipRoluMu(roller: readonly { kod: string; sistemRolu: boolean }[]): boolean {
  return roller.some((rol) => rol.sistemRolu && rol.kod === "FIRMA_SAHIBI");
}

function modulKodu(deger: VarsayilanModul | undefined): VarsayilanModul {
  return deger === "ISLEME" ? "ISLEME" : "ALIM";
}

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
      // Firma Sahibi rolü tüm yetkilere sahiptir ve firmada birden fazla firma
      // sahibi bulunabilir; ancak bu rolü yalnız mevcut bir firma sahibi
      // atayabilir (kullanıcı yönetimiyle root yetkisi yükseltilemez).
      if (sahipRoluMu(roller) && !sahipRoluMu(actor.roller.map((atama) => atama.rol))) {
        throw new Error("SAHIP_ATAMA");
      }
      const kullanici = await tx.kullanici.create({ data: { firmaId: actor.firmaId, ad: g.ad.trim(), eposta: g.eposta.trim().toLowerCase(), telefon: g.telefon?.trim() || null, sifreHash, varsayilanModul: modulKodu(g.varsayilanModul), roller: { createMany: { data: roller.map(r => ({ rolId: r.id })) } } } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "OLUSTUR", hedefTipi: "Kullanici", hedefId: kullanici.id, sonrakiVeri: { ad: kullanici.ad, eposta: kullanici.eposta, rolIds: g.rolIds, varsayilanModul: kullanici.varsayilanModul } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/ayarlar"); return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "GECERSIZ_ROL") return { ok: false, hata: "Geçersiz veya pasif yetki grubu seçimi" };
    if (error instanceof Error && error.message === "SAHIP_ATAMA") return { ok: false, hata: "Firma Sahibi rolünü yalnızca mevcut bir firma sahibi atayabilir" };
    return { ok: false, hata: "Kullanıcı kaydedilemedi; e-posta daha önce kullanılmış olabilir" };
  }
}

/**
 * Kullanıcının yetki gruplarını ve (verilmişse) giriş sonrası açılacak modülünü
 * günceller. Modül seçimi kullanıcı kaydında tutulur ve giriş yönlendirmesinde
 * okunur.
 */
export async function kullaniciRolleriniGuncelle(kullaniciId: string, rolIds: string[], varsayilanModul?: VarsayilanModul): Promise<Sonuc> {
  const actor = await requirePermission("KULLANICI_YONETIMI", "YONET");
  if (!rolIds.length) return { ok: false, hata: "Kullanıcıya en az bir yetki grubu atanmalı" };
  try {
    await prisma.$transaction(async tx => {
      const target = await tx.kullanici.findFirst({ where: { id: kullaniciId, firmaId: actor.firmaId }, include: { roller: { include: { rol: true } } } });
      const roller = await tx.yetkiRolu.findMany({ where: { id: { in: rolIds }, firmaId: actor.firmaId, aktif: true }, select: { id: true, kod: true, sistemRolu: true } });
      if (!target) throw new Error("KULLANICI_YOK");
      if (roller.length !== new Set(rolIds).size) throw new Error("GECERSIZ_ROL");
      const sahipRolu = target.roller.find((atama) => atama.rol.sistemRolu && atama.rol.kod === "FIRMA_SAHIBI");
      // Firma Sahibi rolü sonradan da eklenebilir; ancak yalnız mevcut bir firma
      // sahibi ekleyebilir (kullanıcı yönetimiyle root yetkisi yükseltilemez).
      if (!sahipRolu && sahipRoluMu(roller) && !sahipRoluMu(actor.roller.map((atama) => atama.rol))) {
        throw new Error("SAHIP_ATAMA");
      }
      // Rol kaldırılırken firmada en az bir aktif firma sahibi kalmalıdır.
      if (sahipRolu && !rolIds.includes(sahipRolu.rolId)) {
        const digerSahip = await tx.kullaniciRol.count({
          where: {
            rolId: sahipRolu.rolId,
            kullanici: { is: { firmaId: actor.firmaId, aktif: true, id: { not: target.id } } },
          },
        });
        if (digerSahip === 0) throw new Error("SAHIP_ROLU");
      }
      await tx.kullaniciRol.deleteMany({ where: { kullaniciId: target.id } });
      await tx.kullaniciRol.createMany({ data: roller.map(r => ({ kullaniciId: target.id, rolId: r.id })) });
      if (varsayilanModul) {
        await tx.kullanici.update({ where: { id: target.id }, data: { varsayilanModul: modulKodu(varsayilanModul) } });
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "KullaniciRol", hedefId: target.id, oncekiVeri: { rolIds: target.roller.map(r => r.rolId), varsayilanModul: target.varsayilanModul }, sonrakiVeri: { rolIds, varsayilanModul: varsayilanModul ? modulKodu(varsayilanModul) : target.varsayilanModul } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const kod = error instanceof Error ? error.message : "";
    if (kod === "KULLANICI_YOK") return { ok: false, hata: "Kullanıcı bulunamadı" };
    if (kod === "GECERSIZ_ROL") return { ok: false, hata: "Geçersiz veya pasif yetki grubu seçimi" };
    if (kod === "SAHIP_ROLU") return { ok: false, hata: "Firmada tek firma sahibi kaldı; bu kullanıcıdan Firma Sahibi rolü kaldırılamaz" };
    if (kod === "SAHIP_ATAMA") return { ok: false, hata: "Firma Sahibi rolünü yalnızca mevcut bir firma sahibi atayabilir" };
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
