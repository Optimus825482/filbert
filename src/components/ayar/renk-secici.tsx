"use client";

import { useAyar, TEMA_BILGI, type RenkTemasi } from "@/lib/ayar-store";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMALAR: RenkTemasi[] = ["yesil", "altin", "mavi", "mor"];

export function RenkSecici() {
  const { ayar, setRenkTemasi } = useAyar();

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sky-100">
        Renk Teması
      </h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {TEMALAR.map((t) => {
          const secili = ayar.renkTemasi === t;
          const b = TEMA_BILGI[t];
          return (
            <button
              key={t}
              onClick={() => setRenkTemasi(t)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                secili
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-slate-700 bg-[var(--surface)] hover:border-slate-500"
              )}
            >
              {secili && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)]">
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}
              <div
                className="h-10 w-10 rounded-lg shadow-md"
                style={{ backgroundColor: b.renk }}
              />
              <div className="text-center">
                <div className="text-xs font-bold text-sky-100">{b.etiket}</div>
                <div className="text-[10px] text-sky-100">{b.aciklama}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
