import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { DurumRozet } from "@/components/rozetler";
import { kg, paraTL, tarihSaat, tarih } from "@/lib/format";
import { Plus, FileText } from "lucide-react";
import { FisDurumIslemleri } from "@/components/fis-durum-islemleri";
import { getCurrentFirmaId } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function SatisYonetimiPage() {
  const actor = await requirePagePermission("SATIS", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "SATIS", "OLUSTUR");
  const onayYetkisi = izinVar(actor, "SATIS", "ONAYLA");
  const iptalYetkisi = izinVar(actor, "SATIS", "IPTAL");
  const firmaId = await getCurrentFirmaId();
  const satislar = await prisma.satis.findMany({
    where: { firmaId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { cari: true },
  });

  return (
    <div>
      {/* Mobil başlık */}
      <div className="md:hidden">
        <PageBaslik
          baslik="Satış Yönetimi"
          alt="Müşteri · cins · miktar · fiyat"
          geri="/findik-islemleri"
        />
      </div>

      {/* Masaüstü başlık */}
      <div className="mb-4 hidden items-center justify-between md:flex">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--app-fg)]">Satış Yönetimi</h1>
          <p className="text-sm text-sky-100">Müşteri · cins · miktar · fiyat</p>
        </div>
        {olusturmaYetkisi && <Link
          href="/satis/yeni"
          className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2.5 text-sm font-extrabold text-[#0b1b3a] shadow-[0_2px_0_#7a5b08] transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Yeni Satış
        </Link>}
      </div>

      {/* Mobil aksiyon */}
      <div className="mb-4 md:hidden">
        {olusturmaYetkisi && <Link
          href="/satis/yeni"
          className="saha-btn w-full bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
        >
          <Plus className="h-5 w-5" /> Yeni Satış
        </Link>}
      </div>

      {/* ═══ MOBİL: kart listesi ═══ */}
      <div className="space-y-2 md:hidden">
        {satislar.map((s) => (
          <div key={s.id} className="ozet-kart flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-bold text-[var(--app-fg)]">{s.cari.ad}</span>
                <DurumRozet durum={s.durum} />
              </div>
              <div className="mt-0.5 text-xs text-sky-100">
                {s.fisNo} · {tarihSaat(s.tarih)} · {s.cins}
                {s.aciklama ? ` · ${s.aciklama}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold tabular-nums text-[var(--app-fg)]">{kg(Number(s.kg))}</div>
              <div className="text-xs tabular-nums text-sky-100">{paraTL(s.tutar)}</div>
              <Link href={`/satis/${s.id}/fis`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-filbert-300">
                <FileText className="h-3 w-3" /> Fiş
              </Link>
            </div>
            <FisDurumIslemleri fisId={s.id} durum={s.durum} tur="SATIS" onayYetkisi={onayYetkisi} iptalYetkisi={iptalYetkisi} />
          </div>
        ))}
        {satislar.length === 0 && (
          <div className="ozet-kart py-10 text-center text-sm text-sky-500">
            Henüz satış kaydı yok.
          </div>
        )}
      </div>

      {/* ═══ MASAÜSTÜ: veri tablosu ═══ */}
      <div className="hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] md:block">
        <div className="flex items-center border-b border-[var(--surface-border)] px-5 py-3">
          <span className="text-sm font-bold text-sky-100">Son {satislar.length} satış</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-left text-[10px] uppercase tracking-wider text-sky-500">
              <th className="px-5 py-2.5 font-bold">Fiş No</th>
              <th className="px-3 py-2.5 font-bold">Müşteri</th>
              <th className="px-3 py-2.5 font-bold">Cins</th>
              <th className="px-3 py-2.5 font-bold">Tarih</th>
              <th className="px-3 py-2.5 font-bold text-right">Net kg</th>
              <th className="px-3 py-2.5 font-bold text-right">Birim Fiyat</th>
              <th className="px-3 py-2.5 font-bold text-right">Tutar</th>
              <th className="px-5 py-2.5 font-bold">Durum</th>
              <th className="px-5 py-2.5 font-bold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {satislar.map((s) => (
              <tr
                key={s.id}
                className="border-b border-[var(--surface-border)] transition-colors hover:bg-slate-800/40"
              >
                <td className="px-5 py-3 text-xs tabular-nums text-sky-100">{s.fisNo}</td>
                <td className="px-3 py-3">
                  <span className="font-bold text-[var(--app-fg)]">{s.cari.ad}</span>
                </td>
                <td className="px-3 py-3 text-xs text-sky-100">{s.cins}</td>
                <td className="px-3 py-3 text-xs tabular-nums text-sky-100">{tarih(s.tarih)}</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--app-fg)]">
                  {kg(Number(s.kg))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-sky-100">
                  {paraTL(s.birimFiyat)}
                </td>
                <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#f5c518]">
                  {paraTL(s.tutar)}
                </td>
                <td className="px-5 py-3">
                  <DurumRozet durum={s.durum} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/satis/${s.id}/fis`} className="inline-flex h-11 items-center gap-1 rounded-lg bg-filbert-950/60 px-3 text-xs font-bold text-filbert-300">
                      <FileText className="h-3.5 w-3.5" /> Fiş
                    </Link>
                    <FisDurumIslemleri fisId={s.id} durum={s.durum} tur="SATIS" onayYetkisi={onayYetkisi} iptalYetkisi={iptalYetkisi} />
                  </div>
                </td>
              </tr>
            ))}
            {satislar.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-sky-500">
                  Henüz satış kaydı yok — ilk satışı + butonuyla girin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
