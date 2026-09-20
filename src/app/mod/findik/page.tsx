import { ModulSekmeler, type Modul } from "@/components/modul-tabs";
import { prisma } from "@/lib/db";
import { getCurrentFirmaId } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { modulleriIzinlereGoreFiltrele } from "@/lib/rbac/modul-navigasyon";

export const dynamic = "force-dynamic";

export default async function FindikModulPage() {
  const actor = await requirePagePermission("ALIM", "GORUNTULE");
  const firmaId = await getCurrentFirmaId();
  const bekleyenRandiman = await prisma.alimFisi.count({ where: { randimanDurumu: "BEKLIYOR", durum: { not: "IPTAL" }, cari: { firmaId } } });

  const modüller: Modul[] = [
    {
      id: "findik",
      etiket: "Fındık İşlemleri",
      altModuller: [
        { href: "/alim/yeni", etiket: "Yeni Alım Fişi", ikon: "alim-yeni", dekont: "Müşteri, miktar, fiyat, kalite — tek işlemde." },
        { href: "/alim", etiket: "Alım Yönetimi", ikon: "alim-liste", badge: bekleyenRandiman > 0 ? bekleyenRandiman : undefined, dekont: "Fiş listesi, randıman tamamlama, emanet fişleri." },
        { href: "/hizmet", etiket: "Kırma & Paketleme", ikon: "alim-liste", dekont: "Ev kullanımı fındık kırma, kavurma ve paketleme siparişleri." },
        { href: "/randiman", etiket: "Randıman Takibi", ikon: "randiman", dekont: "Kalite sonuçlarını ürün ve müşteri hareketleriyle birlikte değerlendirin." },
        { href: "/virman", etiket: "Virman Kontrolü", ikon: "virman", dekont: "Depolar veya hesaplar arasındaki miktar aktarımını izlenebilir biçimde yürütün." },
        { href: "/sevkiyat", etiket: "Sevk Planlama", ikon: "sevk", dekont: "Hazırlanan ürünleri araç, müşteri ve teslimat bilgileriyle sevke bağlayın." },
        { href: "/emanet", etiket: "Emanetler", ikon: "emanet", dekont: "Fiyatsız bırakılan emanetler ve bozma işlemleri." },
      ],
    },
    {
      id: "finans",
      etiket: "Finans İşlemleri",
      altModuller: [
        { href: "/kasa", etiket: "Kasa", ikon: "kasa", dekont: "Tahsilat ve ödeme sonrası bakiye." },
        { href: "/banka", etiket: "Banka", ikon: "banka", dekont: "Havale ve EFT hareketleri." },
        { href: "/tahsilat", etiket: "Tahsilat", ikon: "tahsilat", dekont: "Cari hesaptan tahsilat." },
        { href: "/finans/odeme", etiket: "Ödeme", ikon: "odeme", dekont: "Üretici/tüccar/fabrika ödemeleri." },
        { href: "/masraf", etiket: "Masraf", ikon: "masraf", dekont: "Nakliye, kantar, hamaliye." },
        { href: "/avans", etiket: "Avans", ikon: "avans", dekont: "Nakit/ayni/fındık karşılığı avans." },
      ],
    },
    {
      id: "musteri",
      etiket: "Müşteri İşlemleri",
      altModuller: [
        { href: "/cari/hesaplar", etiket: "Cari Hesaplar", ikon: "cari", dekont: "Üretici, tüccar, fabrika — çoklu bakiye." },
        { href: "/avans", etiket: "Avans", ikon: "avans", dekont: "Üretici avansı." },
        { href: "/tahsilat", etiket: "Tahsilat", ikon: "tahsilat", dekont: "Cari hesaptan tahsilat." },
        { href: "/satis", etiket: "Satış", ikon: "satis", dekont: "Müşteriye satış fişi." },
      ],
    },
    {
      id: "rapor",
      etiket: "Raporlar",
      altModuller: [
        { href: "/raporlar", etiket: "Günlük Rapor", ikon: "rapor", dekont: "Alım, ödeme, tahsilat, emanet." },
        { href: "/kar-zarar", etiket: "Kâr / Zarar", ikon: "kar-zarar", dekont: "Seçili tarih aralığında P&L raporu." },
        { href: "/stok", etiket: "Stok Durumu", ikon: "stok", dekont: "Depo bazında stok özeti ve hareketleri." },
      ],
    },
  ];

  return <ModulSekmeler modüller={modulleriIzinlereGoreFiltrele(actor, modüller)} aktifId="findik" />;
}
