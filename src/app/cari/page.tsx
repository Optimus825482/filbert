import { ModulListe } from "@/components/modul-liste";
import { Users, HandCoins, PiggyBank, FileText } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function CariLandingPage() {
  const actor = await requirePagePermission("CARI", "GORUNTULE");
  return (
    <ModulListe
      baslik="Müşteri Yönetimi"
      alt="Cari Hesaplar · Tahsilat · Avans · Satış"
      geri="/"
      maddeler={[
        {
          href: "/cari/hesaplar",
          baslik: "Cari Hesaplar",
          alt: "Üretici, tüccar ve fabrika kartları · çoklu bakiye ve hareket geçmişi.",
          ikon: Users,
          renk: "bg-sky-600",
        },
        {
          href: "/tahsilat",
          baslik: "Tahsilat İşlemleri",
          alt: "Cari hesaptan tahsilatı hesap hareketine işler.",
          ikon: HandCoins,
          renk: "bg-emerald-600",
        },
        {
          href: "/avans",
          baslik: "Avans İşlemleri",
          alt: "Üreticiye nakit/ayni/fındık karşılığı avans, Ziraat faiz maliyeti.",
          ikon: PiggyBank,
          renk: "bg-violet-600",
        },
        {
          href: "/satis",
          baslik: "Satış İşlemleri",
          alt: "Fabrikaya/tüccara fındık satışı ve satış emaneti.",
          ikon: FileText,
          renk: "bg-orange-500",
        },
      ].filter((madde) => {
        const izinler: Record<string, Parameters<typeof izinVar>[1]> = { "/cari/hesaplar": "CARI", "/tahsilat": "FINANS", "/avans": "AVANS", "/satis": "SATIS" };
        return izinVar(actor, izinler[madde.href], "GORUNTULE");
      })}
    />
  );
}
