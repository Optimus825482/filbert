"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { onaylaAlimFisi, iptalEtAlimFisi } from "@/lib/actions/alim";
import { onaylaSatis, iptalEtSatis } from "@/lib/actions/satis";
import { sunucuIslemi } from "@/lib/istemci-guvenli";

type IslemTuru = "ALIM" | "SATIS";

export function FisDurumIslemleri({
  fisId, durum, tur, onayYetkisi, iptalYetkisi,
}: {
  fisId: string; durum: string; tur: IslemTuru; onayYetkisi: boolean; iptalYetkisi: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const etiket = tur === "ALIM" ? "Alım fişi" : "Satış";

  function calistir(islem: "onay" | "iptal") {
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() =>
        tur === "ALIM"
          ? (islem === "onay" ? onaylaAlimFisi(fisId) : iptalEtAlimFisi(fisId))
          : (islem === "onay" ? onaylaSatis(fisId) : iptalEtSatis(fisId)),
      );
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(islem === "onay" ? etiket + " onaylandı" : etiket + " iptal edildi");
        router.refresh();
      } else {
        toast.error("İşlem tamamlanamadı", { description: sonuc.hata });
      }
    });
  }

  if (durum === "IPTAL") return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {durum === "TASLAK" && onayYetkisi && (
        <button type="button" disabled={pending} onClick={() => calistir("onay")} className="inline-flex h-11 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> {pending ? "İşleniyor..." : "Onayla"}
        </button>
      )}
      {iptalYetkisi && <button type="button" disabled={pending} onClick={() => calistir("iptal")} className="inline-flex h-11 items-center gap-1 rounded-lg bg-red-950/60 px-3 text-xs font-bold text-red-200 disabled:opacity-50">
        <X className="h-3.5 w-3.5" /> İptal
      </button>}
    </div>
  );
}
