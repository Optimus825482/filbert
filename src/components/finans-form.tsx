"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFinansIslem } from "@/lib/actions/finans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { ArrowDownLeft, ArrowUpRight, Search, RotateCcw } from "lucide-react";

interface Secenek {
  id: string;
  ad: string;
}

export function FinansForm({
  cariler,
  hesaplar,
  sabitTip,
}: {
  cariler: (Secenek & { tur: string })[];
  hesaplar: (Secenek & { bakiyeTuru: string })[];
  sabitTip?: "ODEME" | "TAHSILAT";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tip, setTip] = useState<"ODEME" | "TAHSILAT">(sabitTip ?? "ODEME");
  const [cariArama, setCariArama] = useState("");
  const [cariId, setCariId] = useState("");
  const [hesapId, setHesapId] = useState("");
  const [tutar, setTutar] = useState("");
  const [bakiyeTuru, setBakiyeTuru] = useState<"TL" | "USD" | "EUR" | "XAU">("TL");
  const [aciklama, setAciklama] = useState("");

  const filtrelenmisCariler = cariArama.trim()
    ? cariler.filter((c) =>
        c.ad.toLocaleLowerCase("tr-TR").includes(cariArama.trim().toLocaleLowerCase("tr-TR"))
      )
    : cariler;

  const seciliCari = cariler.find((c) => c.id === cariId);
  const seciliHesap = hesaplar.find((h) => h.id === hesapId);
  const sayisalTutar = sayiCevir(tutar);

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createFinansIslem({
        tip,
        cariId,
        hesapId,
        tutar: sayiCevir(tutar),
        bakiyeTuru,
        aciklama: aciklama || undefined,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(tip === "ODEME" ? "Ödeme kaydedildi" : "Tahsilat kaydedildi", {
          description: `${seciliCari?.ad ?? ""} · ${sayisalTutar.toLocaleString("tr-TR")} ${bakiyeTuru}`,
        });
        setTutar("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("İşlem kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  const renk = tip === "ODEME" ? "bg-sky-600 hover:bg-sky-500" : "bg-emerald-600 hover:bg-emerald-500";

  return (
    <div className="ozet-kart space-y-4">
      {/* Tip Seçimi (Ödeme / Tahsilat) */}
      {!sabitTip && <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-sm font-bold">
          <button
            type="button"
            onClick={() => setTip("ODEME")}
            className={`flex min-h-12 items-center justify-center gap-2 transition-colors ${
              tip === "ODEME" ? "bg-sky-600 text-white shadow-xs" : "text-muted-foreground hover:text-[var(--app-fg)]"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Ödeme (Biz → Cari)
          </button>
          <button
            type="button"
            onClick={() => setTip("TAHSILAT")}
            className={`flex min-h-12 items-center justify-center gap-2 transition-colors ${
              tip === "TAHSILAT" ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-[var(--app-fg)]"
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Tahsilat (Cari → Biz)
          </button>
        </div>}

      {/* Cari Seçimi */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="finans-cari" className="text-sm font-bold text-[var(--app-fg)]">
            Cari Hesap <span className="text-red-400">*</span>
          </Label>
          {seciliCari && (
            <span className="text-xs text-muted-foreground font-medium">
              {seciliCari.tur === "URETICI" ? "Müstahsil" : seciliCari.tur === "TUCCAR" ? "Tüccar" : "Fabrika"}
            </span>
          )}
        </div>

        {cariler.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={cariArama}
              onChange={(e) => setCariArama(e.target.value)}
              placeholder="Cari adıyla filtrele..."
              className="flex h-9 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-secondary)] pl-8 pr-3 text-xs text-[var(--app-fg)] placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        <Select value={cariId} onValueChange={setCariId}>
          <SelectTrigger id="finans-cari" className="saha-input">
            <SelectValue placeholder="Cari seçin..." />
          </SelectTrigger>
          <SelectContent>
            {filtrelenmisCariler.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.ad} <span className="text-muted-foreground">· {c.tur === "URETICI" ? "Üretici" : c.tur === "TUCCAR" ? "Tüccar" : "Fabrika"}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kasa/Banka ve Para Birimi */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="finans-hesap" className="text-sm font-bold text-[var(--app-fg)]">
            Kasa / Banka <span className="text-red-400">*</span>
          </Label>
          <Select
            value={hesapId}
            onValueChange={(id) => { setHesapId(id); const hesap = hesaplar.find((h) => h.id === id); if (hesap && ["TL", "USD", "EUR", "XAU"].includes(hesap.bakiyeTuru)) setBakiyeTuru(hesap.bakiyeTuru as "TL" | "USD" | "EUR" | "XAU"); }}
          >
            <SelectTrigger id="finans-hesap" className="saha-input">
              <SelectValue placeholder="Hesap seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.ad} <span className="text-muted-foreground">({h.bakiyeTuru})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="finans-para" className="text-sm font-bold text-[var(--app-fg)]">Para Birimi</Label>
          <Select value={bakiyeTuru} onValueChange={(v) => setBakiyeTuru(v as "TL")}>
            <SelectTrigger id="finans-para" className="saha-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TL">Türk Lirası (TL)</SelectItem>
              <SelectItem value="USD">Amerikan Doları (USD)</SelectItem>
              <SelectItem value="EUR">Euro (EUR)</SelectItem>
              <SelectItem value="XAU">Altın (gr)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tutar Girişi ve Hızlı Seçim */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="finans-tutar" className="text-sm font-bold text-[var(--app-fg)]">
            İşlem Tutarı <span className="text-red-400">*</span>
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
          id="finans-tutar"
          inputMode="decimal"
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          placeholder="0,00"
          className="saha-input text-2xl font-extrabold tracking-tight"
        />
        <QuickNumberStepper
          label="Hızlı Tutar Ekle:"
          values={[1000, 5000, 10000, 25000, 50000, 100000]}
          unit={bakiyeTuru}
          mode="add"
          onSelect={(ekle) => {
            const cur = sayiCevir(tutar);
            setTutar(String(cur + ekle));
          }}
        />
      </div>

      {/* Canlı Özet Göstergesi */}
      {sayisalTutar > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-secondary)] border border-[var(--surface-border)] p-3.5">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase">Toplam {tip === "ODEME" ? "Çıkış" : "Giriş"}:</span>
            {seciliHesap && <span className="text-[11px] text-muted-foreground">{seciliHesap.ad} ({seciliHesap.bakiyeTuru})</span>}
          </div>
          <span className="text-xl font-black tabular-nums text-[var(--app-fg)]">
            {bakiyeTuru === "TL" ? paraTL(sayisalTutar) : `${sayisalTutar.toLocaleString("tr-TR")} ${bakiyeTuru}`}
          </span>
        </div>
      )}

      {/* Açıklama */}
      <div className="space-y-1.5">
        <Label htmlFor="finans-aciklama" className="text-sm font-bold text-[var(--app-fg)]">Açıklama (Opsiyonel)</Label>
        <Input
          id="finans-aciklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Havale no, dekont notu, teslim eden vb..."
          className="saha-input"
        />
      </div>

      {/* Gönder Butonu */}
      <button
        type="button"
        disabled={pending || !cariId || !hesapId || sayiCevir(tutar) <= 0}
        onClick={gonder}
        className={`saha-btn w-full text-white shadow-md ${renk}`}
      >
        {pending ? "Kaydediliyor..." : tip === "ODEME" ? "Ödemeyi Onayla & Kaydet" : "Tahsilatı Onayla & Kaydet"}
      </button>
    </div>
  );
}
