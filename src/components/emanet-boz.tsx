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
import { PackageOpen } from "lucide-react";

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

  const tutar = tutarHesapla(sayiCevir(kgGirdi), sayiCevir(fiyat));

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => muhasebelestirEmanet({ emanetId, kg: sayiCevir(kgGirdi), birimFiyat: sayiCevir(fiyat) }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Emanet muhasebeleştirildi", { description: `${kgGirdi} kg × ${paraTL(sayiCevir(fiyat))} → ${paraTL(sonuc.tutar)} TL borç` });
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
        <button type="button" className="saha-btn bg-orange-800 px-4 text-sm text-white">
          <PackageOpen className="h-4 w-4" /> Muhasebeleştir (Hesap Gör)
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Emaneti Muhasebeleştir — {cariAd}</DialogTitle>
          <DialogDescription>
            Emanetteki {kg(kalanKg)} fındığın tamamını veya bir kısmını manuel fiyatla satın alınır; kg borcu düşer, TL borç yazılır.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Miktar (kg) — kalan: {kalanKg.toLocaleString("tr-TR")}</Label>
            <Input inputMode="decimal" value={kgGirdi} onChange={(e) => setKgGirdi(e.target.value)} className="saha-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Birim fiyat (TL/kg)</Label>
            <Input inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} className="saha-input" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-900/30 px-4 py-3">
            <span className="text-sm font-bold text-orange-200">Oluşacak TL borç</span>
            <span className="text-2xl font-extrabold tabular-nums text-orange-700">{paraTL(tutar)}</span>
          </div>
          <button
            type="button"
            disabled={pending || sayiCevir(kgGirdi) <= 0 || sayiCevir(kgGirdi) > kalanKg || sayiCevir(fiyat) <= 0}
            onClick={gonder}
            className="saha-btn w-full bg-orange-800 text-white"
          >
            {pending ? "İşleniyor..." : "Satın Almayı Tamamla"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
