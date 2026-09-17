import { PageBaslik } from "@/components/page-baslik";
import { SatisForm } from "./satis-form";
import { getCariler, getDepolar } from "@/lib/queries";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function YeniSatisPage() {
  await requirePagePermission("SATIS", "OLUSTUR");
  const [musteriler, depolar] = await Promise.all([
    getCariler("TUCCAR"),
    getDepolar(),
  ]);

  return (
    <div>
      <PageBaslik baslik="Yeni Satış" alt="Müşteriye fındık satışı" geri="/satis" />
      <SatisForm
        musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, bolge: m.bolge }))}
        depolar={depolar.filter((depo) => depo.aktif).map((depo) => ({ id: depo.id, ad: depo.ad }))}
      />
    </div>
  );
}
