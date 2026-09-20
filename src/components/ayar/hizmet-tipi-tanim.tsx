"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createHizmetTipi,
  updateHizmetTipi,
  toggleHizmetTipiAktif,
  type HizmetTipiGirdi,
} from "@/lib/actions/hizmet-tanimlar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PackageCheck } from "lucide-react";
import {
  AktifButon,
  AktifRozet,
  BosDurum,
  DuzenleButon,
  TanimBaslik,
  TanimSatir,
} from "./tanim-ortak";

export interface HizmetTipiSatir {
  id: string;
  ad: string;
  kirma: boolean;
  kavurma: boolean;
  paketleme: boolean;
  varsayilanBirimFiyat: number;
  sira: number;
  aktif: boolean;
}

export function HizmetTipiTanim({
  hizmetTipleri,
  olusturYetkisi,
  guncelleYetkisi,
}: {
  hizmetTipleri: HizmetTipiSatir[];
  olusturYetkisi: boolean;
  guncelleYetkisi: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<HizmetTipiSatir | null>(null);

  // Form states
  const [ad, setAd] = useState("");
  const [kirma, setKirma] = useState(false);
  const [kavurma, setKavurma] = useState(false);
  const [paketleme, setPaketleme] = useState(false);
  const [birimFiyatStr, setBirimFiyatStr] = useState("0");

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setKirma(true);
    setKavurma(false);
    setPaketleme(false);
    setBirimFiyatStr("0");
    setAcik(true);
  }

  function duzenleAc(h: HizmetTipiSatir) {
    setDuzenlenen(h);
    setAd(h.ad);
    setKirma(h.kirma);
    setKavurma(h.kavurma);
    setPaketleme(h.paketleme);
    setBirimFiyatStr(String(h.varsayilanBirimFiyat));
    setAcik(true);
  }

  function gonder() {
    const f = parseFloat(birimFiyatStr.replace(",", "."));
    if (isNaN(f) || f < 0) {
      toast.error("Geçerli bir birim fiyat giriniz");
      return;
    }

    startTransition(async () => {
      const girdi: HizmetTipiGirdi = {
        ad: ad.trim(),
        kirma,
        kavurma,
        paketleme,
        varsayilanBirimFiyat: f,
      };

      const res = duzenlenen
        ? await updateHizmetTipi(duzenlenen.id, girdi)
        : await createHizmetTipi(girdi);

      if (!res.ok) {
        toast.error(res.hata ?? "İşlem başarısız");
        return;
      }

      toast.success(duzenlenen ? "Hizmet tipi güncellendi" : "Hizmet tipi eklendi");
      setAcik(false);
      router.refresh();
    });
  }

  function aktifToggle(id: string) {
    startTransition(async () => {
      const res = await toggleHizmetTipiAktif(id);
      if (!res.ok) {
        toast.error(res.hata ?? "Durum değiştirilemedi");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <TanimBaslik
        ikon={PackageCheck}
        baslik="Fındık Kırma & Paketleme Hizmet Tipleri"
        adet={hizmetTipleri.length}
        onYeni={olusturYetkisi ? yeniAc : undefined}
      />

      {hizmetTipleri.length === 0 ? (
        <BosDurum mesaj="Henüz tanımlı hizmet tipi yok. 'Yeni' butonuna tıklayarak ekleyebilirsiniz (örn: Kırma, Kırma + Paketleme)." />
      ) : (
        <div className="space-y-2">
          {hizmetTipleri.map((h) => (
            <TanimSatir key={h.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{h.ad}</span>
                  <AktifRozet aktif={h.aktif} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sky-200">
                  <span className="font-mono font-bold text-[#f5c518]">
                    {h.varsayilanBirimFiyat} ₺ / KG
                  </span>
                  <span>•</span>
                  <span>
                    {[
                      h.kirma && "Kırma",
                      h.kavurma && "Kavurma",
                      h.paketleme && "Vakumlu Paketleme",
                    ]
                      .filter(Boolean)
                      .join(" + ")}
                  </span>
                </div>
              </div>

              {guncelleYetkisi && (
                <div className="flex items-center gap-1">
                  <DuzenleButon onClick={() => duzenleAc(h)} />
                  <AktifButon aktif={h.aktif} onClick={() => aktifToggle(h.id)} disabled={pending} />
                </div>
              )}
            </TanimSatir>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {duzenlenen ? "Hizmet Tipini Düzenle" : "Yeni Hizmet Tipi"}
            </DialogTitle>
            <DialogDescription className="text-sky-300">
              Kırma, kavurma veya paketleme paketi ve kg birim fiyatı
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-sky-200">Hizmet Adı *</Label>
              <Input
                placeholder="Örn: Kırma + Paketleme"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <Label className="text-xs text-sky-200">İçerdiği İşlemler</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-sky-100">
                  <input
                    type="checkbox"
                    checked={kirma}
                    onChange={(e) => setKirma(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#f5c518]"
                  />
                  Kırma
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-sky-100">
                  <input
                    type="checkbox"
                    checked={kavurma}
                    onChange={(e) => setKavurma(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#f5c518]"
                  />
                  Kavurma
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-sky-100">
                  <input
                    type="checkbox"
                    checked={paketleme}
                    onChange={(e) => setPaketleme(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#f5c518]"
                  />
                  Vakumlu Paketleme
                </label>
              </div>
            </div>

            <div>
              <Label className="text-xs text-sky-200">Varsayılan Birim Fiyat (TL/KG) *</Label>
              <div className="relative mt-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={birimFiyatStr}
                  onChange={(e) => setBirimFiyatStr(e.target.value)}
                  className="border-white/10 bg-white/5 font-mono text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-sky-300">
                  ₺ / kg
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAcik(false)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-white/5"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={gonder}
              className="rounded-lg bg-[#f5c518] px-4 py-2 text-xs font-black text-[#081226] hover:bg-[#e5b508] disabled:opacity-50"
            >
              Kaydet
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
