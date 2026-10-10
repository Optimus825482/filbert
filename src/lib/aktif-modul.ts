import { cookies, headers } from "next/headers";
import { getCurrentOturum } from "@/lib/auth";
import { MODUL_BASLIGI, MODUL_CEREZI, aktifModulBelirle, type ModulId } from "@/lib/modul";

/**
 * Sunucu bileşenlerinde aktif modülü okur. Sıra: istek yolu (proxy başlığı) →
 * `filbert_modul` çerezi → kullanıcının varsayılan modülü. Oturum yoksa `null`
 * döner; çağıran taraf bu durumda alım modülünü varsayar.
 */
export async function aktifModuluOku(): Promise<ModulId | null> {
  const oturum = await getCurrentOturum();
  const user = oturum?.kullanici;
  if (!user?.aktif || !user.firma.aktif) return null;
  return aktifModulBelirle({
    yol: (await headers()).get(MODUL_BASLIGI),
    cerez: (await cookies()).get(MODUL_CEREZI)?.value,
    varsayilan: user.varsayilanModul,
  });
}