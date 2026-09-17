"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createKasaHesap, updateKasaHesap, toggleKasaHesapAktif } from "@/lib/actions/tanimlar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface HesapSatir {
  id: string;
  ad: string;
  tip: string; // KASA | BANKA
  bakiyeTuru: string; // TL | USD | EUR | XAU
  bankaAdi: string | null;
  iban: string | null;
  aktif: boolean;
}

const TIPLER = [
  { v: "KASA", e: "Kasa" },
  { v: "BANKA", e: "Banka" },
];

const BAKIYELER = [
  { v: "TL", e: "TL (₺)" },
  { v: "USD", e: "USD ($)" },
  { v: "EUR", e: "EUR (€)" },
  { v: "XAU", e: "Altın (gram)" },
];

const BAKIYE_ETIKET: Record<string, string> = { TL: "TL", USD: "USD", EUR: "EUR", XAU: "Altın" };

export function HesapTanim({ hesaplar, olusturYetkisi, guncelleYetkisi }: { hesaplar: HesapSatir[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<HesapSatir | null>(null);
  const [ad, setAd] = useState("");
  const [tip, setTip] = useState("KASA");
  const [bakiyeTuru, setBakiyeTuru] = useState("TL");
  const [bankaAdi, setBankaAdi] = useState("");
  const [iban, setIban] = useState("");

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setTip("KASA");
    setBakiyeTuru("TL");
    setBankaAdi("");
    setIban("");
    setAcik(true);
  }

  function duzenleAc(h: HesapSatir) {
    setDuzenlenen(h);
    setAd(h.ad);
    setTip(h.tip);
    setBakiyeTuru(h.bakiyeTuru);
    setBankaAdi(h.bankaAdi ?? "");
    setIban(h.iban ?? "");
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const girdi = {
        ad: ad.trim(),
        tip: tip as "KASA" | "BANKA",
        bakiyeTuru,
        bankaAdi: tip === "BANKA" ? bankaAdi.trim() || undefined : undefined,
        iban: tip === "BANKA" ? iban.trim() || undefined : undefined,
      };
      const sonuc = duzenlenen ? await updateKasaHesap(duzenlenen.id, girdi) : await createKasaHesap(girdi);
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Hesap güncellendi" : "Hesap eklendi", { description: ad.trim() });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(h: HesapSatir) {
    startTransition(async () => {
      const sonuc = await toggleKasaHesapAktif(h.id);
      if (sonuc.ok) {
        toast.success(h.aktif ? "Hesap pasifleştirildi" : "Hesap aktifleştirildi", { description: h.ad });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div>
      <TanimBaslik ikon={Landmark} baslik="Kasa / Banka Hesapları" adet={hesaplar.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {hesaplar.length === 0 ? (
        <BosDurum mesaj="Henüz hesap tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {hesaplar.map((h) => (
            <TanimSatir key={h.id}>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--app-fg)]">{h.ad}</div>
                <div className="truncate text-xs text-sky-100">
                  {h.tip === "BANKA" ? h.bankaAdi ?? "Banka" : "Kasa"} · {BAKIYE_ETIKET[h.bakiyeTuru] ?? h.bakiyeTuru}
                  {h.tip === "BANKA" && h.iban ? ` · ${h.iban}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={h.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(h)} disabled={pending} /><AktifButon aktif={h.aktif} onClick={() => aktifToggle(h)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Hesap Düzenle" : "Yeni Hesap"}</DialogTitle>
            <DialogDescription>
              Ödeme, tahsilat ve virman işlemlerinde kullanılacak kasa veya banka hesabı.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hesap adı</Label>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: Merkez Kasa / Ziraat TL"
                className="saha-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tip</Label>
                <Select value={tip} onValueChange={setTip}>
                  <SelectTrigger className="saha-input w-full bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPLER.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bakiye türü</Label>
                <Select value={bakiyeTuru} onValueChange={setBakiyeTuru}>
                  <SelectTrigger className="saha-input w-full bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAKIYELER.map((b) => (
                      <SelectItem key={b.v} value={b.v}>
                        {b.e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tip === "BANKA" && (
              <>
                <div className="space-y-1.5">
                  <Label>Banka adı</Label>
                  <Input
                    value={bankaAdi}
                    onChange={(e) => setBankaAdi(e.target.value)}
                    placeholder="ör: Ziraat Bankası"
                    className="saha-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>IBAN (opsiyonel)</Label>
                  <Input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="TR__ ____ ____ ____ ____ ____ __"
                    className="saha-input"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              disabled={pending || !ad.trim() || (tip === "BANKA" && !bankaAdi.trim())}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Hesap Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
