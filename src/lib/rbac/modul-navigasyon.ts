import { izinVar } from "@/lib/rbac/guard";
import type { IzinEylemiKodu, UygulamaModuluKodu } from "@/lib/rbac/permissions";

type Izin = readonly [UygulamaModuluKodu, IzinEylemiKodu];

const ROTA_IZINLERI: Readonly<Record<string, Izin>> = {
  "/alim": ["ALIM", "GORUNTULE"],
  "/alim/yeni": ["ALIM", "OLUSTUR"],
  "/randiman": ["RANDIMAN", "GORUNTULE"],
  "/emanet": ["EMANET", "GORUNTULE"],
  "/virman": ["FINANS", "GORUNTULE"],
  "/sevkiyat": ["SEVKIYAT", "GORUNTULE"],
  "/kasa": ["FINANS", "GORUNTULE"],
  "/banka": ["FINANS", "GORUNTULE"],
  "/tahsilat": ["FINANS", "GORUNTULE"],
  "/finans": ["FINANS", "GORUNTULE"],
  "/finans/odeme": ["FINANS", "GORUNTULE"],
  "/avans": ["AVANS", "GORUNTULE"],
  "/masraf": ["MASRAF", "GORUNTULE"],
  "/cari/hesaplar": ["CARI", "GORUNTULE"],
  "/satis": ["SATIS", "GORUNTULE"],
  "/raporlar": ["RAPORLAR", "GORUNTULE"],
  "/kar-zarar": ["RAPORLAR", "GORUNTULE"],
  "/fiyatlar": ["AYARLAR", "GORUNTULE"],
  "/stok": ["STOK", "GORUNTULE"],
};

type ModulGrubu<Tile extends { href: string }> = { altModuller: Tile[] };

/** İkincil navigasyon yalnızca kullanıcının gerçekten açabileceği ekranları içerir. */
export function modulleriIzinlereGoreFiltrele<Tile extends { href: string }, Grup extends ModulGrubu<Tile>>(
  actor: Parameters<typeof izinVar>[0],
  moduller: readonly Grup[],
): Grup[] {
  return moduller
    .map((modul) => ({ ...modul, altModuller: modul.altModuller.filter((tile) => {
      const izin = ROTA_IZINLERI[tile.href];
      return !izin || izinVar(actor, izin[0], izin[1]);
    }) }))
    .filter((modul) => modul.altModuller.length > 0) as Grup[];
}
