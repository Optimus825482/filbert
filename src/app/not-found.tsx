import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function Bulunamadi() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#071126] p-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-sky-200/20 bg-[#0a1830] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-300/15 text-sky-100">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-extrabold tracking-[0.16em] text-[#f5c518]">SAYFA BULUNAMADI</p>
        <h1 className="mt-2 text-2xl font-extrabold">Aradığınız ekran burada değil</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-sky-100">Bağlantı değişmiş olabilir. Çalışma alanınıza dönerek işleminize devam edebilirsiniz.</p>
        <Link href="/" className="saha-btn mt-7 justify-center bg-filbert-600 text-white">
          <Home className="h-4 w-4" aria-hidden="true" />
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
