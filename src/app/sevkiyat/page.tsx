import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { kg, tarih, tarihSaat } from "@/lib/format";
import { Plus, Truck, FileText } from "lucide-react";
import { SevkiyatDurumIslemleri } from "@/components/sevkiyat-durum-islemleri";
import { getCurrentFirmaId } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DURUM_SIRASI: Record<string, number> = {
  FABRIKA_EMANET: 0,
  SATILDI: 1,
  IPTAL: 2,
};

// Kapalı-devre sevkiyat durum rozeti (Fabrika Emanet / Satıldı / İptal)
function SevkiyatDurumRozet({ durum }: { durum: string }) {
  const map: Record<string, { etiket: string; sinif: string }> = {
    FABRIKA_EMANET: { etiket: "Fabrika Emanet", sinif: "bg-amber-900/70 text-amber-200" },
    SATILDI: { etiket: "Satıldı", sinif: "bg-emerald-900/70 text-emerald-200" },
    IPTAL: { etiket: "İptal", sinif: "bg-red-900/70 text-red-200" },
  };
  const d = map[durum] ?? { etiket: durum, sinif: "bg-slate-700 text-sky-100" };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", d.sinif)}>{d.etiket}</span>;
}

export default async function SevkiyatPage() {
  const actor = await requirePagePermission("SEVKIYAT", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "SEVKIYAT", "OLUSTUR");
  const guncelleYetkisi = izinVar(actor, "SEVKIYAT", "GUNCELLE");
  const iptalYetkisi = izinVar(actor, "SEVKIYAT", "IPTAL");
  const firmaId = await getCurrentFirmaId();
  const sevkiyatlar = await prisma.sevkiyat.findMany({
    where: { firmaId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      cari: true,
      arac: true,
      kalemler: { include: { depo: true } },
      satisler: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  // Toplam kg hesapla ve durum sıralaması yap
  const withTotal = sevkiyatlar.map((s) => ({
    ...s,
    toplamKg: s.kalemler.reduce((sum, k) => sum + Number(k.kg), 0),
  }));

  // Önce durum sırasına göre, sonra tarihe göre sırala
  withTotal.sort(
    (a, b) =>
      (DURUM_SIRASI[a.durum] ?? 99) - (DURUM_SIRASI[b.durum] ?? 99) ||
      new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
  );

  return (
    <div>
      {/* Mobil başlık */}
      <div className="md:hidden">
        <PageBaslik baslik="Sevkiyat" alt="Fabrika sevkı · emanet · satış" geri="/findik-islemleri" />
      </div>

      {/* Masaüstü başlık */}
      <div className="mb-4 hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Sevkiyat</h1>
          <p className="text-sm text-sky-100">Fabrika sevkı · emanet · satış</p>
        </div>
        {olusturmaYetkisi && <Link
          href="/sevk-yeni"
          className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2.5 text-sm font-extrabold text-[#0b1b3a] shadow-[0_2px_0_#7a5b08] transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Yeni Sevkiyat
        </Link>}
      </div>

      {/* Mobil aksiyonlar */}
      <div className="mb-4 md:hidden">
        {olusturmaYetkisi && <Link
          href="/sevk-yeni"
          className="saha-btn w-full bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
        >
          <Plus className="h-5 w-5" /> Yeni Sevkiyat
        </Link>}
      </div>

      {/* ═══ MOBIL: kart listesi ═══ */}
      <div className="space-y-2 md:hidden">
        {withTotal.map((s) => (
          <div key={s.id} className="ozet-kart">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold">{s.cari?.ad ?? "—"}</span>
                  <SevkiyatDurumRozet durum={s.durum} />
                </div>
                <div className="mt-0.5 text-xs text-sky-100">
                  {s.fisNo} · {tarihSaat(s.tarih)}
                </div>
                <div className="mt-0.5 text-xs text-sky-100">
                  {s.plaka || "—"}{s.sofor ? ` · ${s.sofor}` : ""}
                </div>
                {s.aciklama && (
                  <div className="mt-1 text-xs text-sky-500 line-clamp-1">{s.aciklama}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-1 font-extrabold tabular-nums">
                  <Truck className="h-3.5 w-3.5 text-sky-100" />
                  {kg(s.toplamKg)}
                </div>
                {s.durum === "SATILDI" && s.satisler[0] && (
                  <Link
                    href={`/satis/${s.satisler[0].id}/fis`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-filbert-300"
                  >
                    <FileText className="h-3 w-3" /> Fiş
                  </Link>
                )}
              </div>
            </div>
            {/* Kalem özeti */}
            {s.kalemler.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-700/50 pt-2">
                {s.kalemler.map((k) => (
                  <span
                    key={k.id}
                    className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-sky-100"
                  >
                    {k.depo?.ad ?? "—"} · {kg(k.kg)}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-slate-700/50 pt-2">
              <SevkiyatDurumIslemleri sevkiyatId={s.id} durum={s.durum} kgDeger={s.toplamKg} fisNo={s.fisNo ?? ""} guncelleYetkisi={guncelleYetkisi} iptalYetkisi={iptalYetkisi} />
            </div>
          </div>
        ))}

        {withTotal.length === 0 && (
          <div className="py-10 text-center text-sm text-sky-500">
            Henüz sevkiyat yok — + butonuyla ilk sevkiyatı oluşturun.
          </div>
        )}
      </div>

      {/* ═══ MASAUSTU: defter tablosu ═══ */}
      <div className="hidden rounded-2xl border border-slate-800 bg-[#0a1830] md:block">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <span className="text-sm font-bold text-sky-100">Son {withTotal.length} sevkiyat</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
              <th className="px-5 py-2.5 font-bold">Fiş No</th>
              <th className="px-3 py-2.5 font-bold">Fabrika</th>
              <th className="px-3 py-2.5 font-bold">Plaka</th>
              <th className="px-3 py-2.5 font-bold">Şoför</th>
              <th className="px-3 py-2.5 font-bold">Tarih</th>
              <th className="px-3 py-2.5 font-bold">Kalem</th>
              <th className="px-3 py-2.5 font-bold text-right">Toplam kg</th>
              <th className="px-5 py-2.5 font-bold">Durum</th>
              <th className="px-5 py-2.5 font-bold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {withTotal.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40"
              >
                <td className="px-5 py-3 text-xs tabular-nums text-sky-100">{s.fisNo}</td>
                <td className="px-3 py-3 text-xs font-bold">{s.cari?.ad ?? "—"}</td>
                <td className="px-3 py-3 text-xs text-sky-100">{s.plaka || "—"}</td>
                <td className="px-3 py-3 text-xs text-sky-100">{s.sofor || "—"}</td>
                <td className="px-3 py-3 text-xs tabular-nums text-sky-100">{tarih(s.tarih)}</td>
                <td className="px-3 py-3 text-xs text-sky-100">
                  {s.kalemler.map((k) => `${k.depo?.ad ?? "—"}: ${kg(k.kg)}`).join(", ")}
                </td>
                <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#f5c518]">
                  {kg(s.toplamKg)}
                </td>
                <td className="px-5 py-3">
                  <SevkiyatDurumRozet durum={s.durum} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.durum === "SATILDI" && s.satisler[0] && (
                      <Link
                        href={`/satis/${s.satisler[0].id}/fis`}
                        className="inline-flex h-11 items-center gap-1 rounded-lg bg-filbert-950/60 px-3 text-xs font-bold text-filbert-300"
                      >
                        <FileText className="h-3.5 w-3.5" /> Fiş
                      </Link>
                    )}
                    <SevkiyatDurumIslemleri sevkiyatId={s.id} durum={s.durum} kgDeger={s.toplamKg} fisNo={s.fisNo ?? ""} guncelleYetkisi={guncelleYetkisi} iptalYetkisi={iptalYetkisi} />
                  </div>
                </td>
              </tr>
            ))}
            {withTotal.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-sky-500">
                  Henüz sevkiyat yok — + Yeni Sevkiyat butonuyla başlayın.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
