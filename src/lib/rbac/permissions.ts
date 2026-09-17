/**
 * RBAC izin sözlüğünün tek kaynağı.
 * Değerler Prisma enumlarıyla birebir aynı tutulur; action katmanı burada
 * tanımlı olmayan bir modül veya eylem için yetki denetimi yapmamalıdır.
 */
export const UYGULAMA_MODULLERI = [
  "DASHBOARD",
  "ALIM",
  "RANDIMAN",
  "EMANET",
  "AVANS",
  "CARI",
  "FINANS",
  "MASRAF",
  "STOK",
  "SATIS",
  "SEVKIYAT",
  "TANIMLAR",
  "RAPORLAR",
  "AYARLAR",
  "KULLANICI_YONETIMI",
  "SESLI_NOT",
] as const;

export const IZIN_EYLEMLERI = [
  "GORUNTULE",
  "OLUSTUR",
  "GUNCELLE",
  "SIL",
  "ONAYLA",
  "IPTAL",
  "YONET",
] as const;

export type UygulamaModuluKodu = (typeof UYGULAMA_MODULLERI)[number];
export type IzinEylemiKodu = (typeof IZIN_EYLEMLERI)[number];

export type Izin = Readonly<{ modul: UygulamaModuluKodu; eylem: IzinEylemiKodu }>;

export function izinlerGecerli(deger: unknown): deger is Izin[] {
  return Array.isArray(deger) && deger.every((izin) =>
    typeof izin === "object" && izin !== null &&
    UYGULAMA_MODULLERI.includes((izin as Izin).modul) &&
    IZIN_EYLEMLERI.includes((izin as Izin).eylem)
  );
}

export const TAM_YETKI_IZINLERI: readonly Izin[] = UYGULAMA_MODULLERI.flatMap((modul) =>
  IZIN_EYLEMLERI.map((eylem) => ({ modul, eylem }))
);

export const MODUL_ADLARI: Readonly<Record<UygulamaModuluKodu, string>> = {
  DASHBOARD: "Ana ekran",
  ALIM: "Alım",
  RANDIMAN: "Randıman",
  EMANET: "Emanet",
  AVANS: "Avans",
  CARI: "Cari",
  FINANS: "Finans",
  MASRAF: "Masraf",
  STOK: "Stok",
  SATIS: "Satış",
  SEVKIYAT: "Sevkiyat",
  TANIMLAR: "Tanımlar",
  RAPORLAR: "Raporlar",
  AYARLAR: "Ayarlar",
  KULLANICI_YONETIMI: "Kullanıcı ve rol yönetimi",
  SESLI_NOT: "Sesli notlar",
};

export const EYLEM_ADLARI: Readonly<Record<IzinEylemiKodu, string>> = {
  GORUNTULE: "Görüntüle",
  OLUSTUR: "Oluştur",
  GUNCELLE: "Güncelle",
  SIL: "Sil",
  ONAYLA: "Onayla",
  IPTAL: "İptal et",
  YONET: "Yönet",
};
