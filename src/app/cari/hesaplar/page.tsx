import Link from "next/link";
import { PageBaslik } from "@/components/page-baslik";
import { BakiyeRozet } from "@/components/rozetler";
import { getCariler, getTumCariBakiyeler } from "@/lib/queries";
import { ChevronRight, Star } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { CariBosDurum, CariDuzenleButonu, YeniCariButonu } from "@/components/cari-kart-kontrolleri";

export const dynamic = "force-dynamic";

const TUR_ETIKET: Record<string, string> = { URETICI: "Üretici", TUCCAR: "Tüccar", FABRIKA: "Fabrika" };

export default async function CariHesaplarPage({ searchParams }: { searchParams: Promise<{ q?: string; tur?: string }> }) {
  const actor = await requirePagePermission("CARI", "GORUNTULE");
  const cariOlusturYetkisi = izinVar(actor, "CARI", "OLUSTUR");
  const cariGuncelleYetkisi = izinVar(actor, "CARI", "GUNCELLE");
  const { q, tur } = await searchParams;
  const [cariler, bakiyeler] = await Promise.all([
    getCariler(tur as "URETICI" | undefined, q, cariGuncelleYetkisi ? "TUMU" : true),
    getTumCariBakiyeler(),
  ]);

  return (
    <div>
      {/* Mobil başlık */}
      <div className="md:hidden">
        <PageBaslik baslik="Cari Hesaplar" alt={`${cariler.length} kayıt`} geri="/cari" />
      </div>

      {/* Masaüstü başlık */}
      <div className="mb-4 hidden md:block">
        <h1 className="text-xl font-extrabold tracking-tight">Cari Hesaplar</h1>
        <p className="text-sm text-sky-100">Üretici, tüccar ve fabrika kartları · çoklu bakiye</p>
      </div>

      <div className="mb-3 flex gap-2">
        <form className="relative flex min-w-0 flex-1 items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="İsim veya bölge ara..."
            className="saha-input flex-1"
          />
          {tur && <input type="hidden" name="tur" value={tur} />}
          <button
            type="submit"
            className="saha-btn shrink-0 bg-[var(--primary)] px-5 font-bold text-white shadow-xs"
          >
            Ara
          </button>
        </form>
        <YeniCariButonu yetkili={cariOlusturYetkisi} />
      </div>

      <div className="mb-3 flex gap-2 text-sm font-semibold overflow-x-auto pb-1">
        {[undefined, "URETICI", "TUCCAR", "FABRIKA"].map((t) => (
          <Link
            key={t ?? "hepsi"}
            href={{ query: { q, tur: t } }}
            className={`rounded-full px-3.5 py-1.5 transition-colors shrink-0 ${
              tur === t || (!tur && !t)
                ? "bg-[var(--primary)] font-bold text-white shadow-xs"
                : "border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--app-fg)] hover:border-[var(--primary)]"
            }`}
          >
            {t ? TUR_ETIKET[t] : "Tümü"}
          </Link>
        ))}
      </div>

      {cariler.length === 0 && <CariBosDurum yetkili={cariOlusturYetkisi} />}

      {/* ═══ MOBİL: kart listesi ═══ */}
      <div className="space-y-2 md:hidden">
        {cariler.map((c) => {
          const b = bakiyeler.get(c.id) ?? {};
          return (
            <div key={c.id} className="ozet-kart hover-kaldir flex items-center gap-3">
              <Link href={`/cari/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {c.favori && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  <span className="truncate font-bold">{c.ad}</span>
                  {!c.aktif && <span className="rounded-full border border-amber-300/50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-100">PASİF</span>}
                  </div>
                  <div className="text-xs text-sky-100">{TUR_ETIKET[c.tur]} {c.bolge ? `· ${c.bolge}` : ""}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(b).map(([t, tutar]) => <BakiyeRozet key={t} tur={t} tutar={tutar ?? 0} />)}
                  </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1"><CariDuzenleButonu kayit={c} yetkili={cariGuncelleYetkisi} /><ChevronRight className="h-4 w-4 text-sky-500" /></div>
            </div>
          );
        })}
      </div>

      {/* ═══ MASAÜSTÜ: tablo ═══ */}
      <div className="hidden rounded-2xl border border-slate-800 bg-[#0a1830] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
              <th className="px-5 py-2.5 font-bold">Cari</th>
              <th className="px-3 py-2.5 font-bold">Tür</th>
              <th className="px-3 py-2.5 font-bold">Bölge</th>
              <th className="px-3 py-2.5 font-bold">Bakiyeler</th>
              <th className="px-5 py-2.5 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {cariler.map((c) => {
              const b = bakiyeler.get(c.id) ?? {};
              return (
                <tr key={c.id} className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <Link href={`/cari/${c.id}`} className="flex items-center gap-1.5 font-bold hover:text-[#f5c518]">
                      {c.favori && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                      {c.ad}
                      {!c.aktif && <span className="rounded-full border border-amber-300/50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-100">PASİF</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-sky-100">{TUR_ETIKET[c.tur]}</td>
                  <td className="px-3 py-3 text-xs text-sky-100">{c.bolge ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(b).map(([t, tutar]) => <BakiyeRozet key={t} tur={t} tutar={tutar ?? 0} />)}
                      {Object.keys(b).length === 0 && <span className="text-xs text-sky-500">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-2"><CariDuzenleButonu kayit={c} yetkili={cariGuncelleYetkisi} /><Link href={`/cari/${c.id}`} className="text-xs font-bold text-[#f5c518]">Detay →</Link></span>
                  </td>
                </tr>
              );
            })}
            {cariler.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-sky-500">Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
