"use client";

import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function UygulamaHataSiniri({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#071126] p-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-sky-200/20 bg-[#0a1830] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300"><ShieldAlert /></div>
        <h1 className="mt-5 text-2xl font-extrabold">Bu ekran şu anda açılamadı</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-sky-100">Bilgileriniz korunuyor. Bağlantıyı kontrol edip işlemi yeniden deneyebilirsiniz.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={retry} className="saha-btn justify-center bg-filbert-600 text-white"><RefreshCw className="h-4 w-4" /> Yeniden dene</button>
          <Link href="/giris" className="saha-btn justify-center border border-sky-200/30 bg-transparent text-sky-100">Girişe dön</Link>
        </div>
      </section>
    </main>
  );
}
