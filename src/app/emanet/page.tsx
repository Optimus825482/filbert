import { PageBaslik } from "@/components/page-baslik";
import { EmanetBozButon } from "@/components/emanet-boz";
import { EmanetYonet } from "@/components/emanet-yonet";
import { getAcikEmanetler } from "@/lib/queries";
import { kg, puan, tarih, gunFarki } from "@/lib/format";
import { PackageOpen } from "lucide-react";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export default async function EmanetPage() {
  const actor = await requirePagePermission("EMANET", "GORUNTULE");
  const guncelleYetkisi = izinVar(actor, "EMANET", "GUNCELLE");
  const emanetler = await getAcikEmanetler();

  return (
    <div>
      <PageBaslik baslik="Emanetler" alt={`${emanetler.length} açık emanet`} geri="/" />

      {emanetler.length === 0 && (
        <div className="ozet-kart flex items-center gap-2 text-sm text-muted-foreground">
          <PackageOpen className="h-4 w-4" /> Açık emanet yok. Alım fişinde &quot;Emanet&quot; seçeneğiyle emanet oluşturulur.
        </div>
      )}

      <div className="space-y-2">
        {emanetler.map((e) => (
          <div key={e.id} className="ozet-kart flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{e.cari.ad}</div>
              <div className="text-xs text-muted-foreground">
                {tarih(e.acilisTarihi)} · {gunFarki(e.acilisTarihi)} gündür emanette
                {e.alimFisi?.fisNo ? ` · ${e.alimFisi.fisNo}` : ""}
                {e.cari.bolge ? ` · ${e.cari.bolge}` : ""}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-xl font-extrabold tabular-nums text-orange-600">{kg(e.kalanKg)}</span>
                <span className="text-xs font-semibold text-muted-foreground">Randıman: {e.randimanPuan === null ? "—" : puan(e.randimanPuan)}</span>
              </div>
            </div>
            {guncelleYetkisi && <div className="flex flex-wrap items-center gap-2">
              <EmanetBozButon emanetId={e.id} cariAd={e.cari.ad} kalanKg={e.kalanKg} />
              <EmanetYonet emanetId={e.id} cariAd={e.cari.ad} kalanKg={e.kalanKg} />
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}
