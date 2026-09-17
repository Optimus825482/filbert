"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";

/** Sayfa açılınca bir kez otomatik yazdırma başlatır ve
 * ekranda yalnızca yazdırmada gizlenen (no-print) bir buton gösterir. */
export function YazdirBaslat({ etiket = "Yazdır" }: { etiket?: string }) {
  const basildi = useRef(false);

  useEffect(() => {
    if (basildi.current) return;
    basildi.current = true;
    const zamanlayici = setTimeout(() => window.print(), 300);
    return () => clearTimeout(zamanlayici);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white active:scale-[0.97]"
    >
      <Printer className="h-4 w-4" /> {etiket}
    </button>
  );
}
