"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { iadeEmanet } from "@/lib/actions/emanet";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmanetYonet({ emanetId, cariAd, kalanKg }: { emanetId: string; cariAd: string; kalanKg: number }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [kg, setKg] = useState(String(kalanKg));
  const [aciklama, setAciklama] = useState("");
  const [pending, startTransition] = useTransition();

  function iadeEt() {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => iadeEmanet({ emanetId, kg: sayiCevir(kg), aciklama: aciklama.trim() || undefined }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success("Emanet iade edildi");
        setAcik(false);
        router.refresh();
      } else toast.error("İade başarısız", { description: sonuc.hata });
    });
  }

  return <Dialog open={acik} onOpenChange={setAcik}>
    <DialogTrigger asChild><button type="button" className="saha-btn bg-slate-700 px-3 text-sm text-white"><RotateCcw className="h-4 w-4" /> İade</button></DialogTrigger>
    <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Emanet İade — {cariAd}</DialogTitle><DialogDescription>İade edilen miktar emanet stokundan ve üreticinin kg alacağından düşülür.</DialogDescription></DialogHeader>
      <div className="space-y-3"><div className="space-y-1.5"><Label>İade miktarı (kg) — kalan: {kalanKg.toLocaleString("tr-TR")}</Label><Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="saha-input" /></div><div className="space-y-1.5"><Label>Açıklama (isteğe bağlı)</Label><Input value={aciklama} onChange={(e) => setAciklama(e.target.value)} className="saha-input" /></div><button type="button" disabled={pending || sayiCevir(kg) <= 0 || sayiCevir(kg) > kalanKg} onClick={iadeEt} className="saha-btn w-full bg-slate-700 text-white">{pending ? "İşleniyor..." : "İadeyi Kaydet"}</button></div>
    </DialogContent>
  </Dialog>;
}
