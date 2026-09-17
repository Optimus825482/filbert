import { PageBaslik } from "@/components/page-baslik";
import { SevkForm } from "@/components/sevk-form";
import { getCariler, getDepolar, getAktifAraclar } from "@/lib/queries";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function SevkYeniPage() {
  await requirePagePermission("SEVKIYAT", "OLUSTUR");
  const [cariler, depolar, araclar] = await Promise.all([
    getCariler("FABRIKA"),
    getDepolar(),
    getAktifAraclar(),
  ]);

  return (
    <div>
      <PageBaslik baslik="Yeni Sevkiyat" alt="Fabrikaya fındık sevki" geri="/sevkiyat" />
      <SevkForm
        depolar={depolar.filter((d) => d.aktif).map((d) => ({ id: d.id, ad: d.ad }))}
        cariler={cariler.filter((c) => c.aktif).map((c) => ({ id: c.id, ad: c.ad }))}
        araclar={araclar.map((a) => ({
          id: a.id,
          plaka: a.plaka,
          sofor: a.sofor,
          marka: a.marka,
          tip: a.tip,
        }))}
      />
    </div>
  );
}
