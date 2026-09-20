"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, RotateCcw } from "lucide-react";
import { createVirman } from "@/lib/actions/finans";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";

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

  const sayisalTutar = sayiCevir(tutar);

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
        toast.success("Virman başarıyla gerçekleşti", {
          description: `${kaynakHesap?.ad ?? ""} → ${hedefHesap?.ad ?? ""}: ${paraTL(sayisalTutar)}`,
        });
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
    <form onSubmit={gonder} className="ozet-kart space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[var(--app-fg)]">Yeni Hesap Virmanı</h3>
          <p className="text-xs text-muted-foreground">Kasa ve banka hesapları arasında bakiye transferi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            Kaynak Hesap (Çıkış) <span className="text-red-400">*</span>
          </Label>
          <Select value={kaynakId} onValueChange={setKaynakId}>
            <SelectTrigger className="saha-input">
              <SelectValue placeholder="Kaynak seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id} disabled={h.id === hedefId}>
                  {h.ad}{" "}
                  <span className="text-muted-foreground">
                    · {TIP_ETIKET[h.tip] ?? h.tip} ({h.bakiyeTuru})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kaynakHesap && (
            <p className="text-xs text-muted-foreground">
              {TIP_ETIKET[kaynakHesap.tip] ?? kaynakHesap.tip} · {kaynakHesap.bakiyeTuru}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            Hedef Hesap (Giriş) <span className="text-red-400">*</span>
          </Label>
          <Select value={hedefId} onValueChange={setHedefId}>
            <SelectTrigger className="saha-input">
              <SelectValue placeholder="Hedef seçin..." />
            </SelectTrigger>
            <SelectContent>
              {hesaplar.map((h) => (
                <SelectItem key={h.id} value={h.id} disabled={h.id === kaynakId}>
                  {h.ad}{" "}
                  <span className="text-muted-foreground">
                    · {TIP_ETIKET[h.tip] ?? h.tip} ({h.bakiyeTuru})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hedefHesap && (
            <p className="text-xs text-muted-foreground">
              {TIP_ETIKET[hedefHesap.tip] ?? hedefHesap.tip} · {hedefHesap.bakiyeTuru}
            </p>
          )}
        </div>
      </div>

      {kaynakId && hedefId && kaynakId === hedefId && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          Kaynak ve hedef aynı hesap olamaz.
        </p>
      )}

      {/* Tutar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-[var(--app-fg)]">
            Transfer Tutarı <span className="text-red-400">*</span>
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
          placeholder="0,00"
          className="saha-input text-2xl font-extrabold"
        />

        <QuickNumberStepper
          label="Hızlı Tutar Ekle:"
          values={[1000, 5000, 10000, 50000, 100000]}
          unit="TL"
          mode="add"
          onSelect={(ekle) => {
            const cur = sayiCevir(tutar);
            setTutar(String(cur + ekle));
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-bold text-[var(--app-fg)]">Açıklama (Opsiyonel)</Label>
        <Input
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          className="saha-input"
          placeholder="Ör. Bankadan nakit çekim veya kasalar arası devir"
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
        className="saha-btn w-full bg-violet-600 text-white shadow-md shadow-violet-600/30 hover:bg-violet-500"
      >
        {pending ? (
          "Transfer Yapılıyor..."
        ) : (
          <>
            <ArrowRightLeft className="h-4 w-4" />
            Virmanı Onayla & Gerçekleştir
          </>
        )}
      </button>
    </form>
  );
}
