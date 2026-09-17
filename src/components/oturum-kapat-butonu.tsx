"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cikisYap } from "@/lib/actions/giris";

export function OturumKapatButonu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);

  async function kapat() {
    setBekliyor(true);
    await cikisYap();
    router.replace("/giris");
    router.refresh();
  }

  return <button type="button" onClick={() => void kapat()} disabled={bekliyor} aria-label="Güvenli çıkış" title="Güvenli çıkış" className={compact ? "tray-icon flex h-7 w-7 items-center justify-center rounded-md text-sky-100 transition-colors hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50" : "inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300/40 px-3 text-xs font-bold text-red-100 hover:bg-red-500/15 disabled:opacity-50"}>
    <LogOut className="h-4 w-4" />
    {!compact && (bekliyor ? "Çıkış yapılıyor…" : "Çıkış yap")}
  </button>;
}
