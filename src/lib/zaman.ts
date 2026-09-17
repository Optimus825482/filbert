/** İstanbul iş günü yardımcıları.
 * DATE kolonları için UTC gece yarısı anahtarı, zaman damgası sorguları için
 * ise İstanbul gece yarısının gerçek UTC karşılığı kullanılır. */
const ISTANBUL = "Europe/Istanbul";

type TarihParcalari = { yil: number; ay: number; gun: number; saat?: number; dakika?: number };

const tarihBicimleyici = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const zamanBicimleyici = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISTANBUL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parcalariAl(bicimleyici: Intl.DateTimeFormat, deger: Date): TarihParcalari {
  const parcalar = Object.fromEntries(bicimleyici.formatToParts(deger)
    .filter((parca) => parca.type !== "literal")
    .map((parca) => [parca.type, parca.value]));
  return {
    yil: Number(parcalar.year),
    ay: Number(parcalar.month),
    gun: Number(parcalar.day),
    ...(parcalar.hour ? { saat: Number(parcalar.hour), dakika: Number(parcalar.minute) } : {}),
  };
}

function istanbulYerelZamaniUtc(parcalar: Required<TarihParcalari>): Date {
  const hedef = Date.UTC(parcalar.yil, parcalar.ay - 1, parcalar.gun, parcalar.saat, parcalar.dakika);
  let tahmin = hedef;
  // Intl ile dönüşüm, sabit +03 varsayımı yapmadan yaz/kış saati geçişlerini de
  // doğru çözer. İstanbul bugün sabit olsa da geçmiş veriler güvenli kalır.
  for (let deneme = 0; deneme < 3; deneme += 1) {
    const gorunen = parcalariAl(zamanBicimleyici, new Date(tahmin));
    const gorunenMs = Date.UTC(gorunen.yil, gorunen.ay - 1, gorunen.gun, gorunen.saat ?? 0, gorunen.dakika ?? 0);
    tahmin += hedef - gorunenMs;
  }
  return new Date(tahmin);
}

/** PostgreSQL DATE alanları için İstanbul tarihini temsil eden kararlı anahtar. */
export function istanbulTarihAnahtari(deger: Date = new Date()): Date {
  const { yil, ay, gun } = parcalariAl(tarihBicimleyici, deger);
  return new Date(Date.UTC(yil, ay - 1, gun));
}

/** İstanbul iş gününün UTC zaman aralığı: [başlangıç, ertesi gün başlangıcı). */
export function istanbulGunAraligi(deger: Date = new Date()): { baslangic: Date; bitis: Date } {
  const tarih = parcalariAl(tarihBicimleyici, deger);
  const ertesiGun = new Date(Date.UTC(tarih.yil, tarih.ay - 1, tarih.gun + 1));
  const baslangic = istanbulYerelZamaniUtc({ ...tarih, saat: 0, dakika: 0 });
  const bitis = istanbulYerelZamaniUtc({ yil: ertesiGun.getUTCFullYear(), ay: ertesiGun.getUTCMonth() + 1, gun: ertesiGun.getUTCDate(), saat: 0, dakika: 0 });
  return { baslangic, bitis };
}

/** Güvenilir date input çözümlemesi; geçersiz tarihi null döndürür. */
export function istanbulTarihMetniniCoz(metin: string | undefined): Date | null {
  if (!metin || !/^\d{4}-\d{2}-\d{2}$/.test(metin)) return null;
  const [yil, ay, gun] = metin.split("-").map(Number);
  const sonuc = new Date(Date.UTC(yil, ay - 1, gun));
  return sonuc.getUTCFullYear() === yil && sonuc.getUTCMonth() === ay - 1 && sonuc.getUTCDate() === gun ? sonuc : null;
}
