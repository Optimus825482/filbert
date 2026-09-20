"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ShoppingBasket,
  ClipboardList,
  Calculator,
  ArrowLeftRight,
  Truck,
  PackageOpen,
  Wallet,
  Banknote,
  HandCoins,
  ArrowDownUp,
  Receipt,
  PiggyBank,
  Users,
  Warehouse,
  FileBarChart,
  type LucideIcon,
} from "lucide-react";

type Sonuc = { href: string; etiket: string; grup: string; ikon: LucideIcon };
type Cari = { id: string; ad: string; tur: string; bolge: string | null };

const MODUL_OGELERI: Sonuc[] = [
  { href: "/alim/yeni", etiket: "Yeni Alım Fişi", grup: "Fındık", ikon: ShoppingBasket },
  { href: "/alim", etiket: "Alım Yönetimi", grup: "Fındık", ikon: ClipboardList },
  { href: "/randiman", etiket: "Randıman Takibi", grup: "Fındık", ikon: Calculator },
  { href: "/virman", etiket: "Virman Kontrolü", grup: "Fındık", ikon: ArrowLeftRight },
  { href: "/emanet", etiket: "Emanetler", grup: "Fındık", ikon: PackageOpen },
  { href: "/sevkiyat", etiket: "Sevk Planlama", grup: "Fındık", ikon: Truck },
  { href: "/kasa", etiket: "Kasa Hareketleri", grup: "Finans", ikon: Wallet },
  { href: "/banka", etiket: "Banka İşlemleri", grup: "Finans", ikon: Banknote },
  { href: "/tahsilat", etiket: "Tahsilat", grup: "Finans", ikon: HandCoins },
  { href: "/finans/odeme", etiket: "Ödeme", grup: "Finans", ikon: ArrowDownUp },
  { href: "/masraf", etiket: "Masraf", grup: "Finans", ikon: Receipt },
  { href: "/avans", etiket: "Avans", grup: "Müşteri", ikon: PiggyBank },
  { href: "/cari/hesaplar", etiket: "Cari Hesaplar", grup: "Müşteri", ikon: Users },
  { href: "/raporlar", etiket: "Günlük Rapor", grup: "Rapor", ikon: FileBarChart },
  { href: "/stok", etiket: "Stok Durumu", grup: "Rapor", ikon: Warehouse },
];

export function AramaIcerik({
  izinliRotalar,
  cariAramaYetkisi,
}: {
  izinliRotalar: string[];
  cariAramaYetkisi: boolean;
}) {
  const [metin, setMetin] = useState("");
  const [cariler, setCariler] = useState<Cari[]>([]);
  const izinliModuller = MODUL_OGELERI.filter((oge) => izinliRotalar.includes(oge.href));

  useEffect(() => {
    if (!cariAramaYetkisi || metin.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/cari-ara?q=${encodeURIComponent(metin)}`, { signal: controller.signal });
        setCariler(r.ok ? await r.json() : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCariler([]);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [cariAramaYetkisi, metin]);

  const modulSonuc = metin
    ? izinliModuller.filter((oge) => oge.etiket.toLocaleLowerCase("tr-TR").includes(metin.toLocaleLowerCase("tr-TR")))
    : izinliModuller;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Geri"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--app-fg)] transition-colors hover:border-[var(--primary)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={metin}
            onChange={(e) => {
              setMetin(e.target.value);
              if (e.target.value.length < 2) setCariler([]);
            }}
            placeholder="Modül veya müşteri ara..."
            className="flex h-12 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] py-3 pl-11 pr-10 text-base text-[var(--app-fg)] placeholder:text-muted-foreground focus:border-[var(--primary)] focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/30"
          />
          {metin && (
            <button
              type="button"
              onClick={() => {
                setMetin("");
                setCariler([]);
              }}
              aria-label="Temizle"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-[var(--app-fg)]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {cariAramaYetkisi && metin.length >= 2 && cariler.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MÜŞTERİLER</div>
          <div className="space-y-1.5">
            {cariler.map((c) => (
              <Link
                key={c.id}
                href={`/cari/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--primary)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[var(--app-fg)]">{c.ad}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.tur === "URETICI" ? "Üretici" : c.tur === "TUCCAR" ? "Tüccar" : "Fabrika"}
                    {c.bolge ? ` · ${c.bolge}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {metin ? "MODÜLLER" : "TÜM MODÜLLER"}
        </div>
        <div className="space-y-1.5">
          {modulSonuc.length === 0 && (
            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 text-center text-sm text-muted-foreground">
              Sonuç bulunamadı.
            </div>
          )}
          {modulSonuc.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--primary)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]">
                <s.ikon className="h-5 w-5" />
              </span>
              <span className="flex-1 truncate text-sm font-bold text-[var(--app-fg)]">{s.etiket}</span>
              <span className="text-xs font-medium text-muted-foreground">{s.grup}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
