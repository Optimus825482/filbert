import { PageBaslik } from "@/components/page-baslik";
import { AvansForm } from "@/components/avans-form";
import { getCariler, getHesaplar, getAcikAvanslar, getDepolar } from "@/lib/queries";
import { paraTL, paraBirim, tarih, gunFarki } from "@/lib/format";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function AvansPage() {
  const actor = await requirePagePermission("AVANS", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "AVANS", "OLUSTUR");
  const [cariler, hesaplar, avanslar, depolar] = await Promise.all([
    getCariler("URETICI"),
    getHesaplar(),
    getAcikAvanslar(),
    getDepolar(),
  ]);

  return (
    <div>
      <PageBaslik baslik="Avans İşlemleri" alt="Üretici avansları" geri="/cari" />

      {olusturmaYetkisi && <AvansForm
        cariler={cariler.map((c) => ({ id: c.id, ad: c.ad }))}
        hesaplar={hesaplar.map((h) => ({ id: h.id, ad: h.ad, bakiyeTuru: h.bakiyeTuru }))}
        depolar={depolar.filter((depo) => depo.aktif).map((depo) => ({ id: depo.id, ad: depo.ad }))}
      />}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-sky-100">
          AÇIK AVANSLAR ({avanslar.length})
        </h2>
        <div className="space-y-2">
          {avanslar.map((a) => {
            const gun = gunFarki(a.tarih);
            return (
              <div key={a.id} className="ozet-kart border-violet-700/50 bg-violet-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{a.cari.ad}</div>
                    <div className="text-xs text-sky-100">
                      {a.tur} · {tarih(a.tarih)} · {gun} gün önce {a.aciklama ? `· ${a.aciklama}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold tabular-nums text-violet-300">
                      {paraBirim(a.bakiyeTuru === "TL" ? a.kalanTl : (a.tutarDoviz ?? a.kalanTl), a.bakiyeTuru)}
                    </div>
                    {a.bakiyeTuru !== "TL" && (
                      <div className="text-xs tabular-nums text-sky-100">{paraTL(a.kalanTl)} karşılığı</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {avanslar.length === 0 && (
            <div className="ozet-kart text-sm text-sky-100">Açık avans yok.</div>
          )}
        </div>
      </section>
    </div>
  );
}
