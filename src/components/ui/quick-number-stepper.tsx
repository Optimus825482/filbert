"use client";

import { cn } from "@/lib/utils";

interface QuickNumberStepperProps {
  label?: string;
  values: number[];
  unit?: string;
  onSelect: (amount: number) => void;
  mode?: "add" | "set";
  className?: string;
}

/**
 * Sahada eldivenli veya hızlı kullanım için miktar / puan hızlı seçim düğmeleri.
 * - 'add' modu: Mevcut değere ekler (+100, +500, +1000 kg vb.)
 * - 'set' modu: Değeri doğrudan ayarlar (50, 51, 52 randıman vb.)
 */
export function QuickNumberStepper({
  label,
  values,
  unit = "",
  onSelect,
  mode = "add",
  className,
}: QuickNumberStepperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {values.map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onSelect(val)}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--app-fg)] shadow-xs transition-transform active:scale-95 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {mode === "add" ? `+${val.toLocaleString("tr-TR")}` : val.toLocaleString("tr-TR")}
            {unit ? ` ${unit}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
