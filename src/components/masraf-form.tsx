"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMasraf } from "@/lib/actions/masraf";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt } from "lucide-react";

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

  function gonder() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createMasraf({
        tur,
        tutar: sayiCevir(tutar),
        cariId: cariId || undefined,
        hesapId: hesapId || undefined,
        maliyeteYansit,
        aciklama: aciklama || undefined,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Masraf kaydedildi");
        setTutar("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("Masraf kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
        <Receipt className="h-4 w-4" /> YENİ MASRAF
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Masraf türü</Label>
          {masrafTurleri.length === 0 ? (
            <p className="saha-input bg-slate-800 text-sm text-sky-100">Tanımlı masraf türü yok — Ayarlar &gt; Tanımlar&apos;dan ekleyin</p>
          ) : (
            <Select value={tur} onValueChange={setTur}>
              <SelectTrigger className="saha-input bg-slate-800">
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
          <Label>Tutar (TL)</Label>
          <Input inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="0,00" className="saha-input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kime ödendi (ops.)</Label>
          <Select value={cariId} onValueChange={setCariId}>
            <SelectTrigger className="saha-input bg-slate-800">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {cariler.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kasa/Banka (ops.)</Label>
          <Select value={hesapId} onValueChange={setHesapId}>
            <SelectTrigger className="saha-input bg-slate-800">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl bg-slate-700/50 px-4 py-3">
        <input type="checkbox" checked={maliyeteYansit} onChange={(e) => setMaliyeteYansit(e.target.checked)} className="h-5 w-5 accent-filbert-600" />
        <span className="text-sm font-semibold">Stok maliyetine yansıt</span>
      </label>

      <div className="space-y-1.5">
        <Label>Açıklama (opsiyonel)</Label>
        <Input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="ör: Kargalı'dan depoya nakliye" className="saha-input" />
      </div>

      <button type="button" disabled={pending || !tur || sayiCevir(tutar) <= 0} onClick={gonder} className="saha-btn w-full bg-slate-700 text-white">
        {pending ? "Kaydediliyor..." : "Masrafı Kaydet"}
      </button>
    </div>
  );
}
