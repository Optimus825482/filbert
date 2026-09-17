import Image from "next/image";
import Link from "next/link";
import { getFirma } from "@/lib/queries";
import { getCurrentOturum } from "@/lib/auth";
import { izinVar } from "@/lib/rbac/guard";
import { Search } from "lucide-react";
import { OturumKapatButonu } from "@/components/oturum-kapat-butonu";

export async function AppHeader() {
  const [firma, oturum] = await Promise.all([getFirma(), getCurrentOturum()]);
  const yeniAlimYetkisi = Boolean(oturum?.kullanici && izinVar(oturum.kullanici, "ALIM", "OLUSTUR"));

  return (
    <>
      {/* ── MASAÜSTÜ: üst bar (md+) ─────────────────────────── */}
      <header className="sticky top-0 z-40 hidden border-b border-slate-800 bg-[#0a1830]/95 text-white backdrop-blur md:block">
        <div className="flex h-14 items-center gap-4 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
              <Image src="/logo.png" alt="Filbert" width={340} height={329} className="h-11 w-9 object-contain" priority />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">FİLBERT</div>
              <div className="text-[10px] font-medium text-sky-100">Fındığın Dijital Aklı</div>
            </div>
          </Link>

          {/* Global arama */}
          <Link
            href="/arama"
            className="ml-4 flex h-9 w-72 items-center gap-2 rounded-lg border border-slate-700 bg-[var(--surface)] px-3 text-sm text-sky-100 transition-colors hover:border-slate-600"
          >
            <Search className="h-4 w-4" />
            Modül veya müşteri ara...
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {yeniAlimYetkisi && <Link href="/alim/yeni" className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-extrabold text-[#0b1b3a] shadow-[0_2px_0_#7a5b08] transition-transform duration-150 ease-out active:scale-[0.97]">
              + Yeni Alım Fişi
            </Link>}
            <span className="rounded-full border border-[#f5c518]/40 bg-[#f5c518]/10 px-3 py-1.5 text-xs font-extrabold text-[#f5c518]">
              {firma?.unvan ?? "Filbert"}
            </span>
            <OturumKapatButonu />
          </div>
        </div>
      </header>

      {/* ── MOBİL: kompakt bar (md altı) ────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--surface-border)] bg-[#0b1b3a] text-white md:hidden">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <Image src="/logo.png" alt="Filbert" width={340} height={329} className="h-14 w-11 object-contain" priority />
            </span>
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight">FİLBERT</div>
              <div className="text-[11px] font-medium text-sky-100">Fındığın Dijital Aklı</div>
            </div>
          </Link>
          <div className="ml-auto rounded-full bg-[#f5c518] px-3 py-1.5 text-xs font-extrabold text-[#0b1b3a]">
            {firma?.unvan ?? "Filbert"}
          </div>
          <OturumKapatButonu compact />
        </div>
      </header>
    </>
  );
}
