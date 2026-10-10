import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { tarihSaat } from "@/lib/format";
import {
  etiketProfiliGetir,
  findikIslemeAyarlariniCoz,
  yaziciHedefTanimi,
  yaziciYapilandirildiMi,
} from "@/lib/findik-isleme";
import { HizmetEtiketYazdirici } from "./etiket-yazdirici";

export const dynamic = "force-dynamic";

export default async function HizmetEtiketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const kullanici = await requirePagePermission("HIZMET", "GORUNTULE");
  const { id } = await params;
  const firma = await getCurrentFirma();

  const kayit = await prisma.hizmetIslemi.findFirst({
    where: { id, firmaId: firma.id },
  });

  if (!kayit) notFound();

  // Kayda özel profil yoksa firma varsayılanı (Ayarlar → Fındık İşleme) kullanılır.
  const islemeAyarlari = findikIslemeAyarlariniCoz(firma.ayarlar);
  const seciliProfil = etiketProfiliGetir(kayit.etiketProfili || islemeAyarlari.etiketProfili);
  const yaziciHazir = yaziciYapilandirildiMi(islemeAyarlari.yazici);
  // Doğrudan baskı, kaydı güncelleyen bir işlemdir; ayrıca GUNCELLE izni gerekir.
  const yazdirmaYetkisi = izinVar(kullanici, "HIZMET", "GUNCELLE");
  const yaziciAdi = yaziciHedefTanimi(islemeAyarlari.yazici);

  const islemler: string[] = [];
  if (kayit.kirma) islemler.push("Kırma");
  if (kayit.kavurma) islemler.push("Kavurma");
  if (kayit.paketleme) islemler.push("Vakumlu Paketleme");

  return (
    <HizmetEtiketYazdirici
      hizmetId={kayit.id}
      siraNo={kayit.siraNo}
      musteriAdi={kayit.musteriAdi}
      telefon={kayit.telefon}
      kilo={String(kayit.kilo)}
      islemler={islemler}
      paketTipi={kayit.paketTipi}
      paketAdedi={kayit.paketAdedi}
      odemeDurumu={kayit.odemeDurumu}
      notlar={kayit.notlar}
      tarihSaatStr={tarihSaat(kayit.createdAt)}
      firmaAdi={firma.unvan}
      toplamTutar={String(kayit.toplamTutar)}
      etiketProfili={seciliProfil.kod}
      yaziciHazir={yaziciHazir}
      yaziciAdi={yaziciAdi}
      yazdirmaYetkisi={yazdirmaYetkisi}
      yaziciHedefi={islemeAyarlari.yazici.hedef}
      bluetoothYogunluk={islemeAyarlari.yazici.bluetoothYogunluk}
    />
  );
}
