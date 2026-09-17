import Image from "next/image";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { AppSplash } from "@/components/app-splash";
import { GirisForm } from "./giris-form";

const nitelikler = ["Yetki bazlı güvenli erişim", "İzlenebilir ticari kayıtlar", "Saha için tasarlanmış akışlar"];

export default function GirisPage() {
  return <><AppSplash /><main className="relative isolate min-h-screen overflow-hidden bg-[#071126] px-5 py-8 sm:px-8 lg:flex lg:items-center lg:justify-center lg:p-12">
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_14%,rgba(22,163,74,0.22),transparent_29%),radial-gradient(circle_at_82%_88%,rgba(34,211,238,0.12),transparent_32%)]" />
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#09172f]/90 shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur md:grid-cols-[1.15fr_0.85fr]">
      <section className="relative border-b border-white/10 px-7 py-10 sm:px-12 sm:py-14 md:border-b-0 md:border-r">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/30 bg-white p-1.5 shadow-[0_0_28px_rgba(74,222,128,0.14)] md:h-28 md:w-28 md:rounded-3xl md:p-2">
            <Image src="/logo.png" alt="Filbert amblemi" width={340} height={329} priority className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="rounded-md bg-white px-2 py-1.5">
              <Image src="/filbertt.png" alt="Filbert" width={351} height={84} priority className="h-auto w-28 md:w-36" />
            </div>
            <div className="mt-2 text-[11px] font-bold tracking-[0.12em] text-cyan-100">TARIM TİCARET PLATFORMU</div>
          </div>
        </div>
        <div className="mt-14 max-w-md">
          <div className="mb-4 flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-[#f5c518]"><Sparkles className="h-4 w-4" /> OPERASYONUNUZ, TEK MERKEZDE</div>
          <div className="flex items-center gap-5">
            <Image src="/filbert.png" alt="Filbert marka simgesi" width={377} height={386} priority className="h-28 w-28 rounded-2xl border border-emerald-200/40 bg-white object-contain p-1 shadow-[0_14px_32px_rgba(0,0,0,0.22)] sm:h-32 sm:w-32" />
            <div><h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Tarım ticaretinin operasyon merkezi.</h1><p className="mt-3 text-sm font-semibold leading-6 text-sky-100">Alım, stok, cari ve finans süreçlerinizi güvenle yönetin.</p></div>
          </div>
        </div>
        <ul className="mt-12 space-y-3" aria-label="Platform nitelikleri">{nitelikler.map((nitelik) => <li key={nitelik} className="flex items-center gap-3 text-sm font-semibold text-white"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />{nitelik}</li>)}</ul>
      </section>
      <section className="bg-[#0b1932]/85 px-7 py-10 sm:px-12 sm:py-14">
        <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-[#f5c518]"><ShieldCheck className="h-4 w-4" /> KURUMSAL ERİŞİM</div>
        <p className="mt-3 text-sm leading-6 text-sky-100">Yetkilerinize uygun çalışma alanına devam etmek için bilgilerinizi doğrulayın.</p>
        <GirisForm />
        <PwaInstallButton />
        <p className="mt-8 border-t border-white/10 pt-5 text-xs font-semibold leading-5 text-sky-100">Erişim hareketleri kayıt altındadır. Sorun yaşarsanız sistem yöneticinizle iletişime geçin.</p>
      </section>
    </div>
  </main></>;
}
