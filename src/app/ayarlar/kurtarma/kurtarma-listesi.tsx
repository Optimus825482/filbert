"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { geriYukleAuditKaydi } from "@/lib/actions/kurtarma";

type Kayit = { id: string; hedefTipi: string; aciklama: string | null; createdAt: string; destekleniyor: boolean };

function tarihSaat(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

export function KurtarmaListesi({ kayitlar }: { kayitlar: Kayit[] }) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState("");
  const [pending, startTransition] = useTransition();

  function restore(id: string) {
    if (!confirm("Bu sürüme geri dönmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const sonuc = await geriYukleAuditKaydi(id);
      setMesaj(sonuc.ok ? "Geri yükleme tamamlandı." : sonuc.hata ?? "Geri yükleme tamamlanamadı.");
      if (sonuc.ok) router.refresh();
    });
  }

  return <div className="mt-6 space-y-2">
    {mesaj && <p role="status" className="text-sm text-sky-100">{mesaj}</p>}
    {kayitlar.length === 0 ? <p className="text-sm text-sky-100">Geri yüklenebilir sürüm yok.</p> : kayitlar.map((kayit) => <div key={kayit.id} className="flex items-center justify-between rounded border p-3"><div><b>{kayit.hedefTipi}</b><p className="text-xs text-sky-100">{tarihSaat(kayit.createdAt)} {kayit.aciklama ?? ""}</p></div>{kayit.destekleniyor ? <button type="button" disabled={pending} onClick={() => restore(kayit.id)} className="rounded border px-3 py-1 text-sm">{pending ? "Geri yükleniyor..." : "Bu sürüme dön"}</button> : <span className="max-w-56 text-right text-xs text-sky-100">Silinmez; iptal veya ters kayıtla düzeltilir</span>}</div>)}
  </div>;
}
