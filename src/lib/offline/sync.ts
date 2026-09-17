"use client";

import { offlineKomutlariGetir, offlineKomutuSil } from "./outbox";

/**
 * Bekleyen offline komutları gönderir.
 *
 * - Kalıcı hatalar (4xx: geçersiz taslak, yetki silinmiş vb.) komutu sıradan
 *   siler ve kullanıcıya `filbert:offline-hata` olayıyla bir mesaj iletir.
 *   Aksi halde aynı komut her eşitlemede süresiz yeniden denenirdi.
 * - Geçici hatalar (5xx/ağ) sırayı korur ve döngüyü kırar; bir sonraki
 *   fırsatta tekrar denenir.
 */
export async function offlineKuyruguEsitle(sahipKullaniciId: string): Promise<{ gonderilen: number; bekleyen: number }> {
  if (!navigator.onLine) return { gonderilen: 0, bekleyen: (await offlineKomutlariGetir(sahipKullaniciId)).length };
  let gonderilen = 0;
  for (const komut of await offlineKomutlariGetir(sahipKullaniciId)) {
    try {
      const response = await fetch("/api/offline-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(komut) });
      if (response.ok) {
        await offlineKomutuSil(komut.id); gonderilen++;
        continue;
      }
      // 5xx/istek zaman aşımı geçicidir; kuyruk korunur.
      if (response.status >= 500) break;
      // 4xx kalıcıdır: komut atılır ve ne olduğu kullanıcıya bildirilir.
      let mesaj = "İşlem sunucu tarafından kabul edilmedi.";
      try {
        const govde = await response.json();
        if (govde && typeof govde.hata === "string") mesaj = govde.hata;
      } catch { /* gövde mesaj içermeyebilir */ }
      await offlineKomutuSil(komut.id);
      window.dispatchEvent(new CustomEvent("filbert:offline-hata", { detail: { mesaj } }));
    } catch {
      // Ağ kopukluğu: bir sonraki fırsatta tekrar dene, kuyruğu koru.
      break;
    }
  }
  const bekleyen = (await offlineKomutlariGetir(sahipKullaniciId)).length;
  window.dispatchEvent(new CustomEvent("filbert:offline-sync", { detail: { gonderilen, bekleyen } }));
  return { gonderilen, bekleyen };
}