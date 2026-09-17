"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSezon, updateSezon, toggleSezonAktif } from "@/lib/actions/tanimlar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarRange } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface SezonSatir {
  id: string;
  ad: string;
  baslangic: string; // ISO
  bitis: string; // ISO
  aktif: boolean;
}

function tarihKisa(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
}

export function SezonTanim({ sezonlar, olusturYetkisi, guncelleYetkisi }: { sezonlar: SezonSatir[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<SezonSatir | null>(null);
  const [ad, setAd] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setBaslangic("");
    setBitis("");
    setAcik(true);
  }

  function duzenleAc(s: SezonSatir) {
    setDuzenlenen(s);
    setAd(s.ad);
    setBaslangic(s.baslangic.slice(0, 10));
    setBitis(s.bitis.slice(0, 10));
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const girdi = { ad: ad.trim(), baslangic, bitis };
      const sonuc = duzenlenen ? await updateSezon(duzenlenen.id, girdi) : await createSezon(girdi);
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Sezon güncellendi" : "Sezon eklendi", { description: ad.trim() });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(s: SezonSatir) {
    startTransition(async () => {
      const sonuc = await toggleSezonAktif(s.id);
      if (sonuc.ok) {
        toast.success(s.aktif ? "Sezon pasifleştirildi" : "Sezon aktifleştirildi", {
          description: s.aktif ? s.ad : `${s.ad} — diğer sezonlar pasifleştirildi`,
        });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  const tarihlerGecerli = baslangic && bitis && bitis > baslangic;

  return (
    <div>
      <TanimBaslik ikon={CalendarRange} baslik="Sezonlar" adet={sezonlar.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {sezonlar.length === 0 ? (
        <BosDurum mesaj="Henüz sezon tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {sezonlar.map((s) => (
            <TanimSatir key={s.id}>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--app-fg)]">{s.ad}</div>
                <div className="text-xs tabular-nums text-sky-100">
                  {tarihKisa(s.baslangic)} → {tarihKisa(s.bitis)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={s.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(s)} disabled={pending} /><AktifButon aktif={s.aktif} onClick={() => aktifToggle(s)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Sezon Düzenle" : "Yeni Sezon"}</DialogTitle>
            <DialogDescription>
              Alım, emanet ve stok hareketleri aktif sezona işlenir. Yeni sezon pasif olarak eklenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Sezon adı</Label>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: 2026-27"
                className="saha-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Başlangıç</Label>
                <Input
                  type="date"
                  value={baslangic}
                  onChange={(e) => setBaslangic(e.target.value)}
                  className="saha-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bitiş</Label>
                <Input
                  type="date"
                  value={bitis}
                  onChange={(e) => setBitis(e.target.value)}
                  className="saha-input"
                />
              </div>
            </div>
            {baslangic && bitis && !tarihlerGecerli && (
              <p className="text-xs font-semibold text-red-400">Bitiş tarihi başlangıçtan sonra olmalı</p>
            )}
            <button
              type="button"
              disabled={pending || !ad.trim() || !tarihlerGecerli}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Sezon Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
