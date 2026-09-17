"server only";
import { getCurrentOturum } from "@/lib/auth";
import type { IzinEylemi, UygulamaModulu } from "@/generated/prisma/client";
import { redirect } from "next/navigation";

type YetkiBaglami = { roller: { rol: { aktif: boolean; izinler: { modul: UygulamaModulu; eylem: IzinEylemi }[] } }[] };

export function izinVar(user: YetkiBaglami, modul: UygulamaModulu, eylem: IzinEylemi) {
  return user.roller.some((assignment) => assignment.rol.aktif && assignment.rol.izinler.some((permission) => permission.modul === modul && permission.eylem === eylem));
}

export async function requirePermission(modul: UygulamaModulu, eylem: IzinEylemi) {
  const session = await getCurrentOturum();
  const user = session?.kullanici;
  if (!user?.aktif || !user.firma.aktif) throw new Error("Oturum açmanız gerekiyor");
  const permitted = izinVar(user, modul, eylem);
  if (!permitted) throw new Error("Bu işlem için yetkiniz yok");
  return user;
}

/** Sayfa render'larında hata ekranı yerine güvenli yönlendirme kullanılır.
 * Sunucu aksiyonları ve API'ler, çağırana açık hata döndürebilmek için
 * requirePermission kullanmaya devam eder. */
export async function requirePagePermission(modul: UygulamaModulu, eylem: IzinEylemi) {
  const session = await getCurrentOturum();
  const user = session?.kullanici;
  if (!user?.aktif || !user.firma.aktif) redirect("/giris");
  if (!izinVar(user, modul, eylem)) redirect("/yetkisiz");
  return user;
}

/** Birden fazla yönetim alanının ortak giriş ekranları için kullanılır.
 * Kullanıcı, kendisine tanımlı alt modülün ekranına ulaşabilir; sayfa içindeki
 * diğer sekmeler ayrıca kendi izinleriyle gizlenir. */
export async function requireAnyPagePermission(...gerekenler: readonly (readonly [UygulamaModulu, IzinEylemi])[]) {
  const session = await getCurrentOturum();
  const user = session?.kullanici;
  if (!user?.aktif || !user.firma.aktif) redirect("/giris");
  if (!gerekenler.some(([modul, eylem]) => izinVar(user, modul, eylem))) redirect("/yetkisiz");
  return user;
}
