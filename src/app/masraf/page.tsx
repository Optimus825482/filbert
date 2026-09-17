import { PageBaslik } from "@/components/page-baslik";
import { MasrafForm } from "@/components/masraf-form";
import { getCariler, getHesaplar, getSonMasraflar, getMasrafTurleri } from "@/lib/queries";
import { paraTL, tarih } from "@/lib/format";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function MasrafPage() {
  const actor = await requirePagePermission("MASRAF", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "MASRAF", "OLUSTUR");
  const [cariler, hesaplar, masraflar, masrafTurleri] = await Promise.all([getCariler(), getHesaplar(), getSonMasraflar(20), getMasrafTurleri()]);

  return (
    <div>
      <PageBaslik baslik="Masraflar" alt="Nakliye, kantar, hamaliye..." geri="/" />

      {olusturmaYetkisi && <MasrafForm cariler={cariler.map((c) => ({ id: c.id, ad: c.ad }))} hesaplar={hesaplar.map((h) => ({ id: h.id, ad: h.ad }))} masrafTurleri={masrafTurleri.map((t) => ({ id: t.id, ad: t.ad }))} />}

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Son Masraflar</h2>
        <div className="space-y-1.5">
          {masraflar.map((m) => (
            <div key={m.id} className="ozet-kart flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {m.tur} {m.maliyeteYansit && <span className="ml-1 rounded bg-filbert-100 px-1.5 py-0.5 text-[10px] font-bold text-filbert-700">MALİYETE</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {tarih(m.tarih)} {m.aciklama ? `· ${m.aciklama}` : ""}
                </div>
              </div>
              <div className="font-extrabold tabular-nums text-[#0b2d55]">{paraTL(m.tutar)}</div>
            </div>
          ))}
          {masraflar.length === 0 && <div className="ozet-kart text-sm text-muted-foreground">Henüz masraf yok.</div>}
        </div>
      </section>
    </div>
  );
}
