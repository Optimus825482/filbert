"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSevkiyat } from "@/lib/actions/sevkiyat";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { kg as formatKg, sayiCevir, CINS_ETIKET } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

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

// Select bileşeni boş string value kabul etmediği için manuel giriş sentinel değeri
const MANUEL_GIRIS = "__MANUEL__";

const CINSLER = ["LEVANT", "GIRESUN", "ORDU", "DIGER"] as const;
type Cins = (typeof CINSLER)[number];

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
  const [cins, setCins] = useState<Cins>("LEVANT");
  const [kgGirdi, setKgGirdi] = useState("");
  const [randiman, setRandiman] = useState("");
  const [aracSecim, setAracSecim] = useState(MANUEL_GIRIS); // aracId veya MANUEL_GIRIS
  const [plaka, setPlaka] = useState("");
  const [sofor, setSofor] = useState("");
  const [aciklama, setAciklama] = useState("");

  // Araç seçildiğinde plaka/şoför snapshot olarak otomatik dolar
  function aracDegisti(v: string) {
    setAracSecim(v);
    if (v === MANUEL_GIRIS) return;
    const arac = araclar.find((a) => a.id === v);
    if (arac) {
      setPlaka(arac.plaka.toLocaleUpperCase("tr-TR"));
      setSofor(arac.sofor ?? "");
    }
  }

  // Elle plaka/şoför düzenlenirse araç seçimi kaldırılır (manuel girişe düşer)
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
        cins,
        // Türkçe ondalık (virgül) ve binlik (nokta) gösterimini güvenli çözer.
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
      {/* Fabrika ve yük bilgileri */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sevk-fabrika" className="text-base font-bold">Fabrika</Label>
          <Select value={cariId} onValueChange={setCariId}>
            <SelectTrigger id="sevk-fabrika" className="saha-input bg-slate-800">
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
            <p className="text-sm font-semibold text-red-300">
              Sevkiyat için aktif bir fabrika carisi tanımlanmalı.
            </p>
          )}
        </div>

        {/* Araç bilgileri */}
        <div className="space-y-1.5">
          <Label htmlFor="sevk-arac" className="text-base font-bold">Araç</Label>
          <Select value={aracSecim} onValueChange={aracDegisti}>
            <SelectTrigger id="sevk-arac" className="saha-input bg-slate-800">
              <SelectValue placeholder="Manuel giriş" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MANUEL_GIRIS} className="text-base">
                Manuel giriş
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sevk-plaka" className="text-base font-bold">Plaka</Label>
            <Input
              id="sevk-plaka"
              value={plaka}
              onChange={(e) => plakaDegisti(e.target.value)}
              placeholder="06 ABC 123"
              className="saha-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sevk-sofor" className="text-base font-bold">Şoför</Label>
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

      {/* Yük detayı */}
      <div className="ozet-kart space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-sky-100">YÜK DETAYI</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Kaynak depo */}
          <div className="space-y-1">
            <Label htmlFor="sevk-depo" className="text-[10px] uppercase text-sky-500">Kaynak Depo</Label>
            <Select value={depoId} onValueChange={setDepoId}>
              <SelectTrigger id="sevk-depo" className="min-h-11 h-11 text-sm">
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

          {/* Cins */}
          <div className="space-y-1">
            <Label htmlFor="sevk-cins" className="text-[10px] uppercase text-sky-500">Cins</Label>
            <Select value={cins} onValueChange={(v) => setCins(v as Cins)}>
              <SelectTrigger id="sevk-cins" className="min-h-11 h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CINSLER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CINS_ETIKET[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kg */}
          <div className="space-y-1">
            <Label htmlFor="sevk-kg" className="text-[10px] uppercase text-sky-500">Kg</Label>
            <Input
              id="sevk-kg"
              inputMode="decimal"
              value={kgGirdi}
              onChange={(e) => setKgGirdi(e.target.value)}
              placeholder="0"
              className="min-h-11 h-11 text-sm"
            />
          </div>

          {/* Randıman (fabrika ölçümü, opsiyonel) */}
          <div className="space-y-1">
            <Label htmlFor="sevk-randiman" className="text-[10px] uppercase text-sky-500">Randıman (opsiyonel)</Label>
            <Input
              id="sevk-randiman"
              inputMode="decimal"
              value={randiman}
              onChange={(e) => setRandiman(e.target.value)}
              placeholder="Örn: 52"
              className="min-h-11 h-11 text-sm"
            />
          </div>
        </div>

        {/* Toplam kg */}
        <div className="flex items-center justify-between rounded-xl bg-filbert-900/50 px-4 py-3">
          <span className="text-sm font-bold text-filbert-300">Sevk Edilen</span>
          <span className="text-2xl font-extrabold tabular-nums text-filbert-400">
            {formatKg(kgDeger)}
          </span>
        </div>
      </div>

      {/* Açıklama */}
      <div className="space-y-1.5">
        <Label htmlFor="sevk-aciklama" className="text-base font-bold">Açıklama (opsiyonel)</Label>
        <Input
          id="sevk-aciklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="İsteğe bağlı not..."
          className="saha-input"
        />
      </div>

      {/* Kaydet */}
      <button
        type="button"
        disabled={pending || !gecerli}
        onClick={gonder}
        className="saha-btn w-full bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
      >
        <Save className="h-5 w-5" />
        {pending ? "Kaydediliyor..." : "Fabrikaya Sevk Et"}
      </button>
    </div>
  );
}
