/**
 * Nimbot B1 (Bluetooth LE) etiketi — saf (tarayıcısız) katman.
 *
 * NIIMBOT yazıcılar ESC/POS konuşmaz; kendi ikili (binary) BLE protokollerini
 * kullanırlar. Bu yüzden etiket önce 384 nokta genişliğinde bir ızgaraya
 * çizilir, ardından 1 bit siyah/beyaz raster'a çevrilip Bluetooth üzerinden
 * gönderilir.
 *
 * Bu dosya bilinçli olarak "saf"tır: DOM, canvas veya Bluetooth API'sine
 * dokunmaz. Böylece etiket içeriği ve rasterleştirme birim testlerinde
 * doğrulanabilir. Tuval çizimi ve Bluetooth gönderimi `nimbot.ts` içindedir.
 */

import QRCode from "qrcode";
import { paketTipiEtiketi, type EtiketVerisi } from "@/lib/yazici/escpos";
import { etiketProfiliGetir, type EtiketProfili } from "@/lib/findik-isleme";

/** NIMBOT cihazlarının kullandığı GATT servis UUID'si. */
export const NIMBOT_SERVIS_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";

/** B1 baskı kafası 203 dpi ve 384 nokta genişliğindedir (48 mm). */
export const NIMBOT_BASLIK_NOKTASI = 384;
export const NIMBOT_DPI = 203;

/** Etiket içeriğinin kenarlardan bırakacağı boşluk (nokta). */
export const NIMBOT_KENAR_BOSLUGU = 10;

/** Soluk/silik baskıyı önlemek için gri eşiği (0-255). */
export const VARSAYILAN_ESIK = 160;

// ─── Etiket içeriği (saf) ───────────────────────────────────

export type NimbotSatirRolu = "baslik" | "buyuk" | "vurgu" | "normal" | "kucuk";

/**
 * 50×30 mm rulo için rol başına punto (384 nokta genişlik referansı).
 *
 * Bu tablo operatör onaylı kompakt düzendir; 50×50 mm rulo için
 * {@link NIMBOT_SABLONLARI} içindeki daha büyük tablo kullanılır.
 */
export const NIMBOT_ROL_PUNTOSU: Readonly<Record<NimbotSatirRolu, number>> = {
  baslik: 25,
  buyuk: 26,
  vurgu: 22,
  normal: 16,
  kucuk: 12,
};

/**
 * Etiket şablonu: rulo boyuna göre hedef puntolar.
 *
 * Şablon yalnızca puntoları belirler; `nimbotTuvale` bunları kendi ölçek
 * aramasıyla ince ayarlar (sığmazsa küçültür, boşluk kalırsa yayarak doldurur).
 * Böylece aynı içerik 50×30 ruloda kompakt, 50×50 ruloda ferah basılır.
 */
export interface NimbotSablonu {
  /** Şablonun hangi rulo için tanımlandığı (arayüz/raporlama). */
  ad: string;
  rolPuntosu: Readonly<Record<NimbotSatirRolu, number>>;
  /** Ölçek aramasının üst sınırı; büyük hedef puntolarda 1.00 yeterlidir. */
  olcekMax: number;
  /**
   * Artan dikey boşluk satırlar arasına dağıtılsın mı?
   *
   * Kompakt 50×30 şablonu operatör onaylı hizalamayı koruduğu için kapalıdır;
   * geniş 50×50 şablonu boşluğu yayarak etiketi doldurur.
   */
  yay: boolean;
}

export const NIMBOT_SABLONLARI: Readonly<Record<EtiketProfili, NimbotSablonu>> = {
  NIMBOT_B1_50x30: {
    ad: "Nimbot B1 · 50×30 mm",
    rolPuntosu: NIMBOT_ROL_PUNTOSU,
    olcekMax: 1.35,
    yay: false,
  },
  NIMBOT_B1_50x50: {
    ad: "Nimbot B1 · 50×50 mm",
    rolPuntosu: { baslik: 40, buyuk: 42, vurgu: 32, normal: 24, kucuk: 16 },
    olcekMax: 1,
    yay: true,
  },
  TERMAL_80x70: {
    ad: "Termal rulo · 80×70 mm",
    rolPuntosu: { baslik: 32, buyuk: 42, vurgu: 24, normal: 24, kucuk: 16 },
    olcekMax: 1,
    yay: true,
  },
};

/** Etiket profilinin şablonunu döndürür; bilinmeyen profilde 50×50 kullanılır. */
export function nimbotSablonu(profil: EtiketProfili): NimbotSablonu {
  return NIMBOT_SABLONLARI[profil] ?? NIMBOT_SABLONLARI.NIMBOT_B1_50x50;
}

export interface NimbotMetinSatiri {
  tip: "metin";
  metin: string;
  rol?: NimbotSatirRolu;
  hizala?: "sol" | "orta" | "sag";
  /** Aynı satırın sağına yaslanan ikincil metin (ör. tutar/ödeme durumu). */
  sagMetin?: string;
  /** Sağdaki metnin rolü (varsayılan: "kucuk"). */
  sagRol?: NimbotSatirRolu;
  /** true ise satır akışta değil, etiketin en altına yaslanarak çizilir. */
  dibe?: boolean;
}

/**
 * Alt alta yazılan satırlar bloğu (normal puntoyla, sarılabilir).
 *
 * Etikette seçili hizmetler tek satırda bu blokla yazılır.
 */
export interface NimbotIslemSatiri {
  tip: "islem";
  islemler: string[];
  /** Blok satırlarının yatay hizası (varsayılan: "sol"). */
  hizala?: "sol" | "orta" | "sag";
}

export type NimbotSatiri = NimbotMetinSatiri | NimbotIslemSatiri;

/**
 * Seçili hizmetleri tek satırda özetler: "Kırma - Kavurma - 25x 1 KG".
 *
 * Operatör isteğiyle işaret kutuları ([X]/[ ]) kaldırıldı; yalnızca yapılacak
 * işler yazılır. Hiçbiri seçilmemişse boş metin döner.
 */
export function seciliHizmetlerMetni(
  veri: Pick<EtiketVerisi, "islemler" | "paketTipi" | "paketAdedi">
): string {
  const parcalar: string[] = [];
  if (veri.islemler.kirma) parcalar.push("Kırma");
  if (veri.islemler.kavurma) parcalar.push("Kavurma");
  if (veri.islemler.paketleme) parcalar.push("Paketleme");

  const paket = paketTipiEtiketi(veri.paketTipi);
  if (paket) parcalar.push(veri.paketAdedi ? `${veri.paketAdedi}x ${paket}` : paket);

  return parcalar.join(" - ");
}

/**
 * Etiketin satır planını üretir. Düzen (üstten alta):
 *
 *   1) Müşteri adı         (en büyük punto, ortada)
 *   2) Telefon             (aynı punto, ortada)
 *   3) Seçili hizmetler    (Kırma - Kavurma - Paketleme, ortada)
 *   4) Miktar              ("100.00 KG" ortada; sağda ödeme durumu)
 *   5) NOT                 (yalnızca varsa, ortada, en alta yaslı)
 *   6) #SIRA               (etiket kimliği, büyük punto, ortada)
 *   7) FİRMA ADI           (en alt satır, ortada)
 *
 * QR kod operatör isteğiyle etiketten çıkarıldı; talep kimliği sıra numarası
 * ile okunur.
 */
export function nimbotEtiketIcerigi(veri: EtiketVerisi): NimbotSatiri[] {
  const satirlar: NimbotSatiri[] = [
    // Teslim sırasında ilk okunan bilgi müşteridir: etiketin en üstünde durur.
    { tip: "metin", metin: veri.musteriAdi, rol: "baslik", hizala: "orta" },
    { tip: "metin", metin: veri.telefon, rol: "baslik", hizala: "orta" },
  ];

  const hizmetler = seciliHizmetlerMetni(veri);
  if (hizmetler) satirlar.push({ tip: "islem", islemler: [hizmetler], hizala: "orta" });

  satirlar.push({
    tip: "metin",
    metin: `${veri.kilo} KG`,
    rol: "buyuk",
    hizala: "orta",
    sagMetin: odemeOzeti(veri),
    sagRol: "kucuk",
  });

  if (veri.kopyaSayisi && veri.kopyaSayisi > 1) {
    satirlar.push({
      tip: "metin",
      metin: `Kopya ${veri.kopyaNo ?? 1}/${veri.kopyaSayisi}`,
      rol: "kucuk",
      hizala: "orta",
    });
  }

  // NOT ve etiket kimliği akışa katılmaz: etiketin en altına yaslanır.
  // Sıra numarası büyük puntoyla ortalanır, firma adı en alt satırda kalır.
  const not = veri.notlar?.trim();
  if (not) {
    satirlar.push({ tip: "metin", metin: `NOT: ${not}`, rol: "kucuk", hizala: "orta", dibe: true });
  }
  satirlar.push({
    tip: "metin",
    metin: `#${veri.siraNo}`,
    rol: "vurgu",
    hizala: "orta",
    dibe: true,
  });
  satirlar.push({
    tip: "metin",
    metin: veri.firmaAdi,
    rol: "normal",
    hizala: "orta",
    dibe: true,
  });

  return satirlar;
}

/**
 * Miktar satırının sağında gösterilecek özet.
 *
 * Fiyat/tutar operatör isteğiyle etikete basılmaz; yalnızca tahsilat durumu
 * (TAHSİL EDİLDİ / VERESİYE) yazılır. Bekleyen talepte sağ taraf boş kalır.
 */
function odemeOzeti(veri: EtiketVerisi): string | undefined {
  if (veri.odemeDurumu === "ODENDI") return "TAHSİL EDİLDİ";
  if (veri.odemeDurumu === "VERESIYE") return "VERESİYE";
  return undefined;
}

// ─── Tuval ölçüsü (saf) ─────────────────────────────────────

export interface NimbotOlcusu {
  /** Baskı kafası genişliği (nokta): her zaman 384. */
  genislik: number;
  /** Etiket yüksekliği (nokta). */
  yukseklik: number;
  /** Yazı puntosu çarpanı (384 nokta = 1.00). */
  olcek: number;
}

/**
 * Görüntünün ilk satırlarının basılmadığı bölge (nokta).
 *
 * Ölçüldü (Nimbot B1, 50×30 rulo): boşluk algılayıcı baskı kafasının ilerisinde
 * olduğu için görüntünün ilk ~4 mm'si etiketin üstüne değil boşluğa denk geliyor.
 * Bu yüzden içerik görüntüde bu kadar aşağıdan başlatılır.
 */
export const NIMBOT_UST_BOSLUGU = 32;

/**
 * Baskı yüksekliğinden güvenlik için düşülen pay (nokta).
 *
 * Ölçüldü: görüntü etiket boyundan uzun olursa son satırlar alttaki etikete
 * taşıyor. Görüntü bu yüzden etiketten kısa tutulur.
 */
export const NIMBOT_ALT_EMNIYETI = 16;

/** Güvenlik payı düşüldükten sonra kalabilecek en küçük baskı yüksekliği. */
export const NIMBOT_ASGARI_YUKSEKLIK = 120;

function mmNoktaya(mm: number): number {
  return Math.round((mm * NIMBOT_DPI) / 25.4);
}

/**
 * B1 baskı alanına sığan tuval ölçüsünü hesaplar. Genişlik her zaman baskı
 * kafası genişliğidir; daha büyük profiller (ör. 80×70 mm) B1'e sığacak
 * biçimde küçültülür.
 */
export function nimbotOlcusu(profil: EtiketProfili): NimbotOlcusu {
  const bilgi = etiketProfiliGetir(profil);
  const genislik = NIMBOT_BASLIK_NOKTASI;
  const tam = Math.min(mmNoktaya(bilgi.yukseklikMm), NIMBOT_BASLIK_NOKTASI);
  // Görüntü etiketin tamamına yayılırsa son satırlar alttaki etikete taşıyor
  // (ölçüldü); bu yüzden alt kenarda güvenlik payı bırakılır.
  const yukseklik = Math.max(NIMBOT_ASGARI_YUKSEKLIK, tam - NIMBOT_ALT_EMNIYETI);
  const olcek = genislik / NIMBOT_BASLIK_NOKTASI;
  return { genislik, yukseklik, olcek };
}

/**
 * Rol punktosunu ölçeğe göre piksele çevirir (en az 9 px).
 *
 * `taban` verilmezse 50×30 şablonu kullanılır; çağıran taraf profil şablonunu
 * ({@link nimbotSablonu}) geçerek rulo boyuna göre punto seçer.
 */
export function nimbotPunto(
  rol: NimbotSatirRolu,
  olcek = 1,
  taban: Readonly<Record<NimbotSatirRolu, number>> = NIMBOT_ROL_PUNTOSU
): number {
  const punto = taban[rol] ?? taban.normal ?? NIMBOT_ROL_PUNTOSU.normal;
  return Math.max(9, Math.round(punto * olcek));
}

// ─── Raster (1 bit) dönüşümü ────────────────────────────────

/**
 * `@mmote/niimbluelib` ImageEncoder'ın beklediği kaynak arayüzü.
 * `getPixelColor` 0xRRGGBB döndürür; siyah = baskı noktası.
 */
export interface NoktaKaynagi {
  readonly width: number;
  readonly height: number;
  getPixelColor(x: number, y: number, yon?: "left" | "top"): number;
}

/** RGBA pikselin algılanan parlaklığı (0 = siyah, 255 = beyaz). */
export function pikselParlakligi(kirmizi: number, yesil: number, mavi: number): number {
  return (kirmizi * 299 + yesil * 587 + mavi * 114) / 1000;
}

/**
 * Tarayıcı tuvalinin RGBA verisini eşikleyerek saf siyah/beyaz noktalara
 * çevirir. Anti-aliasing kaynaklı gri pikseller böylece ya tamamen siyah ya
 * da tamamen beyaz olur; termal baskıda yazı netliği artar.
 */
export function esikliNoktaKaynagi(
  rgba: Uint8ClampedArray | Uint8Array,
  genislik: number,
  yukseklik: number,
  esik: number = VARSAYILAN_ESIK
): NoktaKaynagi {
  return {
    width: genislik,
    height: yukseklik,
    getPixelColor(x: number, y: number, yon: "left" | "top" = "top"): number {
      // niimbluelib, "left" yönünde görüntüyü 90° döndürerek adresler.
      const indeks = yon === "left" ? (yukseklik - 1 - x) * genislik + y : y * genislik + x;
      const ofset = indeks * 4;
      const parlaklik = pikselParlakligi(
        rgba[ofset] ?? 255,
        rgba[ofset + 1] ?? 255,
        rgba[ofset + 2] ?? 255
      );
      return parlaklik < esik ? 0x000000 : 0xffffff;
    },
  };
}

/**
 * RGBA tamponuna eşik uygular: her piksel tam siyah ya da tam beyaz olur.
 * Önizleme görüntüsü bu işlemden sonra üretildiği için ekranda görünen ile
 * yazıcıya giden 1 bit raster birebir aynıdır.
 */
export function esikUygula(
  rgba: Uint8ClampedArray,
  genislik: number,
  yukseklik: number,
  esik: number = VARSAYILAN_ESIK
): void {
  for (let i = 0; i < genislik * yukseklik; i++) {
    const ofset = i * 4;
    const koyu =
      pikselParlakligi(rgba[ofset] ?? 255, rgba[ofset + 1] ?? 255, rgba[ofset + 2] ?? 255) < esik;
    const deger = koyu ? 0 : 255;
    rgba[ofset] = deger;
    rgba[ofset + 1] = deger;
    rgba[ofset + 2] = deger;
    rgba[ofset + 3] = 255;
  }
}

// ─── QR kod (saf) ───────────────────────────────────────────

export interface QrMatrisi {
  /** Kenar başına modül sayısı (21, 25, 29, ...). */
  boyut: number;
  /** Modül koyu (siyah) mu? */
  koyu(satir: number, sutun: number): boolean;
}

/** Etiketteki QR kodun modül matrisini üretir (M hata düzeltme düzeyi). */
export function qrMatrisiOlustur(veri: string): QrMatrisi {
  const qr = QRCode.create(veri, { errorCorrectionLevel: "M" });
  const modul = qr.modules;
  return {
    boyut: modul.size,
    koyu: (satir: number, sutun: number) => modul.get(satir, sutun) === 1,
  };
}

/**
 * QR kodu tuval üzerinde tam noktalara oturacak biçimde ölçekler. Modül
 * boyutu tam sayı olmazsa QR bulanıklaşır ve okuyucular tanımakta zorlanır.
 */
export function qrNoktaOlcusu(
  matris: QrMatrisi,
  izinVerilenGenislik: number
): { modulNokta: number; kenarNokta: number } {
  const modulNokta = Math.max(1, Math.floor(izinVerilenGenislik / matris.boyut));
  return { modulNokta, kenarNokta: modulNokta * matris.boyut };
}