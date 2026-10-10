export type SmsSaglayici = "NETGSM" | "ILETIMERKEZI" | "GENERIC_HTTP" | "TEST";

/** Sağlayıcı etiketleri — ayar ekranı ve SMS merkezinde gösterilir. */
export const SMS_SAGLAYICI_ETIKETLERI: Record<SmsSaglayici, string> = {
  NETGSM: "Netgsm",
  ILETIMERKEZI: "İleti Merkezi",
  GENERIC_HTTP: "Genel HTTP (webhook)",
  TEST: "Test (gönderim yapılmaz)",
};

export const SMS_KODLAMALARI = ["TR", "ASCII"] as const;
/**
 * Metin kodlaması.
 *  - `TR`    : Türkçe karakterler korunur; mesaj UCS-2 olarak kodlanır ve tek SMS
 *              sınırı 65 karaktere düşer (Türkiye'de operatör kimliği için 5
 *              karakter ayrıldığından GSM-7'de 155, UCS-2'de 65 karakterdir).
 *  - `ASCII` : ş/ğ/ı/ö/ü/ç harfleri sadeleştirilir; GSM-7 sınırı (155) korunur,
 *              yani aynı metin daha az krediye bölünür.
 */
export type SmsKodlama = (typeof SMS_KODLAMALARI)[number];

/** Gönderim kaydının hangi iş akışından doğduğu. */
export type SmsKayitTipi = "KAYIT" | "TAMAMLANDI" | "TESLIM_HATIRLATMA" | "TEST" | "MANUEL";

export const SMS_TIP_ETIKETLERI: Record<SmsKayitTipi, string> = {
  KAYIT: "Talep alındı bildirimi",
  TAMAMLANDI: "Talep tamamlandı bildirimi",
  TESLIM_HATIRLATMA: "Teslim hatırlatma",
  TEST: "Entegrasyon testi",
  MANUEL: "Elle gönderim",
};

/** Gönderim kaydının sağlayıcı nezdindeki son durumu. */
export type SmsKayitDurumu = "KUYRUKTA" | "GONDERILDI" | "TESLIM_EDILDI" | "HATA" | "SIMULASYON";

export const SMS_DURUM_ETIKETLERI: Record<SmsKayitDurumu, string> = {
  KUYRUKTA: "Kuyrukta",
  GONDERILDI: "Gönderildi",
  TESLIM_EDILDI: "Teslim edildi",
  HATA: "Hata",
  SIMULASYON: "Simülasyon",
};

export interface SmsAyarlari {
  aktif: boolean;
  saglayici: SmsSaglayici;
  apiUrl?: string;
  kullaniciAdi?: string;
  sifre?: string;
  baslik?: string;
  kayitSablonu: string;
  tamamlandiSablonu: string;
  teslimHatirlatmaSablonu: string;
  otomatikGirisSms: boolean;
  /** SMS başına tahmini maliyet (kuruş). Maliyet raporu için kullanılır. */
  birimMaliyetKurus: number | null;
  kodlama: SmsKodlama;
  /** Sağlayıcı uygulama adı; Netgsm gönderimleri bu etiketle izlenir. */
  appname: string;
}

export interface SmsGonderSonuc {
  basarili: boolean;
  mesajId?: string;
  hata?: string;
  /** Sağlayıcının döndürdüğü hata kodu (Netgsm: 20/30/40/50/70 …). */
  hataKodu?: string;
  /** Gönderim kaydının kimliği; SMS merkezinde satırı bulmak için kullanılır. */
  kayitId?: string;
  /** Kredi karşılığı SMS parça sayısı. */
  parcaSayisi?: number;
  /** SMS servisi kapalıyken/test modundayken gönderim yapılmaz, simüle edilir. */
  simulasyon?: boolean;
}

/** Gönderim sırasında kaydı iş akışına bağlayan ek bilgiler. */
export interface SmsGonderSecenekleri {
  tip?: SmsKayitTipi;
  hizmetIslemiId?: string;
  musteriAdi?: string;
  kullaniciId?: string;
}

/**
 * Netgsm REST v2 `/sms/rest/v2/send` hata kodları. HTTP durumu neredeyse her
 * zaman 200 döner; gerçek sonuç gövdedeki `code` alanındadır.
 */
export const NETGSM_GONDERIM_HATALARI: Record<string, string> = {
  "00": "Gönderim kuyruğa alındı",
  "20": "Mesaj metni hatalı veya karakter sınırı aşıldı",
  "30": "Kullanıcı adı/şifre hatalı ya da API erişimi IP ile kısıtlı",
  "40": "Gönderici başlığı sistemde onaylı değil",
  "50": "İYS kontrollü gönderim aboneliğinizde tanımlı değil",
  "51": "Aboneliğe ait İYS marka bilgisi bulunamadı",
  "70": "Hatalı istek: zorunlu bir alan eksik veya geçersiz",
  "80": "Gönderim hız sınırı aşıldı",
  "85": "Aynı numaraya 1 dakikada en fazla 20 görev oluşturulabilir",
  "100": "Sağlayıcı sistem hatası",
  "101": "Sağlayıcı sistem hatası",
  "5000": "Tanımsız sağlayıcı hatası",
};

/** Netgsm teslim raporu durum kodları (`/sms/rest/v2/report` → `jobs[].status`). */
export const NETGSM_TESLIM_DURUMLARI: Record<number, { durum: SmsKayitDurumu; etiket: string }> = {
  0: { durum: "GONDERILDI", etiket: "Operatöre gönderilmeyi bekliyor" },
  1: { durum: "TESLIM_EDILDI", etiket: "İletildi" },
  2: { durum: "HATA", etiket: "Süresi doldu" },
  3: { durum: "HATA", etiket: "Geçersiz veya kısıtlı numara" },
  4: { durum: "HATA", etiket: "Operatöre iletilemedi" },
  11: { durum: "HATA", etiket: "Reddedildi" },
  12: { durum: "HATA", etiket: "İletim hatası" },
  13: { durum: "HATA", etiket: "Mükerrer gönderim" },
  14: { durum: "HATA", etiket: "Yetersiz bakiye" },
  15: { durum: "HATA", etiket: "Numara kara listede" },
  16: { durum: "HATA", etiket: "İYS reddi" },
  17: { durum: "HATA", etiket: "İYS hatası" },
};

export const VARSAYILAN_KAYIT_SABLONU =
  "Sayın {musteri_adi}, {kilo} kg fındığınız için #{sira_no} sıra no ile talebiniz alınmıştır. Yapılacak işlemler: {hizmetler}. Hazır olduğunda tarafınıza bilgi verilecektir. {firma_adi}";

export const VARSAYILAN_TESLIM_HATIRLATMA_SABLONU =
  "Sayın {musteri_adi}, #{sira_no} sıra no'lu {kilo} kg fındığınızın {hizmetler} işlemi tamamlanmıştır ve teslim alınmayı beklemektedir. Tutar: {tutar} TL. {firma_adi}";

export const VARSAYILAN_TAMAMLANDI_SABLONU =
  "Sayın {musteri_adi}, #{sira_no} sıra no'lu {kilo} kg fındığınızın {hizmetler} işlemi tamamlanmıştır. Tutar: {tutar} TL. Teslim alabilirsiniz. {firma_adi}";