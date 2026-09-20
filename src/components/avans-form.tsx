"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAvans } from "@/lib/actions/avans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { PiggyBank, Search, RotateCcw } from "lucide-react";

interface Secenek {
  id: string;
  ad: string;
}

export function AvansForm({
  cariler,
  hesaplar,
  depolar,
}: {
  cariler: Secenek[];
  hesaplar: (Secenek & { bakiyeTuru: string })[];
  depolar: Secenek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cariArama, setCariArama] = useState("");
  const [cariId, setCariId] = useState("");
  const [tur, setTur] = useState<"NAKIT" | "AYNI" | "FINDIK_KARSILIGI">("NAKIT");
  const [bakiyeTuru, setBakiyeTuru] = useState<"TL" | "USD" | "EUR" | "XAU">("TL");
  const [tutar, setTutar] = useState("");
  const [tutarDoviz, setTutarDoviz] = useState("");
  const [hesapId, setHesapId] = useState(hesaplar[0]?.id ?? "");
  const [depoId, setDepoId] = useState(depolar[0]?.id ?? "");
  const [kg, setKg] = useState("");
  const [aciklama, setAciklama] = useState("");

  const filtrelenmisCariler = cariArama.trim()
    ? cariler.filter((c) =>
        c.ad.toLocaleLowerCase("tr-TR").includes(cariArama.trim().toLocaleLowerCase("tr-TR"))
      )
    : cariler;

  const seciliCari = cariler.find((c) => c.id === cariId);
  const sayisalTutar = sayiCevir(tutar);
  const sayisalKg = sayiCevir(kg);

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createAvans({
        cariId,
        tur,
        tutarTl: sayiCevir(tutar),
        bakiyeTuru,
        tutarDoviz: bakiyeTuru !== "TL" ? sayiCevir(tutarDoviz) : undefined,
        aciklama: aciklama || undefined,
        hesapId: tur === "NAKIT" ? hesapId : undefined,
        depoId: tur === "AYNI" ? depoId : undefined,
        kg: tur === "AYNI" || tur === "FINDIK_KARSILIGI" ? sayiCevir(kg) : undefined,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Avans kaydedildi", {
          description: `${seciliCari?.ad ?? ""} · ${sayisalTutar > 0 ? paraTL(sayisalTutar) : `${sayisalKg} kg`}`,
        });
        setTutar("");
        setTutarDoviz("");
        setKg("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("Avans kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)] border-b border-[var(--surface-border)] pb-2.5">
        <PiggyBank className="h-4 w-4 text-violet-400" /> YENİ AVANS GİRİŞİ
      </div>

      {/* Üretici Seçimi */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            Üretici (Müstahsil) <span className="text-red-400">*</span>
          </Label>
        </div>

        {cariler.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={cariArama}
              onChange={(e) => setCariArama(e.target.value)}
              placeholder="Üretici adıyla filtrele..."
              className="flex h-9 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-secondary)] pl-8 pr-3 text-xs text-[var(--app-fg)] placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>
        )}

        <Select value={cariId} onValueChange={setCariId}>
          <SelectTrigger className="saha-input">
            <SelectValue placeholder="Üretici seçin..." />
          </SelectTrigger>
          <SelectContent>
            {filtrelenmisCariler.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.ad}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Avans Türü Sekmeleri */}
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-xs font-bold">
        {(["NAKIT", "AYNI", "FINDIK_KARSILIGI"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTur(t)}
            className={`min-h-11 transition-colors ${
              tur === t ? "bg-violet-600 text-white shadow-xs" : "text-muted-foreground hover:text-[var(--app-fg)]"
            }`}
          >
            {t === "NAKIT" ? "Nakit" : t === "AYNI" ? "Ayni (Gübre/İlaç)" : "Fındık Karşılığı"}
          </button>
        ))}
      </div>

      {/* Para Birimi ve Tutar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">Para Birimi</Label>
          <Select value={bakiyeTuru} onValueChange={(v) => setBakiyeTuru(v as "TL")}>
            <SelectTrigger className="saha-input">
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold text-[var(--app-fg)]">TL Karşılığı <span className="text-red-400">*</span></Label>
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

      <QuickNumberStepper
        label="Hızlı Tutar Ekle:"
        values={[5000, 10000, 25000, 50000, 100000]}
        unit="TL"
        mode="add"
        onSelect={(ekle) => {
          const cur = sayiCevir(tutar);
          setTutar(String(cur + ekle));
        }}
      />

      {bakiyeTuru !== "TL" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            {bakiyeTuru === "XAU" ? "Altın Tutarı (gr)" : `${bakiyeTuru} Tutarı`}
          </Label>
          <Input
            inputMode="decimal"
            value={tutarDoviz}
            onChange={(e) => setTutarDoviz(e.target.value)}
            placeholder="0"
            className="saha-input"
          />
        </div>
      )}

      {tur === "NAKIT" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">Ödenecek Kasa / Banka <span className="text-red-400">*</span></Label>
          <Select
            value={hesapId}
            onValueChange={(id) => {
              setHesapId(id);
              const hesap = hesaplar.find((item) => item.id === id);
              if (hesap && ["TL", "USD", "EUR", "XAU"].includes(hesap.bakiyeTuru)) {
                setBakiyeTuru(hesap.bakiyeTuru as "TL" | "USD" | "EUR" | "XAU");
              }
            }}
          >
            <SelectTrigger className="saha-input">
              <SelectValue placeholder="Hesap seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.ad} ({h.bakiyeTuru})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {tur === "AYNI" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">Çıkış deposu <span className="text-red-400">*</span></Label>
          <Select value={depoId} onValueChange={setDepoId}>
            <SelectTrigger className="saha-input"><SelectValue placeholder="Depo seçin..." /></SelectTrigger>
            <SelectContent>{depolar.map((depo) => <SelectItem key={depo.id} value={depo.id}>{depo.ad}</SelectItem>)}</SelectContent>
          </Select>
          {depolar.length === 0 && <p className="text-xs font-semibold text-destructive">Ayni avans için önce aktif bir depo tanımlanmalı.</p>}
        </div>
      )}

      {(tur === "AYNI" || tur === "FINDIK_KARSILIGI") && (
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            {tur === "AYNI" ? "Stoktan çıkacak miktar (kg)" : "Fındık karşılığı miktar (kg)"} <span className="text-red-400">*</span>
          </Label>
          <Input
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="0 kg"
            className="saha-input"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-bold text-[var(--app-fg)]">Açıklama (Opsiyonel)</Label>
        <Input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder={tur === "AYNI" ? "Ör. 20 torba 20-20 taban gübresi" : "Ör. Hasat öncesi nakit avans"}
          className="saha-input"
        />
      </div>

      <button
        type="button"
        disabled={
          pending ||
          !cariId ||
          sayiCevir(tutar) <= 0 ||
          (bakiyeTuru !== "TL" && sayiCevir(tutarDoviz) <= 0) ||
          (tur === "NAKIT" && !hesapId) ||
          (tur === "AYNI" && (!depoId || sayiCevir(kg) <= 0)) ||
          (tur === "FINDIK_KARSILIGI" && sayiCevir(kg) <= 0)
        }
        onClick={gonder}
        className="saha-btn w-full bg-violet-600 text-white shadow-md hover:bg-violet-500"
      >
        {pending ? "Kaydediliyor..." : "Avansı Onayla & Kaydet"}
      </button>
    </div>
  );
}
