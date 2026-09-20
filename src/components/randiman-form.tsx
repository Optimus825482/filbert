"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { randimanGir } from "@/lib/actions/alim";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir, puan as fmtPuan } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { Calculator, Save, X, RotateCcw } from "lucide-react";

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
          description: `Randıman: ${sonuc.puan} Puan`,
        });
        onComplete?.();
      } else {
        toast.error("Randıman kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)]">
          <Calculator className="h-4 w-4 text-amber-500" /> RANDIMAN GİRİŞİ — <span className="text-[var(--primary)]">{fisNo}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-[var(--app-fg)]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`randiman-${fisId}`} className="text-sm font-bold text-[var(--app-fg)]">
            Randıman Puanı (0 - 100) <span className="text-red-400">*</span>
          </Label>
          {puanGirdi && (
            <button
              type="button"
              onClick={() => setPuanGirdi("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3" /> Temizle
            </button>
          )}
        </div>
        <Input
          id={`randiman-${fisId}`}
          inputMode="decimal"
          value={puanGirdi}
          onChange={(e) => setPuanGirdi(e.target.value)}
          placeholder="Örn. 52"
          className="saha-input text-2xl font-extrabold text-center tracking-tight"
          autoFocus
        />

        {/* Hızlı Randıman Puanları */}
        <QuickNumberStepper
          label="Standart Randıman Değerleri:"
          values={[48, 49, 50, 51, 52, 53, 54, 55]}
          mode="set"
          onSelect={(p) => setPuanGirdi(String(p))}
        />
      </div>

      {/* Canlı Puan Önizleme */}
      <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <span className="text-sm font-bold text-amber-300">Hesaplanan Randıman</span>
        <span className="text-2xl font-black tabular-nums text-amber-400">
          {puanGecerli ? fmtPuan(puan) : "—"}
        </span>
      </div>

      <button
        type="button"
        disabled={pending || !puanGecerli}
        onClick={gonder}
        className="saha-btn w-full bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30 hover:opacity-95"
      >
        <Save className="h-4 w-4" />
        {pending ? "Kaydediliyor..." : "Randımanı Onayla & Kaydet"}
      </button>
    </div>
  );
}
