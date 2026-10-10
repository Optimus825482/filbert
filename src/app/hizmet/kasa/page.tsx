import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { getModulHesapBakiyeleri } from "@/lib/queries";
import { paraBirim, tarihSaat } from "@/lib/format";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Wallet } from "lucide-react";
import { IslemeKasaYonetimi, type IslemeKasaSatir } from "./isleme-kasa-yonetimi";

export const dynamic = "force-dynamic";

/**
 * Fındık İşleme Modülü kasa yönetimi.
 *
 * İşleme kasası alım modülünün kasalarından ayrıdır (`KasaHesap.modul =
 * ISLEME`). Bu ekran hesap tanımlarını, bakiyeleri ve kasa hareketlerini
 * yönetir; alım modülünün `/kasa` ekranı aynı hesapları yalnızca görüntüler.
 */
export default async function IslemeKasaPage() {
  const actor = await requirePagePermission("HIZMET", "GORUNTULE");
  const firma = await getCurrentFirma();

  const [hesaplar, bakiyeler, hareketler] = await Promise.all([
    prisma.kasaHesap.findMany({
      where: { firmaId: firma.id, modul: "ISLEME" },
      orderBy: [{ aktif: "desc" }, { ad: "asc" }],
    }),
    getModulHesapBakiyeleri("ISLEME"),
    prisma.finansHareket.findMany({
      where: { hesap: { firmaId: firma.id, modul: "ISLEME" } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { hesap: { select: { ad: true, tip: true } } },
    }),
  ]);

  const satirlar: IslemeKasaSatir[] = hesaplar.map((hesap) => {
    const bakiye = bakiyeler.get(hesap.id) ?? null;
    return {
      id: hesap.id,
      ad: hesap.ad,
      tip: hesap.tip,
      bakiyeTuru: hesap.bakiyeTuru,
      bankaAdi: hesap.bankaAdi,
      iban: hesap.iban,
      aktif: hesap.aktif,
      bakiye: bakiye ? { tur: bakiye.tur, tutar: bakiye.tutar } : null,
    };
  });

  // Para birimi başına toplam; farklı birimler tek satırda toplanmaz.
  const toplamlar = new Map<string, number>();
  for (const hesap of hesaplar) {
    if (!hesap.aktif) continue;
    const bakiye = bakiyeler.get(hesap.id);
    if (!bakiye) continue;
    toplamlar.set(bakiye.tur, (toplamlar.get(bakiye.tur) ?? 0) + bakiye.tutar);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Fındık İşleme Kasası</h1>
          <p className="mt-0.5 text-xs font-semibold text-sky-200">
            Kırma / kavurma / paketleme hizmetinin kasa yönetimi
          </p>
        </div>
        <Link
          href="/hizmet"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Talep Listesi
        </Link>
      </div>

      <section className="ozet-kart flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="tr-muted">İşleme kasası bakiyesi</div>
          {toplamlar.size === 0 ? (
            <div className="tr-value text-emerald-300">—</div>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[...toplamlar.entries()].map(([tur, tutar]) => (
                <span key={tur} className="tr-value text-emerald-300">{paraBirim(tutar, tur)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right text-[11px] font-semibold text-sky-200">
          {hesaplar.filter((h) => h.aktif).length} aktif hesap
        </div>
      </section>

      <IslemeKasaYonetimi
        hesaplar={satirlar}
        olusturYetkisi={izinVar(actor, "HIZMET", "OLUSTUR")}
        guncelleYetkisi={izinVar(actor, "HIZMET", "GUNCELLE")}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold tracking-wide text-sky-200">Son Kasa Hareketleri</h2>
        {hareketler.length === 0 ? (
          <div className="ozet-kart text-sm text-sky-100">Bu kasada henüz hareket yok.</div>
        ) : (
          <div className="space-y-1.5">
            {hareketler.map((hareket) => {
              const giris = hareket.tip === "TAHSILAT" || hareket.tip === "VIRMAN";
              const Ikon = giris ? ArrowDownLeft : ArrowUpRight;
              return (
                <div
                  key={hareket.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"
                >
                  <span
                    className={
                      giris
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400"
                    }
                  >
                    <Ikon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[var(--app-fg)]">
                      {hareket.hesap.ad}
                      <span className="ml-2 rounded bg-[#f5c518]/15 px-1.5 py-0.5 text-[10px] font-extrabold text-[#f5c518]">
                        İŞLEME
                      </span>
                    </div>
                    <div className="truncate text-xs text-sky-100">
                      {hareket.aciklama ?? (giris ? "Tahsilat" : "Ödeme")} · {tarihSaat(hareket.createdAt)}
                    </div>
                  </div>
                  <div className={giris ? "shrink-0 text-sm font-extrabold text-emerald-300" : "shrink-0 text-sm font-extrabold text-red-300"}>
                    {giris ? "+" : "−"}
                    {paraBirim(hareket.tutar, hareket.bakiyeTuru)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[11px] font-semibold text-sky-200">
        Bu kasalar alım modülünün <Link href="/kasa" className="font-extrabold text-[#f5c518]">Kasa</Link> ekranında da
        görüntülenir. İşleme taleplerinden alınan tahsilatlar İşleme Ayarları&apos;nda seçilen kasaya işlenir.
      </p>
    </div>
  );
}