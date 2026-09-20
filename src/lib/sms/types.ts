export type SmsSaglayici = "NETGSM" | "ILETIMERKEZI" | "GENERIC_HTTP" | "TEST";

export interface SmsAyarlari {
  aktif: boolean;
  saglayici: SmsSaglayici;
  apiUrl?: string;
  kullaniciAdi?: string;
  sifre?: string;
  baslik?: string;
  kayitSablonu: string;
  tamamlandiSablonu: string;
  otomatikGirisSms: boolean;
}

export interface SmsGonderSonuc {
  basarili: boolean;
  mesajId?: string;
  hata?: string;
  simulasyon?: boolean;
}

export const VARSAYILAN_KAYIT_SABLONU =
  "Sayın {musteri_adi}, {kilo} kg fındığınız #{sira_no} sıra no ile teslim alınmıştır. Yapılacak işlemler: {hizmetler}. Bizi tercih ettiğiniz için teşekkür ederiz. {firma_adi}";

export const VARSAYILAN_TAMAMLANDI_SABLONU =
  "Sayın {musteri_adi}, #{sira_no} sıra no'lu {kilo} kg fındığınızın {hizmetler} işlemi tamamlanmıştır. Tutar: {tutar} TL. Teslim alabilirsiniz. {firma_adi}";
