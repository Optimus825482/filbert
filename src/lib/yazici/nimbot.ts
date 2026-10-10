/**
 * Nimbot B1 doğrudan baskı — tarayıcı katmanı (Bluetooth LE ve USB seri).
 *
 * NIIMBOT yazıcılar ESC/POS konuşmadığı için etiket burada tarayıcıda bir
 * tuvale çizilir, 1 bit raster'a çevrilir ve `@mmote/niimbluelib` ile
 * yazıcıya gönderilir. İki taşıma yolu desteklenir:
 *
 *   - Web Bluetooth (BLE): kablosuz, cihaz seçme penceresiyle eşleşir.
 *   - Web Serial (USB): kablo takılıyken daha kararlıdır; baud 115200.
 *
 * Böylece Windows'a sürücü kurmak veya ek bir servis çalıştırmak gerekmez.
 *
 * Gereksinimler: Chrome/Edge, güvenli bağlam (https veya localhost) ve
 * yazıcının bilgisayara Bluetooth ya da USB ile bağlı olması.
 *
 * Bu modül yalnızca istemci bileşenlerinden çağrılır; sunucu tarafında
 * kullanılamaz.
 */

import {
  ImageEncoder,
  LabelType,
  NiimbotBluetoothClient,
  NiimbotPacket,
  NiimbotSerialClient,
  PageColorType,
  PacketReceivedEvent,
  PrinterInfoFetchedEvent,
  ResponseCommandId,
  SoundSettingsItemType,
  type NiimbotAbstractClient,
  type PrinterInfo,
} from "@mmote/niimbluelib";
import type { EtiketVerisi } from "@/lib/yazici/escpos";
import {
  BLUETOOTH_YOGUNLUK_MAX,
  BLUETOOTH_YOGUNLUK_MIN,
  VARSAYILAN_BLUETOOTH_YOGUNLUGU,
  type EtiketProfili,
} from "@/lib/findik-isleme";
import {
  NIMBOT_KENAR_BOSLUGU,
  NIMBOT_SERVIS_UUID,
  esikUygula,
  esikliNoktaKaynagi,
  nimbotEtiketIcerigi,
  nimbotOlcusu,
  nimbotPunto,
  qrMatrisiOlustur,
  qrNoktaOlcusu,
  type NimbotSatiri,
} from "@/lib/yazici/nimbot-etiket";

/** Yazıcı seçim penceresinde gösterilecek Nimbot model adı önekleri. */
const NIMBOT_AD_ONEKLERI = ["B1", "B21", "B1_PRO", "D11", "D110", "D101", "M2", "N1"];

/** En fazla kaç kopya basılabilir (sunucu tarafı ESC/POS ile aynı). */
export const NIMBOT_MAKS_KOPYA = 10;

export const NIMBOT_DESTEK_HATASI =
  "Bu tarayıcı Bluetooth (Web Bluetooth) desteklemiyor. Chrome veya Edge kullanın; " +
  "sayfa https veya localhost üzerinden açılmalıdır.";

export interface NimbotBaskiSecenekleri {
  etiketProfili: EtiketProfili;
  yogunluk: number;
  kopya?: number;
  /** Paket gönderimi ilerlemesi (0-100). */
  ilerleme?: (yuzde: number) => void;
}

export interface NimbotBaskiSonucu {
  /** Yazıcının bildirdiği model (ör. B1). */
  model: string;
  /** Tarayıcının gördüğü cihaz adı (ör. B1-1A2B3C). */
  cihazAdi: string;
  kopya: number;
}

// Sayfa oturumu boyunca istemci ve cihaz hatırlanır; böylece ikinci baskıda
// cihaz seçme penceresi yeniden açılmaz.
let istemci: NiimbotBluetoothClient | null = null;
let basilanCihaz: BluetoothDevice | null = null;

export function nimbotBluetoothDestekleniyorMu(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.bluetooth !== "undefined";
}

/** Seçilmiş yazıcının adı (henüz seçilmediyse null). */
export function nimbotCihazAdi(): string | null {
  return basilanCihaz?.name ?? null;
}

/** Bağlantıyı ve seçili cihazı unutur (başka yazıcıya geçmek için). */
export function nimbotBaglantiyiSifirla(): void {
  void istemci?.disconnect().catch(() => undefined);
  istemci = null;
  basilanCihaz = null;
}

async function cihaziAl(): Promise<BluetoothDevice> {
  if (basilanCihaz) return basilanCihaz;

  const tarayici = navigator.bluetooth;
  // Daha önce izin verilmiş cihaz varsa seçim penceresi açılmadan kullanılır.
  // (`getDevices` yalnızca yeni izin arka ucu açıkken çalışır; hata yok sayılır.)
  const getDevices = (tarayici as unknown as { getDevices?: () => Promise<BluetoothDevice[]> })
    .getDevices;
  if (typeof getDevices === "function") {
    try {
      const izinliler = await getDevices.call(tarayici);
      const nimbot = izinliler.find((cihaz) => cihaz.name && /^(B1|B21|D1|M2|N1)/i.test(cihaz.name));
      if (nimbot) {
        basilanCihaz = nimbot;
        return nimbot;
      }
    } catch {
      // Yeni izin arka ucu kapalı; cihaz seçme penceresine düşülür.
    }
  }

  basilanCihaz = await tarayici.requestDevice({
    filters: [
      { services: [NIMBOT_SERVIS_UUID] },
      ...NIMBOT_AD_ONEKLERI.map((onek) => ({ namePrefix: onek })),
    ],
  });
  return basilanCihaz;
}

// ─── Etiketin tuvale çizimi ─────────────────────────────────

function yaziTipi(punto: number): string {
  return "bold " + punto + "px Arial, Helvetica, sans-serif";
}

/** Metni tuval genişliğine sığacak biçimde kelime sınırlarından böler. */
function metniSar(
  ctx: CanvasRenderingContext2D,
  metin: string,
  genislik: number
): string[] {
  const kelimeler = metin.trim().split(/\s+/).filter(Boolean);
  if (kelimeler.length === 0) return [""];

  const satirlar: string[] = [];
  let aktif = "";

  const kelimeyiBol = (kelime: string) => {
    let parca = "";
    for (const harf of kelime) {
      if (parca && ctx.measureText(parca + harf).width > genislik) {
        satirlar.push(parca);
        parca = harf;
      } else {
        parca += harf;
      }
    }
    return parca;
  };

  for (const kelime of kelimeler) {
    if (ctx.measureText(kelime).width > genislik) {
      if (aktif) {
        satirlar.push(aktif);
        aktif = "";
      }
      aktif = kelimeyiBol(kelime);
      continue;
    }
    const aday = aktif ? aktif + " " + kelime : kelime;
    if (ctx.measureText(aday).width <= genislik) {
      aktif = aday;
    } else {
      satirlar.push(aktif);
      aktif = kelime;
    }
  }
  if (aktif) satirlar.push(aktif);
  return satirlar;
}

interface CizimParcasi {
  satir: NimbotSatiri;
  punto: number;
  satirlar: string[];
  yukseklik: number;
}

/**
 * Etiketi B1 baskı alanına (384 nokta genişlik) çizer. İçerik yüksekliği
 * etikete sığmazsa punto oransal olarak küçültülür; QR kodu her zaman alt
 * tarafta tam nokta modüllerle çizilir.
 */
export function nimbotTuvale(veri: EtiketVerisi, etiketProfili: EtiketProfili): HTMLCanvasElement {
  const olcu = nimbotOlcusu(etiketProfili);
  const tuval = document.createElement("canvas");
  tuval.width = olcu.genislik;
  tuval.height = olcu.yukseklik;

  const ctx = tuval.getContext("2d");
  if (!ctx) throw new Error("Etiket tuvali oluşturulamadı");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tuval.width, tuval.height);
  ctx.textBaseline = "top";

  const icerik = nimbotEtiketIcerigi(veri);
  const qrSatiri = icerik.find((s) => s.tip === "qr");
  const govde = icerik.filter((s) => s.tip !== "qr");

  const kenar = NIMBOT_KENAR_BOSLUGU;
  const icGenislik = tuval.width - kenar * 2;

  const matris = qrSatiri?.veri ? qrMatrisiOlustur(qrSatiri.veri) : null;
  const qr = matris
    ? qrNoktaOlcusu(matris, Math.min(icGenislik, Math.round(olcu.yukseklik * 0.3)))
    : null;
  const qrAlani = qr ? qr.kenarNokta + kenar : 0;
  const govdeAlani = tuval.height - kenar * 2 - qrAlani;

  const planla = (katSayi: number): CizimParcasi[] =>
    govde.map((satir) => {
      if (satir.tip === "ayrac") {
        return { satir, punto: 0, satirlar: [], yukseklik: 8 };
      }
      const punto = nimbotPunto(satir.rol ?? "normal", olcu.olcek * katSayi);
      ctx.font = yaziTipi(punto);
      const satirlar = metniSar(ctx, satir.metin ?? "", icGenislik);
      const satirYuksekligi = Math.round(punto * 1.22);
      return {
        satir,
        punto,
        satirlar,
        yukseklik: satirYuksekligi * satirlar.length + (satir.ters ? 6 : 0),
      };
    });

  const topla = (parcalar: CizimParcasi[]) => parcalar.reduce((t, p) => t + p.yukseklik, 0);

  let plan = planla(1);
  const toplam = topla(plan);
  if (toplam > govdeAlani && toplam > 0) {
    const kucultulmus = planla(Math.max(0.55, govdeAlani / toplam));
    if (topla(kucultulmus) < toplam) plan = kucultulmus;
  }

  let y = kenar;
  for (const parca of plan) {
    if (parca.satir.tip === "ayrac") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(kenar, Math.round(y + parca.yukseklik / 2), icGenislik, 2);
      y += parca.yukseklik;
      continue;
    }

    const ters = Boolean(parca.satir.ters);
    const hizala = parca.satir.hizala ?? "sol";
    const satirYuksekligi = Math.round(parca.punto * 1.22);
    ctx.font = yaziTipi(parca.punto);

    if (ters) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(kenar, Math.round(y), icGenislik, satirYuksekligi * parca.satirlar.length + 6);
    }

    ctx.fillStyle = ters ? "#ffffff" : "#000000";
    const yaziBaslangici = y + (ters ? 3 : 0);
    parca.satirlar.forEach((metin, sira) => {
      const genislik = ctx.measureText(metin).width;
      const x =
        hizala === "orta"
          ? kenar + (icGenislik - genislik) / 2
          : hizala === "sag"
            ? kenar + icGenislik - genislik
            : kenar;
      ctx.fillText(metin, Math.max(kenar, Math.round(x)), Math.round(yaziBaslangici + sira * satirYuksekligi));
    });
    y += parca.yukseklik;
  }

  if (matris && qr) {
    const boyut = qr.kenarNokta;
    const sol = Math.round((tuval.width - boyut) / 2);
    const ust = tuval.height - kenar - boyut;
    // Sessiz bölge: QR çevresinde beyaz boşluk bırakılır.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sol - 4, ust - 4, boyut + 8, boyut + 8);
    ctx.fillStyle = "#000000";
    for (let satir = 0; satir < matris.boyut; satir++) {
      for (let sutun = 0; sutun < matris.boyut; sutun++) {
        if (matris.koyu(satir, sutun)) {
          ctx.fillRect(sol + sutun * qr.modulNokta, ust + satir * qr.modulNokta, qr.modulNokta, qr.modulNokta);
        }
      }
    }
  }

  return tuval;
}

/**
 * Etiketin Bluetooth baskıya gidecek hâlini PNG veri adresi olarak döndürür.
 * Aynı çizim kodu kullanıldığı için ekrandaki önizleme ile yazıcıya giden
 * raster birebir aynıdır; kâğıt harcamadan etiket denetlenebilir.
 */
export function nimbotEtiketOnizleme(veri: EtiketVerisi, etiketProfili: EtiketProfili): string {
  const tuval = nimbotTuvale(veri, etiketProfili);
  const ctx = tuval.getContext("2d");
  if (!ctx) throw new Error("Etiket tuvali okunamadı");

  // Yazıcıya giden raster 1 bittir; önizleme de aynı eşikten geçirilir.
  const pikseller = ctx.getImageData(0, 0, tuval.width, tuval.height);
  esikUygula(pikseller.data, tuval.width, tuval.height);
  ctx.putImageData(pikseller, 0, 0);
  return tuval.toDataURL("image/png");
}

// ─── Ortak Nimbot baskı çekirdeği ───────────────────────────

/** Kopya sayısını ve yoğunluğu yazıcının desteklediği aralığa çeker. */
function baskiDegerleriniNormalizeEt(secenekler: NimbotBaskiSecenekleri): {
  kopya: number;
  yogunluk: number;
} {
  const kopya = Math.min(NIMBOT_MAKS_KOPYA, Math.max(1, Math.trunc(secenekler.kopya ?? 1) || 1));
  const yogunlukHam = Math.trunc(secenekler.yogunluk);
  const yogunluk =
    Number.isFinite(yogunlukHam) && yogunlukHam > 0
      ? Math.min(BLUETOOTH_YOGUNLUK_MAX, Math.max(BLUETOOTH_YOGUNLUK_MIN, yogunlukHam))
      : VARSAYILAN_BLUETOOTH_YOGUNLUGU;
  return { kopya, yogunluk };
}

/**
 * Bağlı istemci üzerinden etiketi yazıcıya gönderir. Bluetooth ve USB seri
 * yolları aynı Nimbot protokolünü konuştuğu için baskı akışı tek yerde tutulur.
 */
async function nimbotGoreviniYazdir(
  aktifIstemci: NiimbotAbstractClient,
  veri: EtiketVerisi,
  secenekler: NimbotBaskiSecenekleri,
  kopya: number,
  yogunluk: number,
  cihazAdi: string
): Promise<NimbotBaskiSonucu> {
  const meta = aktifIstemci.getModelMetadata();
  const gorevAdi = aktifIstemci.getPrintTaskType();
  if (!gorevAdi) {
    throw new Error(
      "Yazıcı modeli tanınamadı" + (meta ? " (" + meta.model + ")" : "") +
        ". Nimbot B1 veya uyumlu bir model bağlandığından emin olun."
    );
  }

  const sayfaKodla = (sayfaVerisi: EtiketVerisi) => {
    const tuval = nimbotTuvale(sayfaVerisi, secenekler.etiketProfili);
    const tuvalCtx = tuval.getContext("2d");
    if (!tuvalCtx) throw new Error("Etiket tuvali okunamadı");
    const pikseller = tuvalCtx.getImageData(0, 0, tuval.width, tuval.height).data;
    const kaynak = esikliNoktaKaynagi(pikseller, tuval.width, tuval.height);
    return ImageEncoder.encode(kaynak, PageColorType.SingleColor, meta?.printDirection ?? "top");
  };

  const gorev = aktifIstemci.protocol.newPrintTask(gorevAdi, {
    totalPages: kopya,
    density: yogunluk,
    labelType: LabelType.WithGaps,
    pageColor: PageColorType.SingleColor,
    statusPollIntervalMs: 300,
    statusTimeoutMs: 20_000,
    pageTimeoutMs: 30_000,
  });

  const ilerleme = (olay: { progress: number }) => secenekler.ilerleme?.(olay.progress);
  aktifIstemci.on("printpacketprogress", ilerleme);
  try {
    await gorev.printInit();
    // Her kopya ayrı sayfa olarak gönderilir; böylece "Kopya n/N" doğru basılır.
    for (let sira = 1; sira <= kopya; sira++) {
      await gorev.printPage(sayfaKodla({ ...veri, kopyaNo: sira, kopyaSayisi: kopya }), 1);
    }
    await gorev.waitForFinished();
  } finally {
    aktifIstemci.off("printpacketprogress", ilerleme);
    await gorev.printEnd().catch(() => false);
  }

  return { model: meta?.model ?? "BILINMEYEN", cihazAdi, kopya };
}

// ─── Bluetooth (BLE) baskı ──────────────────────────────────

/**
 * Etiketi Bluetooth üzerinden Nimbot yazıcıya gönderir. İlk çağrıda tarayıcı
 * cihaz seçme penceresi açılır; aynı sayfa oturumundaki sonraki baskılar
 * hatırlanan cihaza gider.
 */
export async function nimbotEtiketiYazdir(
  veri: EtiketVerisi,
  secenekler: NimbotBaskiSecenekleri
): Promise<NimbotBaskiSonucu> {
  if (!nimbotBluetoothDestekleniyorMu()) throw new Error(NIMBOT_DESTEK_HATASI);

  const { kopya, yogunluk } = baskiDegerleriniNormalizeEt(secenekler);
  const hedefCihaz = await cihaziAl();
  const aktifIstemci = istemci ?? (istemci = new NiimbotBluetoothClient());

  try {
    if (!aktifIstemci.isConnected()) {
      await aktifIstemci.connect({ authorizedDevice: hedefCihaz });
    }
    return await nimbotGoreviniYazdir(
      aktifIstemci,
      veri,
      secenekler,
      kopya,
      yogunluk,
      hedefCihaz.name ?? "Nimbot"
    );
  } catch (hata) {
    // Bağlantı koptuysa bir sonraki denemede yeniden bağlanılsın.
    if (istemci && !istemci.isConnected()) void istemci.disconnect().catch(() => undefined);
    throw hata;
  }
}

// ─── USB seri baskı (Web Serial) ────────────────────────────

/** NIIMBOT USB satıcı kimliği; port seçme penceresi bu kimlikle süzülür. */
const NIMBOT_USB_VID = 0x3513;

export const NIMBOT_SERI_DESTEK_HATASI =
  "Bu tarayıcı USB seri (Web Serial) desteklemiyor. Chrome veya Edge kullanın; " +
  "sayfa https veya localhost üzerinden açılmalıdır.";

/**
 * USB seri taşımasında paket başına yanıt bekleme süresi.
 *
 * Nimbot B1 yanıt gecikmesi uyanıkken 1-3 sn, uzun boşluktan sonra 10-30 sn
 * (ölçüldü). Kütüphanenin 1 sn varsayılanı USB'de kesin yetersiz.
 */
export const NIMBOT_SERI_PAKET_ZAMAN_ASIMI = 20_000;

/**
 * Zorunlu olmayan yazıcı bilgisi sorguları için kısa zaman aşımı. Yazıcı uykuda
 * olduğunda bu sorgular yanıtsız kalabiliyor; bağlantı bunları beklemeden sürer.
 */
export const NIMBOT_SERI_BILGI_ZAMAN_ASIMI = 4_000;

/** Bağlantı kurulurken denenecek en fazla tur (ilk tur uyanma yüzünden düşebilir). */
export const NIMBOT_SERI_BAGLANTI_DENEMESI = 3;

/** Paketler arası bekleme: kütüphane BLE için 10 ms kullanıyor, USB'de yazıcı tıkanıyor. */
export const NIMBOT_SERI_PAKET_ARALIGI = 250;

/**
 * Kendiliğinden gelen paketlerin önbellekte kalma süresi. Yazıcı port açıldıktan
 * hemen sonra istek beklemeden `connect`/durum paketi gönderiyor; bunlar kısa süre
 * yeniden kullanılır, eskisi istek yanıtı sayılmasın diye süre kısa tutulur.
 */
export const NIMBOT_SERI_ERKEN_PAKET_OMRU = 3_000;

/**
 * USB seri için Nimbot istemcisi.
 *
 * Ölçülen davranış (Nimbot B1, Windows, 115200 baud):
 * - Yazıcı port açıldıktan hemen sonra kendiliğinden `connect` (c2) ve durum (b5)
 *   paketi gönderiyor; istek henüz yazılmadığı için bu paketler kayboluyordu.
 * - Art arda gönderilen sorgularda yazıcı bir noktadan sonra yanıt vermeyi
 *   bırakıyor; kütüphanenin 10 ms paket aralığı USB'de çok hızlı.
 * - Tek bir bilgi sorgusu yanıtsız kalınca kütüphane bağlantının tamamını düşürüyor.
 *
 * Bu sınıf erken gelen paketleri bağlantı sırasında yeniden kullanır, paket
 * aralığını yavaşlatır ve bilgi turunu hata toleranslı okur.
 */
export class NimbotUsbIstemcisi extends NiimbotSerialClient {
  private erkenPaketler = new Map<number, { paket: NiimbotPacket; zaman: number }>();

  constructor() {
    super();
    this.protocol.setPacketTimeout(NIMBOT_SERI_PAKET_ZAMAN_ASIMI);
    this.packetIntervalMs = NIMBOT_SERI_PAKET_ARALIGI;
    this.on("packetreceived", (olay) => {
      this.erkenPaketler.set(olay.packet.command, { paket: olay.packet, zaman: Date.now() });
    });
  }

  /** Kısa süre önce gelen paketi hazır yanıt olarak verir (kullanılınca önbellekten silinir). */
  private erkenPaketiAl(ids: number[]): NiimbotPacket | null {
    for (const id of ids) {
      const kayit = this.erkenPaketler.get(id);
      if (kayit && Date.now() - kayit.zaman <= NIMBOT_SERI_ERKEN_PAKET_OMRU) {
        this.erkenPaketler.delete(id);
        return kayit.paket;
      }
    }
    return null;
  }

  override async sendPacketWaitResponse(
    packet: NiimbotPacket,
    timeoutMs: number = NIMBOT_SERI_PAKET_ZAMAN_ASIMI
  ): Promise<NiimbotPacket> {
    return this.mutex.runExclusive(async () => {
      if (packet.oneWay) {
        await this.sendPacket(packet, true);
        return new NiimbotPacket(ResponseCommandId.In_Invalid, []);
      }
      // Yazıcı istek yazılmadan önce de paket gönderiyor (ölçüldü); hazır paket
      // varsa yanıt beklenmeden kullanılır.
      const hazir = this.erkenPaketiAl(packet.validResponseIds);
      if (hazir) {
        await this.sendPacket(packet, true);
        return hazir;
      }
      // Bekleyici yazmadan ÖNCE kurulur; USB seri hızlı yanıt veriyor.
      const bekleme = this.yanitBekle(packet.validResponseIds, timeoutMs, packet.command);
      try {
        await this.sendPacket(packet, true);
      } catch (yazmaHatasi) {
        void bekleme.catch(() => undefined);
        throw yazmaHatasi;
      }
      return bekleme;
    });
  }

  /**
   * Yanıtı kendi dinleyicimiz ve paket önbelleğiyle bekler.
   *
   * Kütüphanenin `waitForPacket` akışı USB seride yanıtı kaçırabiliyor; burada
   * paket olayı ile önbellek birlikte izlenir, yanıt iki yoldan da yakalanır.
   * Yazıcının hata paketleri (0xdb / 0x02) isteği reddeder.
   */
  private yanitBekle(ids: number[], timeoutMs: number, istekKomutu: number): Promise<NiimbotPacket> {
    return new Promise((cozul, reddet) => {
      let bitti = false;
      let zamanlayici: ReturnType<typeof setTimeout> | null = null;
      let denetleyici: ReturnType<typeof setInterval> | null = null;
      const temizle = () => {
        bitti = true;
        if (zamanlayici) clearTimeout(zamanlayici);
        if (denetleyici) clearInterval(denetleyici);
        this.off("packetreceived", dinleyici);
      };
      const kabul = (paket: NiimbotPacket) => {
        if (bitti) return;
        temizle();
        cozul(paket);
      };
      const dinleyici = (olay: PacketReceivedEvent) => {
        const komut = olay.packet.command;
        if (ids.length === 0 || ids.includes(komut)) {
          kabul(olay.packet);
        } else if (
          komut === ResponseCommandId.In_PrintError ||
          komut === ResponseCommandId.In_NotSupported
        ) {
          if (bitti) return;
          temizle();
          reddet(new Error("Yazıcı isteği reddetti (0x" + komut.toString(16) + ")"));
        }
      };
      this.on("packetreceived", dinleyici);
      denetleyici = setInterval(() => {
        const paket = this.erkenPaketiAl(ids);
        if (paket) kabul(paket);
      }, 40);
      zamanlayici = setTimeout(() => {
        if (bitti) return;
        temizle();
        reddet(
          new Error("Yanıt gelmedi (istek 0x" + istekKomutu.toString(16) + ", beklenen 0x" + ids.map((id) => id.toString(16)).join(",")) + ")"
        );
      }, timeoutMs);
      const elde = this.erkenPaketiAl(ids);
      if (elde) kabul(elde);
    });
  }

  /**
   * Bağlantı kurulduktan sonraki bilgi turu.
   *
   * Kütüphane tek bir sorgu yanıtsız kalınca bağlantıyı düşürüyor. USB'de bu
   * sık yaşandığı için bilgiler tek tek ve hata toleranslı okunur; yalnızca
   * baskı görevi seçimini belirleyen model kimliği zorunludur.
   */
  protected override async negotiateAndGetPrinterInfo(temizle?: () => void): Promise<void> {
    try {
      try {
        await this.connectNegotiate();
      } catch (hata) {
        temizle?.();
        throw new Error(`Unable to perform initial negotiate: ${hata}`);
      }
      try {
        await this.fetchPrinterInfo();
      } catch (hata) {
        console.warn("[nimbot-usb] Yazıcı bilgileri tam okunamadı, baskı yine denenecek:", hata);
      }
      await this.fetchRfidInfo().catch(() => undefined);
    } finally {
      // Bağlantı turu bitince erken paketler temizlenir; baskıda karışmasınlar.
      this.erkenPaketler.clear();
    }
  }

  override async fetchPrinterInfo(): Promise<PrinterInfo> {
    const dene = async <T>(
      ad: string,
      islem: () => Promise<T>,
      zamanAsimi = NIMBOT_SERI_BILGI_ZAMAN_ASIMI
    ): Promise<T | undefined> => {
      const oncekiZamanAsimi = this.protocol.getPacketTimeout();
      this.protocol.setPacketTimeout(zamanAsimi);
      try {
        return await islem();
      } catch (hata) {
        console.warn(`[nimbot-usb] ${ad} okunamadı: ${(hata as Error).message}`);
        return undefined;
      } finally {
        this.protocol.setPacketTimeout(oncekiZamanAsimi);
      }
    };

    // Model kimliği baskı görevinin seçiminde zorunlu; okunamazsa bağlantı kurulamaz.
    this.printerInfo.modelId = await this.protocol.getPrinterModel();
    this.printerInfo.serial = await dene("seri numarası", () => this.protocol.getPrinterSerialNumber());
    this.printerInfo.mac = await dene("bluetooth adresi", () =>
      this.protocol.getPrinterBluetoothMacAddress()
    );
    this.printerInfo.batteryPercents = await dene("batarya", () => this.protocol.getBatteryChargeLevel());
    this.printerInfo.autoShutdownTime = await dene("kapanma süresi", () =>
      this.protocol.getAutoShutDownTime()
    );
    this.printerInfo.settings.connectionSound =
      (await dene("bluetooth bağlantı sesi", () =>
        this.protocol.isSoundEnabled(SoundSettingsItemType.BluetoothConnectionSound)
      )) ?? false;
    this.printerInfo.settings.powerSound =
      (await dene("açılış sesi", () => this.protocol.isSoundEnabled(SoundSettingsItemType.PowerSound))) ??
      false;
    try {
      const bilgi = await this.protocol.heartbeatPrinterInfo();
      this.printerInfo.printheadWidth = bilgi.printheadWidth;
      this.printerInfo.hardwareVersion = bilgi.hardwareVersion;
      this.printerInfo.softwareVersion = bilgi.softwareVersion;
      this.printerInfo.resolutionClass = bilgi.resolutionClass;
    } catch {
      this.printerInfo.hardwareVersion = await dene("donanım sürümü", () =>
        this.protocol.getHardwareVersion()
      );
      this.printerInfo.softwareVersion = await dene("yazılım sürümü", () =>
        this.protocol.getSoftwareVersion()
      );
    }
    this.emit("printerinfofetched", new PrinterInfoFetchedEvent(this.printerInfo));
    return this.printerInfo;
  }
}

// Sayfa oturumu boyunca USB portu ve istemcisi hatırlanır; böylece sonraki
// baskılarda port seçme penceresi yeniden açılmaz.
let seriIstemci: NimbotUsbIstemcisi | null = null;
let seriPort: SerialPort | null = null;

/** Web Serial API bu tarayıcıda kullanılabilir mi? */
export function nimbotSerialDestekleniyorMu(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.serial !== "undefined";
}

function seriPortEtiketi(port: SerialPort): string {
  const bilgi = port.getInfo();
  const vid = bilgi.usbVendorId !== undefined ? bilgi.usbVendorId.toString(16).toUpperCase() : "?";
  const pid = bilgi.usbProductId !== undefined ? bilgi.usbProductId.toString(16).toUpperCase() : "?";
  return "USB VID:" + vid + " PID:" + pid;
}

/** Seçili USB portunun okunur etiketi (henüz seçilmediyse null). */
export function nimbotSeriPortAdi(): string | null {
  return seriPort ? seriPortEtiketi(seriPort) : null;
}

/**
 * USB portunu hazırlar. Daha önce izin verilmiş bir NIIMBOT portu varsa seçim
 * penceresi açılmadan kullanılır; yoksa tarayıcının port seçme penceresi açılır.
 */
async function seriPortuAl(): Promise<SerialPort> {
  if (seriPort) return seriPort;
  if (!nimbotSerialDestekleniyorMu()) throw new Error(NIMBOT_SERI_DESTEK_HATASI);

  const izinliPortlar = await navigator.serial.getPorts();
  const kayitli = izinliPortlar.find((port) => port.getInfo().usbVendorId === NIMBOT_USB_VID);
  seriPort =
    kayitli ??
    (await navigator.serial.requestPort({ filters: [{ usbVendorId: NIMBOT_USB_VID }] }));
  return seriPort;
}

/**
 * USB bağlantısını kurar. Yazıcı uyanmadıysa ilk tur zaman aşımına düşebildiği
 * için birkaç kez denenir; her tur arasında kısa bir bekleme vardır.
 */
async function seriBaglan(istemci: NimbotUsbIstemcisi, port: SerialPort): Promise<void> {
  let sonHata: unknown = null;
  for (let deneme = 1; deneme <= NIMBOT_SERI_BAGLANTI_DENEMESI; deneme++) {
    try {
      await istemci.connect({ authorizedPort: port });
      return;
    } catch (hata) {
      sonHata = hata;
      if (deneme < NIMBOT_SERI_BAGLANTI_DENEMESI) {
        await new Promise((coz) => setTimeout(coz, 800));
      }
    }
  }
  throw sonHata instanceof Error ? sonHata : new Error("USB yazıcıya bağlanılamadı");
}

/**
 * Ayarlar ekranından USB portunu seçer ve okunur etiketini döndürür. İlk
 * çağrıda tarayıcının port seçme penceresi açılır.
 */
export async function nimbotSeriPortuSec(): Promise<string> {
  return seriPortEtiketi(await seriPortuAl());
}

/** USB bağlantısını ve seçili portu unutur (başka porta geçmek için). */
export function nimbotSeriBaglantiyiSifirla(): void {
  void seriIstemci?.disconnect().catch(() => undefined);
  seriIstemci = null;
  seriPort = null;
}

/**
 * Etiketi USB kablo üzerinden Nimbot yazıcıya gönderir. İlk çağrıda tarayıcı
 * port seçme penceresi açılır; aynı sayfa oturumundaki sonraki baskılar
 * hatırlanan porta gider.
 */
export async function nimbotSeriEtiketiYazdir(
  veri: EtiketVerisi,
  secenekler: NimbotBaskiSecenekleri
): Promise<NimbotBaskiSonucu> {
  if (!nimbotSerialDestekleniyorMu()) throw new Error(NIMBOT_SERI_DESTEK_HATASI);

  const { kopya, yogunluk } = baskiDegerleriniNormalizeEt(secenekler);
  const port = await seriPortuAl();
  const aktifIstemci = seriIstemci ?? (seriIstemci = new NimbotUsbIstemcisi());

  try {
    if (!aktifIstemci.isConnected()) {
      await seriBaglan(aktifIstemci, port);
    }
    return await nimbotGoreviniYazdir(
      aktifIstemci,
      veri,
      secenekler,
      kopya,
      yogunluk,
      seriPortEtiketi(port)
    );
  } catch (hata) {
    // Bağlantı koptuysa bir sonraki denemede yeniden bağlanılsın.
    if (seriIstemci && !seriIstemci.isConnected()) {
      void seriIstemci.disconnect().catch(() => undefined);
    }
    throw hata;
  }
}
