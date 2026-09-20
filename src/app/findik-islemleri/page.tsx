import { ModulListe } from "@/components/modul-liste";
import { ShoppingBasket, ClipboardList, Calculator, ArrowLeftRight, Truck, PackageCheck } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function FindikIslemleriPage() {
  const actor = await requirePagePermission("ALIM", "GORUNTULE");
  return (
    <ModulListe
      baslik="Fındık İşlemleri"
      alt="Alım yönetimi, randıman takibi, kırma-paketleme, virman ve sevk planlama"
      geri="/"
      maddeler={[
        {
          href: "/alim",
          baslik: "Alım Yönetimi",
          alt: "Müşteri, miktar, fiyat ve kalite bilgilerini tek işlemde kaydedin.",
          ikon: ShoppingBasket,
          renk: "bg-filbert-600",
        },
        {
          href: "/hizmet",
          baslik: "Kırma & Paketleme",
          alt: "Ev kullanımı için fındık kırma, kavurma, vakumlu paketleme ve sıra takibi.",
          ikon: PackageCheck,
          renk: "bg-emerald-600",
        },
        {
          href: "/randiman",
          baslik: "Randıman Takibi",
          alt: "Kalite sonuçlarını ürün ve müşteri hareketleriyle birlikte değerlendirin.",
          ikon: Calculator,
          renk: "bg-amber-500",
        },
        {
          href: "/virman",
          baslik: "Virman Kontrolü",
          alt: "Depolar veya hesaplar arasındaki miktar aktarımını izlenebilir biçimde yürütün.",
          ikon: ArrowLeftRight,
          renk: "bg-sky-600",
        },
        {
          href: "/sevkiyat",
          baslik: "Sevk Planlama",
          alt: "Hazırlanan ürünleri araç, müşteri ve teslimat bilgileriyle sevke bağlayın.",
          ikon: Truck,
          renk: "bg-orange-500",
        },
        {
          href: "/emanet",
          baslik: "Emanet Hareketleri",
          alt: "Fiyatsız bırakılan emanetleri izleyin ve istediğinizde bozun.",
          ikon: ClipboardList,
          renk: "bg-violet-600",
        },
      ].filter((madde) => {
        const izinler: Record<string, Parameters<typeof izinVar>[1]> = {
          "/alim": "ALIM",
          "/hizmet": "HIZMET",
          "/randiman": "RANDIMAN",
          "/virman": "FINANS",
          "/sevkiyat": "SEVKIYAT",
          "/emanet": "EMANET",
        };
        return izinVar(actor, izinler[madde.href], "GORUNTULE");
      })}
    />
  );
}
