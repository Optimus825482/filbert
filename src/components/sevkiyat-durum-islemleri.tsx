"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { muhasebelestirSevkiyat, iptalEtSevkiyat } from "@/lib/actions/sevkiyat";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { tutarHesapla } from "@/lib/hesap";
import { paraTL, sayiCevir, kg } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, X } from "lucide-react";

type Durum = "FABRIKA_EMANET" | "SATILDI" | "IPTAL";

export function SevkiyatDurumIslemleri({
  sevkiyatId,
  durum,
  kgDeger,
  fisNo,
  guncelleYetkisi,
  iptalYetkisi,
}: {
  sevkiyatId: string;
  durum: Durum;
  kgDeger: number;
  fisNo: string;
  guncelleYetkisi: boolean;
  iptalYetkisi: boolean;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fiyat, setFiyat] = useState("");

  // Satılmış sevkiyat fişini satış listesinden izler; burada işlem yok.
  if (durum !== "FABRIKA_EMANET") return null;

  const fiyatDeger = sayiCevir(fiyat);
  const tutar = tutarHesapla(kgDeger, fiyatDeger);

  function muhasebelestir() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => muhasebelestirSevkiyat(sevkiyatId, fiyatDeger));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(`Muhasebeleştirildi: ${sonuc.fisNo}`, {
          description: `${kg(kgDeger)} × ${paraTL(fiyatDeger)} = ${paraTL(sonuc.tutar)}`,
        });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Muhasebeleştirme başarısız", { description: sonuc.hata });
      }
    });
  }

  function iptal() {
    if (!window.confirm("Sevkiyat iptal edilecek ve stok kaynağı depoya iade edilecek. Devam edilsin mi?")) return;
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => iptalEtSevkiyat(sevkiyatId));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Sevkiyat iptal edildi");
        router.refresh();
      } else {
        toast.error("İptal başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {guncelleYetkisi && (
        <Dialog open={acik} onOpenChange={setAcik}>
          <DialogTrigger asChild>
            <button type="button" disabled={pending} className="inline-flex h-11 items-center gap-1 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white disabled:opacity-50">
              <Calculator className="h-3.5 w-3.5" /> Muhasebeleştir
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Muhasebeleştir — {fisNo}</DialogTitle>
              <DialogDescription>
                Fabrika emanetindeki {kg(kgDeger)} fındık, gireceğiniz birim fiyatla satılığa çevrilir
                ve fabrika carisine TL alacak işlenir.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Birim fiyat (TL/kg)</Label>
                <Input
                  inputMode="decimal"
                  value={fiyat}
                  onChange={(e) => setFiyat(e.target.value)}
                  placeholder="0,00"
                  className="saha-input"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-sky-900/30 px-4 py-3">
                <span className="text-sm font-bold text-sky-200">Satış tutarı</span>
                <span className="text-2xl font-extrabold tabular-nums text-sky-200">{paraTL(tutar)}</span>
              </div>
              <button
                type="button"
                disabled={pending || fiyatDeger <= 0}
                onClick={muhasebelestir}
                className="saha-btn w-full bg-filbert-600 text-white"
              >
                {pending ? "İşleniyor..." : "Satışı Tamamla"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {iptalYetkisi && (
        <button type="button" disabled={pending} onClick={iptal} className="inline-flex h-11 items-center gap-1 rounded-lg bg-red-950/60 px-3 text-xs font-bold text-red-200 disabled:opacity-50">
          <X className="h-3.5 w-3.5" /> İptal
        </button>
      )}
    </div>
  );
}
