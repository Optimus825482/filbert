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
  ResponseCommandId,
  type NiimbotAbstractClient,
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
 * Nimbot B1 uzun süre boşta kaldığında ilk paketlere geç yanıt verebiliyor
 * (ölçülen: 1-5 sn). Kütüphanenin varsayılanı 1 sn kaldığı için USB
 * bağlantısı bu değerle kurulur.
 */
export const NIMBOT_SERI_PAKET_ZAMAN_ASIMI = 10_000;

/** Bağlantı kurulurken denenecek en fazla tur (ilk tur uyanma yüzünden düşebilir). */
export const NIMBOT_SERI_BAGLANTI_DENEMESI = 3;

/**
 * USB seri için Nimbot istemcisi.
 *
 * Kütüphane yanıt dinleyicisini paketi yazdıktan SONRA bağlıyor. USB seri,
 * Bluetooth'a göre çok daha hızlı yanıt verdiği için yanıt dinleyici
 * bağlanmadan önce gelip kaybolabiliyor. Bu sınıf dinleyiciyi yazmadan önce
 * bağlar ve USB için daha geniş paket zaman aşımı kullanır.
 */
export class NimbotUsbIstemcisi extends NiimbotSerialClient {
  constructor() {
    super();
    this.protocol.setPacketTimeout(NIMBOT_SERI_PAKET_ZAMAN_ASIMI);
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
      // Dinleyici yazmadan ÖNCE bağlanır; aksi hâlde hızlı yanıt kaybolur.
      const bekleme = this.waitForPacket(packet.validResponseIds, true, timeoutMs);
      try {
        await this.sendPacket(packet, true);
      } catch (yazmaHatasi) {
        void bekleme.catch(() => undefined);
        throw yazmaHatasi;
      }
      return bekleme;
    });
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
        await new Promise((coz) => setTimeout(coz, 400));
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
