import type { SmsKodlama } from "./types";

/** Telefon numarasını Türkiye standart biçimine (905xxxxxxxxx veya 05xxxxxxxxx) normalize eder. */
export function telefonTemizle(tel: string): string {
  const sadeceRakam = tel.replace(/\D/g, "");
  if (sadeceRakam.startsWith("90") && sadeceRakam.length === 12) {
    return sadeceRakam;
  }
  if (sadeceRakam.startsWith("0") && sadeceRakam.length === 11) {
    return "9" + sadeceRakam;
  }
  if (sadeceRakam.length === 10) {
    return "90" + sadeceRakam;
  }
  return sadeceRakam;
}

/**
 * Netgsm REST API numarayı `5XXXXXXXXX` biçiminde bekler: 10 hane, başta sıfır
 * yok, ülke kodu yok. Geçersiz numarada `null` döner; böylece gönderim yerine
 * kayıt "hata" olarak işaretlenir ve kredi harcanmaz.
 */
export function netgsmNumara(tel: string): string | null {
  let rakam = tel.replace(/\D/g, "");
  if (rakam.startsWith("90")) rakam = rakam.slice(2);
  else if (rakam.startsWith("0")) rakam = rakam.slice(1);
  return /^5\d{9}$/.test(rakam) ? rakam : null;
}

/** Metnin GSM-7 (yazdırılabilir ASCII) kümesinde kalıp kalmadığı. */
export function gsm7UyumluMu(mesaj: string): boolean {
  return /^[\x20-\x7E\n\r\t]*$/.test(mesaj);
}

/** Türkçe karakterleri GSM-7 karşılıklarıyla sadeleştirir (kredi tasarrufu). */
export function asciiyeCevir(mesaj: string): string {
  return mesaj
    .replace(/[şŞ]/g, (h) => (h === "ş" ? "s" : "S"))
    .replace(/[ğĞ]/g, (h) => (h === "ğ" ? "g" : "G"))
    .replace(/[ıİ]/g, (h) => (h === "ı" ? "i" : "I"))
    .replace(/[öÖ]/g, (h) => (h === "ö" ? "o" : "O"))
    .replace(/[üÜ]/g, (h) => (h === "ü" ? "u" : "U"))
    .replace(/[çÇ]/g, (h) => (h === "ç" ? "c" : "C"))
    .replace(/[âÂ]/g, (h) => (h === "â" ? "a" : "A"))
    .replace(/[îÎ]/g, (h) => (h === "î" ? "i" : "I"))
    .replace(/[ûÛ]/g, (h) => (h === "û" ? "u" : "U"));
}

/**
 * SMS parça (kredi) limitleri. Türkiye'de operatör kimliği için 5 karakter
 * ayrıldığından GSM-7 tek parça 155, çok parçalı gönderimde parça başına 148;
 * Türkçe karakter içeren UCS-2 metinde tek parça 65, parça başına 62 karakterdir.
 */
export const SMS_KARAKTER_LIMITLERI = {
  GSM7: { tek: 155, coklu: 148 },
  UCS2: { tek: 65, coklu: 62 },
} as const;

/** Mesajı seçilen kodlamaya göre hazırlar ve Unicode gerekip gerekmediğini söyler. */
export function smsMetniHazirla(
  mesaj: string,
  kodlama: SmsKodlama
): { metin: string; unicode: boolean } {
  const metin = kodlama === "ASCII" ? asciiyeCevir(mesaj) : mesaj;
  return { metin, unicode: !gsm7UyumluMu(metin) };
}

export interface SmsParcaBilgisi {
  /** Metnin kaç SMS kredisine bölüneceği. */
  parcaSayisi: number;
  /** Metnin karakter sayısı. */
  karakterSayisi: number;
  /** Bu metin için geçerli tek parça sınırı. */
  sinir: number;
  /** İlk parçada kalan karakter hakkı. */
  kalan: number;
  /** Türkçe karakter nedeniyle UCS-2 kodlama gerekiyor mu. */
  unicode: boolean;
}

/**
 * Mesajın kaç SMS kredisine bölüneceğini hesaplar. Gönderimden önce hesaplanan
 * bu değer kayda yazılır; böylece aylık kredi tüketimi şaşırtmaz.
 */
export function smsParcaHesapla(mesaj: string, kodlama: SmsKodlama): SmsParcaBilgisi {
  const { metin, unicode } = smsMetniHazirla(mesaj, kodlama);
  const limitler = unicode ? SMS_KARAKTER_LIMITLERI.UCS2 : SMS_KARAKTER_LIMITLERI.GSM7;
  const karakterSayisi = metin.length;

  if (karakterSayisi <= limitler.tek) {
    return {
      parcaSayisi: karakterSayisi === 0 ? 0 : 1,
      karakterSayisi,
      sinir: limitler.tek,
      kalan: Math.max(limitler.tek - karakterSayisi, 0),
      unicode,
    };
  }

  const parcaSayisi = Math.ceil(karakterSayisi / limitler.coklu);
  return {
    parcaSayisi,
    karakterSayisi,
    sinir: limitler.coklu,
    kalan: Math.max(parcaSayisi * limitler.coklu - karakterSayisi, 0),
    unicode,
  };
}

/** Şablon içerisindeki {anahtar} değişkenlerini değerleriyle değiştirir. */
export function sablonDoldur(
  sablon: string,
  degiskenler: Record<string, string | number | undefined | null>
): string {
  let sonuc = sablon;
  for (const [anahtar, deger] of Object.entries(degiskenler)) {
    const ifade = new RegExp(`\\{${anahtar}\\}`, "gi");
    sonuc = sonuc.replace(ifade, String(deger ?? ""));
  }
  return sonuc;
}