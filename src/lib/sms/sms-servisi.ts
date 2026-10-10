import { prisma } from "@/lib/db";
import {
  NETGSM_TESLIM_DURUMLARI,
  VARSAYILAN_KAYIT_SABLONU,
  VARSAYILAN_TAMAMLANDI_SABLONU,
  VARSAYILAN_TESLIM_HATIRLATMA_SABLONU,
  type SmsAyarlari,
  type SmsGonderSecenekleri,
  type SmsGonderSonuc,
  type SmsKayitDurumu,
  type SmsKayitTipi,
  type SmsKodlama,
  type SmsSaglayici,
} from "./types";
import { telefonTemizle, smsParcaHesapla } from "./utils";
import {
  genericHttpGonder,
  iletiMerkeziGonder,
  netgsmGonder,
  netgsmRaporSorgula,
} from "./saglayicilar";

export { sablonDoldur, smsParcaHesapla, telefonTemizle } from "./utils";
export { netgsmBakiyeSorgula, netgsmBasliklariGetir, netgsmRaporSorgula } from "./saglayicilar";

/** Veritabanında kaydı olmayan firmalar için güvenli varsayılanlar. */
function varsayilanAyarlar(): SmsAyarlari {
  return {
    aktif: false,
    saglayici: "TEST",
    apiUrl: "",
    kullaniciAdi: "",
    sifre: "",
    baslik: "",
    kayitSablonu: VARSAYILAN_KAYIT_SABLONU,
    tamamlandiSablonu: VARSAYILAN_TAMAMLANDI_SABLONU,
    teslimHatirlatmaSablonu: VARSAYILAN_TESLIM_HATIRLATMA_SABLONU,
    otomatikGirisSms: true,
    birimMaliyetKurus: null,
    kodlama: "TR",
    appname: "",
  };
}

/** Firma SMS ayarlarını veritabanından getirir, yoksa varsayılan ayarları döndürür. */
export async function getFirmaSmsAyarlari(firmaId: string): Promise<SmsAyarlari> {
  const kayit = await prisma.smsAyari.findUnique({
    where: { firmaId },
  });

  if (!kayit) return varsayilanAyarlar();

  return {
    aktif: kayit.aktif,
    saglayici: (kayit.saglayici as SmsSaglayici) || "TEST",
    apiUrl: kayit.apiUrl ?? "",
    kullaniciAdi: kayit.kullaniciAdi ?? "",
    sifre: kayit.sifre ?? "",
    baslik: kayit.baslik ?? "",
    kayitSablonu: kayit.kayitSablonu || VARSAYILAN_KAYIT_SABLONU,
    tamamlandiSablonu: kayit.tamamlandiSablonu || VARSAYILAN_TAMAMLANDI_SABLONU,
    teslimHatirlatmaSablonu:
      kayit.teslimHatirlatmaSablonu || VARSAYILAN_TESLIM_HATIRLATMA_SABLONU,
    otomatikGirisSms: kayit.otomatikGirisSms,
    birimMaliyetKurus: kayit.birimMaliyetKurus ?? null,
    kodlama: (kayit.kodlama as SmsKodlama) ?? "TR",
    appname: kayit.appname ?? "",
  };
}

/**
 * Gönderim kaydını günlüğe yazar. Günlük yazımı başarısız olsa bile SMS
 * gönderimi durdurulmaz; amaç iş akışını kilitlememek, yalnızca iz bırakmaktır.
 */
async function kayitOlustur(girdi: {
  firmaId: string;
  telefon: string;
  mesaj: string;
  ipucuTipi: SmsKayitTipi;
  ayarlar: SmsAyarlari;
  parcaSayisi: number;
  secenekler: SmsGonderSecenekleri;
}): Promise<string | null> {
  try {
    const kayit = await prisma.smsKaydi.create({
      data: {
        firmaId: girdi.firmaId,
        hizmetIslemiId: girdi.secenekler.hizmetIslemiId ?? null,
        musteriAdi: girdi.secenekler.musteriAdi ?? null,
        telefon: girdi.telefon,
        mesaj: girdi.mesaj,
        tip: girdi.secenekler.tip ?? girdi.ipucuTipi,
        saglayici: girdi.ayarlar.saglayici,
        durum: "KUYRUKTA",
        kodlama: girdi.ayarlar.kodlama,
        parcaSayisi: girdi.parcaSayisi,
        birimMaliyetKurus: girdi.ayarlar.birimMaliyetKurus,
        denemeAdedi: 1,
        olusturanKullaniciId: girdi.secenekler.kullaniciId ?? null,
      },
      select: { id: true },
    });
    return kayit.id;
  } catch (hata) {
    console.error("SMS kaydı yazılamadı:", hata);
    return null;
  }
}

async function kayitGuncelle(
  kayitId: string | null,
  veri: {
    durum: SmsKayitDurumu;
    saglayiciIsId?: string | null;
    hataKodu?: string | null;
    hataAciklama?: string | null;
    saglayiciDurumKodu?: number | null;
    teslimAt?: Date | null;
  }
): Promise<void> {
  if (!kayitId) return;
  try {
    await prisma.smsKaydi.update({
      where: { id: kayitId },
      data: {
        durum: veri.durum,
        saglayiciIsId: veri.saglayiciIsId ?? undefined,
        hataKodu: veri.hataKodu ?? undefined,
        hataAciklama: veri.hataAciklama ?? undefined,
        saglayiciDurumKodu: veri.saglayiciDurumKodu ?? undefined,
        teslimAt: veri.teslimAt ?? undefined,
      },
    });
  } catch (hata) {
    console.error("SMS kaydı güncellenemedi:", hata);
  }
}

/**
 * Belirtilen firmaya ait SMS yapılandırmasını kullanarak alıcıya SMS gönderir
 * ve sonucu `SmsKaydi` günlüğüne yazar. Böylece "mesaj gitti mi, sağlayıcı ne
 * döndü" sorusu FİLBERT içinden yanıtlanır.
 */
export async function smsGonder(
  firmaId: string,
  aliciTelefon: string,
  mesaj: string,
  secenekler: SmsGonderSecenekleri = {}
): Promise<SmsGonderSonuc> {
  const ayarlar = await getFirmaSmsAyarlari(firmaId);
  const normalizeTel = telefonTemizle(aliciTelefon);

  if (!normalizeTel || normalizeTel.length < 10) {
    return { basarili: false, hata: "Geçersiz telefon numarası" };
  }

  if (!mesaj || !mesaj.trim()) {
    return { basarili: false, hata: "Gönderilecek mesaj boş olamaz" };
  }

  const parcaSayisi = smsParcaHesapla(mesaj, ayarlar.kodlama).parcaSayisi;
  const tip = secenekler.tip ?? "MANUEL";
  const kayitId = await kayitOlustur({
    firmaId,
    telefon: normalizeTel,
    mesaj,
    ipucuTipi: tip,
    ayarlar,
    parcaSayisi,
    secenekler,
  });

  // SMS servisi kapalı ya da test modundaysa gönderim simüle edilir.
  if (!ayarlar.aktif || ayarlar.saglayici === "TEST") {
    console.log(
      `[SMS SİMÜLASYONU] Alıcı: ${normalizeTel} | Sağlayıcı: ${ayarlar.saglayici} | Mesaj: ${mesaj}`
    );
    const mesajId = `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await kayitGuncelle(kayitId, {
      durum: "SIMULASYON",
      saglayiciIsId: mesajId,
      hataAciklama: ayarlar.aktif ? "Test modu: gönderim yapılmadı" : "SMS servisi kapalı",
    });
    return { basarili: true, simulasyon: true, mesajId, parcaSayisi, kayitId: kayitId ?? undefined };
  }

  let sonuc: SmsGonderSonuc;
  try {
    if (ayarlar.saglayici === "NETGSM") {
      sonuc = await netgsmGonder(ayarlar, normalizeTel, mesaj);
    } else if (ayarlar.saglayici === "ILETIMERKEZI") {
      sonuc = await iletiMerkeziGonder(ayarlar, normalizeTel, mesaj);
    } else if (ayarlar.saglayici === "GENERIC_HTTP") {
      sonuc = await genericHttpGonder(ayarlar, normalizeTel, mesaj);
    } else {
      sonuc = { basarili: false, hata: `Desteklenmeyen sağlayıcı: ${ayarlar.saglayici}` };
    }
  } catch (error) {
    console.error("SMS gönderim hatası:", error);
    sonuc = {
      basarili: false,
      hata: error instanceof Error ? error.message : "SMS gönderilirken bilinmeyen hata oluştu",
    };
  }

  await kayitGuncelle(kayitId, {
    durum: sonuc.basarili ? "GONDERILDI" : "HATA",
    saglayiciIsId: sonuc.mesajId ?? null,
    hataKodu: sonuc.hataKodu ?? null,
    hataAciklama: sonuc.hata ?? null,
  });

  return { ...sonuc, parcaSayisi: sonuc.parcaSayisi ?? parcaSayisi, kayitId: kayitId ?? undefined };
}

// ─── SMS GÜNLÜĞÜ OKUMA / İZLEME ─────────────────────────────

export interface SmsKayitFiltresi {
  durum?: SmsKayitDurumu | "HEPSI";
  tip?: SmsKayitTipi | "HEPSI";
  arama?: string;
  baslangic?: Date;
  bitis?: Date;
  limit?: number;
}

/** SMS Merkezi listesi: firma kapsamlı, en yeni kayıt önce. */
export async function smsKayitlariniGetir(firmaId: string, filtre: SmsKayitFiltresi = {}) {
  const arama = filtre.arama?.trim();
  return prisma.smsKaydi.findMany({
    where: {
      firmaId,
      ...(filtre.durum && filtre.durum !== "HEPSI" ? { durum: filtre.durum } : {}),
      ...(filtre.tip && filtre.tip !== "HEPSI" ? { tip: filtre.tip } : {}),
      ...(filtre.baslangic || filtre.bitis
        ? {
            createdAt: {
              ...(filtre.baslangic ? { gte: filtre.baslangic } : {}),
              ...(filtre.bitis ? { lte: filtre.bitis } : {}),
            },
          }
        : {}),
      ...(arama
        ? {
            OR: [
              { musteriAdi: { contains: arama, mode: "insensitive" as const } },
              { telefon: { contains: arama } },
              { mesaj: { contains: arama, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filtre.limit ?? 200, 500),
    include: { hizmetIslemi: { select: { siraNo: true } } },
  });
}

/**
 * SMS Merkezi üst şerit metrikleri: bugün gönderilen, teslim edilen, hatalı ve
 * rapor bekleyen kayıtlar; ayrıca bugünkü tahmini kredi maliyeti (kuruş).
 */
export async function smsSayaclari(firmaId: string, bugunBaslangic: Date) {
  const [bugun, durumlar, kredi] = await Promise.all([
    prisma.smsKaydi.groupBy({
      by: ["durum"],
      where: { firmaId, createdAt: { gte: bugunBaslangic } },
      _count: { _all: true },
      _sum: { parcaSayisi: true },
    }),
    prisma.smsKaydi.groupBy({
      by: ["durum"],
      where: { firmaId },
      _count: { _all: true },
    }),
    prisma.smsKaydi.aggregate({
      where: { firmaId, createdAt: { gte: bugunBaslangic } },
      _sum: { parcaSayisi: true },
    }),
  ]);

  const say = (gruplar: { durum: string; _count: { _all: number } }[], hedefler: readonly string[]) =>
    gruplar
      .filter((grup) => hedefler.includes(grup.durum))
      .reduce((toplam, grup) => toplam + grup._count._all, 0);

  return {
    bugunGonderilen: say(bugun, ["GONDERILDI", "TESLIM_EDILDI", "SIMULASYON"]),
    bugunTeslimEdilen: say(bugun, ["TESLIM_EDILDI"]),
    bugunHatali: say(bugun, ["HATA"]),
    bugunParca: kredi._sum.parcaSayisi ?? 0,
    /** Sağlayıcıya ulaşmış, teslim raporu henüz okunmamış kayıtlar. */
    raporBekleyen: say(durumlar, ["GONDERILDI"]),
    /** Rapor sorgusuyla hataya düşenler ve hiç gönderilemeyenler. */
    hataliToplam: say(durumlar, ["HATA"]),
    teslimEdilenToplam: say(durumlar, ["TESLIM_EDILDI"]),
    toplamKayit: durumlar.reduce((toplam, grup) => toplam + grup._count._all, 0),
  };
}

/**
 * Gönderilmiş mesajların teslim durumunu sağlayıcıdan okur ve kayıtları
 * günceller. Tek bir kayıt ya da rapor bekleyen tüm kayıtlar sorgulanabilir.
 */
export async function smsTeslimDurumunuYenile(
  firmaId: string,
  kayitId?: string
): Promise<{ ok: boolean; guncellenen: number; hata?: string }> {
  const ayarlar = await getFirmaSmsAyarlari(firmaId);
  if (ayarlar.saglayici !== "NETGSM") {
    return { ok: false, guncellenen: 0, hata: "Teslim raporu yalnızca Netgsm için sorgulanabilir" };
  }
  if (!ayarlar.aktif) {
    return { ok: false, guncellenen: 0, hata: "SMS servisi kapalı" };
  }

  const kayitlar = await prisma.smsKaydi.findMany({
    where: {
      firmaId,
      durum: "GONDERILDI",
      saglayiciIsId: { not: null },
      ...(kayitId ? { id: kayitId } : {}),
    },
    select: { id: true, saglayiciIsId: true },
    orderBy: { createdAt: "desc" },
    take: kayitId ? 1 : 50,
  });

  const jobIdler = kayitlar
    .map((kayit) => kayit.saglayiciIsId)
    .filter((jobId): jobId is string => Boolean(jobId));
  if (jobIdler.length === 0) return { ok: true, guncellenen: 0 };

  const rapor = await netgsmRaporSorgula(ayarlar, jobIdler);
  if (!rapor.basarili) return { ok: false, guncellenen: 0, hata: rapor.hata };

  const jobIdyeGore = new Map<string, (typeof kayitlar)[number]>();
  for (const kayit of kayitlar) {
    if (kayit.saglayiciIsId) jobIdyeGore.set(kayit.saglayiciIsId, kayit);
  }

  let guncellenen = 0;
  for (const satir of rapor.satirlar ?? []) {
    const kayit = jobIdyeGore.get(satir.jobid);
    if (!kayit) continue;
    const esleme = NETGSM_TESLIM_DURUMLARI[satir.status];
    if (!esleme) continue;
    // 0 = "kuyrukta": kayıt zaten GONDERILDI; gereksiz yazma yapılmaz.
    if (esleme.durum === "GONDERILDI") continue;
    await prisma.smsKaydi.update({
      where: { id: kayit.id },
      data: {
        durum: esleme.durum,
        saglayiciDurumKodu: satir.status,
        hataAciklama: esleme.durum === "HATA" ? esleme.etiket : null,
        teslimAt: esleme.durum === "TESLIM_EDILDI" ? new Date() : null,
      },
    });
    guncellenen += 1;
  }

  return { ok: true, guncellenen };
}

/** Başarısız (ya da simüle edilmiş) bir gönderimi yeniden dener. */
export async function smsKaydiTekrarGonder(
  firmaId: string,
  kayitId: string,
  kullaniciId?: string
): Promise<SmsGonderSonuc> {
  const kayit = await prisma.smsKaydi.findFirst({
    where: { id: kayitId, firmaId },
    select: {
      telefon: true,
      mesaj: true,
      tip: true,
      hizmetIslemiId: true,
      musteriAdi: true,
      denemeAdedi: true,
    },
  });
  if (!kayit) return { basarili: false, hata: "SMS kaydı bulunamadı" };

  if (kayit.denemeAdedi > 0) {
    await prisma.smsKaydi.update({
      where: { id: kayitId },
      data: { denemeAdedi: { increment: 1 } },
    });
  }

  return smsGonder(firmaId, kayit.telefon, kayit.mesaj, {
    tip: kayit.tip as SmsKayitTipi,
    hizmetIslemiId: kayit.hizmetIslemiId ?? undefined,
    musteriAdi: kayit.musteriAdi ?? undefined,
    kullaniciId,
  });
}