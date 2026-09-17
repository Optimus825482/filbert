import { PageBaslik } from "@/components/page-baslik";
import { OzetKart } from "@/components/ozet-kart";
import { getKarZarar } from "@/lib/queries";
import { paraTL, tarih } from "@/lib/format";
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/rbac/guard";
import { istanbulTarihAnahtari, istanbulTarihMetniniCoz } from "@/lib/zaman";

export const metadata: Metadata = {
  title: "Kâr/Zarar",
  description: "Seçili tarih aralığı için Kâr/Zarar (P&L) raporu",
};

export const dynamic = "force-dynamic";

function ayBaslangici(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function bugun(): Date {
  return istanbulTarihAnahtari();
}

export default async function KarZararPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  await requirePagePermission("RAPORLAR", "GORUNTULE");
  const { bas, bit } = await searchParams;
  const bugunDate = bugun();

  const baslangic = bas ? istanbulTarihMetniniCoz(bas) : ayBaslangici(bugunDate);
  const bitis = bit ? istanbulTarihMetniniCoz(bit) : bugunDate;
  const safeBas = baslangic ?? ayBaslangici(bugunDate);
  const safeBit = bitis ?? bugunDate;

  const r = await getKarZarar(safeBas, safeBit);

  const basStr = safeBas.toISOString().slice(0, 10);
  const bitStr = safeBit.toISOString().slice(0, 10);

  const netTutar = r.karZarar;
  const karRenk = netTutar >= 0 ? ("yesil" as const) : ("kirmizi" as const);
  const karEtiket = netTutar >= 0 ? "Net Kâr" : "Net Zarar";
  const karlilikOran =
    r.satisToplam > 0 ? ((netTutar / r.satisToplam) * 100).toFixed(1) : "—";

  return (
    <div>
      <PageBaslik
        baslik="Kâr/Zarar"
        alt={`${tarih(safeBas)} – ${tarih(safeBit)}`}
        geri="/"
      />

      {/* Tarih seçici */}
      <form className="mb-5 flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-1.5">
          <label
            htmlFor="bas"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Başlangıç
          </label>
          <input
            id="bas"
            type="date"
            name="bas"
            defaultValue={basStr}
            className="saha-input flex-1 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-1 items-center gap-1.5">
          <label
            htmlFor="bit"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Bitiş
          </label>
          <input
            id="bit"
            type="date"
            name="bit"
            defaultValue={bitStr}
            className="saha-input flex-1 bg-white px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="saha-btn self-end bg-filbert-600 px-6 text-white"
        >
          Getir
        </button>
      </form>

      {/* Özet kartlar */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OzetKart
          baslik="Toplam Alım"
          deger={paraTL(r.alimToplam)}
          alt={`${r.alimAdet} fiş`}
        />
        <OzetKart
          baslik="Toplam Satış"
          deger={paraTL(r.satisToplam)}
          alt={`${r.satisAdet} fiş`}
          ton="yesil"
        />
        <OzetKart baslik="SMM (COGS)" deger={paraTL(r.cogs)} alt={`Satılan malların maliyeti`} />
        <OzetKart baslik="Brüt Kâr" deger={paraTL(r.brutKar)} alt={r.satisToplam > 0 ? `Marj %${((r.brutKar / r.satisToplam) * 100).toFixed(1)}` : "Satış yok"} ton={r.brutKar >= 0 ? "yesil" : "kirmizi"} />
        <OzetKart baslik="Envanter Değeri" deger={paraTL(r.envanterDegeri)} alt="Depo bazlı WAC ile değerlendi" />
        <OzetKart
          baslik="Masraflar"
          deger={paraTL(r.masrafToplam)}
          alt={`${r.masrafAdet} kalem`}
        />
        <OzetKart
          baslik={karEtiket}
          deger={paraTL(netTutar)}
          alt={karlilikOran !== "—" ? `Marj %${karlilikOran}` : "Satış yok"}
          ton={karRenk}
        />
      </section>

      {/* Finans hareket özeti */}
      <section className="mb-6 grid grid-cols-2 gap-3">
        <OzetKart
          baslik="Tahsilatlar"
          deger={paraTL(r.tahsilatToplam)}
          alt={`${r.tahsilatAdet} işlem`}
          ton="yesil"
        />
        <OzetKart
          baslik="Ödemeler"
          deger={paraTL(r.odemeToplam)}
          alt={`${r.odemeAdet} işlem`}
        />
      </section>

      {/* Alım detay */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Alım Fişleri ({r.alimAdet})
        </h2>
        {r.alimlar.length === 0 ? (
          <div className="ozet-kart text-sm text-muted-foreground">
            Bu aralıkta alım yok.
          </div>
        ) : (
          <div className="space-y-1.5">
            {r.alimlar.map((f) => (
              <div
                key={f.id}
                className="ozet-kart flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{f.cari.ad}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.fisNo} · {tarih(f.tarih)}
                  </div>
                </div>
                <div className="shrink-0 text-right font-extrabold tabular-nums">
                  {paraTL(f.tutar)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Satış detay */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Satışlar ({r.satisAdet})
        </h2>
        {r.satislar.length === 0 ? (
          <div className="ozet-kart text-sm text-muted-foreground">
            Bu aralıkta satış yok.
          </div>
        ) : (
          <div className="space-y-1.5">
            {r.satislar.map((s) => (
              <div
                key={s.id}
                className="ozet-kart flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">Satış</div>
                  <div className="text-xs text-muted-foreground">
                    {s.fisNo || `#${s.id.slice(0, 8)}`} · {tarih(s.tarih)}
                    {s.aciklama ? ` · ${s.aciklama}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right font-extrabold tabular-nums text-emerald-600">
                  {paraTL(s.tutar)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Masraf detay */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Masraflar ({r.masrafAdet})
        </h2>
        {r.masraflar.length === 0 ? (
          <div className="ozet-kart text-sm text-muted-foreground">
            Bu aralıkta masraf yok.
          </div>
        ) : (
          <div className="space-y-1.5">
            {r.masraflar.map((m) => (
              <div
                key={m.id}
                className="ozet-kart flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    {m.tur}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tarih(m.tarih)}
                    {m.aciklama ? ` · ${m.aciklama}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right font-extrabold tabular-nums text-red-600">
                  {paraTL(m.tutar)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Finans hareket detay */}
      {r.finansHareketler.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Finans Hareketleri
          </h2>

          {/* Masaüstü: tablo */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-xs font-semibold uppercase tracking-wide text-sky-100">
                <tr>
                  <th className="px-4 py-2.5">Tarih</th>
                  <th className="px-4 py-2.5">Tip</th>
                  <th className="px-4 py-2.5">Hesap</th>
                  <th className="px-4 py-2.5">Açıklama</th>
                  <th className="px-4 py-2.5 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {r.finansHareketler.map((h) => {
                  const tipLabel =
                    h.tip === "ODEME"
                      ? "Ödeme"
                      : h.tip === "TAHSILAT"
                        ? "Tahsilat"
                        : h.tip;
                  const tutarRenk =
                    h.tip === "TAHSILAT"
                      ? "text-emerald-500"
                      : h.tip === "ODEME"
                        ? "text-red-400"
                        : "";
                  return (
                    <tr
                      key={h.id}
                      className="transition-colors hover:bg-slate-700/30"
                    >
                      <td className="px-4 py-2.5 text-sky-100">
                        {tarih(h.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            h.tip === "TAHSILAT"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : h.tip === "ODEME"
                                ? "bg-red-900/60 text-red-300"
                                : "bg-slate-700 text-sky-100"
                          }`}
                        >
                          {tipLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-sky-100">
                        {h.hesap.ad}
                      </td>
                      <td className="px-4 py-2.5 text-sky-100">
                        {h.aciklama || "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-extrabold tabular-nums ${tutarRenk}`}
                      >
                        {paraTL(h.tutar)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil: kart listesi */}
          <div className="space-y-1.5 lg:hidden">
            {r.finansHareketler.map((h) => {
              const tipLabel =
                h.tip === "ODEME"
                  ? "Ödeme"
                  : h.tip === "TAHSILAT"
                    ? "Tahsilat"
                    : h.tip;
              const tutarRenk =
                h.tip === "TAHSILAT"
                  ? "text-emerald-500"
                  : h.tip === "ODEME"
                    ? "text-red-400"
                    : "";
              return (
                <div
                  key={h.id}
                  className="ozet-kart flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          h.tip === "TAHSILAT"
                            ? "bg-emerald-900/60 text-emerald-300"
                            : h.tip === "ODEME"
                              ? "bg-red-900/60 text-red-300"
                              : "bg-slate-700 text-sky-100"
                        }`}
                      >
                        {tipLabel}
                      </span>
                      <span className="text-sm font-medium">
                        {h.hesap.ad}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {tarih(h.createdAt)}
                      {h.aciklama ? ` · ${h.aciklama}` : ""}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-right font-extrabold tabular-nums ${tutarRenk}`}
                  >
                    {paraTL(h.tutar)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Toplu boş durum */}
      {r.alimAdet === 0 &&
        r.satisAdet === 0 &&
        r.masrafAdet === 0 &&
        r.finansHareketler.length === 0 && (
          <div className="ozet-kart py-8 text-center text-muted-foreground">
            <p className="text-lg font-bold">Bu tarih aralığında hareket yok.</p>
            <p className="mt-1 text-sm">
              Farklı bir tarih aralığı seçmeyi deneyin.
            </p>
          </div>
        )}
    </div>
  );
}
