"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDepo, updateDepo, toggleDepoAktif } from "@/lib/actions/tanimlar";
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
import { Warehouse } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface DepoSatir {
  id: string;
  ad: string;
  subeId: string | null;
  aktif: boolean;
}

export interface SubeSecenek {
  id: string;
  ad: string;
}

const YOK = "__yok__";

export function DepoTanim({ depolar, subeler, olusturYetkisi, guncelleYetkisi }: { depolar: DepoSatir[]; subeler: SubeSecenek[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<DepoSatir | null>(null);
  const [ad, setAd] = useState("");
  const [subeId, setSubeId] = useState(YOK);

  const subeAd = (id: string | null) => subeler.find((s) => s.id === id)?.ad ?? "Merkez";

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setSubeId(YOK);
    setAcik(true);
  }

  function duzenleAc(d: DepoSatir) {
    setDuzenlenen(d);
    setAd(d.ad);
    setSubeId(d.subeId ?? YOK);
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const girdi = { ad: ad.trim(), subeId: subeId === YOK ? undefined : subeId };
      const sonuc = duzenlenen ? await updateDepo(duzenlenen.id, girdi) : await createDepo(girdi);
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Depo güncellendi" : "Depo eklendi", { description: ad.trim() });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(d: DepoSatir) {
    startTransition(async () => {
      const sonuc = await toggleDepoAktif(d.id);
      if (sonuc.ok) {
        toast.success(d.aktif ? "Depo pasifleştirildi" : "Depo aktifleştirildi", { description: d.ad });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div>
      <TanimBaslik ikon={Warehouse} baslik="Depolar" adet={depolar.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {depolar.length === 0 ? (
        <BosDurum mesaj="Henüz depo tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {depolar.map((d) => (
            <TanimSatir key={d.id}>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--app-fg)]">{d.ad}</div>
                <div className="text-xs text-sky-100">{subeAd(d.subeId)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={d.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(d)} disabled={pending} /><AktifButon aktif={d.aktif} onClick={() => aktifToggle(d)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Depo Düzenle" : "Yeni Depo"}</DialogTitle>
            <DialogDescription>
              Alım, satış ve sevkiyat işlemlerinde stok hareketleri bu depoya işlenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="depo-ad">Depo adı</Label>
              <Input
                id="depo-ad"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: Merkez Depo"
                className="saha-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="depo-sube">Şube</Label>
              <Select value={subeId} onValueChange={setSubeId}>
                <SelectTrigger id="depo-sube" className="saha-input w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={YOK}>Merkez (şubesiz)</SelectItem>
                  {subeler.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              disabled={pending || !ad.trim()}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Depo Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
