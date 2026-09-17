import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { DurumRozet } from "@/components/rozetler";
import { kg, paraTL, puan, tarihSaat, tarih } from "@/lib/format";
import { Plus, Calculator, ArrowRight } from "lucide-react";
import { FisDurumIslemleri } from "@/components/fis-durum-islemleri";
import { getCurrentFirmaId } from "@/lib/auth";
import { bekleyenRandimanSayisi } from "@/lib/queries";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function AlimYonetimiPage() {
  const actor = await requirePagePermission("ALIM", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "ALIM", "OLUSTUR");
  const randimanYetkisi = izinVar(actor, "RANDIMAN", "GORUNTULE");
  const onayYetkisi = izinVar(actor, "ALIM", "ONAYLA");
  const iptalYetkisi = izinVar(actor, "ALIM", "IPTAL");
  const firmaId = await getCurrentFirmaId();
  const [bekleyenRandiman, fisler] = await Promise.all([
    bekleyenRandimanSayisi(firmaId),
    prisma.alimFisi.findMany({
      where: { cari: { firmaId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { cari: true },
    }),
  ]);

  return (
    <div>
      {/* Mobil başlık */}
      <div className="md:hidden">
        <PageBaslik baslik="Alım Yönetimi" alt="Müşteri · miktar · fiyat · kalite — tek işlemde" geri="/findik-islemleri" />
      </div>

      {/* Masaüstü başlık */}
      <div className="mb-4 hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Alım Yönetimi</h1>
          <p className="text-sm text-sky-100">Müşteri · miktar · fiyat · kalite — tek işlemde</p>
        </div>
        {olusturmaYetkisi && <Link href="/alim/yeni" className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2.5 text-sm font-extrabold text-[#0b1b3a] shadow-[0_2px_0_#7a5b08] transition-transform duration-150 ease-out active:scale-[0.97]">
          <Plus className="h-4 w-4" /> Yeni Alım Fişi
        </Link>}
      </div>

      {/* Mobil aksiyonlar */}
      <div className="mb-4 space-y-2.5 md:hidden">
        {olusturmaYetkisi && <Link href="/alim/yeni" className="saha-btn w-full bg-filbert-600 text-white shadow-lg shadow-filbert-600/30">
          <Plus className="h-5 w-5" /> Yeni Alım Fişi
        </Link>}
        {randimanYetkisi && <Link
          href="/randiman"
          className={`saha-btn w-full py-3 text-sm text-white ${bekleyenRandiman > 0 ? "bg-amber-500" : "bg-slate-700"}`}
        >
          <Calculator className="h-5 w-5" />
          Randıman Kuyruğu ({bekleyenRandiman})
        </Link>}
      </div>

      {/* ═══ MOBİL: kart listesi ═══ */}
      <div className="space-y-2 md:hidden">
        {fisler.map((f) => (
          <div key={f.id} className="ozet-kart flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-bold">{f.cari.ad}</span>
                <DurumRozet durum={f.durum} />
                <DurumRozet durum={f.randimanDurumu} />
                {f.mulkiyetKaynak === "EMANET" && (
                  <span className="rounded-full bg-orange-900/50 px-2.5 py-0.5 text-xs font-bold text-orange-200">Emanet</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-sky-100">
                {f.fisNo} · {tarihSaat(f.tarih)} · {f.bolge ?? "—"}
                {f.randimanPuan ? ` · R: ${puan(f.randimanPuan)}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold tabular-nums">{kg(f.kg)}</div>
              <div className="text-xs tabular-nums text-sky-100">{paraTL(f.tutar)}</div>
            </div>
            <FisDurumIslemleri fisId={f.id} durum={f.durum} tur="ALIM" onayYetkisi={onayYetkisi} iptalYetkisi={iptalYetkisi} />
            <div className="flex flex-col gap-0.5 text-[10px] font-bold">
              <Link href={`/alim/${f.id}/etiket`} className="text-filbert-300 hover:text-filbert-200">Etiket</Link>
              <Link href={`/alim/${f.id}/fis`} className="text-filbert-300 hover:text-filbert-200">Fiş</Link>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MASAÜSTÜ: defter tablosu ═══ */}
      <div className="hidden rounded-2xl border border-slate-800 bg-[#0a1830] md:block">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <span className="text-sm font-bold text-sky-100">Son {fisler.length} fiş</span>
          {randimanYetkisi && <Link href="/randiman" className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${bekleyenRandiman > 0 ? "bg-amber-500/15 text-amber-400" : "text-sky-100"}`}>
            <Calculator className="h-3.5 w-3.5" />
            Randıman Kuyruğu ({bekleyenRandiman})
            <ArrowRight className="h-3 w-3" />
          </Link>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
              <th className="px-5 py-2.5 font-bold">Fiş No</th>
              <th className="px-3 py-2.5 font-bold">Üretici</th>
              <th className="px-3 py-2.5 font-bold">Bölge</th>
              <th className="px-3 py-2.5 font-bold">Tarih</th>
              <th className="px-3 py-2.5 font-bold text-right">Net kg</th>
              <th className="px-3 py-2.5 font-bold text-right">Randıman</th>
              <th className="px-3 py-2.5 font-bold text-right">Birim Fiyat</th>
              <th className="px-3 py-2.5 font-bold text-right">Tutar</th>
              <th className="px-5 py-2.5 font-bold">Durum</th>
              <th className="px-5 py-2.5 font-bold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {fisler.map((f) => (
              <tr key={f.id} className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40">
                <td className="px-5 py-3 text-xs tabular-nums text-sky-100">{f.fisNo}</td>
                <td className="px-3 py-3">
                  <span className="font-bold">{f.cari.ad}</span>
                  {f.mulkiyetKaynak === "EMANET" && (
                    <span className="ml-2 rounded-full bg-orange-900/50 px-2 py-0.5 text-[10px] font-bold text-orange-200">Emanet</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-sky-100">{f.bolge ?? "—"}</td>
                <td className="px-3 py-3 text-xs tabular-nums text-sky-100">{tarih(f.tarih)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums">{kg(f.kg)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-100">{f.randimanPuan ? puan(f.randimanPuan) : "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-100">{paraTL(f.birimFiyat)}</td>
                <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#f5c518]">{paraTL(f.tutar)}</td>
                <td className="px-5 py-3"><div className="flex flex-wrap gap-1"><DurumRozet durum={f.durum} /><DurumRozet durum={f.randimanDurumu} /></div></td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <FisDurumIslemleri fisId={f.id} durum={f.durum} tur="ALIM" onayYetkisi={onayYetkisi} iptalYetkisi={iptalYetkisi} />
                    <Link href={`/alim/${f.id}/etiket`} className="text-xs font-bold text-filbert-300 hover:text-filbert-200">Etiket</Link>
                    <Link href={`/alim/${f.id}/fis`} className="text-xs font-bold text-filbert-300 hover:text-filbert-200">Fiş</Link>
                  </div>
                </td>
              </tr>
            ))}
            {fisler.length === 0 && (
              <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-sky-500">Henüz fiş yok — ilk alımı + butonuyla kesin.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
