"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DurumRozet } from "@/components/rozetler";
import { kg, paraTL, tarihSaat, CINS_ETIKET } from "@/lib/format";
import { RandimanForm } from "@/components/randiman-form";
import { FlaskConical } from "lucide-react";

interface BekleyenFis {
  id: string;
  fisNo: string;
  cariAd: string;
  cins: string;
  tarih: string;
  kg: number;
  birimFiyat: number | null;
  bolge: string | null;
}

export function BekleyenRandimanlar({ fisler, guncelleYetkisi }: { fisler: BekleyenFis[]; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [acikId, setAcikId] = useState<string | null>(null);

  function toggle(fisId: string) {
    setAcikId((onceki) => (onceki === fisId ? null : fisId));
  }

  function onComplete() {
    setAcikId(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {fisler.map((f) => {
        const formAcik = acikId === f.id;
        return (
          <div key={f.id} className="overflow-hidden rounded-2xl border border-amber-700/50 bg-amber-900/20">
            {/* Fis ozeni */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{f.cariAd}</span>
                  <DurumRozet durum="BEKLIYOR" />
                </div>
                <div className="text-xs text-sky-100">
                  {f.fisNo} · {tarihSaat(f.tarih)} · {f.bolge ?? "—"} · {CINS_ETIKET[f.cins] ?? f.cins}
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold tabular-nums">{kg(f.kg)}</div>
                <div className="text-xs text-sky-100">{f.birimFiyat === null ? "—" : `${paraTL(f.birimFiyat)}/kg`}</div>
              </div>
              {guncelleYetkisi && <button
                type="button"
                onClick={() => toggle(f.id)}
                className={`saha-btn min-h-11 rounded-xl text-sm font-bold transition-colors ${
                  formAcik
                    ? "bg-amber-700 text-amber-100 border border-amber-600"
                    : "bg-filbert-600 text-white shadow-sm"
                }`}
              >
                <FlaskConical className="h-4 w-4" />
                {formAcik ? "Iptal" : "Randiman Gir"}
              </button>}
            </div>

            {/* Form bolumu */}
            {guncelleYetkisi && formAcik && (
              <div className="border-t border-amber-700/30 px-4 py-3">
                <RandimanForm
                  fisId={f.id}
                  fisNo={f.fisNo}
                  onClose={() => setAcikId(null)}
                  onComplete={onComplete}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
