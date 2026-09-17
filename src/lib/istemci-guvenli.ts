// İstemci tarafı güvenli işlem sarmalayıcısı.
//
// Sunucu eylemleri oturum süresi dolduğunda veya ağ kesildiğinde reddedilen bir
// Promise olarak döner. Tüm formlar bu sarmalayıcıyı kullanır: hata kullanıcıya
// mesaj olarak döner, oturum süresi dolduğunda giriş ekranına götürülür ve
// yakalanmamış rejection (`startTransition` içinde `await`) ortadan kalkar.

import { toast } from "sonner";

function oturumHatasiMi(mesaj: string): boolean {
  return /oturum/i.test(mesaj) || /giriş/i.test(mesaj);
}

/**
 * Sunucu eylemini çalıştırır. Başarılıysa sonucu, sunucu/bağlantı hatasıysa
 * `null` döner. Hata anında kullanıcıya bildirim gösterilir; oturum hatalarında
 * giriş ekranına yönlendirilir. Formlar dönen değeri `if (!sonuc) return;`
 * ile kapamalıdır.
 */
export async function sunucuIslemi<T>(islem: () => Promise<T>, basariliMesaj?: string): Promise<T | null> {
  try {
    const sonuc = await islem();
    if (basariliMesaj) toast.success(basariliMesaj);
    return sonuc;
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu";
    if (oturumHatasiMi(mesaj)) {
      toast.error("Oturum süresi doldu", { description: "Lütfen yeniden giriş yapın." });
      if (typeof window !== "undefined") {
        // Eylem herhangi bir bileşende çalışabildiğinden yönlendirme burada zorunludur.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- oturum sonrası sabit giriş rotası
        window.location.assign("/giris");
      }
    } else {
      toast.error("İşlem başarısız", { description: mesaj });
    }
    return null;
  }
}