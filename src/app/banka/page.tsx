import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { paraBirim, tarihSaat } from "@/lib/format";
import { Banknote, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { getCurrentFirmaId } from "@/lib/auth";
import { getHesapBakiyeleri } from "@/lib/queries";
import { FinansTersKayit } from "@/components/finans-ters-kayit";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

function hesapEtkisi(h: { tip: string; tutar: unknown }) {
  const tutar = Number(h.tutar);
  if (h.tip === "VIRMAN") return tutar;
  return h.tip === "TAHSILAT" ? tutar : -tutar;
}

export default async function BankaPage() {
  await requirePagePermission("FINANS", "GORUNTULE");
  const firmaId = await getCurrentFirmaId();
  const [hesaplar, hareketler, tamBakiye] = await Promise.all([
    prisma.kasaHesap.findMany({ where: { firmaId, aktif: true, tip: "BANKA" }, orderBy: { ad: "asc" } }),
    prisma.finansHareket.findMany({
      where: { hesap: { firmaId, tip: "BANKA" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { hesap: true },
    }),
    // Bakiye veritabanında toplanır; tüm defter satırlarını çekmez.
    getHesapBakiyeleri("BANKA"),
  ]);

  return (
    <div>
      <PageBaslik baslik="Banka İşlemleri" alt="Havale ve EFT hareketleri" geri="/finans" />

      {hesaplar.length === 0 ? (
        <div className="ozet-kart text-sm text-sky-100">Henüz banka hesabı tanımlı değil.</div>
      ) : (
        <section className="mb-4 space-y-2">
          {hesaplar.map((h) => {
            const b = tamBakiye.get(h.id);
            return (
              <div key={h.id} className="ozet-kart flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-900/50 text-sky-300">
                  <Banknote className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="tr-value">{h.ad}</div>
                  <div className="tr-muted">{h.bankaAdi ?? "—"} · {h.bakiyeTuru}</div>
                </div>
                <div className="text-right">
                  <div className="tr-value text-sky-300">{b ? paraBirim(b.tutar, b.tur) : "—"}</div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <h2 className="mb-2 text-[11px] font-extrabold tracking-[0.14em] text-sky-100">SON HAREKETLER</h2>
      <div className="space-y-1.5">
        {hareketler.map((h) => {
          const cikis = hesapEtkisi(h) < 0;
          return <div key={h.id} className="ozet-kart flex items-center gap-3 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cikis ? "bg-orange-900/50 text-orange-300" : "bg-emerald-900/50 text-emerald-300"}`}>
              {cikis ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{h.aciklama ?? (h.tip === "ODEME" ? "Ödeme" : h.tip === "VIRMAN" ? "Virman" : "Tahsilat")}</div>
              <div className="text-xs text-sky-100">{tarihSaat(h.createdAt)} · {h.hesap.ad}</div>
            </div>
            <div className="font-extrabold tabular-nums">
              {cikis ? "-" : "+"}{paraBirim(Math.abs(hesapEtkisi(h)), h.bakiyeTuru)}
            </div>
            <FinansTersKayit finansId={h.id} tersKayitMi={h.iliskiliTipi === "TERS_KAYIT"} />
          </div>;
        })}
        {hareketler.length === 0 && <div className="ozet-kart text-sm text-sky-100">Henüz hareket yok.</div>}
      </div>
    </div>
  );
}
