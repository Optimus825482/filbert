import { cookies } from "next/headers";
import { ModulSekmeler, type Modul } from "@/components/modul-tabs";
import { ModulTercihSenkronu } from "@/components/modul-tercih-senkronu";
import { requirePagePermission } from "@/lib/rbac/guard";
import { modulleriIzinlereGoreFiltrele } from "@/lib/rbac/modul-navigasyon";
import { islemeSayaclari } from "@/lib/queries";
import { islemModulu } from "@/lib/modul-tanimlari";
import { getCurrentFirmaId } from "@/lib/auth";
import { MODUL_CEREZI, modulCoz } from "@/lib/modul";

export const dynamic = "force-dynamic";

/**
 * Fındık İşleme Modülü — kırma / kavurma / vakumlu paketleme talep akışı:
 * talep kaydı, aşama takibi (bekliyor → kırım → kavurma → paketleme →
 * tamamlandı), teslim, tahsilat, kendi kasa yönetimi ve SMS bildirimleri.
 *
 * Modül ayrımı gereği bu ekranda yalnızca işleme modülünün kendi menüleri
 * listelenir; modül değişimi Ayarlar → Modül sekmesinden yapılır (mobilde alt
 * menüdeki **Ayarlar** ikonu).
 */
export default async function FindikIslemModulPage() {
  const actor = await requirePagePermission("HIZMET", "GORUNTULE");
  const firmaId = await getCurrentFirmaId();

  const islemeSayaci = await islemeSayaclari(firmaId);
  const modüller: Modul[] = [islemModulu(islemeSayaci)];
  // Doğrudan bu ekrana gelen kullanıcının modül tercihi eşitlenir; böylece
  // Ayarlar → Modül ekranı da işleme modülünü açık gösterir.
  const cerezModulu = modulCoz((await cookies()).get(MODUL_CEREZI)?.value);

  return (
    <>
      <ModulTercihSenkronu modul="islem" cerezModulu={cerezModulu} />
      <ModulSekmeler modüller={modulleriIzinlereGoreFiltrele(actor, modüller)} aktifId="islem" />
    </>
  );
}