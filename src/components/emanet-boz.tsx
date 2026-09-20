"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { muhasebelestirEmanet } from "@/lib/actions/emanet";
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
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { PackageOpen, RotateCcw } from "lucide-react";

export function EmanetBozButon({
  emanetId,
  cariAd,
  kalanKg,
}: {
  emanetId: string;
  cariAd: string;
  kalanKg: number;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kgGirdi, setKgGirdi] = useState(String(kalanKg));
  const [fiyat, setFiyat] = useState("");

  const sayisalKg = sayiCevir(kgGirdi);
  const sayisalFiyat = sayiCevir(fiyat);
  const tutar = tutarHesapla(sayisalKg, sayisalFiyat);

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() =>
        muhasebelestirEmanet({ emanetId, kg: sayisalKg, birimFiyat: sayisalFiyat })
      );
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Emanet başarıyla muhasebeleştirildi", {
          description: `${kg(sayisalKg)} × ${paraTL(sayisalFiyat)} = ${paraTL(sonuc.tutar)} TL borç yazıldı`,
        });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Muhasebeleştirme başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="saha-btn bg-amber-600 hover:bg-amber-500 text-white px-4 text-sm font-bold shadow-xs"
        >
          <PackageOpen className="h-4 w-4" /> Muhasebeleştir (Hesap Gör)
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emaneti Muhasebeleştir</DialogTitle>
          <DialogDescription>
            {cariAd} emanetindeki toplam {kg(kalanKg)} fındıktan istenen miktar bozdurularak TL borca dönüştürülür.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Miktar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-[var(--app-fg)]">
                Bozdurulacak Miktar (Kg) <span className="text-red-400">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setKgGirdi(String(kalanKg))}
                className="text-xs font-bold text-[var(--primary)] hover:underline"
              >
                Tümünü Seç ({kalanKg.toLocaleString("tr-TR")} kg)
              </button>
            </div>
            <Input
              inputMode="decimal"
              value={kgGirdi}
              onChange={(e) => setKgGirdi(e.target.value)}
              className="saha-input text-xl font-bold"
            />
          </div>

          {/* Fiyat */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-[var(--app-fg)]">
                Birim Fiyat (TL/kg) <span className="text-red-400">*</span>
              </Label>
              {fiyat && (
                <button
                  type="button"
                  onClick={() => setFiyat("")}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="h-3 w-3" /> Temizle
                </button>
              )}
            </div>
            <Input
              inputMode="decimal"
              value={fiyat}
              onChange={(e) => setFiyat(e.target.value)}
              placeholder="0,00 TL"
              className="saha-input text-xl font-bold"
            />
            <QuickNumberStepper
              label="Hızlı Fiyat Seçimi:"
              values={[125, 130, 135, 140, 145, 150]}
              unit="TL"
              mode="set"
              onSelect={(p) => setFiyat(String(p))}
            />
          </div>

          {/* Canlı Tutar Önizleme */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <span className="text-sm font-bold text-amber-300">Oluşacak TL Borç:</span>
            <span className="text-2xl font-black tabular-nums text-amber-400">{paraTL(tutar)}</span>
          </div>

          <button
            type="button"
            disabled={
              pending ||
              sayisalKg <= 0 ||
              sayisalKg > kalanKg ||
              sayisalFiyat <= 0
            }
            onClick={gonder}
            className="saha-btn w-full bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30"
          >
            {pending ? "İşleniyor..." : "Satın Almayı Onayla & Tamamla"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
