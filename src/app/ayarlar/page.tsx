import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import {
  getAraclar,
  getDepolar,
  getKullanicilar,
  getMasrafTurleri,
  getPersonel,
  getSezonlar,
  getSubeler,
  getTumHesaplar,
} from "@/lib/queries";
import { PageBaslik } from "@/components/page-baslik";
import { AyarIcerik } from "./ayar-icerik";
import { izinVar, requireAnyPagePermission } from "@/lib/rbac/guard";
import { getFirmaSmsAyarlari } from "@/lib/sms/sms-servisi";
import {
  MODULLER,
  MODUL_BASLIGI,
  MODUL_CEREZI,
  MODUL_IDLERI,
  aktifModulBelirle,
  dbModuluCoz,
  type ModulId,
} from "@/lib/modul";

export const dynamic = "force-dynamic";

export default async function AyarlarPage() {
  const actor = await requireAnyPagePermission(
    ["AYARLAR", "GORUNTULE"],
    ["TANIMLAR", "GORUNTULE"],
    ["KULLANICI_YONETIMI", "YONET"],
    // Modül değiştirme ekranı her modül kullanıcısına açıktır; diğer sekmeler
    // kendi izinlerine göre gizlenir.
    ["ALIM", "GORUNTULE"],
    ["HIZMET", "GORUNTULE"],
  );
  const firmaId = actor.firmaId;
  // Modül sekmesi: aktif modül istek yolu → çerez → kullanıcı varsayılanı
  // sırasıyla belirlenir (Ayarlar modüle özel bir ekran olmadığı için yol
  // genellikle boştur).
  const hdrs = await headers();
  const aktifModul = aktifModulBelirle({
    yol: hdrs.get(MODUL_BASLIGI),
    cerez: (await cookies()).get(MODUL_CEREZI)?.value,
    varsayilan: actor.varsayilanModul,
  });
  const yetkiliModuller: ModulId[] = MODUL_IDLERI.filter((modul) =>
    izinVar(actor, MODULLER[modul].izinModulu, "GORUNTULE"),
  );
  const ayarGoruntuleYetkisi = izinVar(actor, "AYARLAR", "GORUNTULE");
  const tanimGoruntuleYetkisi = izinVar(actor, "TANIMLAR", "GORUNTULE");
  const kullaniciYonetYetkisi = izinVar(actor, "KULLANICI_YONETIMI", "YONET");
  const sistemGoruntuleYetkisi = izinVar(actor, "AYARLAR", "YONET");
  const [
    firma,
    sezon,
    kullanicilar,
    kullaniciSayisi,
    cariSayisi,
    hesap,
    depo,
    depolar,
    hesaplarTumu,
    araclar,
    personel,
    sezonlar,
    subeler,
    masrafTurleri,
    hizmetTipleri,
    smsAyari,
  ] = await Promise.all([
    ayarGoruntuleYetkisi ? prisma.firma.findUnique({ where: { id: firmaId } }) : Promise.resolve(null),
    ayarGoruntuleYetkisi ? prisma.sezon.findFirst({ where: { firmaId, aktif: true } }) : Promise.resolve(null),
    kullaniciYonetYetkisi ? getKullanicilar() : Promise.resolve([]),
    kullaniciYonetYetkisi ? prisma.kullanici.count({ where: { firmaId } }) : Promise.resolve(0),
    sistemGoruntuleYetkisi && izinVar(actor, "CARI", "GORUNTULE") ? prisma.cariKart.count({ where: { firmaId, aktif: true } }) : Promise.resolve(0),
    sistemGoruntuleYetkisi && izinVar(actor, "FINANS", "GORUNTULE") ? prisma.kasaHesap.count({ where: { firmaId, aktif: true } }) : Promise.resolve(0),
    sistemGoruntuleYetkisi && izinVar(actor, "TANIMLAR", "GORUNTULE") ? prisma.depo.count({ where: { firmaId, aktif: true } }) : Promise.resolve(0),
    tanimGoruntuleYetkisi ? getDepolar() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getTumHesaplar() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getAraclar() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getPersonel() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getSezonlar() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getSubeler() : Promise.resolve([]),
    tanimGoruntuleYetkisi ? getMasrafTurleri("TUMU") : Promise.resolve([]),
    tanimGoruntuleYetkisi ? prisma.hizmetTipi.findMany({ where: { firmaId }, orderBy: { sira: "asc" } }) : Promise.resolve([]),
    ayarGoruntuleYetkisi ? getFirmaSmsAyarlari(firmaId) : Promise.resolve(null),
  ]);
  const roller = kullaniciYonetYetkisi ? await prisma.yetkiRolu.findMany({ where: { firmaId, aktif: true }, select: { id: true, ad: true }, orderBy: { ad: "asc" } }) : [];

  return (
    <div>
      <PageBaslik baslik="Ayarlar" alt="Uygulama ve firma ayarları" geri="/" />

      <AyarIcerik
        tanimOlusturYetkisi={izinVar(actor, "TANIMLAR", "OLUSTUR")}
        tanimGuncelleYetkisi={izinVar(actor, "TANIMLAR", "GUNCELLE")}
        ayarGoruntuleYetkisi={ayarGoruntuleYetkisi}
        tanimGoruntuleYetkisi={tanimGoruntuleYetkisi}
        kullaniciYonetYetkisi={kullaniciYonetYetkisi}
        sistemGoruntuleYetkisi={sistemGoruntuleYetkisi}
        firmaGuncelleYetkisi={izinVar(actor, "AYARLAR", "GUNCELLE")}
        firma={
          firma
            ? { unvan: firma.unvan, vergiNo: firma.vergiNo ?? "", vergiDairesi: firma.vergiDairesi ?? "", adres: firma.adres ?? "", telefon: firma.telefon ?? "" }
            : null
        }
        sezon={sezon ? { ad: sezon.ad, baslangic: sezon.baslangic.toISOString(), bitis: sezon.bitis.toISOString() } : null}
        kullanicilar={kullanicilar.map((k) => ({
          id: k.id,
          ad: k.ad,
          telefon: k.telefon ?? "",
          rol: k.rol ?? "ROL_ATANMAMIS",
          rolIds: k.roller.map((rol) => rol.rolId),
          aktif: k.aktif,
          varsayilanModul: dbModuluCoz(k.varsayilanModul),
        }))}
        kullaniciSayisi={kullaniciSayisi}
        cariSayisi={cariSayisi}
        hesap={hesap}
        depo={depo}
        depolar={depolar.map((d) => ({ id: d.id, ad: d.ad, subeId: d.subeId, aktif: d.aktif }))}
        hesaplarTumu={hesaplarTumu.map((h) => ({
          id: h.id,
          ad: h.ad,
          tip: h.tip,
          bakiyeTuru: h.bakiyeTuru,
          bankaAdi: h.bankaAdi,
          iban: h.iban,
          aktif: h.aktif,
          modul: h.modul,
        }))}
        araclar={araclar.map((a) => ({
          id: a.id,
          plaka: a.plaka,
          marka: a.marka,
          tip: a.tip,
          sofor: a.sofor,
          aktif: a.aktif,
        }))}
        personel={personel.map((p) => ({
          id: p.id,
          ad: p.ad,
          telefon: p.telefon,
          gorev: p.gorev,
          tckn: p.tckn,
          aktif: p.aktif,
        }))}
        sezonlar={sezonlar.map((s) => ({
          id: s.id,
          ad: s.ad,
          baslangic: s.baslangic.toISOString(),
          bitis: s.bitis.toISOString(),
          aktif: s.aktif,
        }))}
        subeler={subeler.map((s) => ({ id: s.id, ad: s.ad }))}
        masrafTurleri={masrafTurleri.map((t) => ({ id: t.id, ad: t.ad, aktif: t.aktif }))}
        roller={roller}
        aktifModul={aktifModul}
        varsayilanModul={dbModuluCoz(actor.varsayilanModul)}
        yetkiliModuller={yetkiliModuller}
        hizmetTipleri={hizmetTipleri.map((h) => ({
          id: h.id,
          ad: h.ad,
          kirma: h.kirma,
          kavurma: h.kavurma,
          paketleme: h.paketleme,
          varsayilanBirimFiyat: Number(h.varsayilanBirimFiyat),
          sira: h.sira,
          aktif: h.aktif,
        }))}
        smsAyarlari={
          smsAyari ?? {
            aktif: false,
            saglayici: "TEST",
            apiUrl: "",
            kullaniciAdi: "",
            sifre: "",
            baslik: "",
            kayitSablonu: "",
            tamamlandiSablonu: "",
            teslimHatirlatmaSablonu: "",
            otomatikGirisSms: true,
          }
        }
      />
    </div>
  );
}
