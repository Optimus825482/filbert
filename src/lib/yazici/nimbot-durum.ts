"use client";

/**
 * Tarayıcı yazıcı yeteneklerini React bileşenlerine taşıyan küçük yardımcılar.
 *
 * Tarayıcı yetenekleri sunucuda bilinemez. `useSyncExternalStore` sunucu
 * render'ında ve hidrasyonda `false`, ardından tarayıcının gerçek değerini
 * döndürür; böylece etki (effect) içinde durum güncellemek gerekmez.
 */

import { useSyncExternalStore } from "react";
import {
  nimbotBluetoothDestekleniyorMu,
  nimbotSerialDestekleniyorMu,
} from "@/lib/yazici/nimbot";

/** Abone olunacak dış sistem yok; değer her render'da yeniden okunur. */
const aboneOl = () => () => {};

/** Tarayıcı Web Bluetooth (BLE) destekliyor mu? */
export function useBluetoothDestekli(): boolean {
  return useSyncExternalStore(aboneOl, nimbotBluetoothDestekleniyorMu, () => false);
}

/** Tarayıcı Web Serial (USB kablo) destekliyor mu? */
export function useSerialDestekli(): boolean {
  return useSyncExternalStore(aboneOl, nimbotSerialDestekleniyorMu, () => false);
}