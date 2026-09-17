import { getHesaplar, getSonVirmanlar } from "@/lib/queries";
import { PageBaslik } from "@/components/page-baslik";
import { VirmanForm } from "./virman-form";
import { VirmanGecmisi } from "./virman-gecmisi";
import { KasaHesap, FinansHareket } from "@/generated/prisma/client";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

type Hesap = Pick<KasaHesap, "id" | "ad" | "tip" | "bakiyeTuru">;
type VirmanHareket = FinansHareket & { hesap: Hesap };

export default async function VirmanPage() {
  const actor = await requirePagePermission("FINANS", "GORUNTULE");
  const olusturYetkisi = izinVar(actor, "FINANS", "OLUSTUR");
  const [hesaplar, virmanlar] = await Promise.all([getHesaplar(), getSonVirmanlar(30)]);

  // Group virman records by iliskiliTipi to show paired entries
  // We show raw list sorted by time for simplicity; formatter handles both
  const grouped = groupVirmanlar(virmanlar as VirmanHareket[]);

  return (
    <div className="space-y-4 pb-6">
      <PageBaslik baslik="Virman" alt="Hesaplar arası para aktarımı" geri="/finans" />

      {/* Virman form */}
      {olusturYetkisi && <VirmanForm hesaplar={hesaplar} />}

      {/* Recent virman geçmişi */}
      <VirmanGecmisi virmanlar={grouped} />
    </div>
  );
}

/** Group virman transactions by approximate time pairs for display */
function groupVirmanlar(rows: VirmanHareket[]): VirmanHareket[] {
  // Return as-is sorted by createdAt desc; the display component can pair
  // consecutive entries within a short time window (same second).
  return rows;
}
