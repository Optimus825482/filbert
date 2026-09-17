"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { randimanGir } from "@/lib/actions/alim";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir, puan as fmtPuan } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calculator, Save, X } from "lucide-react";

interface RandimanFormProps {
  fisId: string;
  fisNo: string;
  onClose?: () => void;
  onComplete?: () => void;
}

export function RandimanForm({ fisId, fisNo, onClose, onComplete }: RandimanFormProps) {
  const [pending, startTransition] = useTransition();
  const [puanGirdi, setPuanGirdi] = useState("");

  const puan = sayiCevir(puanGirdi);
  const puanGecerli = puanGirdi.trim() !== "" && puan > 0 && puan <= 100;

  function gonder() {
    if (!puanGecerli) {
      toast.error("Geçersiz randıman", { description: "Randıman 0-100 arasında bir rakam olmalı" });
      return;
    }
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => randimanGir(fisId, puan));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(`Randıman kaydedildi: ${fisNo}`, {
          description: `Puan: ${sonuc.puan}`,
        });
        onComplete?.();
      } else {
        toast.error("Randıman kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
          <Calculator className="h-4 w-4" /> RANDIMAN GİRİŞİ
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-sky-500 hover:bg-slate-800 hover:text-sky-100">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`randiman-${fisId}`}>Randıman puanı (0-100)</Label>
        <Input
          id={`randiman-${fisId}`}
          inputMode="decimal"
          value={puanGirdi}
          onChange={(e) => setPuanGirdi(e.target.value)}
          placeholder="Örn. 52"
          className="saha-input"
        />
      </div>

      {/* Canlı puan önizleme */}
      <div className="flex items-center justify-between rounded-xl bg-orange-900/30 px-4 py-3">
        <span className="text-sm font-bold text-orange-200">Randıman Puanı</span>
        <span className="text-2xl font-extrabold tabular-nums text-orange-400">
          {puanGecerli ? fmtPuan(puan) : "—"}
        </span>
      </div>

      <button
        type="button"
        disabled={pending || !puanGecerli}
        onClick={gonder}
        className="saha-btn w-full bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
      >
        <Save className="h-5 w-5" />
        {pending ? "Kaydediliyor..." : "Randımanı Tamamla"}
      </button>
    </div>
  );
}
