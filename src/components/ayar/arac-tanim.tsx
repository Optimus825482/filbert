"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createArac, updateArac, toggleAracAktif } from "@/lib/actions/tanimlar";
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
import { Truck } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface AracSatir {
  id: string;
  plaka: string;
  marka: string | null;
  tip: string;
  sofor: string | null;
  aktif: boolean;
}

const TIPLER = [
  { v: "KAMYON", e: "Kamyon" },
  { v: "TIR", e: "Tır" },
  { v: "PIKAP", e: "Pikap" },
  { v: "MINIVAN", e: "Minivan" },
];

const TIP_ETIKET: Record<string, string> = Object.fromEntries(TIPLER.map((t) => [t.v, t.e]));

export function AracTanim({ araclar, olusturYetkisi, guncelleYetkisi }: { araclar: AracSatir[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<AracSatir | null>(null);
  const [plaka, setPlaka] = useState("");
  const [marka, setMarka] = useState("");
  const [tip, setTip] = useState("KAMYON");
  const [sofor, setSofor] = useState("");

  function yeniAc() {
    setDuzenlenen(null);
    setPlaka("");
    setMarka("");
    setTip("KAMYON");
    setSofor("");
    setAcik(true);
  }

  function duzenleAc(a: AracSatir) {
    setDuzenlenen(a);
    setPlaka(a.plaka);
    setMarka(a.marka ?? "");
    setTip(a.tip);
    setSofor(a.sofor ?? "");
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const girdi = {
        plaka: plaka.trim(),
        marka: marka.trim() || undefined,
        tip,
        sofor: sofor.trim() || undefined,
      };
      const sonuc = duzenlenen ? await updateArac(duzenlenen.id, girdi) : await createArac(girdi);
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Araç güncellendi" : "Araç eklendi", { description: plaka.trim().toLocaleUpperCase("tr-TR") });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(a: AracSatir) {
    startTransition(async () => {
      const sonuc = await toggleAracAktif(a.id);
      if (sonuc.ok) {
        toast.success(a.aktif ? "Araç pasifleştirildi" : "Araç aktifleştirildi", { description: a.plaka });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div>
      <TanimBaslik ikon={Truck} baslik="Araçlar" adet={araclar.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {araclar.length === 0 ? (
        <BosDurum mesaj="Henüz araç tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {araclar.map((a) => (
            <TanimSatir key={a.id}>
              <div className="min-w-0">
                <div className="truncate font-bold tabular-nums text-[var(--app-fg)]">{a.plaka}</div>
                <div className="truncate text-xs text-sky-100">
                  {[TIP_ETIKET[a.tip] ?? a.tip, a.marka, a.sofor].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={a.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(a)} disabled={pending} /><AktifButon aktif={a.aktif} onClick={() => aktifToggle(a)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Araç Düzenle" : "Yeni Araç"}</DialogTitle>
            <DialogDescription>Sevkiyat planlamasında seçilecek araç tanımı.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plaka</Label>
                <Input
                  value={plaka}
                  onChange={(e) => setPlaka(e.target.value)}
                  placeholder="34 ABC 123"
                  className="saha-input"
                />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marka (opsiyonel)</Label>
                <Input
                  value={marka}
                  onChange={(e) => setMarka(e.target.value)}
                  placeholder="ör: Ford Cargo"
                  className="saha-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Şoför (opsiyonel)</Label>
                <Input
                  value={sofor}
                  onChange={(e) => setSofor(e.target.value)}
                  placeholder="ör: Mehmet"
                  className="saha-input"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={pending || !plaka.trim()}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Araç Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
