import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { MasaustuNav } from "@/components/masaustu-nav";
import type { ModulId } from "@/lib/modul";

/**
 * Tek uygulama kabuğu. İçerik (children) yalnızca burada bir kez render edilir;
 * mobil/ masaüstü farkı tamamen CSS ile yönetilir. Böylece sayfa bileşenleri iki
 * kez mount edilmez. AppHeader kendi içinde mobil ve masaüstü başlık varyantlarını
 * taşır; MasaustuNav yalnız md+ ekranlarda, BottomNav yalnız md altında görünür.
 *
 * Aktif modül sunucuda (istek yolu → çerez → kullanıcı varsayılanı) belirlenir ve
 * menüler yalnızca o modülün ekranlarını listeler. Mobil alt (sticky) menü de
 * modüle duyarlıdır: ögeleri `@/lib/modul` içindeki `ALT_MENU_OGELERI` belirler.
 */
export function MobileShell({
  children,
  izinliRotalar,
  bekleyenRandiman = 0,
  aktifModul = null,
}: {
  children: React.ReactNode;
  izinliRotalar: string[];
  bekleyenRandiman?: number;
  aktifModul?: ModulId | null;
}) {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1">
        <MasaustuNav
          izinliRotalar={izinliRotalar}
          bekleyenRandiman={bekleyenRandiman}
          aktifModul={aktifModul}
        />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-3xl md:max-w-6xl">{children}</div>
        </main>
      </div>
      <BottomNav izinliRotalar={izinliRotalar} aktifModul={aktifModul} />
    </>
  );
}