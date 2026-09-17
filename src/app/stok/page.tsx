import { PageBaslik } from "@/components/page-baslik";
import { getStokOzet, getStokHareketleri } from "@/lib/queries";
import { kg, puan, tarihSaat } from "@/lib/format";
import { PackageOpen, Warehouse } from "lucide-react";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

const TIP_ETIKET: Record<string, string> = {
  ALIM_GIRIS: "Alım Giriş",
  SEVK_CIKIS: "Sevk Çıkış",
  TRANSFER: "Transfer",
  DUZELTME: "Düzeltme",
  MULKIYET_DONUSUM: "Mülkiyet Dönüşüm",
};

const MULKIYET_RENK: Record<string, string> = {
  KENDI: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  EMANET: "bg-orange-900/60 text-orange-200 border-orange-700",
};

export default async function StokPage() {
  await requirePagePermission("STOK", "GORUNTULE");
  const [ozet, hareketler] = await Promise.all([
    getStokOzet(),
    getStokHareketleri(undefined, 50),
  ]);

  const toplamKendi = ozet.reduce((s, o) => s + o.kendiKg, 0);
  const toplamEmanet = ozet.reduce((s, o) => s + o.emanetKg, 0);
  const toplamKg = toplamKendi + toplamEmanet;

  return (
    <div>
      {/* Mobil başlık */}
      <div className="md:hidden">
        <PageBaslik baslik="Stok Durumu" alt="Depo bazlı kg takibi · giriş / çıkış / transfer" geri="/" />
      </div>

      {/* Masaüstü başlık */}
      <div className="mb-4 hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Stok Durumu</h1>
          <p className="text-sm text-sky-100">Depo bazlı kg takibi · giriş / çıkış / transfer</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-sky-100">
          <Warehouse className="h-4 w-4" />
          <span>{ozet.length} aktif depo</span>
        </div>
      </div>

      {/* ═══ DEPO ÖZET KARTLARI ═══ */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Toplam stok */}
        <div className="rounded-2xl border border-[#f5c518]/40 bg-[#f5c518]/5 p-4">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-[#f5c518]" />
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">TOPLAM STOK</div>
          </div>
          <div className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-white">{kg(toplamKg)}</div>
          <div className="mt-0.5 text-xs text-sky-500">
            {ozet.length} depo · {kg(toplamKendi)} kendi + {kg(toplamEmanet)} emanet
          </div>
        </div>

        {ozet.map((d) => (
          <div key={d.depo} className="rounded-2xl border border-slate-800 bg-[#0a1830] p-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-sky-500" />
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-100">{d.depo}</div>
            </div>
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-sky-100">Kendi</span>
                <span className="font-bold tabular-nums text-white">{kg(d.kendiKg)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-sky-100">Emanet</span>
                <span className="font-bold tabular-nums text-white">{kg(d.emanetKg)}</span>
              </div>
            </div>
          </div>
        ))}

        {ozet.length === 0 && (
          <div className="col-span-full rounded-2xl border border-slate-800 bg-[#0a1830] px-5 py-10 text-center text-sm text-sky-500">
            Henüz depo tanımlanmamış.
          </div>
        )}
      </div>

      {/* ═══ MOBİL: hareket kart listesi ═══ */}
      <div className="space-y-2 md:hidden">
        {hareketler.map((h) => (
          <div key={h.id} className="ozet-kart flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xs font-bold text-sky-100">{TIP_ETIKET[h.tip] ?? h.tip}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${MULKIYET_RENK[h.mulkiyet] ?? "bg-slate-700 text-sky-100"}`}>
                  {h.mulkiyet === "KENDI" ? "Kendi" : "Emanet"}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-sky-100">
                {h.depo.ad} · {tarihSaat(h.createdAt)}
                {h.bolge ? ` · ${h.bolge}` : ""}
                {h.randimanPuan ? ` · R: ${puan(h.randimanPuan)}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold tabular-nums text-white">{kg(h.kg)}</div>
              {h.maliyetBirimTl ? (
                <div className="text-xs tabular-nums text-sky-100">
                  {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(h.maliyetBirimTl))}/kg
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {hareketler.length === 0 && (
          <div className="ozet-kart py-10 text-center text-sm text-sky-500">
            Henüz stok hareketi yok.
          </div>
        )}
      </div>

      {/* ═══ MASAÜSTÜ: stok hareketleri tablosu ═══ */}
      <div className="hidden rounded-2xl border border-slate-800 bg-[#0a1830] md:block">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <span className="text-sm font-bold text-sky-100">Son {hareketler.length} hareket</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
              <th className="px-5 py-2.5 font-bold">Tarih</th>
              <th className="px-3 py-2.5 font-bold">Depo</th>
              <th className="px-3 py-2.5 font-bold">Tip</th>
              <th className="px-3 py-2.5 font-bold">Mülkiyet</th>
              <th className="px-3 py-2.5 font-bold text-right">Kg</th>
              <th className="px-3 py-2.5 font-bold text-right">Puan</th>
              <th className="px-3 py-2.5 font-bold text-right">Maliyet/kg</th>
              <th className="px-5 py-2.5 font-bold">Kaynak/Bölge</th>
            </tr>
          </thead>
          <tbody>
            {hareketler.map((h) => (
              <tr key={h.id} className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40">
                <td className="px-5 py-3 text-xs tabular-nums text-sky-100">{tarihSaat(h.createdAt)}</td>
                <td className="px-3 py-3">
                  <span className="font-bold">{h.depo.ad}</span>
                </td>
                <td className="px-3 py-3 text-xs text-sky-100">{TIP_ETIKET[h.tip] ?? h.tip}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${MULKIYET_RENK[h.mulkiyet] ?? "bg-slate-700 text-sky-100"}`}>
                    {h.mulkiyet === "KENDI" ? "Kendi" : "Emanet"}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums">{kg(h.kg)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-100">
                  {h.randimanPuan ? puan(h.randimanPuan) : "—"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-100">
                  {h.maliyetBirimTl
                    ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(h.maliyetBirimTl))
                    : "—"}
                </td>
                <td className="px-5 py-3 text-xs text-sky-100">
                  {h.kaynakTipi ? `${h.kaynakTipi} ${h.kaynakId ? `· ${h.kaynakId.slice(0, 8)}` : ""}` : h.bolge ?? "—"}
                </td>
              </tr>
            ))}
            {hareketler.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-sky-500">
                  Henüz stok hareketi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
