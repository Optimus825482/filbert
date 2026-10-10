"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { gizliDegerDogrula, oturumKapat, oturumOlustur, setupYetkisiVer, sifreDogrula } from "@/lib/auth";
import { izinVar } from "@/lib/rbac/guard";
import { MODULLER, MODUL_CEREZI, MODUL_CEREZ_SURESI, dbModuluCoz, type ModulTanimi } from "@/lib/modul";
import { basariliGirisTemizle, basarisizGirisKaydet, girisEngelliMi } from "@/lib/guvenlik/giris-sinirlayici";
import { basarisizGirisDenemesiKaydet, girisAuditYaz, girisDenemesiEngelliMi } from "@/lib/guvenlik/giris-denemesi";

type GirisSonucu = { ok: boolean; hata?: string; hedef?: string };

/** Proxy/ters-ara katmandan gelen gerçek istemci adresi. */
type GirisKullanicisi = { varsayilanModul: unknown; roller: { rol: { aktif: boolean; sistemRolu?: boolean; kod?: string; izinler: { modul: string; eylem: string }[] } }[] };

/**
 * Giriş sonrası açılacak ekran. Kullanıcının kaydındaki varsayılan modül
 * okunur; kullanıcı o modüle yetkili değilse panoya düşer (menüler zaten
 * yetkiye göre filtrelenir).
 */
function girisHedefi(kullanici: GirisKullanicisi): { modul: ModulTanimi; hedef: string } {
  const modul = MODULLER[dbModuluCoz(kullanici.varsayilanModul)];
  const yetkili = izinVar(
    kullanici as unknown as Parameters<typeof izinVar>[0],
    modul.izinModulu,
    "GORUNTULE",
  );
  return { modul, hedef: yetkili ? modul.anaRota : "/" };
}

async function istemciIpAdresi(): Promise<string | undefined> {
  try {
    const hdrs = await headers();
    return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function girisYap(form: FormData): Promise<GirisSonucu> {
  const ip = await istemciIpAdresi();
  const eposta = String(form.get("eposta") ?? "").trim().toLowerCase();
  const sifre = String(form.get("sifre") ?? "");
  if (!eposta || !sifre) return { ok: false, hata: "E-posta ve parola zorunludur" };
  if (eposta.length > 320 || !/^\S+@\S+\.\S+$/.test(eposta) || sifre.length > 1024) return { ok: false, hata: "Giriş bilgileri geçersiz" };
  // Kalıcı (veritabanı) eşik kontrolü; bellekteki sayaç hızlı bir ilk savunmadır.
  if (girisEngelliMi(eposta) || (await girisDenemesiEngelliMi(eposta, ip))) return { ok: false, hata: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin." };

  const basarisiz = async (): Promise<GirisSonucu> => {
    basarisizGirisKaydet(eposta);
    await basarisizGirisDenemesiKaydet(eposta, ip);
    return { ok: false, hata: "Giriş bilgileri geçersiz" };
  };

  try {
    const sistemEposta = process.env.SYSTEM_ADMIN_MAIL?.trim().toLowerCase();
    if (sistemEposta && eposta === sistemEposta) {
      if (!gizliDegerDogrula(sifre, process.env.SYSTEM_ADMIN_PASS)) return await basarisiz();
      const yonetici = await prisma.sistemYoneticisi.findUnique({ where: { eposta: sistemEposta } });
      if (!yonetici) {
        await setupYetkisiVer();
        basariliGirisTemizle(eposta);
        return { ok: true, hedef: "/setup" };
      }
      if (!yonetici.aktif) return await basarisiz();
      const beniHatirla = form.get("beniHatirla") !== null;
      await oturumOlustur({ sistemYoneticisiId: yonetici.id }, beniHatirla);
      basariliGirisTemizle(eposta);
      await girisAuditYaz({ sistemYoneticisiId: yonetici.id, ipAdresi: ip }, "GIRIS");
      return { ok: true, hedef: "/platform" };
    }

    const kullanici = await prisma.kullanici.findUnique({
      where: { eposta },
      include: { firma: true, roller: { include: { rol: { include: { izinler: true } } } } },
    });
    if (!kullanici?.aktif || !kullanici.firma.aktif || !kullanici.sifreHash || !(await sifreDogrula(sifre, kullanici.sifreHash))) return await basarisiz();
    const beniHatirla2 = form.get("beniHatirla") !== null;
    await oturumOlustur({ kullaniciId: kullanici.id }, beniHatirla2);
    // Kullanıcı kaydındaki varsayılan modül hem çereze yazılır hem de giriş
    // yönlendirmesinde kullanılır; böylece ilgili modülün ekranı açılır.
    const { modul, hedef } = girisHedefi(kullanici);
    (await cookies()).set(MODUL_CEREZI, modul.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MODUL_CEREZ_SURESI,
    });
    basariliGirisTemizle(eposta);
    await girisAuditYaz({ firmaId: kullanici.firmaId, kullaniciId: kullanici.id, ipAdresi: ip }, "GIRIS");
    return { ok: true, hedef };
  } catch (error) {
    // Bağlantı ve beklenmeyen altyapı detayları istemciye sızdırılmaz.
    console.error("girisYap", error);
    return { ok: false, hata: "Giriş şu anda doğrulanamadı. Lütfen tekrar deneyin." };
  }
}

export async function cikisYap() {
  await oturumKapat();
  (await cookies()).delete(MODUL_CEREZI);
  return { ok: true };
}
