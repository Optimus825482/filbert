/**
 * Fındık İşleme Modülü — istemci ve sunucu tarafında paylaşılan saf sabitler.
 * Bu dosya bilinçli olarak veritabanına dokunmaz; client bileşenleri güvenle
 * içe aktarabilir. Veritabanı erişimi `@/lib/actions/hizmet` içindedir.
 */

/** Kırma / kavurma / paketleme talebinin durum akışı. */
export const TALEP_ASAMALARI = [
  { kod: "SIRAYA_ALINDI", ad: "Bekliyor", kisa: "Bekliyor" },
  { kod: "KIRIM", ad: "Kırım Aşamasında", kisa: "Kırım" },
  { kod: "KAVURMA", ad: "Kavurma Aşamasında", kisa: "Kavurma" },
  { kod: "PAKETLEME", ad: "Paketleme Aşamasında", kisa: "Paketleme" },
  { kod: "TAMAMLANDI", ad: "Tamamlandı", kisa: "Tamamlandı" },
  { kod: "TESLIM_EDILDI", ad: "Teslim Edildi", kisa: "Teslim" },
] as const;

export type TalepAsamaKodu = (typeof TALEP_ASAMALARI)[number]["kod"];

export const TALEP_DURUM_ADLARI: Readonly<Record<string, string>> = {
  SIRAYA_ALINDI: "Bekliyor",
  KIRIM: "Kırım Aşamasında",
  KAVURMA: "Kavurma Aşamasında",
  PAKETLEME: "Paketleme Aşamasında",
  TAMAMLANDI: "Tamamlandı",
  TESLIM_EDILDI: "Teslim Edildi",
  IPTAL: "İptal",
};

/** Üretimde sayılan (henüz teslim edilmemiş) durumlar. */
export const URETIM_DURUMLARI = ["SIRAYA_ALINDI", "KIRIM", "KAVURMA", "PAKETLEME"] as const;

// ─── Pano durum dağılımı (grafik) ───────────────────────────

/** Pano durum dağılımı grafiğinde her durumun rengi. */
export const DURUM_RENKLERI: Readonly<Record<string, string>> = {
  SIRAYA_ALINDI: "#38bdf8",
  KIRIM: "#f5c518",
  KAVURMA: "#fb923c",
  PAKETLEME: "#a78bfa",
  TAMAMLANDI: "#34d399",
  TESLIM_EDILDI: "#64748b",
  IPTAL: "#f87171",
};

/** Durum dağılımı sırası: üretim hattı → teslim → iptal. */
export const DURUM_DAGILIM_SIRASI = [
  "SIRAYA_ALINDI",
  "KIRIM",
  "KAVURMA",
  "PAKETLEME",
  "TAMAMLANDI",
  "TESLIM_EDILDI",
  "IPTAL",
] as const;

export type DurumDilimi = {
  kod: string;
  ad: string;
  adet: number;
  /** Toplama oranı (0-100). */
  yuzde: number;
  /** Donut yayının başladığı nokta (0-100, saat yönü). */
  baslangicYuzde: number;
  renk: string;
};

/**
 * Durum sayaçlarını donut grafiği ve göstergesi için sıralı dilimlere çevirir.
 * Sıfır adetli durumlar atlanır; `baslangicYuzde` dilimlerin boşluksuz
 * dizilmesini sağlar, böylece yay toplamı %100'e tamamlanır.
 */
export function durumDagilimiDilimleri(sayilar: Readonly<Record<string, number>>) {
  const toplam = DURUM_DAGILIM_SIRASI.reduce((t, kod) => t + (sayilar[kod] ?? 0), 0);
  const dilimler: DurumDilimi[] = [];
  let birikim = 0;
  for (const kod of DURUM_DAGILIM_SIRASI) {
    const adet = sayilar[kod] ?? 0;
    if (adet <= 0) continue;
    const yuzde = toplam > 0 ? (adet / toplam) * 100 : 0;
    dilimler.push({
      kod,
      ad: TALEP_DURUM_ADLARI[kod] ?? kod,
      adet,
      yuzde,
      baslangicYuzde: birikim,
      renk: DURUM_RENKLERI[kod] ?? "#38bdf8",
    });
    birikim += yuzde;
  }
  return { toplam, dilimler };
}

/** Etiket yazıcı profilleri. Nimbot B1 50×50 mm varsayılandır. */
export const ETIKET_PROFILLERI = [
  { kod: "NIMBOT_B1_50x50", ad: "Nimbot B1 · 50×50 mm", genislikMm: 50, yukseklikMm: 50 },
  { kod: "TERMAL_80x70", ad: "Termal rulo · 80×70 mm", genislikMm: 80, yukseklikMm: 70 },
] as const;

export type EtiketProfili = (typeof ETIKET_PROFILLERI)[number]["kod"];

export const VARSAYILAN_ETIKET_PROFILI: EtiketProfili = "NIMBOT_B1_50x50";

export function etiketProfiliGecerliMi(deger: unknown): deger is EtiketProfili {
  return ETIKET_PROFILLERI.some((p) => p.kod === deger);
}

export function etiketProfiliGetir(kod?: string | null) {
  return ETIKET_PROFILLERI.find((p) => p.kod === kod) ?? ETIKET_PROFILLERI[0];
}

// ─── ESC/POS kod sayfası ────────────────────────────────────

export type KodSayfasi = "CP857" | "ASCII";

export const VARSAYILAN_KOD_SAYFASI: KodSayfasi = "CP857";

/** `escposNo`, ESC/POS `ESC t n` komutundaki kod sayfası numarasıdır. */
export const KOD_SAYFALARI = [
  { kod: "CP857", ad: "PC857 · Türkçe (önerilen)", escposNo: 13 },
  { kod: "ASCII", ad: "ASCII · Türkçe harfler sadeleştirilir", escposNo: 0 },
] as const;

export function kodSayfasiGecerliMi(deger: unknown): deger is KodSayfasi {
  return KOD_SAYFALARI.some((k) => k.kod === deger);
}

export function kodSayfasiNo(kod: KodSayfasi): number {
  return KOD_SAYFALARI.find((k) => k.kod === kod)?.escposNo ?? 13;
}

// ─── Nimbot B1 Bluetooth (BLE) baskı ────────────────────────

/** Nimbot yazıcıda baskı yoğunluğu (1 = en açık, 5 = en koyu). */
export const BLUETOOTH_YOGUNLUK_MIN = 1;
export const BLUETOOTH_YOGUNLUK_MAX = 5;
export const VARSAYILAN_BLUETOOTH_YOGUNLUGU = 3;

// ─── Yazıcı hedefi (doğrudan baskı) ─────────────────────────

export const YAZICI_HEDEFLERI = [
  { kod: "YOK", ad: "Kapalı · yalnızca tarayıcıdan yazdır" },
  { kod: "BLUETOOTH_BLE", ad: "Bluetooth · Nimbot B1 (tarayıcıdan)" },
  { kod: "SERIAL_USB", ad: "USB kablo · Nimbot B1 (tarayıcıdan)" },
  { kod: "WINDOWS_KUYRUK", ad: "Windows yazıcı kuyruğu (USB / Nimbot B1)" },
  { kod: "AG_9100", ad: "Ağ yazıcısı (IP:9100 ESC/POS)" },
] as const;

export type YaziciHedefTipi = (typeof YAZICI_HEDEFLERI)[number]["kod"];

export function yaziciHedefGecerliMi(deger: unknown): deger is YaziciHedefTipi {
  return YAZICI_HEDEFLERI.some((y) => y.kod === deger);
}

export interface YaziciAyarlari {
  hedef: YaziciHedefTipi;
  /** Windows yazıcı kuyruğu adı (hedef: WINDOWS_KUYRUK). */
  kuyrukAdi: string | null;
  /** Ağ yazıcısı IP adresi (hedef: AG_9100). */
  ip: string | null;
  /** Ağ yazıcısı TCP portu (varsayılan 9100). */
  port: number;
  kodSayfasi: KodSayfasi;
  /**
   * Nimbot baskı yoğunluğu (hedef: BLUETOOTH_BLE ve SERIAL_USB). Yazıcı 1-5
   * aralığını destekler; etiket soluk çıkarsa artırın.
   */
  bluetoothYogunluk: number;
}

export const VARSAYILAN_YAZICI_AYARLARI: YaziciAyarlari = {
  hedef: "YOK",
  kuyrukAdi: null,
  ip: null,
  port: 9100,
  kodSayfasi: VARSAYILAN_KOD_SAYFASI,
  bluetoothYogunluk: VARSAYILAN_BLUETOOTH_YOGUNLUGU,
};

/** ESC/POS doğrudan baskı için hedef yapılandırılmış mı? */
export function yaziciYapilandirildiMi(yazici: YaziciAyarlari): boolean {
  // Bluetooth ve USB seri baskı tarayıcıda yapılır; sunucu tarafında ek ayar
  // gerekmez. Yanıt, tarayıcının Web Bluetooth / Web Serial desteğine bağlıdır.
  if (yazici.hedef === "BLUETOOTH_BLE") return true;
  if (yazici.hedef === "SERIAL_USB") return true;
  if (yazici.hedef === "WINDOWS_KUYRUK") return Boolean(yazici.kuyrukAdi?.trim());
  if (yazici.hedef === "AG_9100") return Boolean(yazici.ip?.trim());
  return false;
}

/** Ayarlar ekranında ve hata mesajlarında kullanılan okunur hedef tanımı. */
export function yaziciHedefTanimi(yazici: YaziciAyarlari): string {
  if (yazici.hedef === "WINDOWS_KUYRUK") return yazici.kuyrukAdi?.trim() || "kuyruk seçilmedi";
  if (yazici.hedef === "AG_9100") {
    return `${yazici.ip?.trim() || "IP girilmedi"}:${yazici.port}`;
  }
  if (yazici.hedef === "BLUETOOTH_BLE") {
    return `Nimbot B1 · Bluetooth · yoğunluk ${yazici.bluetoothYogunluk}`;
  }
  if (yazici.hedef === "SERIAL_USB") {
    return `Nimbot B1 · USB seri · yoğunluk ${yazici.bluetoothYogunluk}`;
  }
  return "kapalı";
}

// ─── Firma ayarları ─────────────────────────────────────────

// Talep sonrası etiket baskısı (davranış ayarı)

/**
 * Talep kaydedildikten sonra QR kodlu etiketin nasıl basılacağı:
 *   SOR      — kayıt sonrası onay penceresi açılır, baskıyı kullanıcı onaylar.
 *   OTOMATIK — kayıt tamamlanır tamamlanmaz etiket yazıcıya gönderilir.
 *   KAPALI   — kayıt sonrası etiket baskısı istenmez.
 */
export const ETIKET_BASKI_DAVRANISLARI = [
  {
    kod: "SOR",
    ad: "Onaylı yazdır",
    aciklama: "Talep kaydedilince etiket penceresi açılır; baskıyı siz onaylarsınız.",
  },
  {
    kod: "OTOMATIK",
    ad: "Otomatik yazdır",
    aciklama: "Talep kaydedilir kaydedilmez etiket yazıcıya gönderilir.",
  },
  {
    kod: "KAPALI",
    ad: "Kapalı",
    aciklama: "Talep kaydedilir; etiket baskısı sorulmaz.",
  },
] as const;

export type EtiketBaskiDavranisi = (typeof ETIKET_BASKI_DAVRANISLARI)[number]["kod"];

export const VARSAYILAN_ETIKET_BASKI_DAVRANISI: EtiketBaskiDavranisi = "SOR";

export function etiketBaskiDavranisiGecerliMi(deger: unknown): deger is EtiketBaskiDavranisi {
  return ETIKET_BASKI_DAVRANISLARI.some((d) => d.kod === deger);
}

/** Kayıtlı kodun okunur tanımı; bilinmeyen değerde varsayılan seçenek döner. */
export function etiketBaskiDavranisiGetir(kod?: string | null) {
  return ETIKET_BASKI_DAVRANISLARI.find((d) => d.kod === kod) ?? ETIKET_BASKI_DAVRANISLARI[0];
}

export type FindikIslemeAyarlari = {
  kasaHesapId: string | null;
  etiketProfili: EtiketProfili;
  /** Talep kaydedildikten sonra etiketin nasıl basılacağı. */
  etiketBaskiDavranisi: EtiketBaskiDavranisi;
  yazici: YaziciAyarlari;
};

export const VARSAYILAN_FINDIK_ISLEME_AYARLARI: FindikIslemeAyarlari = {
  kasaHesapId: null,
  etiketProfili: VARSAYILAN_ETIKET_PROFILI,
  etiketBaskiDavranisi: VARSAYILAN_ETIKET_BASKI_DAVRANISI,
  yazici: { ...VARSAYILAN_YAZICI_AYARLARI },
};

function yaziciAyarlariniCoz(blok: Record<string, unknown>): YaziciAyarlari {
  const ham = blok.yazici;
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) {
    return { ...VARSAYILAN_YAZICI_AYARLARI };
  }
  const kayit = ham as Record<string, unknown>;
  const hedef = yaziciHedefGecerliMi(kayit.hedef) ? kayit.hedef : VARSAYILAN_YAZICI_AYARLARI.hedef;
  const kuyrukAdi =
    typeof kayit.kuyrukAdi === "string" && kayit.kuyrukAdi.trim() ? kayit.kuyrukAdi.trim() : null;
  const ip = typeof kayit.ip === "string" && kayit.ip.trim() ? kayit.ip.trim() : null;
  const portHam = Number(kayit.port);
  const port =
    Number.isInteger(portHam) && portHam > 0 && portHam < 65536 ? portHam : VARSAYILAN_YAZICI_AYARLARI.port;
  const kodSayfasi = kodSayfasiGecerliMi(kayit.kodSayfasi)
    ? kayit.kodSayfasi
    : VARSAYILAN_KOD_SAYFASI;
  const yogunlukHam = Number(kayit.bluetoothYogunluk);
  const bluetoothYogunluk =
    Number.isInteger(yogunlukHam) &&
    yogunlukHam >= BLUETOOTH_YOGUNLUK_MIN &&
    yogunlukHam <= BLUETOOTH_YOGUNLUK_MAX
      ? yogunlukHam
      : VARSAYILAN_BLUETOOTH_YOGUNLUGU;
  return { hedef, kuyrukAdi, ip, port, kodSayfasi, bluetoothYogunluk };
}

/** Firma.ayarlar JSON alanındaki `findikIsleme` bloğunu güvenli biçimde çözer. */
export function findikIslemeAyarlariniCoz(ayarlar: unknown): FindikIslemeAyarlari {
  if (!ayarlar || typeof ayarlar !== "object" || Array.isArray(ayarlar)) {
    return { ...VARSAYILAN_FINDIK_ISLEME_AYARLARI, yazici: { ...VARSAYILAN_YAZICI_AYARLARI } };
  }
  const blok = (ayarlar as Record<string, unknown>).findikIsleme;
  if (!blok || typeof blok !== "object" || Array.isArray(blok)) {
    return { ...VARSAYILAN_FINDIK_ISLEME_AYARLARI, yazici: { ...VARSAYILAN_YAZICI_AYARLARI } };
  }
  const kayit = blok as Record<string, unknown>;
  const kasaHesapId =
    typeof kayit.kasaHesapId === "string" && kayit.kasaHesapId.trim() ? kayit.kasaHesapId.trim() : null;
  const etiketProfili = etiketProfiliGecerliMi(kayit.etiketProfili)
    ? kayit.etiketProfili
    : VARSAYILAN_ETIKET_PROFILI;
  const etiketBaskiDavranisi = etiketBaskiDavranisiGecerliMi(kayit.etiketBaskiDavranisi)
    ? kayit.etiketBaskiDavranisi
    : VARSAYILAN_ETIKET_BASKI_DAVRANISI;
  return { kasaHesapId, etiketProfili, etiketBaskiDavranisi, yazici: yaziciAyarlariniCoz(kayit) };
}

/** Firma.ayarlar içindeki diğer anahtarları koruyarak fındık işleme bloğunu yazar. */
export function findikIslemeAyarBlogunuBirlestir(
  ayarlar: unknown,
  yeni: FindikIslemeAyarlari
): Record<string, unknown> {
  const kok =
    ayarlar && typeof ayarlar === "object" && !Array.isArray(ayarlar)
      ? { ...(ayarlar as Record<string, unknown>) }
      : {};
  kok.findikIsleme = {
    kasaHesapId: yeni.kasaHesapId,
    etiketProfili: yeni.etiketProfili,
    etiketBaskiDavranisi: yeni.etiketBaskiDavranisi,
    yazici: {
      hedef: yeni.yazici.hedef,
      kuyrukAdi: yeni.yazici.kuyrukAdi,
      ip: yeni.yazici.ip,
      port: yeni.yazici.port,
      kodSayfasi: yeni.yazici.kodSayfasi,
      bluetoothYogunluk: yeni.yazici.bluetoothYogunluk,
    },
  };
  return kok;
}
