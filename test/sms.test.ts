import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  SMS_KARAKTER_LIMITLERI,
  asciiyeCevir,
  netgsmNumara,
  smsMetniHazirla,
  smsParcaHesapla,
  telefonTemizle,
} from "../src/lib/sms/utils";
import { NETGSM_VARSAYILAN_API, netgsmGonderimGovdesi } from "../src/lib/sms/saglayicilar";
import {
  NETGSM_GONDERIM_HATALARI,
  NETGSM_TESLIM_DURUMLARI,
  SMS_DURUM_ETIKETLERI,
  SMS_SAGLAYICI_ETIKETLERI,
  SMS_TIP_ETIKETLERI,
  type SmsAyarlari,
} from "../src/lib/sms/types";

const oku = (...parcalar: string[]) => readFileSync(path.resolve(...parcalar), "utf8");

function ayar(uzerine: Partial<SmsAyarlari> = {}): SmsAyarlari {
  return {
    aktif: true,
    saglayici: "NETGSM",
    apiUrl: "",
    kullaniciAdi: "8500000000",
    sifre: "gizli",
    baslik: "FILBERT",
    kayitSablonu: "sablon",
    tamamlandiSablonu: "sablon",
    teslimHatirlatmaSablonu: "sablon",
    otomatikGirisSms: true,
    birimMaliyetKurus: 42,
    kodlama: "TR",
    appname: "filbert",
    ...uzerine,
  };
}

test("SMS kredi hesabı Türkiye karakter limitlerini uygular", () => {
  // GSM-7 (yazdırılabilir ASCII) metinde tek parça sınırı 155 karakterdir.
  const ascii155 = smsParcaHesapla("A".repeat(155), "TR");
  assert.equal(ascii155.unicode, false);
  assert.equal(ascii155.sinir, SMS_KARAKTER_LIMITLERI.GSM7.tek);
  assert.equal(ascii155.parcaSayisi, 1);

  assert.equal(smsParcaHesapla("A".repeat(156), "TR").parcaSayisi, 2);
  assert.equal(smsParcaHesapla("A".repeat(148), "TR").parcaSayisi, 1);

  // Türkçe karakter UCS-2 kodlama gerektirir; tek parça sınırı 65'e düşer.
  const turkce65 = smsParcaHesapla("ş".repeat(65), "TR");
  assert.equal(turkce65.unicode, true);
  assert.equal(turkce65.sinir, SMS_KARAKTER_LIMITLERI.UCS2.tek);
  assert.equal(turkce65.parcaSayisi, 1);
  assert.equal(smsParcaHesapla("ş".repeat(66), "TR").parcaSayisi, 2);

  // Boş mesaj kredi harcamaz.
  assert.equal(smsParcaHesapla("", "TR").parcaSayisi, 0);
});

test("ASCII kodlama Türkçe harfleri sadeleştirip krediyi korur", () => {
  assert.equal(asciiyeCevir("ŞĞÜÖÇİığşöüç"), "SGUOCIigsouc");

  const tr = smsParcaHesapla("ş".repeat(200), "TR");
  const ascii = smsParcaHesapla("ş".repeat(200), "ASCII");
  assert.equal(tr.unicode, true);
  assert.equal(ascii.unicode, false);
  assert.ok(ascii.parcaSayisi < tr.parcaSayisi, "ASCII kodlama daha az kredi harcamalı");

  const hazir = smsMetniHazirla("Fındığınız hazır", "ASCII");
  assert.equal(hazir.unicode, false);
  assert.equal(hazir.metin, "Findiginiz hazir");
});

test("Netgsm numarayı 5XXXXXXXXX biçiminde bekler", () => {
  assert.equal(netgsmNumara("+90 532 123 45 67"), "5321234567");
  assert.equal(netgsmNumara("0532 123 45 67"), "5321234567");
  assert.equal(netgsmNumara("5321234567"), "5321234567");
  assert.equal(netgsmNumara("905321234567"), "5321234567");
  // Sabit hat ve eksik numara gönderilmez; kredi harcanmaz.
  assert.equal(netgsmNumara("0212 123 45 67"), null);
  assert.equal(netgsmNumara("532123"), null);

  // Genel telefon normalizasyonu (depolama biçimi) korunur.
  assert.equal(telefonTemizle("0532 123 45 67"), "905321234567");
});

test("Netgsm gönderim gövdesi onaylı başlık, kodlama ve İYS filtresini taşır", () => {
  const govde = netgsmGonderimGovdesi(
    ayar(),
    "0532 123 45 67",
    "Sayın Ahmet, talebiniz alınmıştır.",
    "5321234567"
  );

  assert.equal(govde.msgheader, "FILBERT");
  assert.equal(govde.encoding, "TR");
  // Bildirim mesajları ticari ileti sayılmadığı için İYS filtresi kapalı gider.
  assert.equal(govde.iysfilter, "0");
  assert.equal(govde.appname, "filbert");
  assert.deepEqual(govde.messages, [
    { msg: "Sayın Ahmet, talebiniz alınmıştır.", no: "5321234567" },
  ]);

  const asciiGovde = netgsmGonderimGovdesi(
    ayar({ kodlama: "ASCII" }),
    "0532 123 45 67",
    "Fındığınız hazır",
    "5321234567"
  );
  assert.equal(asciiGovde.encoding, "ASCII");
  assert.deepEqual(asciiGovde.messages, [{ msg: "Findiginiz hazir", no: "5321234567" }]);

  assert.equal(NETGSM_VARSAYILAN_API, "https://api.netgsm.com.tr");
});

test("Netgsm hata ve teslim kodları Türkçe karşılıklara eşlenir", () => {
  // HTTP 200 dönse bile gerçek sonuç gövdedeki koddadır; 30/40/20 açıklamasız kalmamalı.
  assert.match(NETGSM_GONDERIM_HATALARI["30"], /IP/);
  assert.match(NETGSM_GONDERIM_HATALARI["40"], /başlığı/);
  assert.match(NETGSM_GONDERIM_HATALARI["20"], /karakter/);
  assert.equal(NETGSM_GONDERIM_HATALARI["00"], "Gönderim kuyruğa alındı");

  assert.equal(NETGSM_TESLIM_DURUMLARI[1].durum, "TESLIM_EDILDI");
  assert.equal(NETGSM_TESLIM_DURUMLARI[0].durum, "GONDERILDI");
  assert.equal(NETGSM_TESLIM_DURUMLARI[14].durum, "HATA");
  assert.equal(NETGSM_TESLIM_DURUMLARI[16].durum, "HATA");

  assert.equal(SMS_DURUM_ETIKETLERI.TESLIM_EDILDI, "Teslim edildi");
  assert.equal(SMS_TIP_ETIKETLERI.TESLIM_HATIRLATMA, "Teslim hatırlatma");
  assert.equal(SMS_SAGLAYICI_ETIKETLERI.NETGSM, "Netgsm");
});

test("her SMS gönderimi kalıcı kayda yazılır ve durumu güncellenir", () => {
  const servis = oku("src/lib/sms/sms-servisi.ts");

  // Gönderim öncesi kuyruk kaydı, gönderim sonrası sonuç güncellemesi.
  assert.match(servis, /prisma\.smsKaydi\.create\(/);
  assert.match(servis, /durum: "KUYRUKTA"/);
  assert.match(servis, /durum: sonuc\.basarili \? "GONDERILDI" : "HATA"/);
  assert.match(servis, /durum: "SIMULASYON"/);
  // Sağlayıcı kimliği, hata kodu ve kredi adedi kayda geçer.
  assert.match(servis, /saglayiciIsId: sonuc\.mesajId \?\? null/);
  assert.match(servis, /hataKodu: sonuc\.hataKodu \?\? null/);
  // Teslim raporu kaydı günceller.
  assert.match(servis, /export async function smsTeslimDurumunuYenile/);
  assert.match(servis, /NETGSM_TESLIM_DURUMLARI\[satir\.status\]/);
  // Tekrar gönderim kalıcı silme yapmaz.
  assert.doesNotMatch(servis, /smsKaydi\.delete/);

  // Talep akışındaki gönderimler tip ve talep bağlantısıyla kaydedilir.
  const aksiyonlar = oku("src/lib/actions/hizmet.ts");
  assert.match(aksiyonlar, /tip: "KAYIT"/);
  assert.match(aksiyonlar, /tip: "TAMAMLANDI"/);
  assert.match(aksiyonlar, /tip: hatirlatmaMi \? "TESLIM_HATIRLATMA" : "TAMAMLANDI"/);
  assert.match(aksiyonlar, /hizmetIslemiId: k\.id/);
});

test("SMS günlüğü firma kapsamlı şemada ve migration'da tanımlıdır", () => {
  const schema = oku("prisma/schema.prisma");
  assert.match(schema, /model SmsKaydi \{[\s\S]*firmaId\s+String/);
  assert.match(schema, /model SmsKaydi \{[\s\S]*@@index\(\[firmaId, createdAt\]\)/);
  assert.match(schema, /model SmsKaydi \{[\s\S]*@@index\(\[firmaId, durum\]\)/);
  assert.match(schema, /model SmsKaydi \{[\s\S]*onDelete: SetNull/);
  // Sağlayıcı bazlı ek ayarlar.
  assert.match(schema, /model SmsAyari \{[\s\S]*birimMaliyetKurus\s+Int\?/);
  assert.match(schema, /model SmsAyari \{[\s\S]*kodlama\s+String\s+@default\("TR"\)/);

  const migration = "prisma/migrations/20261010193000_sms_gonderim_kayitlari/migration.sql";
  assert.ok(existsSync(path.resolve(migration)), "SMS kayıt migration'ı bulunmalı");
  const sql = oku(migration);
  assert.match(sql, /CREATE TABLE "SmsKaydi"/);
  assert.match(sql, /"SmsKaydi_firmaId_fkey" FOREIGN KEY \("firmaId"\)/);
});

test("SMS Merkezi ve dışa aktarım HIZMET görüntüleme izni ister", () => {
  const sayfa = oku("src/app/hizmet/sms/page.tsx");
  assert.match(sayfa, /requirePagePermission\("HIZMET", "GORUNTULE"\)/);
  assert.match(sayfa, /guncelleYetkisi=\{izinVar\(actor, "HIZMET", "GUNCELLE"\)\}/);

  const csv = oku("src/app/api/hizmet/sms/csv/route.ts");
  assert.match(csv, /requirePermission\("HIZMET", "GORUNTULE"\)/);

  // Rota izni tek kaynaktan (modul-navigasyon) yönetilir.
  const navigasyon = oku("src/lib/rbac/modul-navigasyon.ts");
  assert.match(navigasyon, /"\/hizmet\/sms": \["HIZMET", "GORUNTULE"\]/);
});

test("SMS Merkezi işleme modülü menülerinde yer alır, mobil menüyü şişirmez", () => {
  const masaustu = oku("src/components/masaustu-nav.tsx");
  assert.match(masaustu, /\{ href: "\/hizmet\/sms", etiket: "SMS Merkezi", ikon: MessageSquare \}/);

  const tanimlar = oku("src/lib/modul-tanimlari.ts");
  assert.match(tanimlar, /href: "\/hizmet\/sms"/);

  // Mobil alt menü 5 ögeyi geçmez; SMS Merkezi panodan ve ayarlardan erişilir.
  const modul = oku("src/lib/modul.ts");
  const islemBlogu = modul.split("  islem: [")[1]?.split("  ],")[0] ?? "";
  assert.ok(islemBlogu.length > 0, "işleme modülü alt menüsü bulunmalı");
  assert.ok(!islemBlogu.includes("/hizmet/sms"), "SMS Merkezi mobil alt menüde olmamalı");

  // Pano SMS metriklerini gösterir ve SMS Merkezi'ne bağlanır.
  const pano = oku("src/app/pano-isleme.tsx");
  assert.match(pano, /href="\/hizmet\/sms"/);
  assert.match(pano, /sayaclar\.sms\.bugunTeslim/);
});