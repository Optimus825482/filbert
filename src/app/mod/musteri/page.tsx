import { ModulSekmeler, type Modul } from "@/components/modul-tabs";
import { requirePagePermission } from "@/lib/rbac/guard";
import { modulleriIzinlereGoreFiltrele } from "@/lib/rbac/modul-navigasyon";

export const dynamic = "force-dynamic";

export default async function MusteriModulPage() {
  const actor = await requirePagePermission("CARI", "GORUNTULE");
  const modüller: Modul[] = [
    {
      id: "musteri",
      etiket: "Müşteri İşlemleri",
      altModuller: [
        { href: "/cari/hesaplar", etiket: "Cari Hesaplar", ikon: "cari", dekont: "Üretici, tüccar, fabrika — çoklu bakiye." },
        { href: "/tahsilat", etiket: "Tahsilat", ikon: "tahsilat", dekont: "Cari hesaptan tahsilat." },
        { href: "/avans", etiket: "Avans", ikon: "avans", dekont: "Nakit/ayni/fındık karşılığı avans." },
        { href: "/satis", etiket: "Satış", ikon: "satis", dekont: "Müşteriye satış fişi." },
      ],
    },
    {
      id: "findik",
      etiket: "Fındık İşlemleri",
      altModuller: [
        { href: "/alim/yeni", etiket: "Yeni Alım Fişi", ikon: "alim-yeni", dekont: "Müşteri, miktar, fiyat, kalite." },
        { href: "/alim", etiket: "Alım Yönetimi", ikon: "alim-liste", dekont: "Fiş listesi, randıman, emanet." },
        { href: "/randiman", etiket: "Randıman Takibi", ikon: "randiman", dekont: "Bekleyen + tamamlanan randımanlar." },
        { href: "/virman", etiket: "Virman", ikon: "virman", dekont: "Depolar arası aktarım." },
        { href: "/sevkiyat", etiket: "Sevk Planlama", ikon: "sevk", dekont: "Depolar arası transfer ve sevkiyat takibi." },
        { href: "/emanet", etiket: "Emanetler", ikon: "emanet", dekont: "Fiyatsız bırakılan emanetler." },
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
      id: "rapor",
      etiket: "Raporlar",
      altModuller: [
        { href: "/raporlar", etiket: "Günlük Rapor", ikon: "rapor", dekont: "Alım, ödeme, tahsilat, emanet." },
        { href: "/kar-zarar", etiket: "Kâr / Zarar", ikon: "kar-zarar", dekont: "Seçili tarih aralığında P&L raporu." },
        { href: "/stok", etiket: "Stok Durumu", ikon: "stok", dekont: "Depo bazında stok özeti ve hareketleri." },
      ],
    },
  ];

  return <ModulSekmeler modüller={modulleriIzinlereGoreFiltrele(actor, modüller)} aktifId="musteri" />;
}
