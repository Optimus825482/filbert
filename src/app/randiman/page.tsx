import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { DurumRozet } from "@/components/rozetler";
import { kg, paraTL, puan as fmtPuan, tarihSaat, CINS_ETIKET } from "@/lib/format";
import { CheckCircle2, Clock, Calculator } from "lucide-react";
import { BekleyenRandimanlar } from "@/app/randiman/bekleyen-randimanlar";
import { getCurrentFirmaId } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function RandimanPage() {
  const actor = await requirePagePermission("RANDIMAN", "GORUNTULE");
  const guncelleYetkisi = izinVar(actor, "RANDIMAN", "GUNCELLE");
  const firmaId = await getCurrentFirmaId();
  const [bekleyenler, sonTamam] = await Promise.all([
    prisma.alimFisi.findMany({
      where: { randimanDurumu: "BEKLIYOR", durum: { not: "IPTAL" }, cari: { firmaId } },
      include: { cari: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.alimFisi.findMany({
      where: { randimanDurumu: "TAMAM", cari: { firmaId } },
      include: { cari: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <PageBaslik baslik="Randiman Takibi" alt="Bekleyen ve tamamlanan randimanlar" geri="/findik-islemleri" />

      {/* Bekleyenler — client component (form aci/kapa state yonetir) */}
      <section className="mb-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.14em] text-sky-100">
          <Clock className="h-4 w-4" /> BEKLEYEN ({bekleyenler.length})
        </h2>

        {bekleyenler.length === 0 && (
          <div className="ozet-kart flex items-center gap-2 text-sm text-sky-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Randiman bekleyen fis yok.
          </div>
        )}

        {bekleyenler.length > 0 && (
          <BekleyenRandimanlar
            guncelleYetkisi={guncelleYetkisi}
            fisler={bekleyenler.map((f) => ({
              id: f.id,
              fisNo: f.fisNo,
              cariAd: f.cari.ad,
              cins: f.cins,
              tarih: f.tarih.toISOString(),
              kg: Number(f.kg),
              birimFiyat: f.birimFiyat === null ? null : Number(f.birimFiyat),
              bolge: f.bolge,
            }))}
          />
        )}
      </section>

      {/* Tamamlananlar — salt okunur, sunucuda render */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.14em] text-sky-100">
          <Calculator className="h-4 w-4" /> SON TAMAMLANANLAR
        </h2>
        <div className="space-y-2">
          {sonTamam.length === 0 && (
            <div className="ozet-kart text-sm text-sky-100">Henuz tamamlanmis randiman yok.</div>
          )}
          {sonTamam.map((f) => (
            <div key={f.id} className="ozet-kart flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{f.cari.ad}</span>
                  <DurumRozet durum="TAMAM" />
                </div>
                <div className="text-xs text-sky-100">
                  {f.fisNo} · {tarihSaat(f.tarih)} · {f.bolge ?? "—"} · {CINS_ETIKET[f.cins] ?? f.cins}
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold tabular-nums">{fmtPuan(f.randimanPuan ? Number(f.randimanPuan) : null)}</div>
                <div className="text-xs text-sky-100">{kg(f.kg)}</div>
                <div className="text-xs text-filbert-400 font-bold">
                  {paraTL(f.birimFiyat)}/kg
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
