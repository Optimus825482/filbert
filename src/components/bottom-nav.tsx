"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Search, Mic, Settings, PackageCheck, ShoppingBasket, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { altMenuOgeleri, type AltMenuIkonu, type ModulId } from "@/lib/modul";

const IKONLAR: Record<AltMenuIkonu, LucideIcon> = {
  ana: Home,
  ara: Search,
  mikrofon: Mic,
  ayarlar: Settings,
  kuyruk: PackageCheck,
  "yeni-talep": ShoppingBasket,
  "isleme-kasasi": Wallet,
};

/**
 * Mobil alt (sticky) menü. Ögeler aktif modüle göre `@/lib/modul` içindeki
 * `ALT_MENU_OGELERI` listesinden gelir; böylece Fındık İşleme modülünde eller
 * serbest (sesli not) düğmesi görünmez, yerini işleme akışının kısayolları alır.
 * Yetkisi olmayan ögeler hiç listelenmez. Modül değişimi her iki modülde de
 * en sağdaki **Ayarlar** üzerinden yapılır.
 *
 * `vurgulu` işaretli öge ortada yükseltilmiş birincil eylem olarak çizilir.
 */
export function BottomNav({
  izinliRotalar,
  aktifModul = null,
}: {
  izinliRotalar: string[];
  aktifModul?: ModulId | null;
}) {
  const pathname = usePathname();
  const ogeler = altMenuOgeleri(aktifModul).filter((oge) => izinliRotalar.includes(oge.href));
  if (ogeler.length === 0) return null;
  const aktifMi = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="guvenli-alt fixed inset-x-0 bottom-0 z-40 border-t border-[var(--surface-border)] bg-[#0b1b3a]/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-3xl items-end justify-around px-3 pb-1 pt-1.5">
        {ogeler.map((oge) => {
          const Ikon = IKONLAR[oge.ikon];
          const secili = aktifMi(oge.href);

          if (oge.vurgulu) {
            return (
              <div key={oge.href} className="flex flex-col items-center gap-0.5">
                <Link
                  href={oge.href}
                  aria-label={oge.etiket}
                  className="saha-btn pointer-events-auto -mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5c518] text-[#0b1b3a] shadow-xl shadow-[#f5c518]/30 ring-4 ring-[#0b1b3a]"
                >
                  <Ikon className="h-8 w-8" strokeWidth={2.5} />
                </Link>
                <span className={cn("text-[10px] font-bold", secili ? "text-[#f5c518]" : "text-sky-100")}>
                  {oge.etiket}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={oge.href}
              href={oge.href}
              aria-label={oge.etiket}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
                secili ? "text-[#f5c518]" : "text-sky-100 active:bg-white/5"
              )}
            >
              <Ikon className="h-6 w-6" />
              <span className="text-[10px] font-bold">{oge.etiket}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}