"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAvans } from "@/lib/actions/avans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PiggyBank } from "lucide-react";

interface Secenek {
  id: string;
  ad: string;
}

export function AvansForm({ cariler, hesaplar, depolar }: { cariler: Secenek[]; hesaplar: (Secenek & { bakiyeTuru: string })[]; depolar: Secenek[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cariId, setCariId] = useState("");
  const [tur, setTur] = useState<"NAKIT" | "AYNI" | "FINDIK_KARSILIGI">("NAKIT");
  const [bakiyeTuru, setBakiyeTuru] = useState<"TL" | "USD" | "EUR" | "XAU">("TL");
  const [tutar, setTutar] = useState("");
  const [tutarDoviz, setTutarDoviz] = useState("");
  const [hesapId, setHesapId] = useState("");
  const [depoId, setDepoId] = useState("");
  const [kg, setKg] = useState("");
  const [aciklama, setAciklama] = useState("");

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
        toast.success("Avans kaydedildi");
        setTutar("");
        setTutarDoviz("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("Avans kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="ozet-kart space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
        <PiggyBank className="h-4 w-4" /> YENİ AVANS
      </div>

      <div className="space-y-1.5">
        <Label>Üretici</Label>
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

      <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-slate-800 text-xs font-bold">
        {(["NAKIT", "AYNI", "FINDIK_KARSILIGI"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTur(t)} className={`min-h-12 ${tur === t ? "bg-violet-600 text-white" : "text-sky-100"}`}>
            {t === "NAKIT" ? "Nakit" : t === "AYNI" ? "Ayni (gübre vb.)" : "Fındık Karşılığı"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Para birimi</Label>
          <Select value={bakiyeTuru} onValueChange={(v) => setBakiyeTuru(v as "TL")}>
            <SelectTrigger className="saha-input bg-slate-800">
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
        <div className="space-y-1.5">
          <Label>TL karşılığı</Label>
          <Input inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="0,00" className="saha-input" />
        </div>
      </div>

      {bakiyeTuru !== "TL" && (
        <div className="space-y-1.5">
          <Label>{bakiyeTuru === "XAU" ? "Altın tutarı (gr)" : `${bakiyeTuru} tutarı`}</Label>
          <Input inputMode="decimal" value={tutarDoviz} onChange={(e) => setTutarDoviz(e.target.value)} placeholder="0" className="saha-input" />
        </div>
      )}

      {tur === "NAKIT" && (
        <div className="space-y-1.5">
          <Label>Ödenecek kasa/banka</Label>
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
      )}

      {tur === "AYNI" && (
        <div className="space-y-1.5">
          <Label>Çıkış deposu</Label>
          <Select value={depoId} onValueChange={setDepoId}>
            <SelectTrigger className="saha-input bg-slate-800"><SelectValue placeholder="Depo seçin..." /></SelectTrigger>
            <SelectContent>{depolar.map((depo) => <SelectItem key={depo.id} value={depo.id}>{depo.ad}</SelectItem>)}</SelectContent>
          </Select>
          {depolar.length === 0 && <p className="text-xs font-semibold text-red-300">Ayni avans için önce aktif bir depo tanımlanmalı.</p>}
        </div>
      )}

      {(tur === "AYNI" || tur === "FINDIK_KARSILIGI") && (
        <div className="space-y-1.5">
          <Label>{tur === "AYNI" ? "Stoktan çıkacak miktar (kg)" : "Fındık karşılığı miktar (kg)"}</Label>
          <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0,000" className="saha-input" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Açıklama (opsiyonel)</Label>
        <Input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder={tur === "AYNI" ? "ör: 10 torba gübre" : ""} className="saha-input" />
      </div>

      <button
        type="button"
        disabled={pending || !cariId || sayiCevir(tutar) <= 0 || (bakiyeTuru !== "TL" && sayiCevir(tutarDoviz) <= 0) || (tur === "NAKIT" && !hesapId) || (tur === "AYNI" && (!depoId || sayiCevir(kg) <= 0)) || (tur === "FINDIK_KARSILIGI" && sayiCevir(kg) <= 0)}
        onClick={gonder}
        className="saha-btn w-full bg-violet-600 text-white"
      >
        {pending ? "Kaydediliyor..." : "Avansı Kaydet"}
      </button>
    </div>
  );
}
