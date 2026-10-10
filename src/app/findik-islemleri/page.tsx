import { ModulListe } from "@/components/modul-liste";
import { ShoppingBasket, PackageCheck, ClipboardList, Truck } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

/**
 * Fındık modülleri başlatıcısı — uygulama iki ana modüle ayrılmıştır:
 *   · Fındık Alım Modülü   → müstahsil alımı, randıman, emanet, virman, sevk
 *   · Fındık İşleme Modülü → kırma, kavurma, vakumlu paketleme talep akışı
 */
export default async function FindikIslemleriPage() {
  const actor = await requirePagePermission("ALIM", "GORUNTULE");
  return (
    <ModulListe
      baslik="Fındık Modülleri"
      alt="İki ana modül: fındık alımı ve fındık işleme (kırma · kavurma · vakumlu paketleme)"
      geri="/"
      maddeler={[
        {
          href: "/mod/alim",
          baslik: "Fındık Alım Modülü",
          alt: "Müstahsil alımı, randıman takibi, emanet, virman ve sevk planlama.",
          ikon: ShoppingBasket,
          renk: "bg-filbert-600",
        },
        {
          href: "/mod/islem",
          baslik: "Fındık İşleme Modülü",
          alt: "Kırma, kavurma ve vakumlu paketleme talepleri: talep kaydı, aşama takibi, teslim, tahsilat ve SMS.",
          ikon: PackageCheck,
          renk: "bg-emerald-600",
        },
        {
          href: "/alim",
          baslik: "Alım Yönetimi",
          alt: "Alım fişleri, randıman tamamlama ve emanet fişleri.",
          ikon: ClipboardList,
          renk: "bg-sky-600",
        },
        {
          href: "/hizmet",
          baslik: "İşleme Talep Kuyruğu",
          alt: "Bekleyen, üretimde, hazır ve teslim edilen taleplerin aşama takibi.",
          ikon: Truck,
          renk: "bg-amber-500",
        },
      ].filter((madde) => {
        const izinler: Record<string, Parameters<typeof izinVar>[1]> = {
          "/mod/alim": "ALIM",
          "/alim": "ALIM",
          "/mod/islem": "HIZMET",
          "/hizmet": "HIZMET",
        };
        return izinVar(actor, izinler[madde.href], "GORUNTULE");
      })}
    />
  );
}
