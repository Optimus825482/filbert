import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { PageBaslik } from "@/components/page-baslik";
import { SesliNotForm } from "@/components/sesli-not-form";
import { SesliFinansTaslagiForm } from "@/components/sesli-finans-taslagi-form";
import { getCariler } from "@/lib/queries";
import { HFAsistan } from "@/components/hf-asistan";
export const dynamic = "force-dynamic";
export default async function SesliNotPage() {
  const actor = await requirePagePermission("SESLI_NOT", "GORUNTULE");
  await requirePagePermission("CARI", "GORUNTULE");
  // Sesli notlar finansal içerik taşır: normal kullanıcı yalnız kendi notlarını
  // görür; finans onay yetkisi olan inceleyiciler firma genelini görebilir.
  const inceleyici = izinVar(actor, "FINANS", "ONAYLA");
  const [notlar, cariler] = await Promise.all([prisma.sesliNot.findMany({ where: { firmaId: actor.firmaId, ...(inceleyici ? {} : { kullaniciId: actor.id }) }, include: { kullanici: { select: { ad: true } } }, orderBy: { createdAt: "desc" }, take: 30 }), getCariler()]);
  const olusturYetkisi = izinVar(actor, "SESLI_NOT", "OLUSTUR");
  const notlarIcin = notlar.map((not) => ({ id: not.id, metin: not.duzeltilmisMetin ?? not.hamMetin, durum: not.durum, kullanici: not.kullanici.ad, createdAt: not.createdAt.toISOString() }));
  return <div className="space-y-4"><PageBaslik baslik="Sesli not" alt="Konuşun, metni kontrol edin, sonra taslak olarak kaydedin" geri="/" /><HFAsistan />{olusturYetkisi ? <><SesliFinansTaslagiForm cariler={cariler.map(c=>({id:c.id,ad:c.ad}))}/><SesliNotForm kullaniciId={actor.id} notlar={notlarIcin} /></> : <SesliNotForm kullaniciId={actor.id} notlar={notlarIcin} saltOkunur />}</div>;
}
