import { cookies } from "next/headers";
import { ModulSekmeler, type Modul } from "@/components/modul-tabs";
import { ModulTercihSenkronu } from "@/components/modul-tercih-senkronu";
import { requirePagePermission } from "@/lib/rbac/guard";
import { modulleriIzinlereGoreFiltrele } from "@/lib/rbac/modul-navigasyon";
import { bekleyenRandimanSayisi } from "@/lib/queries";
import {
  alimModulu,
  finansModulu,
  musteriModulu,
  raporModulu,
} from "@/lib/modul-tanimlari";
import { getCurrentFirmaId } from "@/lib/auth";
import { MODUL_CEREZI, modulCoz } from "@/lib/modul";

export const dynamic = "force-dynamic";

/**
 * Fındık Alım Modülü — mevcut alım, randıman, emanet, virman ve sevk akışı.
 *
 * Modül ayrımı gereği işleme modülünün menüleri burada listelenmez; işleme
 * tarafına geçiş kenar çubuğunun altındaki butondan (mobilde Ayarlar → Modül)
 * yapılır.
 */
export default async function FindikAlimModulPage() {
  const actor = await requirePagePermission("ALIM", "GORUNTULE");
  const firmaId = await getCurrentFirmaId();

  const bekleyenRandiman = await bekleyenRandimanSayisi(firmaId);
  // Doğrudan bu ekrana gelen kullanıcının modül tercihi eşitlenir; böylece
  // Ayarlar → Modül ekranı da alım modülünü açık gösterir.
  const cerezModulu = modulCoz((await cookies()).get(MODUL_CEREZI)?.value);

  const modüller: Modul[] = [
    alimModulu({ bekleyenRandiman }),
    finansModulu(),
    musteriModulu(),
    raporModulu(),
  ];

  return (
    <>
      <ModulTercihSenkronu modul="alim" cerezModulu={cerezModulu} />
      <ModulSekmeler modüller={modulleriIzinlereGoreFiltrele(actor, modüller)} aktifId="alim" />
    </>
  );
}