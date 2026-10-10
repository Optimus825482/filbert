"use server";

/**
 * Aktif modül tercihi ve kullanıcı varsayılan modülü.
 *
 * Aktif modül çerezde tutulur; böylece kullanıcı modül değiştirdiğinde menüler
 * anında o modüle daralır. Girişte açılacak modül ise kullanıcı kaydında
 * (`Kullanici.varsayilanModul`) saklanır ve giriş yönlendirmesinde okunur.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentOturum } from "@/lib/auth";
import { izinVar } from "@/lib/rbac/guard";
import {
  MODULLER,
  MODUL_CEREZI,
  MODUL_CEREZ_SURESI,
  dbModulKodu,
  modulCoz,
  type ModulId,
} from "@/lib/modul";

type Sonuc = { ok: boolean; hata?: string };
type ModulSonucu = Sonuc & { modul?: ModulId };

async function oturumKullanicisi() {
  const oturum = await getCurrentOturum();
  const user = oturum?.kullanici;
  if (!user?.aktif || !user.firma.aktif) return null;
  return user;
}

function modulYetkisiVar(user: Parameters<typeof izinVar>[0], modul: ModulId) {
  return izinVar(user, MODULLER[modul].izinModulu, "GORUNTULE");
}

async function modulCereziniYaz(modul: ModulId) {
  (await cookies()).set(MODUL_CEREZI, modul, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MODUL_CEREZ_SURESI,
  });
}

/** Sidebar/ayarlar formlarından çağrılan geçiş: çerezi yazar, modülü açar. */
export async function modulDegistirVeGec(form: FormData): Promise<void> {
  const hedef = modulCoz(form.get("modul"));
  const user = await oturumKullanicisi();
  if (!user) redirect("/giris");
  if (!hedef || !modulYetkisiVar(user, hedef)) redirect("/yetkisiz");
  await modulCereziniYaz(hedef);
  revalidatePath("/", "layout");
  redirect(MODULLER[hedef].anaRota);
}

/** İstemci bileşenlerinden çağrılan geçiş; yönlendirmeyi çağıran yapar. */
export async function aktifModuluDegistir(modul: ModulId): Promise<ModulSonucu> {
  if (!modulCoz(modul)) return { ok: false, hata: "Geçersiz modül" };
  const user = await oturumKullanicisi();
  if (!user) return { ok: false, hata: "Oturum açmanız gerekiyor" };
  if (!modulYetkisiVar(user, modul)) return { ok: false, hata: "Bu modüle erişim yetkiniz yok" };
  await modulCereziniYaz(modul);
  revalidatePath("/", "layout");
  return { ok: true, modul };
}

/** Ayarlar ekranı: giriş sonrası açılacak modülü kullanıcı kaydına yazar. */
export async function varsayilanModuluGuncelle(modul: ModulId): Promise<ModulSonucu> {
  if (!modulCoz(modul)) return { ok: false, hata: "Geçersiz modül" };
  const user = await oturumKullanicisi();
  if (!user) return { ok: false, hata: "Oturum açmanız gerekiyor" };
  if (!modulYetkisiVar(user, modul)) return { ok: false, hata: "Bu modüle erişim yetkiniz yok" };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.kullanici.update({ where: { id: user.id }, data: { varsayilanModul: dbModulKodu(modul) } });
      await tx.auditKaydi.create({
        data: {
          firmaId: user.firmaId,
          kullaniciId: user.id,
          modul: "AYARLAR",
          eylem: "GUNCELLE",
          hedefTipi: "Kullanici",
          hedefId: user.id,
          oncekiVeri: { varsayilanModul: user.varsayilanModul },
          sonrakiVeri: { varsayilanModul: dbModulKodu(modul) },
          aciklama: "Girişte açılacak modül güncellendi.",
        },
      });
    });
  } catch (error) {
    console.error("varsayilanModuluGuncelle", error);
    return { ok: false, hata: "Varsayılan modül kaydedilemedi" };
  }
  await modulCereziniYaz(modul);
  revalidatePath("/", "layout");
  revalidatePath("/ayarlar");
  return { ok: true, modul };
}