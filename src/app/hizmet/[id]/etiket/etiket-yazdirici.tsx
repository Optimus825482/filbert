"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Printer,
  Copy,
  ArrowLeft,
  Download,
  QrCode,
  Usb,
  Settings2,
  AlertTriangle,
  Bluetooth,
  Cable,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import QRCode from "qrcode";
import { etiketYazdirildi, hizmetEtiketProfiliKaydet } from "@/lib/actions/hizmet";
import { etiketBaskisiKaydet, hizmetEtiketiYazdir } from "@/lib/actions/yazici";
import {
  ETIKET_PROFILLERI,
  etiketProfiliGetir,
  type EtiketProfili,
  type YaziciHedefTipi,
} from "@/lib/findik-isleme";
import type { EtiketVerisi } from "@/lib/yazici/escpos";
import {
  NIMBOT_DESTEK_HATASI,
  NIMBOT_SERI_DESTEK_HATASI,
  nimbotCihazAdi,
  nimbotEtiketOnizleme,
  nimbotEtiketiYazdir,
  nimbotSeriEtiketiYazdir,
  nimbotSeriPortAdi,
} from "@/lib/yazici/nimbot";
import { useBluetoothDestekli, useSerialDestekli } from "@/lib/yazici/nimbot-durum";

interface Props {
  hizmetId: string;
  siraNo: string;
  musteriAdi: string;
  telefon: string;
  kilo: string;
  islemler: string[];
  paketTipi?: string | null;
  paketAdedi?: number | null;
  odemeDurumu?: string | null;
  notlar?: string | null;
  tarihSaatStr: string;
  firmaAdi: string;
  toplamTutar: string;
  etiketProfili: EtiketProfili;
  /** Firma ayarlarında doğrudan ESC/POS yazıcı hedefi tanımlı mı. */
  yaziciHazir: boolean;
  /** Yazıcı hedefinin okunur tanımı (kuyruk adı veya IP:port). */
  yaziciAdi: string;
  /** Kullanıcının HIZMET/GUNCELLE izni var mı (doğrudan baskı bu izni gerektirir). */
  yazdirmaYetkisi: boolean;
  /** Ayarlarda seçili doğrudan yazıcı hedefi (Bluetooth hedefi burada öne çıkar). */
  yaziciHedefi: YaziciHedefTipi;
  /** Nimbot Bluetooth baskı yoğunluğu (1-5). */
  bluetoothYogunluk: number;
}

export function HizmetEtiketYazdirici({
  hizmetId,
  siraNo,
  musteriAdi,
  telefon,
  kilo,
  islemler,
  paketTipi,
  paketAdedi,
  odemeDurumu,
  notlar,
  tarihSaatStr,
  firmaAdi,
  toplamTutar,
  etiketProfili,
  yaziciHazir,
  yaziciAdi,
  yazdirmaYetkisi,
  yaziciHedefi,
  bluetoothYogunluk,
}: Props) {
  const [kopyaSayisi, setKopyaSayisi] = useState<number>(1);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [profil, setProfil] = useState<EtiketProfili>(etiketProfili);
  const [dogrudanHata, setDogrudanHata] = useState<string | null>(null);
  const [dogrudanYaziyor, startDogrudan] = useTransition();
  const [btYaziyor, setBtYaziyor] = useState(false);
  const [btIlerleme, setBtIlerleme] = useState(0);
  const [btHata, setBtHata] = useState<string | null>(null);
  const [btCihaz, setBtCihaz] = useState<string | null>(null);
  const [btOnizleme, setBtOnizleme] = useState<string | null>(null);
  const [seriPort, setSeriPort] = useState<string | null>(null);
  // Tarayıcı desteği (Web Bluetooth / Web Serial) yalnızca istemcide ölçülebilir.
  const btDestekli = useBluetoothDestekli();
  const seriDestekli = useSerialDestekli();
  // Ayarlarda USB seri hedefi seçiliyse kabloyla, aksi hâlde Bluetooth ile.
  const nimbotSeriMi = yaziciHedefi === "SERIAL_USB";
  const nimbotDestekli = nimbotSeriMi ? seriDestekli : btDestekli;
  const nimbotDestekHatasi = nimbotSeriMi ? NIMBOT_SERI_DESTEK_HATASI : NIMBOT_DESTEK_HATASI;

  const profilBilgi = etiketProfiliGetir(profil);
  const kucuk = profil === "NIMBOT_B1_50x50";

  useEffect(() => {
    // Termal etikette hızlı okutma için QR Kod üretimi
    QRCode.toDataURL(`FILBERT-HIZMET:${siraNo}`, {
      margin: 1,
      width: 160,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code Error:", err));
  }, [siraNo]);

  function handleProfilDegistir(yeni: EtiketProfili) {
    setProfil(yeni);
    // Seçim kayda yazılır; sonraki baskılarda aynı profil hatırlanır.
    void hizmetEtiketProfiliKaydet(hizmetId, yeni);
  }

  function handleYazdir() {
    etiketYazdirildi(hizmetId);
    window.print();
  }

  /** Etiketi tarayıcı penceresi olmadan ham ESC/POS ile yazıcıya gönderir. */
  function handleDogrudanYazdir() {
    setDogrudanHata(null);
    startDogrudan(async () => {
      const res = await hizmetEtiketiYazdir(hizmetId, kopyaSayisi);
      if (!res.ok) {
        setDogrudanHata(res.hata);
        toast.error(res.hata);
        return;
      }
      toast.success(
        `Etiket yazıcıya gönderildi: ${res.hedef} (${res.kopyaSayisi} kopya)`
      );
    });
  }

  /** Etiket verisini (sunucudan gelen alanlardan) oluşturur. */
  function etiketVerisiniOlustur(ek?: Partial<EtiketVerisi>): EtiketVerisi {
    return {
      ...ek,
      firmaAdi,
      siraNo,
      musteriAdi,
      telefon,
      kilo,
      islemler: {
        kirma: islemler.some((i) => i.toLowerCase().includes("kır")),
        kavurma: islemler.some((i) => i.toLowerCase().includes("kav")),
        paketleme: islemler.some((i) => i.toLowerCase().includes("pak")),
      },
      paketTipi,
      paketAdedi,
      odemeDurumu,
      toplamTutar,
      tarihSaatStr,
      notlar,
    };
  }

  /** Bluetooth baskıya gidecek etiketin ekrandaki önizlemesi (kâğıt harcamaz). */
  function handleOnizle() {
    try {
      // Önizleme, yazıcıya gidecek ilk kopyayı birebir gösterir.
      setBtOnizleme(
        nimbotEtiketOnizleme(
          etiketVerisiniOlustur({ kopyaNo: 1, kopyaSayisi: kopyaSayisi }),
          profil
        )
      );
      setBtHata(null);
    } catch (e) {
      setBtHata((e as Error).message || "Etiket önizlemesi oluşturulamadı");
    }
  }

  /** Etiketi Nimbot B1'e gönderir (ayarlara göre USB seri veya Bluetooth). */
  async function handleBluetoothYazdir() {
    setBtHata(null);
    setBtIlerleme(0);
    setBtYaziyor(true);
    const veri = etiketVerisiniOlustur();
    try {
      const gonder = nimbotSeriMi ? nimbotSeriEtiketiYazdir : nimbotEtiketiYazdir;
      const sonuc = await gonder(veri, {
        etiketProfili: profil,
        yogunluk: bluetoothYogunluk,
        kopya: kopyaSayisi,
        ilerleme: setBtIlerleme,
      });
      setBtCihaz(sonuc.cihazAdi);
      // Baskı istemcide yapıldı; sayaç sunucuda güncellenir.
      const kayit = await etiketBaskisiKaydet(hizmetId, sonuc.kopya);
      if (!kayit.ok) {
        toast.warning("Etiket basıldı ancak sayaç güncellenemedi: " + kayit.hata);
      }
      toast.success(
        (nimbotSeriMi ? "USB ile yazdırıldı: " : "Bluetooth ile yazdırıldı: ") +
          sonuc.model + " (" + sonuc.cihazAdi + ")"
      );
    } catch (e) {
      const mesaj =
        (e as Error).message || (nimbotSeriMi ? "USB baskı başarısız" : "Bluetooth baskı başarısız");
      setBtHata(mesaj);
      toast.error(mesaj);
    } finally {
      setBtYaziyor(false);
      setBtCihaz(nimbotSeriMi ? nimbotSeriPortAdi() : nimbotCihazAdi());
      setSeriPort(nimbotSeriPortAdi());
    }
  }

  function handleQrIndir() {
    if (!qrDataUrl) return;
    const baglanti = document.createElement("a");
    baglanti.href = qrDataUrl;
    baglanti.download = `filbert-etiket-${siraNo}.png`;
    baglanti.click();
  }

  // Talepte istenen her işlem için etiket üzerinde işaretlenecek kutu.
  const islemKutulari = [
    { ad: "Kırma", kisa: "Kırma", secili: islemler.some((i) => i.toLowerCase().includes("kır")) },
    { ad: "Kavurma", kisa: "Kavur", secili: islemler.some((i) => i.toLowerCase().includes("kav")) },
    {
      ad: "Vakumlu Paketleme",
      kisa: "Paket",
      secili: islemler.some((i) => i.toLowerCase().includes("pak")),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 p-4 text-white print:min-h-0 print:bg-white print:p-0 print:text-black">
      {/* ─── Kontrol Barı (Yazdırmada Gizlenir) ─── */}
      <div className="no-print mx-auto mb-6 flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/hizmet"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sky-200 transition-colors hover:bg-slate-700 hover:text-white"
              title="Listeye Dön"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-black text-white">Etiket Yazdır</h1>
              <p className="text-xs text-sky-300">
                Sıra No: <b className="text-[#f5c518]">#{siraNo}</b> · {musteriAdi} ·{" "}
                {profilBilgi.genislikMm}×{profilBilgi.yukseklikMm} mm
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Kopya Sayısı Seçimi */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
              <Copy className="h-3.5 w-3.5 text-sky-400" />
              <span className="font-semibold text-sky-200">Kopya:</span>
              <select
                value={kopyaSayisi}
                onChange={(e) => setKopyaSayisi(Number(e.target.value))}
                className="rounded bg-slate-800 px-2 py-1 font-bold text-white focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map((adet) => (
                  <option key={adet} value={adet}>
                    {adet} Adet
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleQrIndir}
              disabled={!qrDataUrl}
              className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:opacity-40"
              title="QR kodu PNG olarak indir (Nimbot B1 uygulamasına aktarabilirsiniz)"
            >
              <Download className="h-4 w-4" /> QR PNG
            </button>

            <button
              type="button"
              onClick={handleDogrudanYazdir}
              disabled={!yaziciHazir || !yazdirmaYetkisi || dogrudanYaziyor}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
              title={
                !yazdirmaYetkisi
                  ? "Doğrudan baskı için HİZMET güncelleme yetkisi gerekir"
                  : yaziciHazir
                  ? `ESC/POS ile doğrudan yazdır (${yaziciAdi})`
                  : "Doğrudan yazıcı hedefi tanımlı değil: Ayarlar → Fındık İşleme"
              }
            >
              <Usb className="h-4 w-4" />
              {dogrudanYaziyor ? "Gönderiliyor..." : "Doğrudan Yazdır"}
            </button>

            <button
              type="button"
              onClick={handleOnizle}
              disabled={!nimbotDestekli}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-sky-100 transition-colors hover:bg-slate-700 disabled:opacity-40"
              title="Bluetooth etiketinin ekrandaki önizlemesi (kâğıt harcamaz)"
            >
              <QrCode className="h-4 w-4" />
              Önizle
            </button>

            <button
              type="button"
              onClick={() => void handleBluetoothYazdir()}
              disabled={!yazdirmaYetkisi || btYaziyor || !nimbotDestekli}
              className="flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 transition-colors hover:bg-sky-500/25 disabled:opacity-40"
              title={
                !nimbotDestekli
                  ? nimbotDestekHatasi
                  : !yazdirmaYetkisi
                    ? "Nimbot baskı için HİZMET güncelleme yetkisi gerekir"
                    : nimbotSeriMi
                      ? `Nimbot B1'e USB kablo ile yazdır (${seriPort ?? "ilk baskıda port seçilir"})`
                      : `Nimbot B1'e Bluetooth ile yazdır (${btCihaz ?? "ilk baskıda yazıcı seçilir"})`
              }
            >
              {btYaziyor ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : nimbotSeriMi ? (
                <Cable className="h-4 w-4" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              {btYaziyor
                ? `Yazdırılıyor %${btIlerleme}`
                : nimbotSeriMi
                  ? "USB ile Yazdır"
                  : "Bluetooth ile Yazdır"}
            </button>

            <button
              type="button"
              onClick={handleYazdir}
              className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2 text-sm font-extrabold text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Yazdır {kopyaSayisi > 1 && `(${kopyaSayisi})`}
            </button>
          </div>
        </div>

        {/* ─── Yazıcı Profili Seçimi (Nimbot B1 / termal rulo) ─── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
            <QrCode className="h-3.5 w-3.5 text-[#f5c518]" /> Yazıcı Profili
          </span>
          {ETIKET_PROFILLERI.map((p) => {
            const aktif = profil === p.kod;
            return (
              <button
                key={p.kod}
                type="button"
                onClick={() => handleProfilDegistir(p.kod)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                  aktif
                    ? "border-[#f5c518] bg-[#f5c518]/15 text-[#f5c518]"
                    : "border-slate-700 bg-slate-900 text-sky-200 hover:bg-slate-800"
                }`}
              >
                {p.ad}
              </button>
            );
          })}
          <span className="text-[11px] text-sky-400">
            Tarayıcı yazdırma penceresinde kâğıt boyutunu {profilBilgi.genislikMm}×
            {profilBilgi.yukseklikMm} mm, kenar boşluklarını &quot;Yok&quot; seçin.
          </span>
        </div>

        {/* ─── Doğrudan ESC/POS yazıcı durumu ─── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-[11px]">
          <Usb className="h-3.5 w-3.5 text-[#f5c518]" />
          {yaziciHazir ? (
            <span className="text-emerald-300">
              Doğrudan yazıcı: <b>{yaziciAdi}</b> · etiket ham ESC/POS komutlarıyla gönderilir.
            </span>
          ) : (
            <>
              <span className="text-amber-300">
                Doğrudan ESC/POS yazıcı tanımlı değil; etiket yalnızca tarayıcıdan yazdırılabilir.
              </span>
              <Link
                href="/hizmet/ayarlar"
                className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-500/20"
              >
                <Settings2 className="h-3 w-3" /> Yazıcı Ayarları
              </Link>
            </>
          )}
        </div>

        {/* ─── Nimbot B1 (Bluetooth / USB seri) durumu ─── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-[11px]">
          {nimbotSeriMi ? (
            <Cable className="h-3.5 w-3.5 text-[#f5c518]" />
          ) : (
            <Bluetooth className="h-3.5 w-3.5 text-[#f5c518]" />
          )}
          {!nimbotDestekli ? (
            <span className="text-amber-300">{nimbotDestekHatasi}</span>
          ) : nimbotSeriMi ? (
            <>
              <span className="text-emerald-300">
                USB seri: <b>{seriPort ?? "port seçilmedi"}</b> · yoğunluk {bluetoothYogunluk} · etiket
                tarayıcıda çizilip kabloyla gönderilir.
              </span>
              <span className="text-sky-300">
                İlk baskıda yazıcı uyanırken birkaç saniye sürebilir; sonrakiler hızlıdır.
              </span>
            </>
          ) : yaziciHedefi === "BLUETOOTH_BLE" ? (
            <span className="text-emerald-300">
              Bluetooth: <b>{btCihaz ?? "yazıcı seçilmedi"}</b> · yoğunluk {bluetoothYogunluk} ·
              etiket tarayıcıda çizilip BLE ile gönderilir.
            </span>
          ) : (
            <span className="text-sky-300">
              Bluetooth ile yazdırma kullanılabilir{btCihaz ? `: ${btCihaz}` : " (ilk baskıda yazıcı seçilir)"}.
            </span>
          )}
        </div>

        {btYaziyor && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: btIlerleme + "%" }}
            />
          </div>
        )}

        {btOnizleme && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
            {/* Etiketin yazıcıya gidecek hâli: 384×384 nokta (48×48 mm) */}
            {/* Veri adresi (data URL) zaten çözülmüş bir görüntüdür; optimize edilmez. */}
            <Image
              src={btOnizleme}
              alt="Bluetooth etiket önizlemesi"
              width={144}
              height={144}
              unoptimized
              className="h-36 w-36 rounded-md border border-slate-600 bg-white"
            />
            <div className="text-[11px] leading-relaxed text-sky-200">
              <b className="text-white">Bluetooth etiket önizlemesi</b>
              <br />
              384×384 nokta (48×48 mm) · QR: FILBERT-HIZMET:{siraNo}
              <br />
              Görüntü, yazıcıya giden 1 bit rasterın birebir aynısıdır (gri ton yok).
            </div>
          </div>
        )}

        {btHata && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-200">
            Bluetooth baskı hatası: {btHata}
          </div>
        )}

        {dogrudanHata && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{dogrudanHata}</span>
          </div>
        )}
      </div>

      {/* ─── Etiket(ler) Önizleme & Baskı Alanı ─── */}
      <div className="space-y-6 print:space-y-0">
        {Array.from({ length: kopyaSayisi }).map((_, index) => (
          <div
            key={index}
            className={`${
              kucuk ? "etiket-sayfa-50" : "etiket-sayfa-80x70"
            } mx-auto flex flex-col justify-between overflow-hidden border-2 border-dashed border-slate-400 bg-white text-black shadow-2xl print:m-0 print:border-none print:shadow-none ${
              kucuk ? "p-1 print:p-1" : "p-3 print:p-2"
            }`}
            style={{
              width: `${profilBilgi.genislikMm}mm`,
              height: `${profilBilgi.yukseklikMm}mm`,
              pageBreakAfter: index < kopyaSayisi - 1 ? "always" : "auto",
            }}
          >
            {/* Üst Bilgi: Firma & Sıra No & QR */}
            <div className={`border-b-2 border-black pb-1 text-center ${kucuk ? "" : "pb-2"}`}>
              <div
                className={`font-black uppercase tracking-wider text-neutral-700 ${
                  kucuk ? "text-[7px]" : "text-[11px]"
                }`}
              >
                {firmaAdi}
              </div>
              {!kucuk && (
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-600">
                  Fındık Kırma &amp; Paketleme Hizmeti
                </div>
              )}
              <div className={`flex items-center justify-center ${kucuk ? "gap-1.5 pt-0.5" : "mt-1.5 gap-3"}`}>
                {qrDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrDataUrl}
                    alt={`QR #${siraNo}`}
                    className={`border border-black p-0.5 ${kucuk ? "h-10 w-10" : "h-14 w-14"}`}
                  />
                )}
                <div className="text-left">
                  <div
                    className={`font-mono font-black leading-none text-black ${
                      kucuk ? "text-xl" : "text-4xl"
                    }`}
                  >
                    #{siraNo}
                  </div>
                  {kopyaSayisi > 1 && (
                    <div className={`font-bold text-neutral-600 ${kucuk ? "text-[6px]" : "mt-1 text-[9px]"}`}>
                      Kopya {index + 1}/{kopyaSayisi}
                    </div>
                  )}
                  {odemeDurumu === "ODENDI" ? (
                    <span
                      className={`mt-0.5 inline-block rounded border border-black bg-black font-black text-white ${
                        kucuk ? "px-0.5 text-[6px]" : "px-1 text-[9px]"
                      }`}
                    >
                      TAHSİL EDİLDİ
                    </span>
                  ) : odemeDurumu === "VERESIYE" ? (
                    <span
                      className={`mt-0.5 inline-block rounded border border-black font-black text-black ${
                        kucuk ? "px-0.5 text-[6px]" : "px-1 text-[9px]"
                      }`}
                    >
                      VERESİYE
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Müşteri ve Miktar Bilgisi */}
            <div className={`space-y-1 font-bold leading-tight ${kucuk ? "my-0.5 text-[8px]" : "my-2 text-sm"}`}>
              <div className="flex justify-between border-b border-neutral-200 py-0.5">
                <span className="uppercase text-neutral-600">MÜŞTERİ:</span>
                <span className="text-right font-black text-black">{musteriAdi}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 py-0.5">
                <span className="uppercase text-neutral-600">TELEFON:</span>
                <span className="text-right font-mono">{telefon}</span>
              </div>
              <div className="flex items-center justify-between border-b-2 border-black py-0.5">
                <span className="font-black uppercase text-black">MİKTAR:</span>
                <span className={`font-mono font-black text-black ${kucuk ? "text-sm" : "text-xl"}`}>
                  {kilo} KG
                </span>
              </div>
            </div>

            {/* Yapılacak Hizmetler */}
            <div className={`rounded border border-black ${kucuk ? "p-0.5" : "my-1 p-1.5"}`}>
              <div
                className={`font-black uppercase tracking-wider text-neutral-700 ${
                  kucuk ? "text-[6px]" : "mb-1 text-[10px]"
                }`}
              >
                YAPILACAK İŞLEMLER:
              </div>
              <div className={`flex flex-wrap ${kucuk ? "gap-0.5" : "gap-1.5"}`}>
                {islemKutulari.map((islem) => (
                  <div
                    key={islem.ad}
                    className={`flex items-center gap-1 rounded border font-black ${
                      kucuk ? "px-0.5 py-0 text-[7px]" : "px-1.5 py-0.5 text-[11px]"
                    } ${
                      islem.secili
                        ? "border-black bg-black text-white"
                        : "border-neutral-300 bg-neutral-50 text-neutral-400 line-through"
                    }`}
                  >
                    <span>{islem.secili ? "☑" : "☐"}</span>
                    <span>{kucuk ? islem.kisa : islem.ad}</span>
                  </div>
                ))}
              </div>

              {/* Paketleme Detayı */}
              {paketTipi && (
                <div
                  className={`border-t border-dashed border-neutral-300 pt-0.5 font-black text-black ${
                    kucuk ? "mt-0.5 text-[7px]" : "mt-1.5 pt-1 text-[11px]"
                  }`}
                >
                  Paket: {paketAdedi ? `${paketAdedi}× ` : ""}
                  {paketTipi.replace("_", " ")}
                </div>
              )}
            </div>

            {/* Müşteri Notu Varsa */}
            {notlar && !kucuk && (
              <div className="my-1 rounded bg-neutral-100 p-1 text-[11px] leading-tight">
                <span className="font-black text-black">NOT: </span>
                <span className="font-medium text-neutral-800">{notlar}</span>
              </div>
            )}

            {/* Alt Bilgi: Tarih ve Tutar */}
            <div
              className={`border-t border-slate-300 pt-0.5 font-bold text-neutral-600 ${
                kucuk ? "text-[6px]" : "mt-2 pt-1 text-[10px]"
              }`}
            >
              <div className="flex justify-between">
                <span>{tarihSaatStr}</span>
                <span className="text-black">{toplamTutar} TL</span>
              </div>
              {!kucuk && (
                <div className="mt-1 text-center font-mono text-[9px] tracking-widest text-neutral-500">
                  * BU ETİKETİ TESLİMATTA İBRAZ EDİNİZ *
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
