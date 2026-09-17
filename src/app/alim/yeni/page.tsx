import { PageBaslik } from "@/components/page-baslik";
import { AlimForm } from "@/components/alim-form";
import { getCariler, getAcikAvanslar, getDepolar } from "@/lib/queries";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function YeniAlimPage() {
  await requirePagePermission("ALIM", "OLUSTUR");
  const [ureticiler, avanslar, depolar] = await Promise.all([
    getCariler("URETICI"),
    getAcikAvanslar(),
    getDepolar(),
  ]);

  return (
    <div>
      <PageBaslik baslik="Yeni Alım Fişi" alt="Peşin veya emanete alım" geri="/" />
      <AlimForm
        ureticiler={ureticiler.map((u) => ({ id: u.id, ad: u.ad, bolge: u.bolge }))}
        acikAvanslar={avanslar.map((a) => ({ id: a.id, cariId: a.cariId, kalanTl: Number(a.kalanTl), tur: a.tur }))}
        depolar={depolar.filter((depo) => depo.aktif).map((depo) => ({ id: depo.id, ad: depo.ad }))}
      />
    </div>
  );
}
