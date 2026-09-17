import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { MasaustuNav } from "@/components/masaustu-nav";

/**
 * Tek uygulama kabuğu. İçerik (children) yalnızca burada bir kez render edilir;
 * mobil/ masaüstü farkı tamamen CSS ile yönetilir. Böylece sayfa bileşenleri iki
 * kez mount edilmez. AppHeader kendi içinde mobil ve masaüstü başlık varyantlarını
 * taşır; MasaustuNav yalnız md+ ekranlarda, BottomNav yalnız md altında görünür.
 */
export function MobileShell({ children, izinliRotalar, bekleyenRandiman = 0 }: { children: React.ReactNode; izinliRotalar: string[]; bekleyenRandiman?: number }) {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1">
        <MasaustuNav izinliRotalar={izinliRotalar} bekleyenRandiman={bekleyenRandiman} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-3xl md:max-w-6xl">{children}</div>
        </main>
      </div>
      <BottomNav izinliRotalar={izinliRotalar} />
    </>
  );
}
