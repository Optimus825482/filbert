"use client";

import { useAyar, STIL_BILGI, type WindowsStili } from "@/lib/ayar-store";
import { cn } from "@/lib/utils";
import { Monitor, Sparkles, MonitorCheck } from "lucide-react";

const STILLER: WindowsStili[] = ["win11", "vista", "xp"];

const STIL_IKON: Record<WindowsStili, typeof Monitor> = {
  win11: Monitor,
  vista: Sparkles,
  xp: MonitorCheck,
};

export function StilSecici() {
  const { ayar, setWindowsStili } = useAyar();

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sky-100">
        Masaüstü Görünüm Stili
      </h3>
      <div className="space-y-2 md:grid md:grid-cols-3 md:gap-2 md:space-y-0">
        {STILLER.map((s) => {
          const secili = ayar.windowsStili === s;
          const b = STIL_BILGI[s];
          const Ikon = STIL_IKON[s];
          return (
            <button
              key={s}
              onClick={() => setWindowsStili(s)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all md:flex-col md:items-center md:text-center",
                secili
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-slate-700 bg-[var(--surface)] hover:border-slate-500"
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                  secili ? "bg-[var(--primary)]/20" : "bg-slate-700/50"
                )}
              >
                <Ikon
                  className={cn("h-6 w-6", secili ? "text-[var(--primary)]" : "text-sky-100")}
                />
              </div>
              <div className="flex-1 md:flex-none">
                <div className={cn("text-sm font-bold", secili ? "text-[var(--primary)]" : "text-sky-100")}>
                  {b.icon} {b.etiket}
                </div>
                <div className="text-[11px] leading-tight text-sky-100">
                  {b.aciklama}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
