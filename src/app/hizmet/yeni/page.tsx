import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { getFirmaSmsAyarlari } from "@/lib/sms/sms-servisi";
import { YeniHizmetFormu } from "./yeni-hizmet-formu";

export const dynamic = "force-dynamic";

export default async function YeniHizmetPage() {
  await requirePagePermission("HIZMET", "OLUSTUR");
  const firma = await getCurrentFirma();

  const [hizmetTipleri, smsAyari, cariler, gecmisHizmetler] = await Promise.all([
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
    prisma.hizmetIslemi.findMany({
      where: { firmaId: firma.id },
      select: { musteriAdi: true, telefon: true, cariId: true },
      distinct: ["musteriAdi", "telefon"],
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Cari kartlar ve geçmiş sipariş müşterilerini birleştir ve tekilleştir
  const musterilerMap = new Map<
    string,
    { id?: string; ad: string; telefon: string; tur?: string; kaynak: "CARI" | "GECMIS" }
  >();

  for (const c of cariler) {
    const anahtar = c.ad.trim().toLocaleLowerCase("tr-TR");
    musterilerMap.set(anahtar, {
      id: c.id,
      ad: c.ad,
      telefon: c.telefon || "",
      tur: c.tur,
      kaynak: "CARI",
    });
  }

  for (const g of gecmisHizmetler) {
    const anahtar = g.musteriAdi.trim().toLocaleLowerCase("tr-TR");
    if (!musterilerMap.has(anahtar)) {
      musterilerMap.set(anahtar, {
        id: g.cariId || undefined,
        ad: g.musteriAdi,
        telefon: g.telefon || "",
        kaynak: "GECMIS",
      });
    }
  }

  const musteriOnerileri = Array.from(musterilerMap.values());

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
      musteriOnerileri={musteriOnerileri}
      smsAktif={smsAyari.aktif || smsAyari.saglayici === "TEST"}
      otomatikGirisSms={smsAyari.otomatikGirisSms}
    />
  );
}
