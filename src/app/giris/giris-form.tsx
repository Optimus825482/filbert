"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { girisYap } from "@/lib/actions/giris";

const alanSinifi = "mt-1.5 w-full rounded-xl border border-slate-500 bg-[#07142a] px-3.5 py-3 text-sm font-semibold text-white shadow-inner shadow-black/20 transition-colors hover:border-sky-300 focus:border-[#f5c518]";

export function GirisForm() {
  const router = useRouter();
  const [hata, setHata] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(data: FormData) {
    setHata(undefined);
    setBusy(true);
    try {
      const sonuc = await girisYap(data);
      if (!sonuc.ok) {
        setHata(sonuc.hata ?? "Giriş doğrulanamadı.");
        return;
      }
      router.replace(sonuc.hedef ?? "/");
      router.refresh();
    } catch {
      setHata("Giriş şu anda doğrulanamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="giris-eposta" className="text-xs font-extrabold tracking-wide text-sky-50">E-POSTA</label>
        <input id="giris-eposta" name="eposta" required type="email" autoComplete="email" className={alanSinifi} placeholder="ornek@firma.com" />
      </div>
      <div>
        <label htmlFor="giris-parola" className="text-xs font-extrabold tracking-wide text-sky-50">PAROLA</label>
        <input id="giris-parola" name="sifre" required type="password" autoComplete="current-password" className={alanSinifi} placeholder="Parolanızı girin" />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="beni-hatirla" className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-sky-100">
          <input id="beni-hatirla" name="beniHatirla" type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-500 bg-[#07142a] accent-emerald-500" />
          Beni hatırla
        </label>
      </div>
      {hata && <p role="alert" className="rounded-xl border border-red-300/40 bg-red-950/35 px-3 py-2.5 text-sm font-semibold text-red-100">{hata}</p>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#18a84b] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_5px_0_#0c642d] transition-all hover:bg-[#22bd58] active:translate-y-0.5 active:shadow-[0_2px_0_#0c642d] disabled:cursor-wait disabled:opacity-75">
        {busy ? "Doğrulanıyor…" : "Çalışma alanına devam et"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
