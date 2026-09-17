"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Search, X, Home, ChevronRight,
  ShoppingBasket, ClipboardList, Calculator, ArrowLeftRight, Truck, PackageOpen,
  Wallet, Banknote, CreditCard, HandCoins, ArrowDownUp, Receipt, PiggyBank,
  Users, FileText, LineChart, Warehouse, FileBarChart, TrendingUp,
  type LucideIcon,
} from "lucide-react";

/** İkonlar isimle referanslanır — Server Component'ten fonksiyon geçirilemez */
export const IKONLAR: Record<string, LucideIcon> = {
  "alim-yeni": ShoppingBasket,
  "alim-liste": ClipboardList,
  "randiman": Calculator,
  "virman": ArrowLeftRight,
  "sevk": Truck,
  "emanet": PackageOpen,
  "kasa": Wallet,
  "banka": Banknote,
  "pos": CreditCard,
  "tahsilat": HandCoins,
  "odeme": ArrowDownUp,
  "masraf": Receipt,
  "avans": PiggyBank,
  "cari": Users,
  "satis": FileText,
  "fiyat": LineChart,
  "stok": Warehouse,
  "rapor": FileBarChart,
  "kar-zarar": TrendingUp,
};

export type ModulTile = {
  href: string;
  etiket: string;
  ikon: keyof typeof IKONLAR;
  badge?: string | number;
  disabled?: boolean;
  disabledFaz?: string;
  dekont?: string;
};

export type Modul = {
  id: "findik" | "finans" | "musteri" | "rapor";
  etiket: string;
  altModuller: ModulTile[];
};

export function ModulSekmeler({ modüller, aktifId }: { modüller: Modul[]; aktifId: Modul["id"] }) {
  const aktif = modüller.find((m) => m.id === aktifId) ?? modüller[0];
  const diger = modüller.filter((m) => m.id !== aktifId);

  const [aramaAcik, setAramaAcik] = useState(false);
  const [aramaMetin, setAramaMetin] = useState("");

  const tumSonuclar = aramaAcik
    ? modüller
        .flatMap((m) => m.altModuller.map((t) => ({ ...t, modul: m.etiket })))
        .filter(
          (t) =>
            t.etiket.toLowerCase().includes(aramaMetin.toLowerCase()) ||
            t.dekont?.toLowerCase().includes(aramaMetin.toLowerCase())
        )
    : [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          aria-label="Ana sayfa"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5c518]/10 text-[#f5c518] transition-colors active:bg-[#f5c518]/20"
        >
          <Home className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-extrabold tracking-tight text-white">
          {aktif.etiket}
        </h1>
        <button
          type="button"
          onClick={() => setAramaAcik((v) => !v)}
          aria-label="Modüllerde ara"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-sky-100 transition-colors active:bg-white/10"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Arama input'u */}
      {aramaAcik && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-100" />
            <input
              autoFocus
              value={aramaMetin}
              onChange={(e) => setAramaMetin(e.target.value)}
              placeholder="Alt modüllerde ara..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-sky-100 focus:border-[#f5c518] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setAramaMetin("");
                setAramaAcik(false);
              }}
              aria-label="Aramayı kapat"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-sky-100 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-1.5">
            {aramaMetin && tumSonuclar.length === 0 && (
              <div className="py-3 text-center text-sm text-sky-100">Sonuç bulunamadı.</div>
            )}
            {tumSonuclar.map((s) => {
              const S = IKONLAR[s.ikon];
              return (
                <Link
                  key={s.href + s.modul}
                  href={s.href}
                  onClick={() => setAramaAcik(false)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors active:bg-slate-700"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f5c518]/15 text-[#f5c518]">
                    <S className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-sky-100">{s.etiket}</span>
                  <span className="text-[10px] uppercase tracking-wide text-sky-500">{s.modul}</span>
                  <ChevronRight className="h-4 w-4 text-sky-500" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Aktif modülün dikey listesi */}
      <section className="space-y-2.5">
        {aktif.altModuller.map((t) => (
          <ModulKare key={t.href} {...t} />
        ))}
      </section>

      {/* Diğer modüller: yatay scroll chip'leri */}
      <div className="space-y-3 pt-2">
        {diger.map((m) => (
          <div key={m.id}>
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">
              {m.etiket}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {m.altModuller.map((t) => {
                const C = IKONLAR[t.ikon];
                return (
                  <Link
                    key={m.id + t.href}
                    href={t.href}
                    className="modul-chip relative flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-sky-100 transition-colors active:bg-slate-700"
                  >
                    <C className="h-3.5 w-3.5 text-[#f5c518]" />
                    {t.etiket}
                    {t.badge !== undefined && (
                      <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white">
                        {t.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModulKare({ href, etiket, ikon, badge, disabled, disabledFaz, dekont }: ModulTile) {
  const Ikon = IKONLAR[ikon];

  if (disabled) {
    return (
      <div className="modul-card flex items-center gap-3 rounded-2xl border border-slate-700 bg-[var(--surface)] px-3 py-2.5 opacity-40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sky-100">
          <Ikon className="h-5 w-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-sky-100">{etiket}</span>
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-sky-100">
          {disabledFaz ?? "YAKINDA"}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="modul-card group flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 transition-transform duration-150 ease-out active:scale-[0.99] active:bg-slate-700"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]">
        <Ikon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold text-white">{etiket}</div>
        {dekont && <div className="truncate text-xs text-sky-100">{dekont}</div>}
      </div>
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold text-white">
          {badge}
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-sky-500 group-active:text-sky-100" />
    </Link>
  );
}
