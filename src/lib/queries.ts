// Veri erişim katmanı — sayfalar için okuma sorguları
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getCurrentFirmaId } from "@/lib/auth";
import { istanbulGunAraligi } from "@/lib/zaman";
import type { AlimFisi, Satis, Masraf, FinansHareket, KasaHesap, CariKart } from "@/generated/prisma/client";

async function firmaId(): Promise<string> {
  return getCurrentFirmaId();
}

// Aynı istek (layout + sayfa) içinde tekrar eden sayımları tek sorguya indirir.
export const bekleyenRandimanSayisi = cache(async (fid: string): Promise<number> => {
  return prisma.alimFisi.count({ where: { randimanDurumu: "BEKLIYOR", durum: { not: "IPTAL" }, cari: { firmaId: fid } } });
});

// Prisma Decimal → number dönüşümü
export function n(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function getFirma() {
  const fid = await firmaId();
  return prisma.firma.findUnique({ where: { id: fid } });
}

export async function getAktifSezon(firmaId: string) {
  return prisma.sezon.findFirst({ where: { firmaId, aktif: true } });
}

export async function getVarsayilanDepo(firmaId: string) {
  return prisma.depo.findFirst({ where: { firmaId, aktif: true } });
}

// ─── Bakiyeler ──────────────────────────────────────────────
// balance = ΣALACAK − ΣBORC (firma perspektifi; negatif = firmaya borçlu)

export type BakiyeMap = Partial<Record<string, number>>;

export async function getCariBakiyeler(cariId: string): Promise<BakiyeMap> {
  const fid = await firmaId();
  const gr = await prisma.cariHareket.groupBy({
    by: ["bakiyeTuru", "yon"],
    where: { cariId, cari: { firmaId: fid } },
    _sum: { tutar: true },
  });
  const out: BakiyeMap = {};
  for (const g of gr) {
    const t = n(g._sum.tutar);
    out[g.bakiyeTuru] = (out[g.bakiyeTuru] ?? 0) + (g.yon === "ALACAK" ? t : -t);
  }
  return out;
}

export async function getTumCariBakiyeler(): Promise<Map<string, BakiyeMap>> {
  const fid = await firmaId();
  const gr = await prisma.cariHareket.groupBy({
    by: ["cariId", "bakiyeTuru", "yon"],
    where: { cari: { firmaId: fid } },
    _sum: { tutar: true },
  });
  const map = new Map<string, BakiyeMap>();
  for (const g of gr) {
    const cur = map.get(g.cariId) ?? {};
    cur[g.bakiyeTuru] = (cur[g.bakiyeTuru] ?? 0) + (g.yon === "ALACAK" ? n(g._sum.tutar) : -n(g._sum.tutar));
    map.set(g.cariId, cur);
  }
  return map;
}

// ─── Dashboard ──────────────────────────────────────────────

export async function getDashboardOzet() {
  const { baslangic: bugunBas } = istanbulGunAraligi();
  const fid = await firmaId();

  const [bugunFisler, bekleyenRandiman, stokGr, emanetGr, sonFisler] = await Promise.all([
    prisma.alimFisi.aggregate({
      where: { tarih: { gte: bugunBas }, durum: "ONAYLI", cari: { firmaId: fid } },
      _sum: { kg: true, tutar: true },
      _count: true,
    }),
    bekleyenRandimanSayisi(fid),
    prisma.stokHareket.groupBy({ by: ["mulkiyet"], where: { depo: { firmaId: fid } }, _sum: { kg: true } }),
    prisma.cariHareket.groupBy({
      by: ["yon"],
      where: { bakiyeTuru: "FINDIK_KG", cari: { firmaId: fid } },
      _sum: { tutar: true },
    }),
    prisma.alimFisi.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      where: { cari: { firmaId: fid } }, include: { cari: true },
    }),
  ]);

  const stok = { KENDI: 0, EMANET: 0 } as Record<string, number>;
  for (const s of stokGr) stok[s.mulkiyet] = n(s._sum.kg);

  let emanetKg = 0;
  for (const e of emanetGr) emanetKg += e.yon === "ALACAK" ? -n(e._sum.tutar) : n(e._sum.tutar);

  return {
    bugunAlimKg: n(bugunFisler._sum.kg),
    bugunAlimTutar: n(bugunFisler._sum.tutar),
    bugunFisAdet: bugunFisler._count,
    bekleyenRandiman,
    stokKendi: stok.KENDI,
    stokEmanet: stok.EMANET,
    emanetKgBorcumuz: emanetKg,
    sonFisler,
  };
}

// ─── Cari ───────────────────────────────────────────────────

export async function getCariler(tur?: "URETICI" | "TUCCAR" | "FABRIKA", q?: string, aktif: boolean | "TUMU" = true) {
  const fid = await firmaId();
  return prisma.cariKart.findMany({
    where: {
      firmaId: fid,
      ...(aktif === "TUMU" ? {} : { aktif }),
      ...(tur ? { tur } : {}),
      ...(q ? { ad: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ favori: "desc" }, { ad: "asc" }],
    take: 100,
  });
}

export async function getCari(id: string) {
  const fid = await firmaId();
  return prisma.cariKart.findFirst({ where: { id, firmaId: fid } });
}

export async function getCariHareketler(cariId: string, take = 30) {
  const fid = await firmaId();
  return prisma.cariHareket.findMany({
    where: { cariId, cari: { firmaId: fid } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// ─── Emanet (müstahsil cari kartındaki emanet fındıklar) ────

export async function getCariEmanetleri(cariId: string) {
  const fid = await firmaId();
  const emanetler = await prisma.emanet.findMany({
    where: { cariId, durum: { in: ["ACIK", "KISMI_BOZULDU"] }, cari: { firmaId: fid } },
    include: { alimFisi: true },
    orderBy: { acilisTarihi: "desc" },
  });
  if (emanetler.length === 0) return [];
  const gruplar = await prisma.emanetHareket.groupBy({
    by: ["emanetId", "tip"],
    where: { emanetId: { in: emanetler.map((e) => e.id) } },
    _sum: { kg: true },
  });
  const kalanlar = new Map<string, number>();
  for (const g of gruplar) {
    const onceki = kalanlar.get(g.emanetId) ?? 0;
    kalanlar.set(g.emanetId, onceki + (g.tip === "GIRIS" ? 1 : -1) * n(g._sum.kg));
  }
  return emanetler.map((e) => ({
    id: e.id,
    kalanKg: Math.round((kalanlar.get(e.id) ?? 0) * 1000) / 1000,
    randimanPuan: e.alimFisi?.randimanPuan ? Number(e.alimFisi.randimanPuan) : null,
    tarih: e.acilisTarihi,
    fisNo: e.alimFisi?.fisNo ?? null,
    satinAlmaKodu: e.alimFisi?.satinAlmaKodu ?? null,
  }));
}

export async function getEmanetKalanKg(emanetId: string): Promise<number> {
  const fid = await firmaId();
  const gr = await prisma.emanetHareket.groupBy({
    by: ["tip"],
    where: { emanetId, emanet: { cari: { firmaId: fid } } },
    _sum: { kg: true },
  });
  let kalan = 0;
  for (const g of gr) {
    const t = n(g._sum.kg);
    if (g.tip === "GIRIS") kalan += t;
    else kalan -= t; // BOZMA | IADE
  }
  return Math.round(kalan * 1000) / 1000;
}

export async function getAcikEmanetler() {
  const fid = await firmaId();
  const emanetler = await prisma.emanet.findMany({
    where: { durum: { in: ["ACIK", "KISMI_BOZULDU"] }, cari: { firmaId: fid } },
    include: { cari: true, alimFisi: true },
    orderBy: { acilisTarihi: "asc" },
  });
  if (emanetler.length === 0) return [];
  // Emanet başına ayrı groupBy (N+1) yerine tek gruplu sorgu.
  const gruplar = await prisma.emanetHareket.groupBy({
    by: ["emanetId", "tip"],
    where: { emanetId: { in: emanetler.map((e) => e.id) } },
    _sum: { kg: true },
  });
  const kalanlar = new Map<string, number>();
  for (const g of gruplar) {
    const onceki = kalanlar.get(g.emanetId) ?? 0;
    kalanlar.set(g.emanetId, onceki + (g.tip === "GIRIS" ? 1 : -1) * n(g._sum.kg));
  }
  return emanetler
    .map((e) => ({
      ...e,
      kalanKg: Math.round((kalanlar.get(e.id) ?? 0) * 1000) / 1000,
      randimanPuan: e.alimFisi?.randimanPuan ? Number(e.alimFisi.randimanPuan) : null,
    })
    )
    .filter((e) => e.kalanKg > 0);
}

// ─── Fabrika emaneti (sevkiyatlar) ──────────────────────────

export async function getCariFabrikaEmanetleri(cariId: string) {
  const fid = await firmaId();
  const sevkiyatlar = await prisma.sevkiyat.findMany({
    where: { cariId, durum: "FABRIKA_EMANET", firmaId: fid },
    include: { kalemler: true },
    orderBy: { tarih: "desc" },
  });
  if (sevkiyatlar.length === 0) return [];
  // Randıman, sevkiyatın stok hareketinde tutulur.
  const stokHareketleri = await prisma.stokHareket.findMany({
    where: { kaynakTipi: "SEVKIYAT", kaynakId: { in: sevkiyatlar.map((s) => s.id) } },
    select: { kaynakId: true, randimanPuan: true },
  });
  const randimanlar = new Map<string, number | null>();
  for (const h of stokHareketleri) {
    randimanlar.set(h.kaynakId ?? "", h.randimanPuan ? Number(h.randimanPuan) : null);
  }
  return sevkiyatlar.map((s) => {
    const kalem = s.kalemler[0];
    return {
      id: s.id,
      fisNo: s.fisNo,
      tarih: s.tarih,
      plaka: s.plaka,
      kg: kalem ? Number(kalem.kg) : 0,
      randimanPuan: randimanlar.get(s.id) ?? null,
      aciklama: s.aciklama,
    };
  });
}

// ─── Avans ──────────────────────────────────────────────────

export async function getAcikAvanslar(cariId?: string) {
  const fid = await firmaId();
  return prisma.avans.findMany({
    where: { durum: "ACIK", cari: { firmaId: fid }, ...(cariId ? { cariId } : {}), kalanTl: { gt: 0 } },
    include: { cari: true },
    orderBy: { tarih: "asc" },
  });
}

// ─── Finans / Masraf ────────────────────────────────────────

export async function getHesaplar() {
  const fid = await firmaId();
  return prisma.kasaHesap.findMany({ where: { firmaId: fid, aktif: true }, orderBy: { ad: "asc" } });
}

/**
 * Hesap türü (KASA/BANKA) bazında her hesabın tam bakiyesini veritabanında
 * toplar. Virman her iki hesaba da aynı `tutar` ile ve ters yön etkisiyle
 * yansır; bu nedenle hesap bazında yön işareti uygulanırken virman, hesabın
 * etkisini hesap tarafı denklemler.
 */
export async function getHesapBakiyeleri(tip: "KASA" | "BANKA"): Promise<Map<string, { tur: string; tutar: number }>> {
  const fid = await firmaId();
  const gr = await prisma.finansHareket.groupBy({
    by: ["hesapId", "bakiyeTuru", "tip"],
    where: { hesap: { firmaId: fid, aktif: true, tip } },
    _sum: { tutar: true },
  });
  const bakiyeler = new Map<string, { tur: string; tutar: number }>();
  for (const satir of gr) {
    const etki = satir.tip === "TAHSILAT" || satir.tip === "VIRMAN" ? n(satir._sum.tutar) : -n(satir._sum.tutar);
    const mevcut = bakiyeler.get(satir.hesapId) ?? { tur: satir.bakiyeTuru, tutar: 0 };
    mevcut.tutar += etki;
    bakiyeler.set(satir.hesapId, mevcut);
  }
  return bakiyeler;
}

export async function getSonFinansHareketler(take = 20) {
  const fid = await firmaId();
  return prisma.finansHareket.findMany({
    where: { firmaId: fid },
    orderBy: { createdAt: "desc" },
    take,
    include: { hesap: true },
  });
}

export async function getSonVirmanlar(take = 30) {
  const fid = await firmaId();
  return prisma.finansHareket.findMany({
    where: { tip: "VIRMAN", firmaId: fid },
    orderBy: { createdAt: "desc" },
    take,
    include: { hesap: true },
  });
}

export async function getSonMasraflar(take = 20) {
  const fid = await firmaId();
  return prisma.masraf.findMany({ where: { firmaId: fid }, orderBy: { tarih: "desc" }, take });
}

export async function getMasrafTurleri(aktifMi: boolean | "TUMU" = true) {
  const fid = await firmaId();
  return prisma.masrafTuru.findMany({
    where: { firmaId: fid, ...(aktifMi === "TUMU" ? {} : { aktif: aktifMi }) },
    orderBy: { ad: "asc" },
  });
}

// ─── Araç ───────────────────────────────────────────────────

export async function getAktifAraclar() {
  const fid = await firmaId();
  return prisma.arac.findMany({
    where: { firmaId: fid, aktif: true },
    orderBy: { plaka: "asc" },
  });
}

// ─── Tanımlar (aktif + pasif tüm kayıtlar) ──────────────────

export async function getDepolar() {
  const fid = await firmaId();
  return prisma.depo.findMany({ where: { firmaId: fid }, orderBy: { ad: "asc" } });
}

export async function getTumHesaplar() {
  const fid = await firmaId();
  return prisma.kasaHesap.findMany({ where: { firmaId: fid }, orderBy: [{ tip: "asc" }, { ad: "asc" }] });
}

export async function getKullanicilar() {
  const fid = await firmaId();
  return prisma.kullanici.findMany({
    where: { firmaId: fid },
    include: { roller: { select: { rolId: true } } },
    orderBy: [{ rol: "asc" }, { ad: "asc" }],
  });
}

export async function getAraclar() {
  const fid = await firmaId();
  return prisma.arac.findMany({ where: { firmaId: fid }, orderBy: { plaka: "asc" } });
}

export async function getPersonel() {
  const fid = await firmaId();
  return prisma.personel.findMany({ where: { firmaId: fid }, orderBy: { ad: "asc" } });
}

export async function getSezonlar() {
  const fid = await firmaId();
  return prisma.sezon.findMany({ where: { firmaId: fid }, orderBy: { baslangic: "desc" } });
}

export async function getSubeler() {
  const fid = await firmaId();
  return prisma.sube.findMany({ where: { firmaId: fid, aktif: true }, orderBy: { ad: "asc" } });
}

// ─── Stok ───────────────────────────────────────────────────

export async function getStokOzet() {
  const fid = await firmaId();
  const depolar = await prisma.depo.findMany({ where: { firmaId: fid, aktif: true }, orderBy: { ad: "asc" } });
  if (depolar.length === 0) return [];
  // Depo başına ayrı sorgu (N+1) yerine tek gruplu sorgu.
  const gruplar = await prisma.stokHareket.groupBy({
    by: ["depoId", "mulkiyet"],
    where: { depoId: { in: depolar.map((d) => d.id) } },
    _sum: { kg: true },
  });
  const toplam = new Map<string, { kendiKg: number; emanetKg: number }>();
  for (const g of gruplar) {
    const cur = toplam.get(g.depoId) ?? { kendiKg: 0, emanetKg: 0 };
    if (g.mulkiyet === "KENDI") cur.kendiKg += n(g._sum.kg);
    else cur.emanetKg += n(g._sum.kg);
    toplam.set(g.depoId, cur);
  }
  return depolar.map((d) => {
    const v = toplam.get(d.id) ?? { kendiKg: 0, emanetKg: 0 };
    return { depo: d.ad, kendiKg: v.kendiKg, emanetKg: v.emanetKg, toplamKg: v.kendiKg + v.emanetKg };
  });
}

export async function getStokHareketleri(depoId?: string, take = 50) {
  const fid = await firmaId();
  return prisma.stokHareket.findMany({
    where: { depo: { firmaId: fid }, ...(depoId ? { depoId } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
    include: { depo: true },
  });
}

// ─── Rapor: Kâr/Zarar ───────────────────────────────────────

export type KarZararRaporu = {
  baslangic: Date;
  bitis: Date;
  alimToplam: number;
  alimAdet: number;
  satisToplam: number;
  satisAdet: number;
  cogs: number;
  brutKar: number;
  envanterDegeri: number;
  masrafToplam: number;
  masrafMaliyetToplam: number;
  masrafGenelToplam: number;
  masrafAdet: number;
  odemeToplam: number;
  odemeAdet: number;
  tahsilatToplam: number;
  tahsilatAdet: number;
  karZarar: number;
  alimlar: (AlimFisi & { cari: CariKart })[];
  satislar: Satis[];
  masraflar: Masraf[];
  finansHareketler: (FinansHareket & { hesap: KasaHesap })[];
};

/** Depo bazında ağırlıklı ortalama maliyet (WAC) hesaplar.
 *  Muhasebe standardı: Toplam Maliyet / Toplam Miktar */
async function getDepoBazliWac(fid: string) {
  const hareketler = await prisma.stokHareket.findMany({
    where: { depo: { firmaId: fid }, mulkiyet: "KENDI" },
    select: { depoId: true, kg: true, maliyetBirimTl: true },
    orderBy: { createdAt: "asc" },
  });
  const depolar = new Map<string, { toplamKg: number; toplamMaliyet: number }>();
  for (const h of hareketler) {
    const cur = depolar.get(h.depoId) ?? { toplamKg: 0, toplamMaliyet: 0 };
    cur.toplamKg += Number(h.kg);
    if (Number(h.kg) > 0 && h.maliyetBirimTl) cur.toplamMaliyet += Number(h.maliyetBirimTl) * Number(h.kg);
    depolar.set(h.depoId, cur);
  }
  const out = new Map<string, number>();
  for (const [depoId, v] of depolar) {
    out.set(depoId, v.toplamKg > 0 ? Math.round((v.toplamMaliyet / v.toplamKg) * 100) / 100 : 0);
  }
  return out;
}

export async function getKarZarar(baslangic: Date, bitis: Date): Promise<KarZararRaporu> {
  const { baslangic: bas } = istanbulGunAraligi(baslangic);
  const { bitis: son } = istanbulGunAraligi(bitis);
  const fid = await firmaId();

  const [
    alimAgg, satisAgg, masrafAgg, odemeAgg, tahsilatAgg,
    alimlar, satislar, masraflar, finansHareketler,
  ] = await Promise.all([
    prisma.alimFisi.aggregate({
      where: { tarih: { gte: bas, lt: son }, durum: "ONAYLI", cari: { firmaId: fid } },
      _sum: { tutar: true },
      _count: true,
    }),
    prisma.satis.aggregate({
      where: { tarih: { gte: bas, lt: son }, durum: "ONAYLI", firmaId: fid },
      _sum: { tutar: true },
      _count: true,
    }),
    prisma.masraf.aggregate({
      where: { firmaId: fid, tarih: { gte: bas, lt: son } },
      _sum: { tutar: true },
      _count: true,
    }),
    prisma.finansHareket.aggregate({
      where: { createdAt: { gte: bas, lt: son }, tip: "ODEME", durum: "ONAYLI", firmaId: fid },
      _sum: { tutar: true },
      _count: true,
    }),
    prisma.finansHareket.aggregate({
      where: { createdAt: { gte: bas, lt: son }, tip: "TAHSILAT", durum: "ONAYLI", firmaId: fid },
      _sum: { tutar: true },
      _count: true,
    }),
    prisma.alimFisi.findMany({
      where: { tarih: { gte: bas, lt: son }, durum: "ONAYLI", cari: { firmaId: fid } },
      include: { cari: true },
      orderBy: { tarih: "desc" },
    }),
    prisma.satis.findMany({
      where: { tarih: { gte: bas, lt: son }, durum: "ONAYLI", firmaId: fid },
      orderBy: { tarih: "desc" },
    }),
    prisma.masraf.findMany({
      where: { firmaId: fid, tarih: { gte: bas, lt: son } },
      orderBy: { tarih: "desc" },
    }),
    prisma.finansHareket.findMany({
      where: { createdAt: { gte: bas, lt: son }, durum: "ONAYLI", tip: { in: ["ODEME", "TAHSILAT"] }, firmaId: fid },
      include: { hesap: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const alimToplam   = n(alimAgg._sum.tutar);
  const satisToplam  = n(satisAgg._sum.tutar);

  // Masrafları ayır: maliyete yansıyanlar alım maliyetine eklenir
  const masrafMaliyet = masraflar.filter(m => m.maliyeteYansit);
  const masrafGenel = masraflar.filter(m => !m.maliyeteYansit);
  const masrafMaliyetToplam = masrafMaliyet.reduce((s, m) => s + n(m.tutar), 0);
  const masrafGenelToplam = masrafGenel.reduce((s, m) => s + n(m.tutar), 0);
  const masrafToplam = masrafMaliyetToplam + masrafGenelToplam;

  const odemeToplam  = n(odemeAgg._sum.tutar);
  const tahsilatToplam = n(tahsilatAgg._sum.tutar);

  const wacMap = await getDepoBazliWac(fid);
  const satisKalemleri = await prisma.satisKalem.findMany({
    where: { satis: { tarih: { gte: bas, lt: son }, durum: "ONAYLI", firmaId: fid } },
    select: { depoId: true, kg: true },
  });
  let cogsToplam = 0;
  for (const k of satisKalemleri) {
    const wac = wacMap.get(k.depoId) ?? 0;
    cogsToplam += Number(k.kg) * wac;
  }
  cogsToplam = Math.round(cogsToplam * 100) / 100;

  // Dönem sonu envanter değeri
  const stokGr = await prisma.stokHareket.groupBy({
    by: ["depoId"],
    where: { depo: { firmaId: fid }, mulkiyet: "KENDI" },
    _sum: { kg: true },
  });
  let envanterDegeri = 0;
  for (const s of stokGr) {
    envanterDegeri += n(s._sum.kg) * (wacMap.get(s.depoId) ?? 0);
  }
  envanterDegeri = Math.round(envanterDegeri * 100) / 100;

  return {
    baslangic,
    bitis,
    alimToplam,
    alimAdet: alimAgg._count,
    satisToplam,
    satisAdet: satisAgg._count,
    cogs: cogsToplam,
    brutKar: Math.round((satisToplam - cogsToplam) * 100) / 100,
    envanterDegeri,
    masrafToplam,
    masrafMaliyetToplam,
    masrafGenelToplam,
    masrafAdet: masrafAgg._count,
    odemeToplam,
    odemeAdet: odemeAgg._count,
    tahsilatToplam,
    tahsilatAdet: tahsilatAgg._count,
    // Net kâr = Satış − COGS − (dönem içindeki tüm masraflar).
    karZarar: Math.round((satisToplam - cogsToplam - masrafGenelToplam - masrafMaliyetToplam) * 100) / 100,
    alimlar,
    satislar,
    masraflar,
    finansHareketler,
  };
}

// ─── Rapor: günlük özet ─────────────────────────────────────

export async function getGunlukRapor(tarih: Date) {
  const { baslangic: bas, bitis: son } = istanbulGunAraligi(tarih);
  const fid = await firmaId();
  const [fisler, finans, masraflar, emanetHareket] = await Promise.all([
    prisma.alimFisi.findMany({
      where: { tarih: { gte: bas, lt: son }, durum: { not: "IPTAL" }, cari: { firmaId: fid } },
      include: { cari: true },
      orderBy: { tarih: "asc" },
    }),
    prisma.finansHareket.findMany({
      where: { createdAt: { gte: bas, lt: son }, durum: "ONAYLI", tip: { in: ["ODEME", "TAHSILAT"] }, firmaId: fid },
      include: { hesap: true },
    }),
    prisma.masraf.findMany({ where: { firmaId: fid, tarih: { gte: bas, lt: son } } }),
    prisma.emanetHareket.findMany({
      where: { createdAt: { gte: bas, lt: son }, emanet: { cari: { firmaId: fid } } },
      include: { emanet: { include: { cari: true } } },
    }),
  ]);
  const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);
  return {
    fisler,
    alimKg: sum(fisler, (f) => n(f.kg)),
    alimTutar: sum(fisler, (f) => n(f.tutar)),
    odemeler: finans.filter((f) => f.tip === "ODEME"),
    odemeTutar: sum(finans.filter((f) => f.tip === "ODEME"), (f) => n(f.tutar)),
    tahsilatlar: finans.filter((f) => f.tip === "TAHSILAT"),
    tahsilatTutar: sum(finans.filter((f) => f.tip === "TAHSILAT"), (f) => n(f.tutar)),
    masraflar,
    masrafTutar: sum(masraflar, (m) => n(m.tutar)),
    emanetHareket,
  };
}
