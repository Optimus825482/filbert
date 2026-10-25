import { prisma } from "@/lib/db";
import type { HizmetDurumu, HizmetIslemi, Prisma } from "@/generated/prisma/client";

export interface HizmetFiltreParams {
  durum?: string | null;
  liste?: string | null;
  q?: string | null;
}

export interface HizmetListesiParams extends HizmetFiltreParams {
  sayfa?: number | string | null;
  page?: number | string | null;
  limit?: number | string | null;
}

export interface HizmetListesiSonucu {
  kayitlar: HizmetIslemi[];
  toplamKayit: number;
  toplamSayfa: number;
  aktifSayfa: number;
  limit: number;
}

export interface HizmetGenelMetrikleri {
  siradaAdet: number;
  siradaKg: number;
  hazirlaniyorAdet: number;
  hazirlaniyorKg: number;
  tamamlandiAdet: number;
  tamamlandiKg: number;
  teslimAdet: number;
  teslimKg: number;
  smsBekleyenAdet: number;
  toplamKirmaKg: number;
  toplamKavurmaKg: number;
  toplamPaketlemeKg: number;
  toplamCiroTl: number;
  tahsilEdilenTl: number;
  bekleyenCiroTl: number;
}

/**
 * Fındık işleme sorguları için parametrelerden Prisma Where objesi üretir.
 * Modül listeleri, tekil durumlar ve arama ifadesini tek bir SQL koşuluna derler.
 */
export function buildHizmetWhere(
  firmaId: string,
  params: HizmetFiltreParams = {}
): Prisma.HizmetIslemiWhereInput {
  const { durum, liste, q } = params;
  const where: Prisma.HizmetIslemiWhereInput = { firmaId };

  // Modül hızlı listeleri
  if (liste === "kuyruk") {
    where.durum = "SIRAYA_ALINDI";
  } else if (liste === "hazirlaniyor") {
    where.durum = { in: ["KIRIM", "KAVURMA", "PAKETLEME"] };
  } else if (liste === "teslimat" || liste === "hazir") {
    where.durum = "TAMAMLANDI";
  } else if (liste === "sms") {
    where.durum = "TAMAMLANDI";
    where.tamamlandiSmsGonderildi = false;
  } else if (liste === "tahsilat") {
    where.durum = "TESLIM_EDILDI";
    where.odemeDurumu = { not: "ODENDI" };
  } else if (durum && durum !== "HEPSI") {
    where.durum = durum as HizmetDurumu;
  }

  // Arama filtresi: Sıra No, Müşteri Adı, Telefon, Notlar
  if (q && q.trim()) {
    const arama = q.trim();
    where.OR = [
      { siraNo: { contains: arama, mode: "insensitive" } },
      { musteriAdi: { contains: arama, mode: "insensitive" } },
      { telefon: { contains: arama } },
      { notlar: { contains: arama, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Sayfalanmış ve filtrelenmiş fındık işleme kayıtlarını getirir.
 * Sabit `take: 300` sınırını kaldırarak sunucu tarafında tam sayfalama ve sayım sağlar.
 */
export async function getHizmetListesi(
  firmaId: string,
  params: HizmetListesiParams = {}
): Promise<HizmetListesiSonucu> {
  const sayfaGirdi = params.sayfa ?? params.page;
  const sayfa = Math.max(1, Number(sayfaGirdi) || 1);
  const hamLimit = Number(params.limit) || 50;
  // Sayfa boyutu 10 ile 200 arasında sınırlandırılır
  const limit = Math.min(200, Math.max(10, hamLimit));
  const skip = (sayfa - 1) * limit;

  const where = buildHizmetWhere(firmaId, params);

  const [kayitlar, toplamKayit] = await Promise.all([
    prisma.hizmetIslemi.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { siraSayisi: "desc" }],
      skip,
      take: limit,
    }),
    prisma.hizmetIslemi.count({ where }),
  ]);

  const toplamSayfa = Math.max(1, Math.ceil(toplamKayit / limit));

  return {
    kayitlar,
    toplamKayit,
    toplamSayfa,
    aktifSayfa: sayfa,
    limit,
  };
}

/**
 * Firma genelindeki tüm aktif fındık işleme kayıtları üzerinde veritabanı düzeyinde
 * aggregate ve groupBy sorguları çalıştırarak KPI sayaçlarını eksiksiz hesaplar.
 */
export async function getHizmetGenelMetrikleri(
  firmaId: string
): Promise<HizmetGenelMetrikleri> {
  const [
    durumGruplari,
    smsBekleyenAdet,
    kirmaAgg,
    kavurmaAgg,
    paketlemeAgg,
    ciroAgg,
    bekleyenAgg,
    odendiTahsilAgg,
    odendiToplamAgg,
  ] = await Promise.all([
    // Durum bazlı toplam adet ve kilo
    prisma.hizmetIslemi.groupBy({
      by: ["durum"],
      where: { firmaId, durum: { not: "IPTAL" } },
      _count: { _all: true },
      _sum: { kilo: true },
    }),
    // SMS bekleyen adedi
    prisma.hizmetIslemi.count({
      where: {
        firmaId,
        durum: "TAMAMLANDI",
        tamamlandiSmsGonderildi: false,
      },
    }),
    // Kırma hacmi
    prisma.hizmetIslemi.aggregate({
      where: { firmaId, durum: { not: "IPTAL" }, kirma: true },
      _sum: { kilo: true },
    }),
    // Kavurma hacmi
    prisma.hizmetIslemi.aggregate({
      where: { firmaId, durum: { not: "IPTAL" }, kavurma: true },
      _sum: { kilo: true },
    }),
    // Paketleme hacmi
    prisma.hizmetIslemi.aggregate({
      where: { firmaId, durum: { not: "IPTAL" }, paketleme: true },
      _sum: { kilo: true },
    }),
    // Toplam Ciro
    prisma.hizmetIslemi.aggregate({
      where: { firmaId, durum: { not: "IPTAL" } },
      _sum: { toplamTutar: true },
    }),
    // Bekleyen / Veresiye Ciro
    prisma.hizmetIslemi.aggregate({
      where: {
        firmaId,
        durum: { not: "IPTAL" },
        odemeDurumu: { not: "ODENDI" },
      },
      _sum: { toplamTutar: true },
    }),
    // Ödenen (tahsilEdilenTutar girilmiş olanlar)
    prisma.hizmetIslemi.aggregate({
      where: {
        firmaId,
        durum: { not: "IPTAL" },
        odemeDurumu: "ODENDI",
        tahsilEdilenTutar: { not: null },
      },
      _sum: { tahsilEdilenTutar: true },
    }),
    // Ödenen (tahsilEdilenTutar null olup toplamTutar esas alınanlar)
    prisma.hizmetIslemi.aggregate({
      where: {
        firmaId,
        durum: { not: "IPTAL" },
        odemeDurumu: "ODENDI",
        tahsilEdilenTutar: null,
      },
      _sum: { toplamTutar: true },
    }),
  ]);

  return hesaplaHizmetMetrikleri({
    durumGruplari: durumGruplari as Array<{
      durum: HizmetDurumu;
      _count: { _all: number };
      _sum: { kilo: unknown };
    }>,
    smsBekleyenAdet,
    toplamKirmaKg: Number(kirmaAgg._sum.kilo ?? 0),
    toplamKavurmaKg: Number(kavurmaAgg._sum.kilo ?? 0),
    toplamPaketlemeKg: Number(paketlemeAgg._sum.kilo ?? 0),
    toplamCiroTl: Number(ciroAgg._sum.toplamTutar ?? 0),
    bekleyenCiroTl: Number(bekleyenAgg._sum.toplamTutar ?? 0),
    tahsilEdilenTahsilAggTl: Number(odendiTahsilAgg._sum.tahsilEdilenTutar ?? 0),
    tahsilEdilenToplamAggTl: Number(odendiToplamAgg._sum.toplamTutar ?? 0),
  });
}

export interface HizmetMetrikHesapGirdisi {
  durumGruplari: Array<{
    durum: HizmetDurumu;
    _count: { _all: number };
    _sum: { kilo: unknown };
  }>;
  smsBekleyenAdet: number;
  toplamKirmaKg: number;
  toplamKavurmaKg: number;
  toplamPaketlemeKg: number;
  toplamCiroTl: number;
  bekleyenCiroTl: number;
  tahsilEdilenTahsilAggTl: number;
  tahsilEdilenToplamAggTl: number;
}

/**
 * Durum grupları ve aggregate sorgu sonuçlarından nihai KPI ve ciro metriklerini
 * hatasız ve deterministik biçimde hesaplayan saf (pure) hesaplama fonksiyonu.
 */
export function hesaplaHizmetMetrikleri(
  girdi: HizmetMetrikHesapGirdisi
): HizmetGenelMetrikleri {
  let siradaAdet = 0;
  let siradaKg = 0;
  let hazirlaniyorAdet = 0;
  let hazirlaniyorKg = 0;
  let tamamlandiAdet = 0;
  let tamamlandiKg = 0;
  let teslimAdet = 0;
  let teslimKg = 0;

  for (const g of girdi.durumGruplari) {
    const adet = g._count._all;
    const kg = Number(g._sum.kilo ?? 0);

    if (g.durum === "SIRAYA_ALINDI") {
      siradaAdet += adet;
      siradaKg += kg;
    } else if (
      g.durum === "KIRIM" ||
      g.durum === "KAVURMA" ||
      g.durum === "PAKETLEME"
    ) {
      hazirlaniyorAdet += adet;
      hazirlaniyorKg += kg;
    } else if (g.durum === "TAMAMLANDI") {
      tamamlandiAdet += adet;
      tamamlandiKg += kg;
    } else if (g.durum === "TESLIM_EDILDI") {
      teslimAdet += adet;
      teslimKg += kg;
    }
  }

  const tahsilEdilenTl =
    Number(girdi.tahsilEdilenTahsilAggTl ?? 0) +
    Number(girdi.tahsilEdilenToplamAggTl ?? 0);

  return {
    siradaAdet,
    siradaKg,
    hazirlaniyorAdet,
    hazirlaniyorKg,
    tamamlandiAdet,
    tamamlandiKg,
    teslimAdet,
    teslimKg,
    smsBekleyenAdet: girdi.smsBekleyenAdet,
    toplamKirmaKg: Number(girdi.toplamKirmaKg ?? 0),
    toplamKavurmaKg: Number(girdi.toplamKavurmaKg ?? 0),
    toplamPaketlemeKg: Number(girdi.toplamPaketlemeKg ?? 0),
    toplamCiroTl: Number(girdi.toplamCiroTl ?? 0),
    tahsilEdilenTl,
    bekleyenCiroTl: Number(girdi.bekleyenCiroTl ?? 0),
  };
}
