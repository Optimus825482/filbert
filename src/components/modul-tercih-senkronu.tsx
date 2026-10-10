"use client";

import { useEffect } from "react";
import { aktifModuluDegistir } from "@/lib/actions/modul";
import type { ModulId } from "@/lib/modul";

/**
 * Bu istemci oturumunda senkron denemesi yapıldı mı? Modül düzeyinde tutulur;
 * tam sayfa yenilemede sıfırlanır, SPA içi gezinmede korunur. Böylece yetki
 * reddi gibi durumlarda aynı oturumda tekrar tekrar istek gönderilmez, ama
 * yer iminden gelen (tam yükleme) ziyarette tercih yine eşitlenir.
 */
let senkronDenendi = false;

/**
 * Modüle özel bir ekrana doğrudan gelindiğinde (yer imi, paylaşılan bağlantı)
 * modül tercihi çerezini sayfanın modülüyle eşitler. Sunucu bileşenleri çerez
 * yazamadığı için bu iş istemcide yapılır; böylece modüle özel olmayan
 * ekranlarda (ör. Ayarlar) da doğru modül "açık" görünür.
 */
export function ModulTercihSenkronu({
  modul,
  cerezModulu,
}: {
  modul: ModulId;
  cerezModulu: ModulId | null;
}) {
  useEffect(() => {
    if (cerezModulu === modul || senkronDenendi) return;
    senkronDenendi = true;
    void aktifModuluDegistir(modul);
  }, [modul, cerezModulu]);

  return null;
}