import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";
import { PageBaslik } from "./page-baslik";
import { cn } from "@/lib/utils";

type Madde = {
  href: string;
  baslik: string;
  alt: string;
  ikon: LucideIcon;
  renk?: string;
};

export function ModulListe({
  baslik,
  alt,
  maddeler,
  geri = "/",
}: {
  baslik: string;
  alt?: string;
  maddeler: Madde[];
  geri?: string;
}) {
  return (
    <div>
      <PageBaslik baslik={baslik} alt={alt} geri={geri} />
      <div className="space-y-2.5">
        {maddeler.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="modul-item group block rounded-2xl border border-slate-700 bg-slate-800 p-4 transition-transform duration-150 ease-out active:scale-[0.98] active:bg-slate-700"
          >
            <div className="flex items-center gap-3">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", m.renk ?? "bg-[#0b1b3a]")}>
                <m.ikon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-white">{m.baslik}</div>
                <div className="text-xs text-sky-100">{m.alt}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-sky-500 group-active:text-sky-100" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
