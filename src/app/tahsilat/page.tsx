import { PageBaslik } from "@/components/page-baslik";
import { FinansForm } from "@/components/finans-form";
import { getCariler, getHesaplar, getSonFinansHareketler } from "@/lib/queries";
import { paraBirim, tarihSaat } from "@/lib/format";
import { ArrowDownLeft, HandCoins } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function TahsilatPage() {
  const actor = await requirePagePermission("FINANS", "GORUNTULE");
  const olusturmaYetkisi = izinVar(actor, "FINANS", "OLUSTUR");
  const [cariler, hesaplar, hareketler] = await Promise.all([
    getCariler(),
    getHesaplar(),
    getSonFinansHareketler(20),
  ]);

  const tahsilatlar = hareketler.filter((h) => h.tip === "TAHSILAT");

  return (
    <div>
      <PageBaslik baslik="Tahsilat İşlemleri" alt="Cari hesaptan tahsilatı hesap hareketine işler" geri="/finans" />

      <div className="saha-btn mb-4 w-full cursor-default bg-emerald-700/40 text-emerald-200">
        <HandCoins className="h-5 w-5" /> TAHSİLAT MODU AKTİF
      </div>

      {olusturmaYetkisi && <FinansForm
        sabitTip="TAHSILAT"
        cariler={cariler.map((c) => ({ id: c.id, ad: c.ad, tur: c.tur }))}
        hesaplar={hesaplar.filter((h) => h.bakiyeTuru !== "FINDIK_KG").map((h) => ({ id: h.id, ad: h.ad, bakiyeTuru: h.bakiyeTuru }))}
      />}

      <h2 className="mb-2 mt-5 text-[11px] font-extrabold tracking-[0.14em] text-sky-100">SON TAHSİLATLAR</h2>
      <div className="space-y-1.5">
        {tahsilatlar.map((h) => (
          <div key={h.id} className="ozet-kart flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 text-emerald-300">
              <ArrowDownLeft className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{h.aciklama ?? "Tahsilat"}</div>
              <div className="text-xs text-sky-100">{tarihSaat(h.createdAt)} · {h.hesap.ad}</div>
            </div>
            <div className="font-extrabold tabular-nums text-emerald-300">+{paraBirim(h.tutar, h.bakiyeTuru)}</div>
          </div>
        ))}
        {tahsilatlar.length === 0 && <div className="ozet-kart text-sm text-sky-100">Henüz tahsilat yok.</div>}
      </div>
    </div>
  );
}
