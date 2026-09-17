"use client";

import { useState } from "react";
import { CalendarRange, HardHat, Landmark, Receipt, Truck, Users, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DepoTanim, type DepoSatir, type SubeSecenek } from "./depo-tanim";
import { HesapTanim, type HesapSatir } from "./hesap-tanim";
import { KullaniciTanim, type KullaniciSatir } from "./kullanici-tanim";
import { AracTanim, type AracSatir } from "./arac-tanim";
import { PersonelTanim, type PersonelSatir } from "./personel-tanim";
import { SezonTanim, type SezonSatir } from "./sezon-tanim";
import { MasrafTuruTanim, type MasrafTuruSatir } from "./masraf-turu-tanim";

type AltSekme = "depo" | "hesap" | "masrafTuru" | "kullanici" | "arac" | "personel" | "sezon";

const ALT_SEKMELER: { key: AltSekme; etiket: string; ikon: LucideIcon }[] = [
  { key: "depo", etiket: "Depolar", ikon: Warehouse },
  { key: "hesap", etiket: "Kasa/Banka", ikon: Landmark },
  { key: "masrafTuru", etiket: "Masraf Türleri", ikon: Receipt },
  { key: "kullanici", etiket: "Kullanıcılar", ikon: Users },
  { key: "arac", etiket: "Araçlar", ikon: Truck },
  { key: "personel", etiket: "Personel", ikon: HardHat },
  { key: "sezon", etiket: "Sezonlar", ikon: CalendarRange },
];

export interface TanimlarVeri {
  depolar: DepoSatir[];
  subeler: SubeSecenek[];
  roller: { id: string; ad: string }[];
  hesaplar: HesapSatir[];
  kullanicilar: KullaniciSatir[];
  araclar: AracSatir[];
  personel: PersonelSatir[];
  sezonlar: SezonSatir[];
  masrafTurleri: MasrafTuruSatir[];
}

export function TanimlarSekme({ veri, olusturYetkisi, guncelleYetkisi, kullaniciYonetYetkisi }: { veri: TanimlarVeri; olusturYetkisi: boolean; guncelleYetkisi: boolean; kullaniciYonetYetkisi: boolean }) {
  const [secilen, setSecilen] = useState<AltSekme>("depo");
  const gorunenAltSekmeler = ALT_SEKMELER.filter((sekme) => sekme.key !== "kullanici" || kullaniciYonetYetkisi);

  return (
    <div>
      {/* Alt sekme çubuğu — kaydırmalı chip bar */}
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {gorunenAltSekmeler.map((s) => {
          const aktif = secilen === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSecilen(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                aktif
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "text-sky-100 hover:bg-[var(--surface)] hover:text-sky-100"
              )}
            >
              <s.ikon className="h-4 w-4" />
              <span className="whitespace-nowrap">{s.etiket}</span>
            </button>
          );
        })}
      </div>

      {secilen === "depo" && <DepoTanim depolar={veri.depolar} subeler={veri.subeler} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
      {secilen === "hesap" && <HesapTanim hesaplar={veri.hesaplar} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
      {secilen === "masrafTuru" && <MasrafTuruTanim turler={veri.masrafTurleri} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
      {secilen === "kullanici" && kullaniciYonetYetkisi && <KullaniciTanim kullanicilar={veri.kullanicilar} roller={veri.roller} />}
      {secilen === "arac" && <AracTanim araclar={veri.araclar} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
      {secilen === "personel" && <PersonelTanim personel={veri.personel} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
      {secilen === "sezon" && <SezonTanim sezonlar={veri.sezonlar} olusturYetkisi={olusturYetkisi} guncelleYetkisi={guncelleYetkisi} />}
    </div>
  );
}
