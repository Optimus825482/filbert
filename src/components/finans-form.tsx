"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFinansIslem } from "@/lib/actions/finans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Secenek {
  id: string;
  ad: string;
}

export function FinansForm({ cariler, hesaplar, sabitTip }: { cariler: (Secenek & { tur: string })[]; hesaplar: (Secenek & { bakiyeTuru: string })[]; sabitTip?: "ODEME" | "TAHSILAT" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tip, setTip] = useState<"ODEME" | "TAHSILAT">(sabitTip ?? "ODEME");
  const [cariId, setCariId] = useState("");
  const [hesapId, setHesapId] = useState("");
  const [tutar, setTutar] = useState("");
  const [bakiyeTuru, setBakiyeTuru] = useState<"TL" | "USD" | "EUR" | "XAU">("TL");
  const [aciklama, setAciklama] = useState("");

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
        toast.success(tip === "ODEME" ? "Ödeme kaydedildi" : "Tahsilat kaydedildi");
        setTutar("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("İşlem kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  const renk = tip === "ODEME" ? "bg-sky-600" : "bg-emerald-600";

  return (
    <div className="ozet-kart space-y-3">
      {!sabitTip && <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-slate-800 text-sm font-bold">
        <button type="button" onClick={() => setTip("ODEME")} className={`min-h-12 ${tip === "ODEME" ? "bg-sky-600 text-white" : "text-sky-100"}`}>
          Ödeme (biz → onlar)
        </button>
        <button type="button" onClick={() => setTip("TAHSILAT")} className={`min-h-12 ${tip === "TAHSILAT" ? "bg-emerald-600 text-white" : "text-sky-100"}`}>
          Tahsilat (onlar → biz)
        </button>
      </div>}

      <div className="space-y-1.5">
        <Label htmlFor="finans-cari">Cari</Label>
        <Select value={cariId} onValueChange={setCariId}>
          <SelectTrigger id="finans-cari" className="saha-input bg-slate-800">
            <SelectValue placeholder="Seçin..." />
          </SelectTrigger>
          <SelectContent>
            {cariler.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.ad} <span className="text-sky-100">· {c.tur === "URETICI" ? "Üretici" : c.tur === "TUCCAR" ? "Tüccar" : "Fabrika"}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="finans-hesap">Kasa/Banka</Label>
          <Select value={hesapId} onValueChange={(id) => { setHesapId(id); const hesap = hesaplar.find((h) => h.id === id); if (hesap && ["TL", "USD", "EUR", "XAU"].includes(hesap.bakiyeTuru)) setBakiyeTuru(hesap.bakiyeTuru as "TL" | "USD" | "EUR" | "XAU"); }}>
            <SelectTrigger id="finans-hesap" className="saha-input bg-slate-800">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finans-para">Para birimi</Label>
          <Select value={bakiyeTuru} onValueChange={(v) => setBakiyeTuru(v as "TL")}>
            <SelectTrigger id="finans-para" className="saha-input bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TL">TL</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="XAU">Altın (gr)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="finans-tutar">Tutar</Label>
        <Input id="finans-tutar" inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="0,00" className="saha-input text-2xl font-extrabold" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="finans-aciklama">Açıklama (opsiyonel)</Label>
        <Input id="finans-aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)} className="saha-input" />
      </div>

      <button
        type="button"
        disabled={pending || !cariId || !hesapId || sayiCevir(tutar) <= 0}
        onClick={gonder}
        className={`saha-btn w-full text-white ${renk}`}
      >
        {pending ? "Kaydediliyor..." : tip === "ODEME" ? "Ödemeyi Kaydet" : "Tahsilatı Kaydet"}
      </button>
    </div>
  );
}
