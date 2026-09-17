"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBasket, ClipboardList, Calculator, ArrowLeftRight, Truck, PackageOpen,
  Wallet, Banknote, HandCoins, ArrowDownUp, Receipt, PiggyBank,
  Users, FileText, Warehouse, FileBarChart, TrendingUp, Settings, Home,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavOge = { href: string; etiket: string; ikon: LucideIcon };
type NavGrup = { baslik: string; ogeler: NavOge[] };

const GRUPLAR: NavGrup[] = [
  {
    baslik: "GENEL",
    ogeler: [{ href: "/", etiket: "Pano", ikon: Home }],
  },
  {
    baslik: "FINDIK İŞLEMLERİ",
    ogeler: [
      { href: "/alim", etiket: "Alım Yönetimi", ikon: ClipboardList },
      { href: "/alim/yeni", etiket: "Yeni Alım Fişi", ikon: ShoppingBasket },
      { href: "/randiman", etiket: "Randıman Takibi", ikon: Calculator },
      { href: "/emanet", etiket: "Emanetler", ikon: PackageOpen },
      { href: "/virman", etiket: "Virman Kontrolü", ikon: ArrowLeftRight },
      { href: "/sevkiyat", etiket: "Sevk Planlama", ikon: Truck },
    ],
  },
  {
    baslik: "FİNANS YÖNETİMİ",
    ogeler: [
      { href: "/kasa", etiket: "Kasa", ikon: Wallet },
      { href: "/banka", etiket: "Banka", ikon: Banknote },
      { href: "/tahsilat", etiket: "Tahsilat", ikon: HandCoins },
      { href: "/finans/odeme", etiket: "Ödeme", ikon: ArrowDownUp },
      { href: "/avans", etiket: "Avans", ikon: PiggyBank },
      { href: "/masraf", etiket: "Masraf", ikon: Receipt },
    ],
  },
  {
    baslik: "MÜŞTERİ",
    ogeler: [
      { href: "/cari/hesaplar", etiket: "Cari Hesaplar", ikon: Users },
      { href: "/satis", etiket: "Satış", ikon: FileText },
    ],
  },
  {
    baslik: "RAPORLAR",
    ogeler: [
      { href: "/raporlar", etiket: "Günlük Rapor", ikon: FileBarChart },
      { href: "/stok", etiket: "Stok Durumu", ikon: Warehouse },
      { href: "/kar-zarar", etiket: "Kâr / Zarar", ikon: TrendingUp },
    ],
  },
];

export function MasaustuNav({ izinliRotalar, bekleyenRandiman }: { izinliRotalar: string[]; bekleyenRandiman: number }) {
  const pathname = usePathname();
  const gruplar = GRUPLAR
    .map((grup) => ({ ...grup, ogeler: grup.ogeler.filter((oge) => izinliRotalar.includes(oge.href)) }))
    .filter((grup) => grup.ogeler.length > 0);
  if (gruplar.length === 0) return null;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-[#0a1830] md:flex">
      <nav className="flex-1 space-y-5 px-3 py-4">
        {gruplar.map((g) => (
          <div key={g.baslik}>
            <div className="mb-1.5 px-2.5 text-[10px] font-extrabold tracking-[0.14em] text-sky-500">
              {g.baslik}
            </div>
            <div className="space-y-0.5">
              {g.ogeler.map((o) => {
                const aktif = o.href === "/" ? pathname === "/" : pathname.startsWith(o.href);
                return (
                  <Link
                    key={o.href}
                    href={o.href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      aktif
                        ? "bg-[#f5c518]/10 font-bold text-[#f5c518]"
                        : "text-sky-100 hover:bg-[var(--surface)] hover:text-white"
                    )}
                  >
                    {/* Altın ray çizgisi — aktif gösterge */}
                    {aktif && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#f5c518]" />}
                    <o.ikon className={cn("h-4 w-4", aktif ? "text-[#f5c518]" : "text-sky-100 group-hover:text-sky-100")} />
                    <span className="flex-1">{o.etiket}</span>
                    {o.href === "/randiman" && bekleyenRandiman > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold text-white">
                        {bekleyenRandiman}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {izinliRotalar.includes("/ayarlar") && (
        <div className="border-t border-slate-800 p-3">
          <Link
            href="/ayarlar"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              pathname.startsWith("/ayarlar") ? "bg-[#f5c518]/10 font-bold text-[#f5c518]" : "text-sky-100 hover:bg-[var(--surface)]"
            )}
          >
            <Settings className="h-4 w-4 text-sky-100" />
            Ayarlar
          </Link>
        </div>
      )}
    </aside>
  );
}
