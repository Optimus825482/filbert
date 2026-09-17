"use client";

import Image from "next/image";

export function AppSplash() {
  return <div aria-label="Filbert yükleniyor" aria-live="polite" className="app-splash fixed inset-0 z-[100] flex items-center justify-center bg-[#071126] px-6">
    <button type="button" aria-label="Giriş ekranına devam et" onClick={(event) => event.currentTarget.parentElement?.classList.add("app-splash-skip")} className="absolute inset-0 z-10 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-emerald-200" />
    <div className="app-splash-card flex flex-col items-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-emerald-300/40 bg-white p-3 shadow-[0_0_70px_rgba(74,222,128,0.28)] sm:h-40 sm:w-40 md:h-72 md:w-72 md:rounded-[3rem] md:p-5">
        <Image src="/filbert.png" alt="Filbert" width={377} height={386} priority className="h-full w-full object-contain" />
      </div>
      <p className="mt-6 text-sm font-extrabold tracking-[0.24em] text-emerald-100">FILBERT</p>
      <p className="mt-2 text-xs font-bold tracking-[0.14em] text-cyan-100">TARIM TİCARET PLATFORMU</p>
      <p className="app-splash-hint mt-8 text-xs font-bold tracking-[0.08em] text-sky-100">Devam etmek için dokunun veya tıklayın</p>
    </div>
  </div>;
}
