import { PageBaslik } from "@/components/page-baslik";
import { OzetKart } from "@/components/ozet-kart";
import { DurumRozet } from "@/components/rozetler";
import { getGunlukRapor } from "@/lib/queries";
import { kg, paraTL, puan, tarih } from "@/lib/format";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/rbac/guard";
import { istanbulTarihAnahtari, istanbulTarihMetniniCoz } from "@/lib/zaman";

export const dynamic = "force-dynamic";

export default async function RaporlarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await requirePagePermission("RAPORLAR", "GORUNTULE");
  const { t } = await searchParams;
  const seciliTarih = t ? istanbulTarihMetniniCoz(t) : istanbulTarihAnahtari();
  if (!seciliTarih) redirect("/raporlar");

  const r = await getGunlukRapor(seciliTarih);
  const tStr = seciliTarih.toISOString().slice(0, 10);

  return (
    <div>
      <PageBaslik baslik="Günlük Rapor" alt={tarih(seciliTarih)} geri="/" />

      <form className="mb-4 flex gap-2">
        <input type="date" name="t" defaultValue={tStr} className="saha-input flex-1 bg-white" />
        <button type="submit" className="saha-btn bg-filbert-600 px-6 text-white">Getir</button>
        <a href={`/api/raporlar/gunluk-csv?t=${tStr}`} className="saha-btn border border-slate-600 bg-slate-800 px-4 text-white" download>CSV İndir</a>
      </form>

      <section className="grid grid-cols-2 gap-3">
        <OzetKart baslik="Alım" deger={kg(r.alimKg)} alt={`${r.fisler.length} fiş · ${paraTL(r.alimTutar)}`} ton="yesil" />
        <OzetKart baslik="Ödemeler" deger={paraTL(r.odemeTutar)} alt={`${r.odemeler.length} işlem`} />
        <OzetKart baslik="Tahsilatlar" deger={paraTL(r.tahsilatTutar)} alt={`${r.tahsilatlar.length} işlem`} />
        <OzetKart baslik="Masraflar" deger={paraTL(r.masrafTutar)} alt={`${r.masraflar.length} kalem`} />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Alım Fişleri</h2>
        <div className="space-y-1.5">
          {r.fisler.map((f) => (
            <div key={f.id} className="ozet-kart flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{f.cari.ad}</span>
                  <DurumRozet durum={f.randimanDurumu} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {f.fisNo} · {kg(Number(f.kg))}
                  {f.randimanPuan ? ` · R: ${puan(f.randimanPuan)}` : ""}
                </div>
              </div>
              <div className="font-extrabold tabular-nums">{paraTL(f.tutar)}</div>
            </div>
          ))}
          {r.fisler.length === 0 && <div className="ozet-kart text-sm text-muted-foreground">Bu tarihte alım yok.</div>}
        </div>
      </section>

      {r.emanetHareket.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Emanet Hareketleri</h2>
          <div className="space-y-1.5">
            {r.emanetHareket.map((h) => (
              <div key={h.id} className="ozet-kart flex items-center justify-between py-3">
                <div className="text-sm">
                  <span className="font-bold">{h.emanet.cari.ad}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{h.tip === "GIRIS" ? "Emanet girişi" : h.tip === "BOZMA" ? "Bozma" : h.tip}</span>
                </div>
                <div className="font-bold tabular-nums text-orange-600">{kg(h.kg)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
