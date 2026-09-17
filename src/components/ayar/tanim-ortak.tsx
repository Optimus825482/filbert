"use client";

// Tanım ekranları için ortak küçük yapı taşları
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Power } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─── Başlık + Yeni butonu ──────────────────────── */

export function TanimBaslik({
  ikon: Ikon,
  baslik,
  adet,
  onYeni,
}: {
  ikon: LucideIcon;
  baslik: string;
  adet: number;
  onYeni?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Ikon className="h-4 w-4 text-[var(--primary)]" />
        <span className="text-sm font-bold text-sky-100">
          {baslik} <span className="font-semibold text-sky-500">({adet})</span>
        </span>
      </div>
      {onYeni && <button
        type="button"
        onClick={onYeni}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition active:scale-[0.97]"
      >
        <Plus className="h-4 w-4" /> Yeni
      </button>}
    </div>
  );
}

/* ─── Liste satırı ──────────────────────────────── */

export function TanimSatir({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3">
      {children}
    </div>
  );
}

/* ─── Aktif/Pasif rozeti ────────────────────────── */

export function AktifRozet({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        "hidden rounded-full px-2.5 py-0.5 text-xs font-extrabold sm:inline",
        aktif ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/60 text-sky-100"
      )}
    >
      {aktif ? "Aktif" : "Pasif"}
    </span>
  );
}

/* ─── Satır aksiyon butonları ───────────────────── */

const IKON_BUTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] transition active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50";

export function DuzenleButon({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title="Düzenle"
      aria-label="Düzenle"
      onClick={onClick}
      disabled={disabled}
      className={cn(IKON_BUTON, "text-sky-100 hover:text-[var(--app-fg)]")}
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}

export function AktifButon({
  aktif,
  onClick,
  disabled,
}: {
  aktif: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={aktif ? "Pasifleştir" : "Aktifleştir"}
      aria-label={aktif ? "Pasifleştir" : "Aktifleştir"}
      onClick={onClick}
      disabled={disabled}
      className={cn(IKON_BUTON, aktif ? "text-emerald-400" : "text-sky-500")}
    >
      <Power className="h-4 w-4" />
    </button>
  );
}

/* ─── Boş durum ─────────────────────────────────── */

export function BosDurum({ mesaj }: { mesaj: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] p-6 text-center text-sm text-sky-100">
      {mesaj}
    </div>
  );
}
