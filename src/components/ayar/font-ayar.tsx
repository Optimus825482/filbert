"use client";

import { useAyar, FONT_OLCEK_BILGI, type FontOlcek } from "@/lib/ayar-store";
import { cn } from "@/lib/utils";
import { Minus, Plus, Type } from "lucide-react";

const OLCEKLER: FontOlcek[] = ["sm", "md", "lg", "xl"];

export function FontAyar() {
  const { ayar, setFontOlcek } = useAyar();

  const idx = OLCEKLER.indexOf(ayar.fontOlcek);
  const b = FONT_OLCEK_BILGI[ayar.fontOlcek];

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sky-100">
        Yazı Tipi Boyutu
      </h3>
      <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-[var(--surface)] p-4">
        <Type className="h-5 w-5 shrink-0 text-sky-100" />
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={() => idx > 0 && setFontOlcek(OLCEKLER[idx - 1])}
            disabled={idx === 0}
            className="saha-btn flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-sky-100 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="flex flex-1 flex-col items-center">
            {/* Görsel slider */}
            <div className="mb-1 flex w-full items-center gap-1">
              {OLCEKLER.map((o, i) => (
                <button
                  key={o}
                  onClick={() => setFontOlcek(o)}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all",
                    i <= idx
                      ? "bg-[var(--primary)]"
                      : "bg-slate-600"
                  )}
                />
              ))}
            </div>
            <div className="text-sm font-bold text-sky-100">{b.etiket}</div>
            <div className="text-[11px] text-sky-100">{b.oran}</div>
          </div>

          <button
            onClick={() => idx < OLCEKLER.length - 1 && setFontOlcek(OLCEKLER[idx + 1])}
            disabled={idx === OLCEKLER.length - 1}
            className="saha-btn flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-sky-100 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Önizleme */}
      <div className="mt-3 rounded-xl border border-slate-700 bg-[var(--surface)] p-4">
        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">
          Önizleme
        </div>
        <p className="text-sky-100" style={{ fontSize: `calc(1rem * var(--font-scale, 1))` }}>
          Bu yazı <strong>seçtiğiniz boyutta</strong> görüntüleniyor.
        </p>
        <p className="mt-1 text-sky-100" style={{ fontSize: `calc(0.75rem * var(--font-scale, 1))` }}>
          Küçük yazılar da ölçeklenir — saha kullanımı için optimize edilmiştir.
        </p>
      </div>
    </div>
  );
}
