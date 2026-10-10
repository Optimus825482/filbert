/**
 * İkincil (mobil) modül menülerinin tek kaynağı.
 *
 * Uygulama iki ana modüle ayrılır:
 *   1) Fındık Alım Modülü   — mevcut alım / randıman / emanet / sevk akışı
 *   2) Fındık İşleme Modülü — kırma / kavurma / paketleme talep akışı
 * Modül menüleri birbirinden bağımsızdır: her modül yalnızca kendi alt
 * modüllerini listeler. İşleme modülü kendi kasasını (İşleme Kasası), alım
 * modülü ise finans/müşteri/rapor kısayollarını taşır. Modüller arası geçiş
 * yalnızca Ayarlar → Modül ekranından yapılır (masaüstü ve mobil aynı ekran);
 * kenar çubuğunda modül geçiş düğmesi bulunmaz. Pano da modüle göre ayrılır:
 * her modülün panosu yalnızca kendi akışını gösterir.
 */
import type { Modul } from "@/components/modul-tabs";

export type AlimModulSayaclari = {
  /** Randımanı bekleyen alım fişi sayısı — menüde kırmızı rozet olur. */
  bekleyenRandiman: number;
};

export type IslemeModulSayaclari = {
  /** Sıraya alınmış talep sayısı. */
  bekleyenTalep: number;
  /** Kırım/kavurma/paketleme aşamasındaki talep sayısı. */
  uretimdeTalep: number;
  /** Hazır olup teslim alınmayan talep sayısı. */
  hazirBekleyen: number;
  /** Tamamlandı bildirimi gönderilmemiş talep sayısı. */
  smsBekleyen: number;
};

export function alimModulu(sayaclar: AlimModulSayaclari): Modul {
  return {
    id: "alim",
    etiket: "Fındık Alım Modülü",
    altModuller: [
      {
        href: "/alim/yeni",
        etiket: "Yeni Alım Fişi",
        ikon: "alim-yeni",
        dekont: "Müstahsil, miktar, fiyat, kalite — tek işlemde.",
      },
      {
        href: "/alim",
        etiket: "Alım Yönetimi",
        ikon: "alim-liste",
        badge: sayaclar.bekleyenRandiman > 0 ? sayaclar.bekleyenRandiman : undefined,
        dekont: "Fiş listesi, randıman tamamlama, emanet fişleri.",
      },
      {
        href: "/randiman",
        etiket: "Randıman Takibi",
        ikon: "randiman",
        dekont: "Kalite sonuçlarını ürün ve müşteri hareketleriyle değerlendirin.",
      },
      {
        href: "/emanet",
        etiket: "Emanetler",
        ikon: "emanet",
        dekont: "Fiyatsız bırakılan emanetler ve bozma işlemleri.",
      },
      {
        href: "/virman",
        etiket: "Virman Kontrolü",
        ikon: "virman",
        dekont: "Depolar veya hesaplar arası miktar aktarımı.",
      },
      {
        href: "/sevkiyat",
        etiket: "Sevk Planlama",
        ikon: "sevk",
        dekont: "Hazırlanan ürünleri araç, müşteri ve teslimat bilgileriyle sevke bağlayın.",
      },
      {
        href: "/cari/hesaplar",
        etiket: "Cari Hesaplar",
        ikon: "cari",
        dekont: "Müstahsil, tüccar, fabrika — çoklu bakiye.",
      },
      {
        href: "/satis",
        etiket: "Satış",
        ikon: "satis",
        dekont: "Fabrika/tüccara satış fişi.",
      },
    ],
  };
}

export function islemModulu(sayaclar: IslemeModulSayaclari): Modul {
  return {
    id: "islem",
    etiket: "Fındık İşleme Modülü",
    altModuller: [
      {
        href: "/hizmet/yeni",
        etiket: "Yeni Talep Kaydı",
        ikon: "isleme-talep",
        dekont: "Müşteri ad-soyad, telefon, fındık miktarı, yapılacak işler ve detayı.",
      },
      {
        href: "/hizmet",
        etiket: "Talep Kuyruğu",
        ikon: "isleme-kir",
        badge:
          sayaclar.bekleyenTalep + sayaclar.uretimdeTalep > 0
            ? sayaclar.bekleyenTalep + sayaclar.uretimdeTalep
            : undefined,
        dekont: `${sayaclar.bekleyenTalep} bekliyor · ${sayaclar.uretimdeTalep} üretimde · ${sayaclar.hazirBekleyen} hazır teslim bekliyor.`,
      },
      {
        href: "/hizmet/kasa",
        etiket: "Kasa",
        ikon: "isleme-kasa",
        dekont: "İşleme modülünün kendi kasası: hesap tanımları, tahsilat ve ödeme hareketleri.",
      },
      {
        href: "/hizmet?liste=teslimat",
        etiket: "Teslimat · Hazırlananlar",
        ikon: "isleme-hazir",
        badge: sayaclar.hazirBekleyen > 0 ? sayaclar.hazirBekleyen : undefined,
        dekont: "Hazırlanmış, müşterisi henüz almamış talepler; yeniden bildirim ve toplu SMS.",
      },
      {
        href: "/hizmet/sms",
        etiket: "SMS Merkezi",
        ikon: "isleme-rapor",
        badge: sayaclar.smsBekleyen > 0 ? sayaclar.smsBekleyen : undefined,
        dekont: "Gönderilen bildirimlerin gönderim ve teslim durumu; yeniden gönderim ve dışa aktarma.",
      },
      {
        href: "/hizmet/raporlar",
        etiket: "Durum Raporları",
        ikon: "isleme-rapor",
        dekont: "Durum dağılımı, aşama süreleri, tahsilat ve uzun bekleyenler.",
      },
      {
        href: "/hizmet/ayarlar",
        etiket: "İşleme Ayarları",
        ikon: "isleme-ayar",
        dekont: "Kasa tanımı, etiket yazıcı profili (Nimbot B1) ve SMS.",
      },
    ],
  };
}

export function finansModulu(): Modul {
  return {
    id: "finans",
    etiket: "Finans İşlemleri",
    altModuller: [
      { href: "/kasa", etiket: "Kasa", ikon: "kasa", dekont: "Tahsilat ve ödeme sonrası bakiye." },
      { href: "/banka", etiket: "Banka", ikon: "banka", dekont: "Havale ve EFT hareketleri." },
      { href: "/tahsilat", etiket: "Tahsilat", ikon: "tahsilat", dekont: "Cari hesaptan tahsilat." },
      { href: "/finans/odeme", etiket: "Ödeme", ikon: "odeme", dekont: "Müstahsil/tüccar/fabrika ödemeleri." },
      { href: "/masraf", etiket: "Masraf", ikon: "masraf", dekont: "Nakliye, kantar, hamaliye." },
      { href: "/avans", etiket: "Avans", ikon: "avans", dekont: "Nakit/ayni/fındık karşılığı avans." },
    ],
  };
}

export function musteriModulu(): Modul {
  return {
    id: "musteri",
    etiket: "Cari İşlemleri",
    altModuller: [
      { href: "/cari/hesaplar", etiket: "Cari Hesaplar", ikon: "cari", dekont: "Müstahsil, tüccar, fabrika — çoklu bakiye." },
      { href: "/tahsilat", etiket: "Tahsilat", ikon: "tahsilat", dekont: "Cari hesaptan tahsilat." },
      { href: "/avans", etiket: "Avans", ikon: "avans", dekont: "Müstahsil avansı." },
      { href: "/satis", etiket: "Satış", ikon: "satis", dekont: "Fabrika/tüccara satış fişi." },
    ],
  };
}

export function raporModulu(): Modul {
  return {
    id: "rapor",
    etiket: "Raporlar",
    altModuller: [
      { href: "/raporlar", etiket: "Günlük Rapor", ikon: "rapor", dekont: "Alım, ödeme, tahsilat, emanet." },
      { href: "/kar-zarar", etiket: "Kâr / Zarar", ikon: "kar-zarar", dekont: "Seçili tarih aralığında P&L raporu." },
      { href: "/stok", etiket: "Stok Durumu", ikon: "stok", dekont: "Depo bazında stok özeti ve hareketleri." },
    ],
  };
}
