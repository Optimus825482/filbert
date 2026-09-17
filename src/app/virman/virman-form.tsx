"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { createVirman } from "@/lib/actions/finans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Hesap {
  id: string;
  ad: string;
  tip: string;
  bakiyeTuru: string;
}

const TIP_ETIKET: Record<string, string> = { KASA: "Kasa", BANKA: "Banka" };

export function VirmanForm({ hesaplar }: { hesaplar: Hesap[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kaynakId, setKaynakId] = useState("");
  const [hedefId, setHedefId] = useState("");
  const [tutar, setTutar] = useState("");
  const [aciklama, setAciklama] = useState("");

  function gonder(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("kaynakHesapId", kaynakId);
    fd.set("hedefHesapId", hedefId);
    fd.set("tutar", tutar);
    if (aciklama.trim()) fd.set("aciklama", aciklama.trim());

    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createVirman(fd));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Virman başarıyla gerçekleşti");
        setKaynakId("");
        setHedefId("");
        setTutar("");
        setAciklama("");
        router.refresh();
      } else {
        toast.error("Virman başarısız", { description: sonuc.hata });
      }
    });
  }

  const kaynakHesap = hesaplar.find((h) => h.id === kaynakId);
  const hedefHesap = hesaplar.find((h) => h.id === hedefId);

  return (
    <form onSubmit={gonder} className="ozet-kart space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-900/60">
          <ArrowRightLeft className="h-4 w-4 text-violet-300" />
        </div>
        <h3 className="text-base font-bold text-[var(--app-fg)]">Yeni Virman</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Kaynak Hesap</Label>
          <Select value={kaynakId} onValueChange={setKaynakId}>
            <SelectTrigger className="saha-input bg-slate-800">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id} disabled={h.id === hedefId}>
                  {h.ad}{" "}
                  <span className="text-sky-100">
                    · {TIP_ETIKET[h.tip] ?? h.tip} · {h.bakiyeTuru}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kaynakHesap && (
            <p className="text-[11px] text-sky-100">
              {TIP_ETIKET[kaynakHesap.tip] ?? kaynakHesap.tip} · {kaynakHesap.bakiyeTuru}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Hedef Hesap</Label>
          <Select value={hedefId} onValueChange={setHedefId}>
            <SelectTrigger className="saha-input bg-slate-800">
              <SelectValue placeholder="Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id} disabled={h.id === kaynakId}>
                  {h.ad}{" "}
                  <span className="text-sky-100">
                    · {TIP_ETIKET[h.tip] ?? h.tip} · {h.bakiyeTuru}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hedefHesap && (
            <p className="text-[11px] text-sky-100">
              {TIP_ETIKET[hedefHesap.tip] ?? hedefHesap.tip} · {hedefHesap.bakiyeTuru}
            </p>
          )}
        </div>
      </div>

      {kaynakId && hedefId && kaynakId === hedefId && (
        <p className="text-xs text-amber-400">Kaynak ve hedef aynı hesap olamaz.</p>
      )}

      <div className="space-y-1.5">
        <Label>Tutar</Label>
        <Input
          inputMode="decimal"
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          placeholder="0,00"
          className="saha-input text-2xl font-extrabold"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Açıklama (opsiyonel)</Label>
        <Input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          className="saha-input"
          placeholder="Virman sebebi..."
        />
      </div>

      <button
        type="submit"
        disabled={
          pending ||
          !kaynakId ||
          !hedefId ||
          kaynakId === hedefId ||
          sayiCevir(tutar) <= 0
        }
        className="saha-btn w-full bg-violet-600 text-white"
      >
        {pending ? (
          "Kaydediliyor..."
        ) : (
          <>
            <ArrowRightLeft className="h-5 w-5" />
            Virman Yap
          </>
        )}
      </button>
    </form>
  );
}
