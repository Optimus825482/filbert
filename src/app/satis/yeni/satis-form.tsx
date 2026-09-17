"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSatis } from "@/lib/actions/satis";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir, CINS_ETIKET } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";

export interface MusteriSecenek {
  id: string;
  ad: string;
  bolge: string | null;
}

export interface DepoSecenek {
  id: string;
  ad: string;
}

const CINSLER = ["LEVANT", "GIRESUN", "ORDU", "DIGER"];

export function SatisForm({
  musteriler,
  depolar,
}: {
  musteriler: MusteriSecenek[];
  depolar: DepoSecenek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [cariId, setCariId] = useState("");
  const [depoId, setDepoId] = useState("");
  const [cins, setCins] = useState("LEVANT");
  const [kgGirdi, setKgGirdi] = useState("");
  const [birimFiyat, setBirimFiyat] = useState("");
  const [aciklama, setAciklama] = useState("");

  const kgDeger = sayiCevir(kgGirdi);
  const fiyatDeger = sayiCevir(birimFiyat);
  const tutar = kgDeger * fiyatDeger;

  function gonder(durum: "ONAYLI" | "TASLAK") {
    if (!cariId) {
      toast.error("Eksik bilgi", { description: "Müşteri seçilmedi" });
      return;
    }
    if (!depoId) {
      toast.error("Eksik bilgi", { description: "Satış yapılacak depo seçilmedi" });
      return;
    }
    if (kgDeger <= 0) {
      toast.error("Eksik bilgi", { description: "Kg sıfır veya negatif" });
      return;
    }
    if (fiyatDeger <= 0) {
      toast.error("Eksik bilgi", { description: "Birim fiyat girilmedi" });
      return;
    }

    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createSatis({
        cariId,
        depoId,
        cins: cins as "LEVANT",
        kg: kgDeger,
        birimFiyat: fiyatDeger,
        aciklama: aciklama || undefined,
        durum,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(`Satış kaydedildi: ${sonuc.fisNo}`, {
          description: `${kgDeger.toLocaleString("tr-TR")} kg × ${paraTL(fiyatDeger)} = ${paraTL(tutar)}`,
        });
        router.push("/satis");
      } else {
        toast.error("Kayıt başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Müşteri */}
      <div className="space-y-1.5">
        <Label htmlFor="satis-musteri" className="text-base font-bold text-[var(--app-fg)]">Müşteri</Label>
        <Select value={cariId} onValueChange={setCariId}>
          <SelectTrigger id="satis-musteri" className="saha-input bg-slate-800">
            <SelectValue placeholder="Müşteri seçin..." />
          </SelectTrigger>
          <SelectContent>
            {musteriler.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-base">
                {m.ad} {m.bolge ? <span className="text-sky-100">· {m.bolge}</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="satis-depo" className="text-base font-bold text-[var(--app-fg)]">Çıkış deposu</Label>
        <Select value={depoId} onValueChange={setDepoId}>
          <SelectTrigger id="satis-depo" className="saha-input bg-slate-800">
            <SelectValue placeholder="Stok çıkışı yapılacak depoyu seçin..." />
          </SelectTrigger>
          <SelectContent>
            {depolar.map((depo) => <SelectItem key={depo.id} value={depo.id} className="text-base">{depo.ad}</SelectItem>)}
          </SelectContent>
        </Select>
        {depolar.length === 0 ? <p className="text-sm font-semibold text-red-300">Satıştan önce aktif bir depo tanımlanmalı.</p> : null}
      </div>

      {/* Cins */}
      <div className="space-y-1.5">
        <Label htmlFor="satis-cins" className="text-base font-bold text-[var(--app-fg)]">Cins</Label>
        <Select value={cins} onValueChange={setCins}>
          <SelectTrigger id="satis-cins" className="saha-input bg-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CINSLER.map((c) => (
              <SelectItem key={c} value={c} className="text-base">
                {CINS_ETIKET[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Miktar ve fiyat */}
      <div className="ozet-kart space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="satis-kg" className="text-[var(--app-fg)]">Kg</Label>
            <Input
              id="satis-kg"
              inputMode="decimal"
              value={kgGirdi}
              onChange={(e) => setKgGirdi(e.target.value)}
              placeholder="0"
              className="saha-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="satis-birim-fiyat" className="text-[var(--app-fg)]">Birim fiyat (TL/kg)</Label>
            <Input
              id="satis-birim-fiyat"
              inputMode="decimal"
              value={birimFiyat}
              onChange={(e) => setBirimFiyat(e.target.value)}
              placeholder="0,00"
              className="saha-input"
            />
          </div>
        </div>
        {/* Birim fiyat özeti */}
        <div className="flex items-center justify-between rounded-xl bg-filbert-600 px-4 py-3 text-white">
          <span className="text-sm font-bold">Birim Fiyat</span>
          <span className="text-2xl font-extrabold tabular-nums">
            {fiyatDeger > 0 ? paraTL(fiyatDeger) : "—"}
          </span>
        </div>
      </div>

      {/* Açıklama */}
      <div className="space-y-1.5">
        <Label htmlFor="satis-aciklama" className="text-base font-bold text-[var(--app-fg)]">Açıklama</Label>
        <Input
          id="satis-aciklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="İsteğe bağlı not..."
          className="saha-input"
        />
      </div>

      {/* Toplam */}
      <div className="rounded-2xl bg-filbert-950 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-filbert-300">SATIŞ TUTARI</span>
          <span className="text-3xl font-extrabold tabular-nums tracking-tight">
            {paraTL(tutar)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--surface-border)] pt-2 text-sm">
          <span className="text-filbert-300">
            {kgDeger.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} kg × {fiyatDeger > 0 ? paraTL(fiyatDeger) : "0,00"} / kg
          </span>
        </div>
      </div>

      {/* Kaydet */}
      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          type="button"
          disabled={pending || !cariId || !depoId || kgDeger <= 0}
          onClick={() => gonder("TASLAK")}
          className="saha-btn border-2 border-filbert-600 bg-slate-800 text-[#f5c518]"
        >
          Taslak Kaydet
        </button>
        <button
          type="button"
          disabled={pending || !cariId || !depoId || kgDeger <= 0 || fiyatDeger <= 0}
          onClick={() => gonder("ONAYLI")}
          className="saha-btn bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
        >
          <Save className="h-5 w-5" />
          {pending ? "Kaydediliyor..." : "Onayla ve Kaydet"}
        </button>
      </div>
    </div>
  );
}
