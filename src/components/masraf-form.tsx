"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMasraf } from "@/lib/actions/masraf";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { Receipt, RotateCcw } from "lucide-react";

export function MasrafForm({
  cariler,
  hesaplar,
  masrafTurleri,
}: {
  cariler: { id: string; ad: string }[];
  hesaplar: { id: string; ad: string }[];
  masrafTurleri: { id: string; ad: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tur, setTur] = useState(masrafTurleri[0]?.ad ?? "");
  const [tutar, setTutar] = useState("");
  const [cariId, setCariId] = useState("");
  const [hesapId, setHesapId] = useState("");
  const [maliyeteYansit, setMaliyeteYansit] = useState(true);
  const [aciklama, setAciklama] = useState("");

  const sayisalTutar = sayiCevir(tutar);

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createMasraf({
        tur,
        tutar: sayisalTutar,
        cariId: cariId || undefined,
        hesapId: hesapId || undefined,
        maliyeteYansit,
        aciklama: aciklama || undefined,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Masraf kaydedildi", {
          description: `${tur} · ${paraTL(sayisalTutar)}`,
        });
        setTutar("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("Masraf kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)] border-b border-[var(--surface-border)] pb-2.5">
        <Receipt className="h-4 w-4 text-[var(--primary)]" /> YENİ MASRAF KAYDI
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            Masraf Türü <span className="text-red-400">*</span>
          </Label>
          {masrafTurleri.length === 0 ? (
            <p className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-xs text-muted-foreground">
              Tanımlı masraf türü yok — Ayarlar &gt; Tanımlar sekmesinden ekleyin.
            </p>
          ) : (
            <Select value={tur} onValueChange={setTur}>
              <SelectTrigger className="saha-input">
                <SelectValue placeholder="Tür seçin..." />
              </SelectTrigger>
              <SelectContent>
                {masrafTurleri.map((t) => (
                  <SelectItem key={t.id} value={t.ad}>{t.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold text-[var(--app-fg)]">
              Tutar (TL) <span className="text-red-400">*</span>
            </Label>
            {sayisalTutar > 0 && (
              <button
                type="button"
                onClick={() => setTutar("")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3 w-3" /> Temizle
              </button>
            )}
          </div>
          <Input
            inputMode="decimal"
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            placeholder="0,00 TL"
            className="saha-input text-xl font-bold"
          />
        </div>
      </div>

      {/* Hızlı Tutar Stepper */}
      <QuickNumberStepper
        label="Hızlı Tutar Ekle:"
        values={[250, 500, 1000, 2500, 5000, 10000]}
        unit="TL"
        mode="add"
        onSelect={(ekle) => {
          const cur = sayiCevir(tutar);
          setTutar(String(cur + ekle));
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">Kime Ödendi (Opsiyonel)</Label>
          <Select value={cariId} onValueChange={setCariId}>
            <SelectTrigger className="saha-input">
              <SelectValue placeholder="Cari seçin..." />
            </SelectTrigger>
            <SelectContent>
              {cariler.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">Kasa / Banka (Opsiyonel)</Label>
          <Select value={hesapId} onValueChange={setHesapId}>
            <SelectTrigger className="saha-input">
              <SelectValue placeholder="Hesap seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)] px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={maliyeteYansit}
          onChange={(e) => setMaliyeteYansit(e.target.checked)}
          className="h-5 w-5 rounded-md accent-[var(--primary)]"
        />
        <div>
          <span className="text-sm font-bold text-[var(--app-fg)]">Stok Maliyetine Yansıt</span>
          <p className="text-xs text-muted-foreground">İşaretlendiğinde bu gider depodaki fındığın birim maliyetine eklenir.</p>
        </div>
      </label>

      <div className="space-y-1.5">
        <Label className="text-sm font-bold text-[var(--app-fg)]">Açıklama (Opsiyonel)</Label>
        <Input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Ör. Kargalı deposu hamaliye ve yükleme bedeli"
          className="saha-input"
        />
      </div>

      <button
        type="button"
        disabled={pending || !tur || sayiCevir(tutar) <= 0}
        onClick={gonder}
        className="saha-btn w-full bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20 hover:opacity-95"
      >
        {pending ? "Kaydediliyor..." : "Masrafı Onayla & Kaydet"}
      </button>
    </div>
  );
}
