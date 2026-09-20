import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { getFirmaSmsAyarlari } from "@/lib/sms/sms-servisi";
import { YeniHizmetFormu } from "./yeni-hizmet-formu";

export const dynamic = "force-dynamic";

export default async function YeniHizmetPage() {
  await requirePagePermission("HIZMET", "OLUSTUR");
  const firma = await getCurrentFirma();

  const [hizmetTipleri, smsAyari, cariler] = await Promise.all([
    prisma.hizmetTipi.findMany({
      where: { firmaId: firma.id, aktif: true },
      orderBy: { sira: "asc" },
    }),
    getFirmaSmsAyarlari(firma.id),
    prisma.cariKart.findMany({
      where: { firmaId: firma.id, aktif: true },
      select: { id: true, ad: true, telefon: true, tur: true },
      orderBy: { ad: "asc" },
      take: 500,
    }),
  ]);

  return (
    <YeniHizmetFormu
      hizmetTipleri={hizmetTipleri.map((t) => ({
        id: t.id,
        ad: t.ad,
        kirma: t.kirma,
        kavurma: t.kavurma,
        paketleme: t.paketleme,
        varsayilanBirimFiyat: Number(t.varsayilanBirimFiyat),
      }))}
      cariler={cariler.map((c) => ({
        id: c.id,
        ad: c.ad,
        telefon: c.telefon || "",
        tur: c.tur,
      }))}
      smsAktif={smsAyari.aktif || smsAyari.saglayici === "TEST"}
      otomatikGirisSms={smsAyari.otomatikGirisSms}
    />
  );
}
