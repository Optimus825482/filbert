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
