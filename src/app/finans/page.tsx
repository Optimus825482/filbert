import { ModulListe } from "@/components/modul-liste";
import { Wallet, Banknote, HandCoins, ArrowDownUp, Receipt } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function FinansYonetimiPage() {
  const actor = await requirePagePermission("FINANS", "GORUNTULE");
  return (
    <ModulListe
      baslik="Finans Yönetimi"
      alt="Kasa · Banka · Tahsilat"
      geri="/"
      maddeler={[
        {
          href: "/kasa",
          baslik: "Kasa Hareketleri",
          alt: "Tahsilat ve ÖDEME işlem sonrası bakiye ile birlikte takip edin.",
          ikon: Wallet,
          renk: "bg-emerald-600",
        },
        {
          href: "/banka",
          baslik: "Banka İşlemleri",
          alt: "Havale ve EFT hareketleri.",
          ikon: Banknote,
          renk: "bg-sky-600",
        },
        {
          href: "/tahsilat",
          baslik: "Tahsilat İşlemleri",
          alt: "Cari hesaptan tahsilatı hesap hareketine işler.",
          ikon: HandCoins,
          renk: "bg-amber-500",
        },
        {
          href: "/finans/odeme",
          baslik: "Ödemeler",
          alt: "Üretici/tüccar/fabrika ödemeleri.",
          ikon: ArrowDownUp,
          renk: "bg-orange-500",
        },
        {
          href: "/masraf",
          baslik: "Masraflar",
          alt: "Nakliye, kantar, hamaliye — maliyete yansıt.",
          ikon: Receipt,
          renk: "bg-slate-600",
        },
        {
          href: "/finans-taslaklari",
          baslik: "Finans Taslakları",
          alt: "Sesli notlardan gelen, onay bekleyen finans kayıtları.",
          ikon: Receipt,
          renk: "bg-amber-600",
        },
      ].filter((madde) => {
        const izinler: Record<string, Parameters<typeof izinVar>[1]> = { "/kasa": "FINANS", "/banka": "FINANS", "/tahsilat": "FINANS", "/finans/odeme": "FINANS", "/masraf": "MASRAF", "/finans-taslaklari": "FINANS" };
        return izinVar(actor, izinler[madde.href], "GORUNTULE");
      })}
    />
  );
}
