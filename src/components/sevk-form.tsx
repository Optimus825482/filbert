"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSevkiyat } from "@/lib/actions/sevkiyat";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { kg as formatKg, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { Save, Truck, RotateCcw } from "lucide-react";

export interface DepoSecenek {
  id: string;
  ad: string;
}

export interface CariSecenek {
  id: string;
  ad: string;
}

export interface AracSecenek {
  id: string;
  plaka: string;
  sofor: string | null;
  marka: string | null;
  tip: string;
}

const MANUEL_GIRIS = "__MANUEL__";

export function SevkForm({
  depolar,
  cariler,
  araclar,
}: {
  depolar: DepoSecenek[];
  cariler: CariSecenek[];
  araclar: AracSecenek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [cariId, setCariId] = useState("");
  const [depoId, setDepoId] = useState(depolar[0]?.id ?? "");
  const [kgGirdi, setKgGirdi] = useState("");
  const [randiman, setRandiman] = useState("");
  const [aracSecim, setAracSecim] = useState(MANUEL_GIRIS);
  const [plaka, setPlaka] = useState("");
  const [sofor, setSofor] = useState("");
  const [aciklama, setAciklama] = useState("");

  function aracDegisti(v: string) {
    setAracSecim(v);
    if (v === MANUEL_GIRIS) return;
    const arac = araclar.find((a) => a.id === v);
    if (arac) {
      setPlaka(arac.plaka.toLocaleUpperCase("tr-TR"));
      setSofor(arac.sofor ?? "");
    }
  }

  function plakaDegisti(v: string) {
    setPlaka(v.toLocaleUpperCase("tr-TR"));
    if (aracSecim !== MANUEL_GIRIS) setAracSecim(MANUEL_GIRIS);
  }

  function soforDegisti(v: string) {
    setSofor(v);
    if (aracSecim !== MANUEL_GIRIS) setAracSecim(MANUEL_GIRIS);
  }

  const kgDeger = sayiCevir(kgGirdi);

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createSevkiyat({
        cariId,
        aracId: aracSecim !== MANUEL_GIRIS ? aracSecim : undefined,
        plaka,
        sofor,
        depoId,
        kg: kgDeger,
        randimanPuan: sayiCevir(randiman) > 0 ? sayiCevir(randiman) : undefined,
        aciklama: aciklama || undefined,
      }));
      if (!sonuc) return;

      if (sonuc.ok) {
        toast.success(`Sevkiyat kaydedildi: ${sonuc.fisNo}`, {
          description: `${formatKg(kgDeger)} · ${plaka} · ${sofor}`,
        });
        router.push("/sevkiyat");
      } else {
        toast.error("Kayıt başarısız", { description: sonuc.hata });
      }
    });
  }

  const gecerli = Boolean(cariId && depoId && plaka.trim() && sofor.trim() && kgDeger > 0);

  return (
    <div className="space-y-4 pb-4">
      {/* Fabrika ve Nakliye Bilgileri */}
      <div className="ozet-kart space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)] border-b border-[var(--surface-border)] pb-2.5">
          <Truck className="h-4 w-4 text-[var(--primary)]" /> FABRİKA VE LOJİSTİK BİLGİLERİ
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sevk-fabrika" className="text-sm font-bold text-[var(--app-fg)]">
            Alıcı Fabrika <span className="text-red-400">*</span>
          </Label>
          <Select value={cariId} onValueChange={setCariId}>
            <SelectTrigger id="sevk-fabrika" className="saha-input">
              <SelectValue placeholder="Sevk edilecek fabrikayı seçin..." />
            </SelectTrigger>
            <SelectContent>
              {cariler.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-base">
                  {c.ad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cariler.length === 0 && (
            <p className="text-xs font-semibold text-destructive">
              Sevkiyat için aktif bir fabrika carisi tanımlanmalı.
            </p>
          )}
        </div>

        {/* Kayıtlı Araç Seçimi */}
        <div className="space-y-1.5">
          <Label htmlFor="sevk-arac" className="text-sm font-bold text-[var(--app-fg)]">Kayıtlı Araç</Label>
          <Select value={aracSecim} onValueChange={aracDegisti}>
            <SelectTrigger id="sevk-arac" className="saha-input">
              <SelectValue placeholder="Manuel giriş" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MANUEL_GIRIS} className="text-base">
                Manuel Araç / Plaka Girişi
              </SelectItem>
              {araclar.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-base">
                  {a.plaka}
                  {a.sofor ? ` · ${a.sofor}` : ""}
                  {a.marka ? ` (${a.marka})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sevk-plaka" className="text-sm font-bold text-[var(--app-fg)]">
              Araç Plakası <span className="text-red-400">*</span>
            </Label>
            <Input
              id="sevk-plaka"
              value={plaka}
              onChange={(e) => plakaDegisti(e.target.value)}
              placeholder="Ör. 52 AB 123"
              className="saha-input font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sevk-sofor" className="text-sm font-bold text-[var(--app-fg)]">
              Şoför Adı & Soyadı <span className="text-red-400">*</span>
            </Label>
            <Input
              id="sevk-sofor"
              value={sofor}
              onChange={(e) => soforDegisti(e.target.value)}
              placeholder="Ad Soyad"
              className="saha-input"
            />
          </div>
        </div>
      </div>

      {/* Yük Detayı */}
      <div className="ozet-kart space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2.5">
          <span className="text-sm font-bold text-[var(--app-fg)]">YÜK VE DEPO DETAYI</span>
          {kgDeger > 0 && (
            <button
              type="button"
              onClick={() => setKgGirdi("")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3" /> Temizle
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Kaynak depo */}
          <div className="space-y-1.5">
            <Label htmlFor="sevk-depo" className="text-sm font-bold text-[var(--app-fg)]">
              Çıkış Deposu <span className="text-red-400">*</span>
            </Label>
            <Select value={depoId} onValueChange={setDepoId}>
              <SelectTrigger id="sevk-depo" className="saha-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {depolar.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kg */}
          <div className="space-y-1.5">
            <Label htmlFor="sevk-kg" className="text-sm font-bold text-[var(--app-fg)]">
              Net Miktar (Kg) <span className="text-red-400">*</span>
            </Label>
            <Input
              id="sevk-kg"
              inputMode="decimal"
              value={kgGirdi}
              onChange={(e) => setKgGirdi(e.target.value)}
              placeholder="0 kg"
              className="saha-input font-bold"
            />
          </div>

          {/* Randıman */}
          <div className="space-y-1.5">
            <Label htmlFor="sevk-randiman" className="text-sm font-bold text-[var(--app-fg)]">
              Fabrika Randımanı (Ops.)
            </Label>
            <Input
              id="sevk-randiman"
              inputMode="decimal"
              value={randiman}
              onChange={(e) => setRandiman(e.target.value)}
              placeholder="Örn: 52"
              className="saha-input font-bold"
            />
          </div>
        </div>

        <QuickNumberStepper
          label="Hızlı Miktar Ekle:"
          values={[2000, 5000, 10000, 15000, 25000]}
          unit="kg"
          mode="add"
          onSelect={(ekle) => {
            const cur = sayiCevir(kgGirdi);
            setKgGirdi(String(cur + ekle));
          }}
        />

        {/* Toplam Kg Canlı Gösterge */}
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-secondary)] border border-[var(--surface-border)] px-4 py-3">
          <span className="text-sm font-bold text-muted-foreground">Sevk Edilecek Toplam:</span>
          <span className="text-2xl font-black tabular-nums text-[var(--primary)]">
            {formatKg(kgDeger)}
          </span>
        </div>
      </div>

      {/* Açıklama */}
      <div className="space-y-1.5">
        <Label htmlFor="sevk-aciklama" className="text-sm font-bold text-[var(--app-fg)]">
          Açıklama (Opsiyonel)
        </Label>
        <Input
          id="sevk-aciklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Kantar fiş numarası, mühür numarası veya özel not..."
          className="saha-input"
        />
      </div>

      {/* Kaydet */}
      <button
        type="button"
        disabled={pending || !gecerli}
        onClick={gonder}
        className="saha-btn w-full bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30 hover:opacity-95"
      >
        <Save className="h-4 w-4" />
        {pending ? "Kaydediliyor..." : "Sevkiyatı Onayla ve Sevk Et"}
      </button>
    </div>
  );
}
