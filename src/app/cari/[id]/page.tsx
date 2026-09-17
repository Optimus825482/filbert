import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { BakiyeRozet } from "@/components/rozetler";
import { getCariBakiyeler, getCariEmanetleri, getCariFabrikaEmanetleri } from "@/lib/queries";
import { kg, paraBirim, puan, tarih, tarihSaat } from "@/lib/format";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { YazdirBaslat } from "@/components/yazdir-baslat";
import { EmanetMuhasebelestirButonu, SevkiyatMuhasebelestirButonu } from "./emanet-islemleri";

export const dynamic = "force-dynamic";

const KAYNAK_ETIKET: Record<string, string> = {
  ALIM: "Alım", EMANET_BOZMA: "Emanet Bozma", AVANS: "Avans",
  ODEME: "Ödeme", TAHSILAT: "Tahsilat", MASRAF: "Masraf",
  SATIS: "Satış", ACILIS: "Açılış",
};

export default async function CariDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("CARI", "GORUNTULE");
  const finansOlustur = izinVar(actor, "FINANS", "OLUSTUR");
  const avansOlustur = izinVar(actor, "AVANS", "OLUSTUR");
  const emanetGuncelle = izinVar(actor, "EMANET", "GUNCELLE");
  const sevkiyatGuncelle = izinVar(actor, "SEVKIYAT", "GUNCELLE");
  const { id } = await params;
  const cari = await prisma.cariKart.findFirst({ where: { id, firmaId: actor.firmaId } });
  if (!cari) notFound();
  const bakiyeler = await getCariBakiyeler(cari.id);
  const hareketler = await prisma.cariHareket.findMany({
    where: { cariId: cari.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const emanetler = cari.tur === "URETICI" ? await getCariEmanetleri(cari.id) : [];
  const fabrikaEmanetleri = cari.tur === "FABRIKA" ? await getCariFabrikaEmanetleri(cari.id) : [];

  return (
    <div>
      <div className="no-print"><PageBaslik baslik={cari.ad} alt={(cari.tur === "URETICI" ? "Üretici" : cari.tur === "TUCCAR" ? "Tüccar" : "Fabrika") + " · " + (cari.bolge ?? "—")} geri="/cari/hesaplar" /></div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        {Object.entries(bakiyeler).map(([tur, tutar]) => <BakiyeRozet key={tur} tur={tur} tutar={tutar ?? 0} />)}
      </div>

      {cari.tur === "URETICI" && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-orange-500">Emanet Fındıkları</h2>
          {emanetler.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 px-4 py-3 text-sm font-semibold text-sky-100">Açık emanet kaydı yok.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0a1830]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-orange-500">
                  <th className="px-4 py-2.5 font-bold">Tarih</th><th className="px-3 py-2.5 font-bold">Fiş No</th>
                  <th className="px-3 py-2.5 font-bold">Satın Alma Kodu</th>
                  <th className="px-3 py-2.5 text-right font-bold">Kalan Kg</th>
                  <th className="px-3 py-2.5 text-right font-bold">Randıman</th>
                  {emanetGuncelle && <th className="px-4 py-2.5 text-right font-bold">İşlem</th>}</tr></thead>
                <tbody>{emanetler.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-xs tabular-nums text-sky-100">{tarih(e.tarih)}</td>
                    <td className="px-3 py-3 text-xs text-sky-100">{e.fisNo ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-sky-100">{e.satinAlmaKodu ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-orange-400">{kg(e.kalanKg)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-sky-100">{e.randimanPuan === null ? "—" : puan(e.randimanPuan)}</td>
                    {emanetGuncelle && <td className="px-4 py-3 text-right"><EmanetMuhasebelestirButonu emanetId={e.id} kalanKg={e.kalanKg} /></td>}
                  </tr>))}
              </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {cari.tur === "FABRIKA" && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-orange-500">Fabrika Emaneti</h2>
          {fabrikaEmanetleri.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 px-4 py-3 text-sm font-semibold text-sky-100">Fabrika emanetinde sevkiyat yok.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0a1830]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-orange-500">
                  <th className="px-4 py-2.5 font-bold">Tarih</th><th className="px-3 py-2.5 font-bold">Fiş No</th>
                  <th className="px-3 py-2.5 font-bold">Plaka</th>
                  <th className="px-3 py-2.5 text-right font-bold">Kg</th>
                  <th className="px-3 py-2.5 text-right font-bold">Randıman</th>
                  {sevkiyatGuncelle && <th className="px-4 py-2.5 text-right font-bold">İşlem</th>}</tr></thead>
                <tbody>{fabrikaEmanetleri.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-xs tabular-nums text-sky-100">{tarih(s.tarih)}</td>
                    <td className="px-3 py-3 text-xs text-sky-100">{s.fisNo ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-sky-100">{s.plaka ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-orange-400">{kg(s.kg)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-sky-100">{s.randimanPuan === null ? "—" : puan(s.randimanPuan)}</td>
                    {sevkiyatGuncelle && <td className="px-4 py-3 text-right"><SevkiyatMuhasebelestirButonu sevkiyatId={s.id} kg={s.kg} /></td>}
                  </tr>))}
              </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="hidden rounded-2xl border border-slate-800 bg-[#0a1830] md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
            <th className="px-4 py-2.5 font-bold">Tarih</th><th className="px-3 py-2.5 font-bold">İşlem</th>
            <th className="px-3 py-2.5 font-bold">Yön</th><th className="px-3 py-2.5 text-right font-bold">Tutar</th>
            <th className="px-4 py-2.5 font-bold">Açıklama</th></tr></thead>
          <tbody>{hareketler.map((h) => (
            <tr key={h.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
              <td className="px-4 py-3 text-xs tabular-nums text-sky-100">{tarihSaat(h.createdAt)}</td>
              <td className="px-3 py-3 text-xs text-sky-100">{KAYNAK_ETIKET[h.kaynakTipi ?? ""] ?? h.kaynakTipi ?? "—"}</td>
              <td className={"px-3 py-3 text-xs font-bold " + (h.yon === "BORC" ? "text-red-400" : "text-emerald-400")}>{h.yon === "BORC" ? "BORÇ" : "ALACAK"}</td>
              <td className="px-3 py-3 text-right tabular-nums">{paraBirim(h.tutar, h.bakiyeTuru)}</td>
              <td className="px-4 py-3 text-xs text-sky-100">{h.aciklama ?? "—"}</td>
            </tr>))}
          </tbody>
        </table>
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        {finansOlustur && <span className="rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-bold text-sky-100">Ödeme/Tahsilat yetkisi</span>}
        {avansOlustur && <span className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-amber-100">Avans yetkisi</span>}
      </div>
      <div className="no-print mt-6">
        <YazdirBaslat etiket="Ekstreyi Yazdır" />
      </div>
    </div>
  );
}
