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
 * Eski "Fındık İşlemleri" mobil girişi artık Fındık Alım Modülü ekranıdır.
 * Modüler ayrım sonrası işleme tarafı /mod/islem altında toplanır; iki
 * modülün menüleri birbirine karışmaz.
 */
export default async function FindikModulPage() {
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