"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Bluetooth, ExternalLink, Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { etiketBaskisiKaydet, hizmetEtiketiYazdir } from "@/lib/actions/yazici";
import {
  etiketProfiliGetir,
  type EtiketProfili,
  type YaziciHedefTipi,
} from "@/lib/findik-isleme";
import type { EtiketVerisi } from "@/lib/yazici/escpos";
import {
  NIMBOT_DESTEK_HATASI,
  NIMBOT_MAKS_KOPYA,
  nimbotEtiketOnizleme,
  nimbotEtiketiYazdir,
} from "@/lib/yazici/nimbot";
import { useBluetoothDestekli } from "@/lib/yazici/nimbot-durum";

/** Dış sistem aboneliği yok; tarayıcı ölçümü her render'da okunur. */
const aboneOl = () => () => {};
const istemciMi = () => true;
const sunucudaMi = () => false;

/** İkincil düğme görünümü (tercih edilmeyen hedef). */
const IKINCIL_DUGME =
  "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50";
/** Birincil (önerilen) düğme görünümü. */
const BIRINCIL_DUGME =
  "flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2 text-sm font-black text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95 disabled:opacity-50";

/**
 * Talep kaydedildikten hemen sonra açılan etiket baskı onayı.
 *
 * Etiket ekranına gitmeye gerek kalmadan, oluşturulan QR kodlu etiketin
 * yazıcıya gidecek görüntüsü gösterilir; tek onayla Nimbot B1'e (Bluetooth)
 * veya ayarlarda seçili doğrudan ESC/POS yazıcıya gönderilir.
 */
interface Props {
  acik: boolean;
  hizmetId: string;
  siraNo: string;
  etiket: EtiketVerisi;
  etiketProfili: EtiketProfili;
  yaziciHedefi: YaziciHedefTipi;
  yaziciAdi: string;
  yaziciHazir: boolean;
  bluetoothYogunluk: number;
  yazdirmaYetkisi: boolean;
  /** Otomatik baskı denemesi başarısız olduysa gösterilecek neden. */
  otomatikHata?: string | null;
  /** Pencere kapatılırken çağrılır; baskı yapıldıysa `yazdirildi` true olur. */
  onKapat: (yazdirildi: boolean) => void;
}

export function EtiketBaskiOnayi({
  acik,
  hizmetId,
  siraNo,
  etiket,
  etiketProfili,
  yaziciHedefi,
  yaziciAdi,
  yaziciHazir,
  bluetoothYogunluk,
  yazdirmaYetkisi,
  otomatikHata,
  onKapat,
}: Props) {
  const [kopyaSayisi, setKopyaSayisi] = useState(1);
  const [yaziyor, setYaziyor] = useState(false);
  const [ilerleme, setIlerleme] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [cihaz, setCihaz] = useState<string | null>(null);
  // Web Bluetooth desteği yalnızca tarayıcıda ölçülebilir.
  const btDestekli = useBluetoothDestekli();
  // Sunucu render'ında tuval bulunmaz; önizleme yalnızca tarayıcıda çizilir.
  const tarayicida = useSyncExternalStore(aboneOl, istemciMi, sunucudaMi);
  const profil = etiketProfiliGetir(etiketProfili);

  // Önizleme, yazıcıya gidecek 1 bit rasterin birebir aynısıdır: kâğıt
  // harcamadan denetlenebilir.
  const onizleme = useMemo(() => {
    if (!acik || !tarayicida) return null;
    try {
      return nimbotEtiketOnizleme({ ...etiket, kopyaNo: 1, kopyaSayisi }, profil.kod);
    } catch (e) {
      console.error("Etiket önizlemesi oluşturulamadı", e);
      return null;
    }
  }, [acik, tarayicida, etiket, kopyaSayisi, profil.kod]);

  // Otomatik baskı denemesi başarısız olduysa nedeni pencere içinde gösterilir.
  const gosterilenHata = hata ?? otomatikHata ?? null;

  const islemOzeti = [
    etiket.islemler.kirma ? "Kırma" : null,
    etiket.islemler.kavurma ? "Kavurma" : null,
    etiket.islemler.paketleme ? "Vakumlu Paketleme" : null,
  ]
    .filter((satir): satir is string => Boolean(satir))
    .join(" + ");

  // Bluetooth baskı tarayıcıda yapılır; ayarlarda hedef seçilmese de çalışır.
  const nimbotKullanilabilir = btDestekli && yazdirmaYetkisi;
  // Doğrudan ESC/POS baskı yalnızca hedef tanımlıysa mümkündür.
  const dogrudanVar = yaziciHazir && yaziciHedefi !== "BLUETOOTH_BLE";
  const dogrudanKullanilabilir = dogrudanVar && yazdirmaYetkisi;
  // Ayarlarda Bluetooth seçiliyse ya da doğrudan yazıcı yoksa Nimbot önerilir.
  const nimbotTercih = yaziciHedefi === "BLUETOOTH_BLE" || !dogrudanKullanilabilir;

  /** Etiketi Bluetooth (Nimbot B1) üzerinden yazıcıya gönderir. */
  async function nimbotIleYazdir() {
    setHata(null);
    setIlerleme(0);
    setYaziyor(true);
    try {
      const sonuc = await nimbotEtiketiYazdir(
        { ...etiket, kopyaNo: 1, kopyaSayisi },
        {
          etiketProfili: profil.kod,
          yogunluk: bluetoothYogunluk,
          kopya: kopyaSayisi,
          ilerleme: setIlerleme,
        }
      );
      setCihaz(sonuc.cihazAdi);
      // Baskı istemcide yapıldı; etiket sayacı sunucuda güncellenir.
      const kayit = await etiketBaskisiKaydet(hizmetId, sonuc.kopya);
      if (!kayit.ok) {
        toast.warning("Etiket basıldı ancak sayaç güncellenemedi: " + kayit.hata);
      }
      toast.success(
        "Etiket Nimbot yazıcıya gönderildi: " + sonuc.model + " (" + sonuc.cihazAdi + ")"
      );
      onKapat(true);
    } catch (e) {
      const mesaj = (e as Error).message || "Bluetooth baskı başarısız";
      setHata(mesaj);
      toast.error(mesaj);
    } finally {
      setYaziyor(false);
    }
  }

  /** Etiketi sunucudan doğrudan ESC/POS hedefine gönderir. */
  async function dogrudanYazdir() {
    setHata(null);
    setYaziyor(true);
    try {
      const res = await hizmetEtiketiYazdir(hizmetId, kopyaSayisi);
      if (!res.ok) {
        setHata(res.hata);
        toast.error(res.hata);
        return;
      }
      toast.success(
        "Etiket yazıcıya gönderildi: " + res.hedef + " (" + res.kopyaSayisi + " kopya)"
      );
      onKapat(true);
    } finally {
      setYaziyor(false);
    }
  }

  return (
    <Dialog open={acik} onOpenChange={(yeni) => !yeni && !yaziyor && onKapat(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-[#f5c518]" /> Etiket Yazdır · Talep #{siraNo}
          </DialogTitle>
          <DialogDescription>
            Etiket, onayınızla yazıcıya gönderilir. Önizleme, yazıcıya gidecek görüntünün birebir
            aynısıdır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs font-semibold text-sky-100">
              <div className="text-sm font-black text-white">{etiket.musteriAdi}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span>{etiket.telefon}</span>
                <span className="font-black text-[#f5c518]">{etiket.kilo} kg</span>
                <span>{etiket.toplamTutar} TL</span>
              </div>
              <div className="mt-1 text-[11px]">İşlemler: {islemOzeti}</div>
              <div className="mt-1 text-[11px]">{etiket.tarihSaatStr}</div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white">
              Kopya Sayısı
              <select
                value={kopyaSayisi}
                onChange={(e) => setKopyaSayisi(Number(e.target.value))}
                disabled={yaziyor}
                className="rounded-lg border border-white/10 bg-[#081226] px-2 py-1 text-xs font-bold text-white focus:border-[#f5c518] focus:outline-none"
              >
                {Array.from({ length: NIMBOT_MAKS_KOPYA }, (_, i) => i + 1).map((adet) => (
                  <option key={adet} value={adet}>
                    {adet} kopya
                  </option>
                ))}
              </select>
            </label>

            {!yazdirmaYetkisi && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] font-semibold text-amber-300">
                Etiket baskısı için HİZMET güncelleme yetkisi gerekir.
              </div>
            )}
            {!btDestekli && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] font-semibold text-amber-300">
                {NIMBOT_DESTEK_HATASI}
              </div>
            )}
            {!dogrudanVar && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5 text-[11px] font-semibold text-sky-200">
                Doğrudan yazıcı hedefi tanımlı değil. Etiketi Bluetooth ile Nimbot B1&apos;e
                gönderebilir veya Ayarlar → Fındık İşleme bölümünden yazıcı seçebilirsiniz.
              </div>
            )}
            {gosterilenHata && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] font-bold text-red-300">
                {gosterilenHata}
              </div>
            )}
            {yaziyor && (
              <div className="text-[11px] font-bold text-sky-200">
                {nimbotTercih ? "Bluetooth ile gönderiliyor %" + ilerleme : "Yazıcıya gönderiliyor"}
                {cihaz ? " · " + cihaz : ""}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white p-2">
            {onizleme ? (
              <Image
                src={onizleme}
                alt={"Talep " + siraNo + " etiket önizlemesi"}
                width={320}
                height={320}
                unoptimized
                className="mx-auto block h-auto w-full max-w-[320px]"
              />
            ) : (
              <div className="py-12 text-center text-[11px] font-bold text-neutral-500">
                Önizleme oluşturulamadı
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Link
            href={"/hizmet/" + hizmetId + "/etiket"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Etiket Ekranını Aç
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onKapat(false)}
              disabled={yaziyor}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Yazdırmadan Bitir
            </button>
            <button
              type="button"
              onClick={() => void nimbotIleYazdir()}
              disabled={yaziyor || !nimbotKullanilabilir}
              title={
                btDestekli
                  ? "Nimbot B1 yazıcıya Bluetooth ile gönder (ilk baskıda yazıcı seçilir)"
                  : NIMBOT_DESTEK_HATASI
              }
              className={nimbotTercih ? BIRINCIL_DUGME : IKINCIL_DUGME}
            >
              {yaziyor && nimbotTercih ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              Nimbot B1&apos;e Yazdır
              {kopyaSayisi > 1 ? " (" + kopyaSayisi + ")" : ""}
            </button>
            {dogrudanVar && (
              <button
                type="button"
                onClick={() => void dogrudanYazdir()}
                disabled={yaziyor || !dogrudanKullanilabilir}
                title={"Etiketi " + yaziciAdi + " hedefine gönder"}
                className={nimbotTercih ? IKINCIL_DUGME : BIRINCIL_DUGME}
              >
                {yaziyor && !nimbotTercih ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Yazıcıya Gönder
                {kopyaSayisi > 1 ? " (" + kopyaSayisi + ")" : ""}
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}