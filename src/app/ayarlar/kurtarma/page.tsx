import { requirePagePermission } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { KurtarmaListesi } from "./kurtarma-listesi";

const GERI_YUKLENEBILIR_TURLER = new Set(["Firma", "Depo", "KasaHesap", "Arac", "Personel", "Sezon", "Kullanici", "KullaniciRol", "YetkiRolu", "CariKart"]);

export default async function KurtarmaPage() {
  const user = await requirePagePermission("AYARLAR", "YONET");
  const kayitlar = (await prisma.auditKaydi.findMany({ where: { firmaId: user.firmaId }, orderBy: { createdAt: "desc" }, take: 100 })).filter((kayit) => kayit.oncekiVeri !== null);
  return <main className="mx-auto max-w-4xl p-6"><h1 className="text-2xl font-extrabold">Veri kurtarma</h1><p className="mt-2 text-sm text-muted-foreground">Tanım ve ayar kayıtları önceki sürümüne geri alınabilir. Finansal ve operasyonel kayıtlar silinmez; iptal veya ters kayıtla izlenebilir biçimde düzeltilir.</p><KurtarmaListesi kayitlar={kayitlar.map((kayit) => ({ id: kayit.id, hedefTipi: kayit.hedefTipi ?? "Kayıt", aciklama: kayit.aciklama, createdAt: kayit.createdAt.toISOString(), destekleniyor: GERI_YUKLENEBILIR_TURLER.has(kayit.hedefTipi ?? "") }))} /></main>;
}
