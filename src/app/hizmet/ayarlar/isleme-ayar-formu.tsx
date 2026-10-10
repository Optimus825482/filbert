"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Save,
  Printer,
  Wallet,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Usb,
  Network,
  PowerOff,
  Bluetooth,
  Loader2,
  QrCode,
} from "lucide-react";
import { findikIslemeAyarlariniKaydet } from "@/lib/actions/hizmet";
import { yaziciTestEtiketiYazdir, yazicilariListele } from "@/lib/actions/yazici";
import {
  BLUETOOTH_YOGUNLUK_MAX,
  BLUETOOTH_YOGUNLUK_MIN,
  ETIKET_BASKI_DAVRANISLARI,
  ETIKET_PROFILLERI,
  KOD_SAYFALARI,
  YAZICI_HEDEFLERI,
  VARSAYILAN_BLUETOOTH_YOGUNLUGU,
  etiketProfiliGetir,
  type EtiketBaskiDavranisi,
  type EtiketProfili,
  type KodSayfasi,
  type YaziciAyarlari,
  type YaziciHedefTipi,
} from "@/lib/findik-isleme";
import { testEtiketiVerisi } from "@/lib/yazici/escpos";
import {
  NIMBOT_DESTEK_HATASI,
  nimbotBaglantiyiSifirla,
  nimbotCihazAdi,
  nimbotEtiketiYazdir,
} from "@/lib/yazici/nimbot";
import { useBluetoothDestekli } from "@/lib/yazici/nimbot-durum";

interface Props {
  kasalar: Array<{ id: string; ad: string; tip: string; modul?: string }>;
  mevcutKasaHesapId: string | null;
  mevcutEtiketProfili: EtiketProfili;
  mevcutEtiketBaskiDavranisi: EtiketBaskiDavranisi;
  mevcutYazici: YaziciAyarlari;
  /** Sunucudan okunan kurulu Windows yazıcı kuyrukları. */
  yazicilar: string[];
  /** Yazıcı listesi okunamadıysa gösterilecek uyarı. */
  yaziciListesiHatasi: string | null;
  smsAktif: boolean;
  smsSaglayici: string;
  otomatikGirisSms: boolean;
  /** Test etiketinde görünecek firma adı. */
  firmaAdi: string;
}

const HEDEF_IKONLARI: Record<YaziciHedefTipi, typeof Usb> = {
  YOK: PowerOff,
  BLUETOOTH_BLE: Bluetooth,
  WINDOWS_KUYRUK: Usb,
  AG_9100: Network,
};

/** Bluetooth yoğunluk seçenekleri (1-5). */
const BLUETOOTH_YOGUNLUKLARI = Array.from(
  { length: BLUETOOTH_YOGUNLUK_MAX - BLUETOOTH_YOGUNLUK_MIN + 1 },
  (_, i) => BLUETOOTH_YOGUNLUK_MIN + i
);

export function IslemeAyarFormu({
  kasalar,
  mevcutKasaHesapId,
  mevcutEtiketProfili,
  mevcutEtiketBaskiDavranisi,
  mevcutYazici,
  yazicilar: baslangicYazicilar,
  yaziciListesiHatasi: baslangicListeHatasi,
  smsAktif,
  smsSaglayici,
  otomatikGirisSms,
  firmaAdi,
}: Props) {
  const [kasaHesapId, setKasaHesapId] = useState<string>(mevcutKasaHesapId ?? "");
  const [etiketProfili, setEtiketProfili] = useState<EtiketProfili>(mevcutEtiketProfili);
  const [etiketBaskiDavranisi, setEtiketBaskiDavranisi] =
    useState<EtiketBaskiDavranisi>(mevcutEtiketBaskiDavranisi);
  const [yaziciHedefi, setYaziciHedefi] = useState<YaziciHedefTipi>(mevcutYazici.hedef);
  const [kuyrukAdi, setKuyrukAdi] = useState<string>(mevcutYazici.kuyrukAdi ?? "");
  const [yaziciIp, setYaziciIp] = useState<string>(mevcutYazici.ip ?? "");
  const [yaziciPort, setYaziciPort] = useState<string>(String(mevcutYazici.port));
  const [kodSayfasi, setKodSayfasi] = useState<KodSayfasi>(mevcutYazici.kodSayfasi);
  const [yazicilar, setYazicilar] = useState<string[]>(baslangicYazicilar);
  const [yazicilarYukleniyor, setYazicilarYukleniyor] = useState(false);
  const [yaziciListeHatasi, setYaziciListeHatasi] = useState<string | null>(
    baslangicListeHatasi
  );
  const [bluetoothYogunluk, setBluetoothYogunluk] = useState<string>(
    String(mevcutYazici.bluetoothYogunluk ?? VARSAYILAN_BLUETOOTH_YOGUNLUGU)
  );
  const [isPending, startTransition] = useTransition();
  const [testBekliyor, startTest] = useTransition();
  const [btYaziyor, setBtYaziyor] = useState(false);
  const [btIlerleme, setBtIlerleme] = useState(0);
  const [btHata, setBtHata] = useState<string | null>(null);
  const [btCihaz, setBtCihaz] = useState<string | null>(null);
  // Web Bluetooth yalnızca tarayıcıda sorgulanabilir; sunucu render'ında kapalı.
  const btDestekli = useBluetoothDestekli();

  async function yaziciListesiniYukle() {
    setYazicilarYukleniyor(true);
    setYaziciListeHatasi(null);
    const res = await yazicilariListele();
    setYazicilarYukleniyor(false);
    if (!res.ok) {
      setYaziciListeHatasi(res.hata);
      return;
    }
    setYazicilar(res.adlar);
  }

  function kaydet() {
    startTransition(async () => {
      const port = Number(yaziciPort);
      const res = await findikIslemeAyarlariniKaydet({
        kasaHesapId: kasaHesapId || null,
        etiketProfili,
        etiketBaskiDavranisi,
        yazici: {
          hedef: yaziciHedefi,
          kuyrukAdi: kuyrukAdi || null,
          ip: yaziciIp || null,
          port: Number.isInteger(port) ? port : mevcutYazici.port,
          kodSayfasi,
          bluetoothYogunluk: Number(bluetoothYogunluk) || VARSAYILAN_BLUETOOTH_YOGUNLUGU,
        },
      });
      if (!res.ok) {
        toast.error(res.hata || "Ayarlar kaydedilemedi");
        return;
      }
      toast.success("Fındık işleme ayarları kaydedildi.");
    });
  }

  function testEtiketiYazdir() {
    startTest(async () => {
      const res = await yaziciTestEtiketiYazdir();
      if (!res.ok) {
        toast.error(res.hata || "Test etiketi yazdırılamadı");
        return;
      }
      toast.success(`Test etiketi gönderildi: ${res.hedef}`);
    });
  }

  /** Bluetooth hedefi için test etiketi: tarayıcıda çizilir, BLE ile basılır. */
  async function bluetoothTestEtiketiYazdir() {
    setBtHata(null);
    setBtIlerleme(0);
    setBtYaziyor(true);
    try {
      const sonuc = await nimbotEtiketiYazdir(testEtiketiVerisi(firmaAdi), {
        etiketProfili,
        yogunluk: Number(bluetoothYogunluk) || VARSAYILAN_BLUETOOTH_YOGUNLUGU,
        kopya: 1,
        ilerleme: setBtIlerleme,
      });
      setBtCihaz(sonuc.cihazAdi);
      toast.success(`Bluetooth test etiketi gönderildi: ${sonuc.model} (${sonuc.cihazAdi})`);
    } catch (e) {
      const mesaj = (e as Error).message || "Bluetooth baskı başarısız";
      setBtHata(mesaj);
      toast.error(mesaj);
    } finally {
      setBtYaziyor(false);
      setBtCihaz(nimbotCihazAdi());
    }
  }

  function bluetoothCihaziUnut() {
    nimbotBaglantiyiSifirla();
    setBtCihaz(null);
    toast.success("Bluetooth yazıcı seçimi sıfırlandı.");
  }

  const profil = etiketProfiliGetir(etiketProfili);
  // Kayıtlı kuyruk adı sunucudan gelen listede yoksa (yazıcı geçici olarak
  // kaldırılmışsa) seçim kaybolmasın diye listeye eklenir.
  const kuyrukSecenekleri =
    kuyrukAdi && !yazicilar.includes(kuyrukAdi) ? [kuyrukAdi, ...yazicilar] : yazicilar;
  const yaziciKaydedilmemis =
    yaziciHedefi !== mevcutYazici.hedef ||
    (kuyrukAdi || null) !== mevcutYazici.kuyrukAdi ||
    (yaziciIp || null) !== mevcutYazici.ip ||
    kodSayfasi !== mevcutYazici.kodSayfasi ||
    Number(yaziciPort) !== mevcutYazici.port ||
    Number(bluetoothYogunluk) !== mevcutYazici.bluetoothYogunluk;

  // İşleme kasası listede önce ve ayrı grupta gösterilir; alım modülünün
  // kasaları geriye dönük uyumluluk için seçilebilir kalır.
  const islemeKasalari = kasalar.filter((kasa) => kasa.modul === "ISLEME");
  const digerKasalari = kasalar.filter((kasa) => kasa.modul !== "ISLEME");

  return (
    <div className="space-y-4">
      {/* ─── Tahsilat Kasası ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Wallet className="h-4 w-4 text-[#f5c518]" /> Kasa
        </div>
        <p className="mt-1 text-xs text-sky-200">
          Müşteri fındığını teslim almaya geldiğinde yapılan tahsilat varsayılan olarak bu kasaya
          işlenir. İşleme modülünün kasasını{" "}
          <Link href="/hizmet/kasa" className="font-extrabold text-[#f5c518]">Kasa</Link> ekranından
          yönetebilirsiniz.
        </p>
        <div className="mt-3">
          {kasalar.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
              Tanımlı aktif kasa bulunamadı. Kasa ekranından (veya Ayarlar → Kasa/Banka
              bölümünden) bir kasa ekleyin.
            </div>
          ) : (
            <select
              value={kasaHesapId}
              onChange={(e) => setKasaHesapId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
            >
              <option value="">-- Varsayılan kasa seçilmedi --</option>
              {islemeKasalari.length > 0 && (
                <optgroup label="İşleme modülü kasası">
                  {islemeKasalari.map((kasa) => (
                    <option key={kasa.id} value={kasa.id}>
                      {kasa.ad} ({kasa.tip})
                    </option>
                  ))}
                </optgroup>
              )}
              {digerKasalari.length > 0 && (
                <optgroup label="Diğer kasalar (alım modülü)">
                  {digerKasalari.map((kasa) => (
                    <option key={kasa.id} value={kasa.id}>
                      {kasa.ad} ({kasa.tip})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>
      </section>

      {/* ─── Etiket Yazıcı Profili ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Printer className="h-4 w-4 text-[#f5c518]" /> Etiket Yazıcı Profili
        </div>
        <p className="mt-1 text-xs text-sky-200">
          Talebe QR kodlu etiket basılırken kullanılacak kâğıt boyutu. Nimbot B1 etiketleri 50×50 mm
          boyutundadır.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ETIKET_PROFILLERI.map((p) => {
            const aktif = etiketProfili === p.kod;
            return (
              <button
                key={p.kod}
                type="button"
                onClick={() => setEtiketProfili(p.kod)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  aktif
                    ? "border-[#f5c518] bg-[#f5c518]/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <div className={`text-sm font-extrabold ${aktif ? "text-[#f5c518]" : "text-white"}`}>
                  {p.ad}
                </div>
                <div className="mt-0.5 text-[11px] text-sky-200">
                  {p.genislikMm} mm × {p.yukseklikMm} mm etiket alanı
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-sky-200">
          Seçili profil: <b className="text-white">{profil.ad}</b>. Tarayıcıdan yazdırırken yazdırma
          penceresinde kâğıt boyutunu{" "}
          <b className="text-white">
            {profil.genislikMm}×{profil.yukseklikMm} mm
          </b>{" "}
          ve kenar boşluklarını <b className="text-white">Yok</b> seçin.
        </div>
      </section>

      {/* ─── Doğrudan ESC/POS Yazıcı ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Usb className="h-4 w-4 text-[#f5c518]" /> Doğrudan Yazıcı
        </div>
        <p className="mt-1 text-xs text-sky-200">
          Etiket, tarayıcı yazdırma penceresi olmadan doğrudan yazıcıya gönderilir. Windows
          kuyruğu ve ağ yazıcısı hedeflerinde ham ESC/POS baytları kullanılır ve baskı bu
          uygulamayı çalıştıran bilgisayardan yapılır. Bluetooth hedefinde ise etiket tarayıcıda
          çizilir ve Web Bluetooth ile Nimbot yazıcıya gönderilir.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {YAZICI_HEDEFLERI.map((hedef) => {
            const Ikon = HEDEF_IKONLARI[hedef.kod];
            const aktif = yaziciHedefi === hedef.kod;
            return (
              <button
                key={hedef.kod}
                type="button"
                onClick={() => setYaziciHedefi(hedef.kod)}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                  aktif
                    ? "border-[#f5c518] bg-[#f5c518]/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <Ikon className={`mt-0.5 h-4 w-4 ${aktif ? "text-[#f5c518]" : "text-sky-300"}`} />
                <span className={`text-xs font-bold ${aktif ? "text-[#f5c518]" : "text-white"}`}>
                  {hedef.ad}
                </span>
              </button>
            );
          })}
        </div>

        {yaziciHedefi === "WINDOWS_KUYRUK" && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
                Windows yazıcı kuyruğu
              </label>
              <button
                type="button"
                onClick={() => void yaziciListesiniYukle()}
                disabled={yazicilarYukleniyor}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${yazicilarYukleniyor ? "animate-spin" : ""}`} />
                Yazıcıları yenile
              </button>
            </div>
            <select
              value={kuyrukAdi}
              onChange={(e) => setKuyrukAdi(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
            >
              <option value="">-- Yazıcı seçilmedi --</option>
              {kuyrukSecenekleri.map((ad) => (
                <option key={ad} value={ad}>
                  {ad}
                </option>
              ))}
            </select>
            {yaziciListeHatasi && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                {yaziciListeHatasi}
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-sky-200">
              Nimbot B1 etiketleri sürücü üzerinden değil, ham bayt olarak gönderilir. Yazıcıyı
              Windows&apos;a kurarken <b className="text-white">Generic / Text Only</b> sürücüsü ve
              doğru etiket ölçüsü (50×50 mm) seçilmelidir; aksi hâlde sürücü baytları yeniden
              yorumlayıp boş etiket basabilir.
            </div>
          </div>
        )}

        {yaziciHedefi === "AG_9100" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
                Yazıcı IP adresi
              </label>
              <input
                value={yaziciIp}
                onChange={(e) => setYaziciIp(e.target.value)}
                placeholder="192.168.1.50"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
                Port
              </label>
              <input
                value={yaziciPort}
                onChange={(e) => setYaziciPort(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="9100"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
              />
            </div>
          </div>
        )}

        {yaziciHedefi === "BLUETOOTH_BLE" && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-[11px] text-sky-100">
              Nimbot B1 ESC/POS konuşmaz; etiket tarayıcıda 384 nokta genişliğinde çizilir ve{" "}
              <b className="text-white">Web Bluetooth</b> ile doğrudan yazıcıya gönderilir.
              Windows&apos;a sürücü kurmak gerekmez. Sayfa <b className="text-white">Chrome</b> veya{" "}
              <b className="text-white">Edge</b> ile, <b className="text-white">localhost</b> ya da{" "}
              <b className="text-white">https</b> üzerinden açık olmalıdır.
            </div>

            {!btDestekli && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                {NIMBOT_DESTEK_HATASI}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
                  Baskı yoğunluğu
                </label>
                <select
                  value={bluetoothYogunluk}
                  onChange={(e) => setBluetoothYogunluk(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
                >
                  {BLUETOOTH_YOGUNLUKLARI.map((deger) => (
                    <option key={deger} value={deger}>
                      {deger}
                      {deger === VARSAYILAN_BLUETOOTH_YOGUNLUGU ? " (önerilen)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-sky-300">
                  Etiket soluk çıkarsa yoğunluğu artırın (yazıcı 1-5 destekler).
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
                  Seçili Bluetooth yazıcı
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={
                      "flex-1 truncate rounded-xl border px-3.5 py-2.5 text-sm font-semibold " +
                      (btCihaz
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-black/20 text-sky-300")
                    }
                  >
                    {btCihaz ?? "Henüz seçilmedi (ilk baskıda seçilir)"}
                  </span>
                  <button
                    type="button"
                    onClick={bluetoothCihaziUnut}
                    disabled={!btCihaz}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white disabled:opacity-40"
                    title="Yazıcı seçimini sıfırla"
                  >
                    Unut
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void bluetoothTestEtiketiYazdir()}
                disabled={btYaziyor || !btDestekli}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
              >
                {btYaziyor ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bluetooth className="h-3.5 w-3.5" />
                )}
                {btYaziyor ? "Gönderiliyor..." : "Bluetooth ile Test Etiketi Yazdır"}
              </button>
              {yaziciKaydedilmemis && (
                <span className="text-[11px] font-semibold text-amber-300">
                  Yoğunluk değişikliği için önce kaydedin.
                </span>
              )}
            </div>

            {btYaziyor && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: btIlerleme + "%" }}
                />
              </div>
            )}

            {btHata && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[11px] text-rose-200">
                {btHata}
              </div>
            )}
          </div>
        )}

        {yaziciHedefi !== "YOK" && yaziciHedefi !== "BLUETOOTH_BLE" && (
          <div className="mt-3">
            <label className="text-[11px] font-bold uppercase tracking-wide text-sky-200">
              Karakter kod sayfası
            </label>
            <select
              value={kodSayfasi}
              onChange={(e) => setKodSayfasi(e.target.value as KodSayfasi)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
            >
              {KOD_SAYFALARI.map((k) => (
                <option key={k.kod} value={k.kod}>
                  {k.ad}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-sky-300">
              Etikette Türkçe harfler bozuk çıkıyorsa ASCII seçeneğine geçin (ç → c, ş → s).
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={testEtiketiYazdir}
            disabled={testBekliyor || yaziciHedefi === "YOK" || yaziciHedefi === "BLUETOOTH_BLE"}
            title={
              yaziciHedefi === "BLUETOOTH_BLE"
                ? "Bluetooth hedefinde test baskısı yukarıdaki Bluetooth bölümünden yapılır"
                : undefined
            }
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" />
            {testBekliyor ? "Gönderiliyor..." : "Test Etiketi Yazdır"}
          </button>
          {yaziciKaydedilmemis && yaziciHedefi !== "BLUETOOTH_BLE" && (
            <span className="text-[11px] font-semibold text-amber-300">
              Test baskısı kaydedilmiş ayarlarla yapılır — önce kaydedin.
            </span>
          )}
        </div>
      </section>

      {/* Talep Sonrası Etiket Baskısı */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <QrCode className="h-4 w-4 text-[#f5c518]" /> Talep Sonrası Etiket
        </div>
        <p className="mt-1 text-xs text-sky-200">
          Yeni talep kaydedildiğinde oluşturulan QR kodlu etiketin nasıl yazdırılacağını belirler.
          Bluetooth hedefinde baskı, tarayıcıdan (Chrome/Edge) Nimbot B1 yazıcıya gönderilir.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {ETIKET_BASKI_DAVRANISLARI.map((secenek) => {
            const aktif = etiketBaskiDavranisi === secenek.kod;
            return (
              <button
                key={secenek.kod}
                type="button"
                onClick={() => setEtiketBaskiDavranisi(secenek.kod)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  aktif
                    ? "border-[#f5c518] bg-[#f5c518]/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div
                  className={`text-xs font-extrabold ${aktif ? "text-[#f5c518]" : "text-white"}`}
                >
                  {secenek.ad}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-sky-200">{secenek.aciklama}</div>
              </button>
            );
          })}
        </div>
        {etiketBaskiDavranisi !== mevcutEtiketBaskiDavranisi && (
          <div className="mt-2 text-[11px] font-bold text-amber-300">
            Seçim henüz kaydedilmedi — Ayarları Kaydet düğmesini kullanın.
          </div>
        )}
      </section>

      {/* ─── SMS Bildirimleri ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <MessageSquare className="h-4 w-4 text-[#f5c518]" /> SMS Bildirimleri
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-bold ${
              smsAktif
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                : "bg-white/5 text-sky-300 ring-1 ring-white/10"
            }`}
          >
            {smsAktif ? "SMS servisi aktif" : "SMS servisi pasif"}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-bold text-sky-200 ring-1 ring-white/10">
            Sağlayıcı: {smsSaglayici}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-bold text-sky-200 ring-1 ring-white/10">
            Talep alındı bildirimi: {otomatikGirisSms ? "otomatik" : "manuel"}
          </span>
        </div>
        <Link
          href="/ayarlar"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" /> SMS Ayarları & Şablonlar (Ayarlar → SMS)
        </Link>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={kaydet}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-5 py-2.5 text-sm font-extrabold text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Ayarları Kaydet
        </button>
      </div>
    </div>
  );
}
