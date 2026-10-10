import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { paraBirim, tarihSaat } from "@/lib/format";
import { Wallet, ArrowDownLeft, ArrowUpRight, Package } from "lucide-react";
import { getCurrentFirmaId } from "@/lib/auth";
import { getHesapBakiyeleri, getModulHesapBakiyeleri } from "@/lib/queries";
import { FinansTersKayit } from "@/components/finans-ters-kayit";
import { requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

function hesapEtkisi(h: { tip: string; tutar: unknown }) {
  const tutar = Number(h.tutar);
  if (h.tip === "VIRMAN") return tutar;
  return h.tip === "TAHSILAT" ? tutar : -tutar;
}

export default async function KasaPage() {
  await requirePagePermission("FINANS", "GORUNTULE");
  const firmaId = await getCurrentFirmaId();
  const [hesaplar, islemeHesaplari, hareketler, tamBakiye, islemeBakiyeleri] = await Promise.all([
    // Alım modülünün kendi kasa hesapları.
    prisma.kasaHesap.findMany({ where: { firmaId, aktif: true, tip: "KASA", modul: "ALIM" }, orderBy: { ad: "asc" } }),
    // İşleme kasası bu ekranda yalnızca görüntülenir; yönetimi işleme modülündedir.
    prisma.kasaHesap.findMany({ where: { firmaId, aktif: true, modul: "ISLEME" }, orderBy: { ad: "asc" } }),
    prisma.finansHareket.findMany({
      where: { hesap: { firmaId, tip: "KASA" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { hesap: true },
    }),
    // Bakiye veritabanında toplanır; tüm defter satırlarını çekmez.
    getHesapBakiyeleri("KASA"),
    getModulHesapBakiyeleri("ISLEME"),
  ]);

  return (
    <div>
      <PageBaslik baslik="Kasa Hareketleri" alt="Tahsilat ve ödeme sonrası bakiye" geri="/finans" />

      {hesaplar.length === 0 ? (
        <div className="ozet-kart text-sm text-sky-100">Henüz kasa hesabı tanımlı değil.</div>
      ) : (
        <section className="mb-4 space-y-2">
          {hesaplar.map((h) => {
            const b = tamBakiye.get(h.id);
            return (
              <div key={h.id} className="ozet-kart flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-900/50 text-emerald-300">
                  <Wallet className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="tr-value">{h.ad}</div>
                  <div className="tr-muted">{h.bakiyeTuru}</div>
                </div>
                <div className="text-right">
                  <div className="tr-value text-emerald-300">{b ? paraBirim(b.tutar, b.tur) : "—"}</div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* İşleme kasası: alım modülünde görüntülenir, işleme modülünde yönetilir. */}
      {islemeHesaplari.length > 0 && (
        <section className="mb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-extrabold tracking-[0.14em] text-sky-100">FINDIK İŞLEME KASASI</h2>
            <Link href="/hizmet/kasa" className="text-[11px] font-extrabold text-[#f5c518]">
              İşleme modülünde yönet →
            </Link>
          </div>
          {islemeHesaplari.map((h) => {
            const b = islemeBakiyeleri.get(h.id);
            return (
              <div key={h.id} className="ozet-kart flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]">
                  <Package className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="tr-value">{h.ad}</div>
                  <div className="tr-muted">{h.tip === "BANKA" ? h.bankaAdi ?? "Banka" : "Kasa"} · {h.bakiyeTuru}</div>
                </div>
                <div className="text-right">
                  <div className="tr-value text-emerald-300">{b ? paraBirim(b.tutar, b.tur) : "—"}</div>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] font-semibold text-sky-200">
            Bu kasa işleme modülüne aittir; hareketleri aşağıdaki listede görünür.
          </p>
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
              <div className="text-xs text-sky-100">
                {tarihSaat(h.createdAt)} · {h.hesap.ad}
                {h.hesap.modul === "ISLEME" && (
                  <span className="ml-2 rounded bg-[#f5c518]/15 px-1.5 py-0.5 text-[10px] font-extrabold text-[#f5c518]">İŞLEME</span>
                )}
              </div>
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
