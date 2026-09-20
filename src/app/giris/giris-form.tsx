"use client";

import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { girisYap } from "@/lib/actions/giris";

const alanSinifi = "mt-1.5 flex min-h-12 w-full rounded-xl border border-slate-600 bg-[#07142a] px-3.5 py-2.5 text-base md:text-sm font-medium text-white shadow-inner shadow-black/30 transition-colors placeholder:text-sky-100/60 focus:border-[#f5c518] focus:outline-hidden focus:ring-2 focus:ring-[#f5c518]/30";

export function GirisForm() {
  const router = useRouter();
  const [hata, setHata] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sifreGorunur, setSifreGorunur] = useState(false);

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
        <label htmlFor="giris-eposta" className="text-xs font-extrabold tracking-wide text-sky-100">
          E-POSTA ADRESİ
        </label>
        <input
          id="giris-eposta"
          name="eposta"
          required
          type="email"
          autoComplete="email"
          className={alanSinifi}
          placeholder="ornek@firma.com"
        />
      </div>

      <div>
        <label htmlFor="giris-parola" className="text-xs font-extrabold tracking-wide text-sky-100">
          PAROLA
        </label>
        <div className="relative">
          <input
            id="giris-parola"
            name="sifre"
            required
            type={sifreGorunur ? "text" : "password"}
            autoComplete="current-password"
            className={`${alanSinifi} pr-11`}
            placeholder="Parolanızı girin"
          />
          <button
            type="button"
            onClick={() => setSifreGorunur(!sifreGorunur)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-sky-100 hover:text-white"
            aria-label={sifreGorunur ? "Parolayı gizle" : "Parolayı göster"}
          >
            {sifreGorunur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label htmlFor="beni-hatirla" className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-sky-100">
          <input
            id="beni-hatirla"
            name="beniHatirla"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded-md border-slate-500 bg-[#07142a] accent-emerald-500"
          />
          Beni hatırla
        </label>
      </div>

      {hata && (
        <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 px-3.5 py-2.5 text-sm font-semibold text-red-200">
          {hata}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#18a84b] px-4 py-3 text-sm md:text-base font-extrabold text-white shadow-[0_4px_0_#0c642d] transition-all hover:bg-[#22bd58] active:translate-y-0.5 active:shadow-[0_1px_0_#0c642d] disabled:cursor-wait disabled:opacity-75"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Doğrulanıyor…
          </>
        ) : (
          <>
            Çalışma alanına devam et
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
