"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { finansHareketiniTersKaydet } from "@/lib/actions/finans";

export function FinansTersKayit({ finansId, tersKayitMi = false }: { finansId: string; tersKayitMi?: boolean }) {
  const [durum, setDurum] = useState<"idle" | "saving" | "done">("idle");
  if (tersKayitMi || durum === "done") return null;
  return <button type="button" disabled={durum === "saving"} title="Kaydı silmeden ters hareket oluştur" className="rounded-md p-1 text-sky-100 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-50" onClick={async () => {
    if (!window.confirm("Bu kayıt silinmez; bakiyeyi dengeleyen ters kayıt oluşturulacak. Devam edilsin mi?")) return;
    setDurum("saving"); const sonuc = await finansHareketiniTersKaydet(finansId);
    if (!sonuc.ok) { window.alert(sonuc.hata ?? "Ters kayıt oluşturulamadı"); setDurum("idle"); return; }
    setDurum("done");
  }}><RotateCcw className="h-4 w-4" /></button>;
}
