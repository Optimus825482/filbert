"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { muhasebelestirEmanet } from "@/lib/actions/emanet";
import { muhasebelestirSevkiyat } from "@/lib/actions/sevkiyat";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { tutarHesapla } from "@/lib/hesap";
import { kg as kgFmt, paraTL, sayiCevir } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Müstahsil emaneti: kg + manuel birim fiyatla hesap gör (satın alma tamamlanır)
export function EmanetMuhasebelestirButonu({ emanetId, kalanKg }: { emanetId: string; kalanKg: number }) {
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
      } else toast.error("Muhasebeleştirme başarısız", { description: sonuc.hata });
    });
  }

  return (
    <Dialog open={acik} onOpenChange={(yeni) => { if (!yeni) setAcik(false); else setAcik(true); }}>
      <DialogTrigger asChild>
        <button type="button" className="saha-btn bg-orange-800 px-3 text-xs text-white">
          <Calculator className="size-3.5" /> Muhasebeleştir (Hesap Gör)
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Emaneti Muhasebeleştir</DialogTitle>
          <DialogDescription>
            Emanetteki {kgFmt(kalanKg)} fındığın tamamını veya bir kısmını manuel fiyatla satın alınır; kg borcu düşer, TL borç yazılır.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Miktar (kg) — kalan: {kalanKg.toLocaleString("tr-TR")}</Label>
            <Input inputMode="decimal" value={kgGirdi} onChange={(e) => setKgGirdi(e.target.value)} className="saha-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Birim fiyat (TL/kg)</Label>
            <Input inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} className="saha-input" placeholder="Ör. 130,50" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-900/30 px-4 py-3">
            <span className="text-sm font-bold text-orange-200">Oluşacak TL borç</span>
            <span className="text-2xl font-extrabold tabular-nums text-orange-700">{paraTL(tutar)}</span>
          </div>
          <button type="button" disabled={pending || sayiCevir(kgGirdi) <= 0 || sayiCevir(kgGirdi) > kalanKg || sayiCevir(fiyat) <= 0} onClick={gonder} className="saha-btn w-full bg-orange-800 text-white">
            {pending ? "İşleniyor..." : "Satın Almayı Tamamla"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fabrika emaneti: sevkiyat manuel birim fiyatla satılır
export function SevkiyatMuhasebelestirButonu({ sevkiyatId, kg: sevkiyatKg }: { sevkiyatId: string; kg: number }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fiyat, setFiyat] = useState("");

  const tutar = tutarHesapla(sevkiyatKg, sayiCevir(fiyat));

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => muhasebelestirSevkiyat(sevkiyatId, sayiCevir(fiyat)));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Sevkiyat muhasebeleştirildi", { description: `${paraTL(sonuc.tutar)} satış fişi: ${sonuc.fisNo ?? "—"}` });
        setAcik(false);
        router.refresh();
      } else toast.error("Muhasebeleştirme başarısız", { description: sonuc.hata });
    });
  }

  return (
    <Dialog open={acik} onOpenChange={(yeni) => { if (!yeni) setAcik(false); else setAcik(true); }}>
      <DialogTrigger asChild>
        <button type="button" className="saha-btn bg-orange-800 px-3 text-xs text-white">
          <Calculator className="size-3.5" /> Muhasebeleştir
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sevkiyatı Muhasebeleştir</DialogTitle>
          <DialogDescription>
            {kgFmt(sevkiyatKg)} fındık manuel birim fiyatla satılır; fabrika carisine TL alacak yazılır.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Birim fiyat (TL/kg)</Label>
            <Input inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value)} className="saha-input" placeholder="Ör. 145,00" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-900/30 px-4 py-3">
            <span className="text-sm font-bold text-orange-200">Oluşacak satış tutarı</span>
            <span className="text-2xl font-extrabold tabular-nums text-orange-700">{paraTL(tutar)}</span>
          </div>
          <button type="button" disabled={pending || sayiCevir(fiyat) <= 0} onClick={gonder} className="saha-btn w-full bg-orange-800 text-white">
            {pending ? "İşleniyor..." : "Satışı Tamamla"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
