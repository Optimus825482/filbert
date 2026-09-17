"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Mic, User, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({ izinliRotalar }: { izinliRotalar: string[] }) {
  const pathname = usePathname();
  const izinli = (rota: string) => izinliRotalar.includes(rota);
  return (
    <>
      <nav className="guvenli-alt fixed inset-x-0 bottom-0 z-40 border-t border-[var(--surface-border)] bg-[#0b1b3a]/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl items-end justify-around px-3 pb-1 pt-1.5">
          {/* 1. Ana Sayfa — en sol */}
          {izinli("/") && <Link
            href="/"
            aria-label="Ana Sayfa"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
              pathname === "/" ? "text-[#f5c518]" : "text-sky-100 active:bg-white/5"
            )}
          >
            <Home className="h-6 w-6" />
            <span className="text-[10px] font-bold">Ana Sayfa</span>
          </Link>}

          {/* 2. Arama */}
          {izinli("/arama") && <Link
            href="/arama"
            aria-label="Ara"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
              pathname.startsWith("/arama") ? "text-[#f5c518]" : "text-sky-100 active:bg-white/5"
            )}
          >
            <Search className="h-6 w-6" />
            <span className="text-[10px] font-bold">Ara</span>
          </Link>}

          {/* 3. Mikrofon — yükseltilmiş orta buton */}
          {izinli("/sesli-not") && <div className="flex justify-center">
            <Link
              href="/sesli-not"
              aria-label="Sesli modu aç"
              className="saha-btn pointer-events-auto -mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5c518] text-[#0b1b3a] shadow-xl shadow-[#f5c518]/30 ring-4 ring-[#0b1b3a]"
            >
              <Mic className="h-8 w-8" strokeWidth={2.5} />
            </Link>
          </div>}

          {/* 4. Profil — en sağ */}
          {izinli("/ayarlar") && <Link
            href="/ayarlar"
            aria-label="Profil"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
              pathname.startsWith("/ayarlar") ? "text-[#f5c518]" : "text-sky-100 active:bg-white/5"
            )}
          >
            <User className="h-6 w-6" />
            <span className="text-[10px] font-bold">Profil</span>
          </Link>}
        </div>
      </nav>
    </>
  );
}
