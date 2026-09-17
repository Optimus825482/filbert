import { getCurrentOturum } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { AramaIcerik } from "./arama-icerik";

const ROTA_IZINLERI = [
  ["/alim/yeni", "ALIM", "OLUSTUR"], ["/alim", "ALIM", "GORUNTULE"], ["/randiman", "RANDIMAN", "GORUNTULE"],
  ["/virman", "FINANS", "GORUNTULE"], ["/emanet", "EMANET", "GORUNTULE"], ["/sevkiyat", "SEVKIYAT", "GORUNTULE"],
  ["/kasa", "FINANS", "GORUNTULE"], ["/banka", "FINANS", "GORUNTULE"], ["/tahsilat", "FINANS", "GORUNTULE"],
  ["/finans", "FINANS", "GORUNTULE"], ["/finans/odeme", "FINANS", "GORUNTULE"], ["/masraf", "MASRAF", "GORUNTULE"], ["/avans", "AVANS", "GORUNTULE"],
  ["/cari/hesaplar", "CARI", "GORUNTULE"], ["/raporlar", "RAPORLAR", "GORUNTULE"], ["/fiyatlar", "AYARLAR", "GORUNTULE"],
  ["/stok", "STOK", "GORUNTULE"],
] as const;

export default async function AramaPage() {
  await requirePagePermission("DASHBOARD", "GORUNTULE");
  const user = (await getCurrentOturum())?.kullanici;
  if (!user) return null;
  const izinliRotalar = ROTA_IZINLERI.filter(([, modul, eylem]) => izinVar(user, modul, eylem)).map(([rota]) => rota);
  return <AramaIcerik izinliRotalar={izinliRotalar} cariAramaYetkisi={izinVar(user, "CARI", "GORUNTULE")} />;
}
