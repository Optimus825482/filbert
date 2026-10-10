import assert from "node:assert/strict";
import test from "node:test";

import {
  ImageEncoder,
  NiimbotPacket,
  PacketReceivedEvent,
  PageColorType,
  RequestCommandId,
  ResponseCommandId,
} from "@mmote/niimbluelib";

import {
  NIMBOT_ALT_EMNIYETI,
  NIMBOT_BASLIK_NOKTASI,
  NIMBOT_ROL_PUNTOSU,
  NIMBOT_UST_BOSLUGU,
  esikliNoktaKaynagi,
  nimbotEtiketIcerigi,
  nimbotOlcusu,
  nimbotPunto,
  nimbotSablonu,
  pikselParlakligi,
  qrMatrisiOlustur,
  qrNoktaOlcusu,
  type NimbotIslemSatiri,
  type NimbotMetinSatiri,
  type NimbotSatirRolu,
} from "../src/lib/yazici/nimbot-etiket";
import {
  ETIKET_BASKI_DAVRANISLARI,
  VARSAYILAN_BLUETOOTH_YOGUNLUGU,
  VARSAYILAN_ETIKET_BASKI_DAVRANISI,
  etiketBaskiDavranisiGecerliMi,
  etiketBaskiDavranisiGetir,
  findikIslemeAyarBlogunuBirlestir,
  findikIslemeAyarlariniCoz,
  yaziciHedefGecerliMi,
  yaziciHedefTanimi,
  yaziciYapilandirildiMi,
  type FindikIslemeAyarlari,
} from "../src/lib/findik-isleme";
import {
  NIMBOT_SERI_BAGLANTI_DENEMESI,
  NIMBOT_SERI_BILGI_ZAMAN_ASIMI,
  NIMBOT_SERI_PAKET_ARALIGI,
  NIMBOT_SERI_PAKET_ZAMAN_ASIMI,
  NimbotUsbIstemcisi,
} from "../src/lib/yazici/nimbot";
import type { EtiketVerisi } from "../src/lib/yazici/escpos";

/** 50×50 şablonunda ölçek büyütmesinin beklenen üst sınırı. */
const NIMBOT_ROL_MAX_BEKLEME = 1;

const ORNEK: EtiketVerisi = {
  firmaAdi: "AKAYDIN TARIM",
  siraNo: "0042",
  musteriAdi: "Şükrü Çağlayan",
  telefon: "05321112233",
  kilo: "25.00",
  islemler: { kirma: true, kavurma: true, paketleme: false },
  paketTipi: "1_KG",
  paketAdedi: 25,
  odemeDurumu: "BEKLIYOR",
  toplamTutar: "200.00",
  tarihSaatStr: "10.10.2026 14:30",
};

/** Etiket planındaki yalnızca metin satırları. */
function metinSatirlari(veri: EtiketVerisi): NimbotMetinSatiri[] {
  return nimbotEtiketIcerigi(veri).flatMap((satir) => (satir.tip === "metin" ? [satir] : []));
}

/** Etiket planındaki işlem bloğu. */
function islemBlogu(veri: EtiketVerisi): NimbotIslemSatiri {
  const blok = nimbotEtiketIcerigi(veri).find(
    (satir): satir is NimbotIslemSatiri => satir.tip === "islem"
  );
  assert.ok(blok, "işlem bloğu bulunamadı");
  return blok;
}



/** 2×2 RGBA tamponu üretir; verilen renk sırası satır satır uygulanır. */
function rgbaOlustur(renkler: Array<[number, number, number]>): Uint8ClampedArray {
  const veri = new Uint8ClampedArray(renkler.length * 4);
  renkler.forEach(([r, g, b], i) => {
    veri[i * 4] = r;
    veri[i * 4 + 1] = g;
    veri[i * 4 + 2] = b;
    veri[i * 4 + 3] = 255;
  });
  return veri;
}

test("Etiket içeriği müşteri öncelikli düzeni izler (50×50 etikete taşmaz)", () => {
  const satirlar = metinSatirlari(ORNEK);
  const duz = satirlar.map((s) => s.metin);

  // İlk okunan bilgi müşteridir: ad ve telefon en üstte, aynı puntoyla.
  assert.equal(duz[0], "Şükrü Çağlayan");
  assert.equal(satirlar[0].rol, "baslik");
  assert.equal(duz[1], "05321112233");
  assert.equal(satirlar[1].rol, "baslik");
  // Miktar başlıksız yazılır; sıra no büyük puntoyla, firma adı en altta durur.
  assert.equal(duz[2], "25.00 KG");
  assert.equal(duz[duz.length - 2], "#0042");
  assert.equal(satirlar[satirlar.length - 2].rol, "vurgu");
  assert.equal(duz[duz.length - 1], "AKAYDIN TARIM");
  // Tüm satırlar ortalanır (operatör onaylı düzen).
  assert.equal(satirlar.every((s) => s.hizala === "orta"), true);
  // İstenmeyen başlıklar etikete yazılmaz.
  assert.equal(duz.some((m) => m.startsWith("MİKTAR")), false);
  assert.equal(duz.some((m) => m.startsWith("MÜŞTERİ")), false);
  assert.equal(duz.some((m) => m.startsWith("TELEFON")), false);
  assert.equal(duz.some((m) => m.startsWith("YAPILACAK")), false);
});

test("Seçili hizmetler tek satırda yazılır, QR kod basılmaz", () => {
  const blok = islemBlogu(ORNEK);
  // İşaret kutuları kaldırıldı; yalnızca yapılacak işler ve paket bilgisi yazılır.
  assert.deepEqual(blok.islemler, ["Kırma - Kavurma - 25x 1 KG"]);
  assert.equal(blok.hizala, "orta");
  assert.equal(blok.islemler.join(" ").includes("[X]"), false);
  // Etikette QR kod artık yok.
  assert.equal(nimbotEtiketIcerigi(ORNEK).some((s) => "veri" in s), false);
});

test("Fiyat etikete yazılmaz, yalnızca tahsilat durumu özetlenir", () => {
  // Tutar bilgisi etikete basılmaz; durum yalnızca miktar satırının sağında yazılır.
  const miktar = (veri: EtiketVerisi) => metinSatirlari(veri).find((s) => s.metin.endsWith("KG"));
  assert.equal(miktar(ORNEK)?.sagMetin, undefined);

  const odendi = miktar({ ...ORNEK, odemeDurumu: "ODENDI" });
  assert.equal(odendi?.sagMetin, "TAHSİL EDİLDİ");

  const veresiye = miktar({ ...ORNEK, odemeDurumu: "VERESIYE" });
  assert.equal(veresiye?.sagMetin, "VERESİYE");
});

test("Kopya bilgisi ve not yalnızca gerektiğinde eklenir", () => {
  const tek = metinSatirlari(ORNEK).map((s) => s.metin);
  assert.equal(tek.some((m) => m.startsWith("Kopya")), false);
  assert.equal(tek.some((m) => m.startsWith("NOT:")), false);

  const coklu = metinSatirlari({
    ...ORNEK,
    kopyaNo: 2,
    kopyaSayisi: 3,
    notlar: "  Çuvallar ayrı teslim edilecek  ",
  }).map((s) => s.metin);
  assert.ok(coklu.includes("Kopya 2/3"));
  assert.ok(coklu.includes("NOT: Çuvallar ayrı teslim edilecek"));
});

test("Rulo şablonları ayrı punto tablosu ve yayma davranışı taşır", () => {
  const kompakt = nimbotSablonu("NIMBOT_B1_50x30");
  const genis = nimbotSablonu("NIMBOT_B1_50x50");

  // Kompakt şablon operatör onaylı tabloyu ve hizalamayı korur.
  assert.equal(kompakt.rolPuntosu.baslik, NIMBOT_ROL_PUNTOSU.baslik);
  assert.equal(kompakt.yay, false);

  // Geniş (50×50) şablonda her rol daha büyüktür ve gövde alanı yayılır.
  for (const rol of Object.keys(NIMBOT_ROL_PUNTOSU) as NimbotSatirRolu[]) {
    assert.ok(genis.rolPuntosu[rol] > kompakt.rolPuntosu[rol], rol + " büyümeli");
  }
  assert.equal(genis.yay, true);
  assert.ok(genis.olcekMax <= NIMBOT_ROL_MAX_BEKLEME);

  // Tanımsız profil sessizce 50×50 şablonuna düşer.
  assert.equal(nimbotSablonu("YOK" as never).ad, genis.ad);
});

test("Başlık puntosu büyütüldü, diğer rollerden ayrışır", () => {
  assert.equal(NIMBOT_ROL_PUNTOSU.baslik, 25);
  // Başlık, müşteri satırından (vurgu) ve işlem satırlarından (normal) büyük kalmalı.
  assert.ok(NIMBOT_ROL_PUNTOSU.baslik > NIMBOT_ROL_PUNTOSU.vurgu);
  assert.ok(NIMBOT_ROL_PUNTOSU.baslik > NIMBOT_ROL_PUNTOSU.normal);
});

test("NOT, sıra no ve firma adı planın sonunda etiketin dibine yaslanır", () => {
  const veri: EtiketVerisi = { ...ORNEK, notlar: "Çuvallar ayrı teslim edilecek" };
  const plan = nimbotEtiketIcerigi(veri);
  const firma = plan[plan.length - 1];
  const sira = plan[plan.length - 2];
  const not = plan[plan.length - 3];

  // En altta firma adı, üstünde sıra no, onun üstünde NOT satırı durur.
  assert.equal(firma.tip === "metin" && firma.metin, "AKAYDIN TARIM");
  assert.equal(firma.tip === "metin" && firma.dibe, true);
  assert.equal(sira.tip === "metin" && sira.metin, "#0042");
  assert.equal(sira.tip === "metin" && sira.dibe, true);
  assert.equal(not.tip === "metin" && not.metin, "NOT: Çuvallar ayrı teslim edilecek");
  assert.equal(not.tip === "metin" && not.dibe, true);
  // Diğer satırlar akışta kalır; dibe işareti bu üç satıra aittir.
  assert.equal(plan.filter((s) => s.tip === "metin" && s.dibe).length, 3);
});

test("Tuval ölçüsü B1 baskı kafasına (384 nokta) sabitlenir", () => {
  const b1 = nimbotOlcusu("NIMBOT_B1_50x50");
  assert.equal(b1.genislik, NIMBOT_BASLIK_NOKTASI);
  // Alt kenarda güvenlik payı bırakılır; alttaki etikete taşma önlenir.
  assert.equal(b1.yukseklik, 384 - NIMBOT_ALT_EMNIYETI);
  assert.equal(b1.olcek, 1);

  // 50×30 mm rulo için baskı yüksekliği 30 mm'ye göre hesaplanır.
  const kisa = nimbotOlcusu("NIMBOT_B1_50x30");
  assert.equal(kisa.genislik, NIMBOT_BASLIK_NOKTASI);
  assert.equal(kisa.yukseklik, 240 - NIMBOT_ALT_EMNIYETI);

  // 80×70 mm profil B1'e sığacak biçimde küçültülür.
  const termal = nimbotOlcusu("TERMAL_80x70");
  assert.equal(termal.genislik, NIMBOT_BASLIK_NOKTASI);
  assert.equal(termal.yukseklik, 384 - NIMBOT_ALT_EMNIYETI);
});

test("Üst boşluk yazıcının basmadığı bölgeyi kapsar", () => {
  // Yazıcı görüntünün ilk satırlarını basmıyor; içerik bu bölgenin altından başlar.
  assert.ok(NIMBOT_UST_BOSLUGU >= 24);
  assert.ok(NIMBOT_UST_BOSLUGU < nimbotOlcusu("NIMBOT_B1_50x30").yukseklik);
});

test("Punto rol başına ölçeklenir ve okunabilir alt sınırın altına inmez", () => {
  assert.ok(nimbotPunto("buyuk") > nimbotPunto("normal"));
  assert.ok(nimbotPunto("normal") > nimbotPunto("kucuk"));
  assert.equal(nimbotPunto("buyuk", 0.2), 9);
});

test("Parlaklık ve eşikleme gri pikselleri tam siyah/beyaza indirir", () => {
  assert.equal(pikselParlakligi(0, 0, 0), 0);
  assert.equal(pikselParlakligi(255, 255, 255), 255);

  // (0,0) siyah · (1,0) beyaz · (0,1) beyaz · (1,1) gri (128)
  const rgba = rgbaOlustur([
    [0, 0, 0],
    [255, 255, 255],
    [255, 255, 255],
    [128, 128, 128],
  ]);
  const kaynak = esikliNoktaKaynagi(rgba, 2, 2);

  assert.equal(kaynak.getPixelColor(0, 0, "top"), 0x000000);
  assert.equal(kaynak.getPixelColor(1, 0, "top"), 0xffffff);
  assert.equal(kaynak.getPixelColor(1, 1, "top"), 0x000000, "gri piksel eşiğin altında siyaha döner");
  assert.equal(kaynak.getPixelColor(1, 1, "top", ), 0x000000);
});

test("Eşik değeri ve döndürme (left) niimbluelib adreslemesiyle uyumludur", () => {
  const rgba = rgbaOlustur([
    [0, 0, 0],
    [255, 255, 255],
    [255, 255, 255],
    [255, 255, 255],
  ]);
  // Eşik 200: gri pikseller de siyah sayılır.
  const griKabul = esikliNoktaKaynagi(rgbaOlustur([[180, 180, 180]]), 1, 1, 200);
  assert.equal(griKabul.getPixelColor(0, 0), 0x000000);

  const kaynak = esikliNoktaKaynagi(rgba, 2, 2);
  // "left" yönünde niimbluelib görüntüyü 90° döndürerek adresler:
  // (x=1, y=0) → indeks (2-1-1)*2+0 = 0 → siyah piksel.
  assert.equal(kaynak.getPixelColor(1, 0, "left"), 0x000000);
  assert.equal(kaynak.getPixelColor(0, 0, "left"), 0xffffff);
});

test("Nokta kaynağı niimbluelib ImageEncoder ile 1 bit raster üretir", () => {
  // 10×2 tuval: yalnızca sol üst piksel siyah; kolonlar 8'in katına tamamlanır.
  const renkler: Array<[number, number, number]> = [];
  for (let i = 0; i < 20; i++) renkler.push(i === 0 ? [0, 0, 0] : [255, 255, 255]);

  const kodlu = ImageEncoder.encode(
    esikliNoktaKaynagi(rgbaOlustur(renkler), 10, 2),
    PageColorType.SingleColor,
    "top"
  );

  assert.equal(kodlu.cols, 16);
  assert.equal(kodlu.rows, 2);
  assert.equal(kodlu.rowsData[0].dataType, "pixels");
  assert.equal(kodlu.rowsData[0].rowDataBlack?.[0], 0x80, "en soldaki nokta en anlamlı bit olur");
  assert.equal(kodlu.rowsData[0].rowDataBlack?.[1], 0x00);
  assert.equal(kodlu.rowsData[0].blackPixelsCount, 1);
  assert.equal(kodlu.rowsData[1].dataType, "void", "boş satır tekrar olarak sıkıştırılır");
});

test("QR matrisi ve modül ölçüsü tam noktaya oturur", () => {
  const matris = qrMatrisiOlustur("FILBERT-HIZMET:0042");
  assert.ok(matris.boyut >= 21);
  assert.equal((matris.boyut - 21) % 4, 0);
  // QR bulucu deseni sol üst köşede koyudur.
  assert.equal(matris.koyu(0, 0), true);

  const olcu = qrNoktaOlcusu(matris, 100);
  assert.equal(olcu.modulNokta, Math.floor(100 / matris.boyut));
  assert.equal(olcu.kenarNokta, olcu.modulNokta * matris.boyut);
  assert.ok(olcu.kenarNokta <= 100);

  // Çok küçük alanda bile en az 1 nokta modül kullanılır.
  assert.equal(qrNoktaOlcusu(matris, 4).modulNokta, 1);
});

test("Bluetooth hedefi ayarlara yazılıp geri okunur", () => {
  const ayarlar: FindikIslemeAyarlari = {
    kasaHesapId: null,
    etiketProfili: "NIMBOT_B1_50x50",
    etiketBaskiDavranisi: "OTOMATIK",
    yazici: {
      hedef: "BLUETOOTH_BLE",
      kuyrukAdi: null,
      ip: null,
      port: 9100,
      kodSayfasi: "CP857",
      bluetoothYogunluk: 4,
    },
  };
  const birlestirilmis = findikIslemeAyarBlogunuBirlestir({ tema: "koyu" }, ayarlar);
  assert.equal(birlestirilmis.tema, "koyu", "diğer ayar anahtarları korunur");

  const cozulen = findikIslemeAyarlariniCoz(birlestirilmis);
  assert.equal(cozulen.yazici.hedef, "BLUETOOTH_BLE");
  assert.equal(cozulen.yazici.bluetoothYogunluk, 4);
  assert.equal(yaziciYapilandirildiMi(cozulen.yazici), true);
  assert.match(yaziciHedefTanimi(cozulen.yazici), /Bluetooth/);
  assert.match(yaziciHedefTanimi(cozulen.yazici), /4/);
  assert.equal(cozulen.etiketBaskiDavranisi, "OTOMATIK", "etiket baskı davranışı korunur");
});

test("Talep sonrası etiket baskı davranışı varsayılanı onaylı yazdırmadır", () => {
  const ayarlar = findikIslemeAyarlariniCoz(null);
  assert.equal(VARSAYILAN_ETIKET_BASKI_DAVRANISI, "SOR");
  assert.equal(ayarlar.etiketBaskiDavranisi, "SOR");
  // Bilinmeyen kayıtlı değer sessizce varsayılana düşer.
  const bozuk = findikIslemeAyarlariniCoz({ findikIsleme: { etiketBaskiDavranisi: "HER_ZAMAN" } });
  assert.equal(bozuk.etiketBaskiDavranisi, "SOR");
  assert.equal(etiketBaskiDavranisiGecerliMi("KAPALI"), true);
  assert.equal(etiketBaskiDavranisiGecerliMi("HER_ZAMAN"), false);
  assert.equal(etiketBaskiDavranisiGetir("OTOMATIK").ad, "Otomatik yazdır");
  assert.equal(ETIKET_BASKI_DAVRANISLARI.length, 3);
});

test("Geçersiz Bluetooth yoğunluğu varsayılan değere düşer", () => {
  const coz = (deger: unknown) =>
    findikIslemeAyarlariniCoz({ findikIsleme: { yazici: { hedef: "BLUETOOTH_BLE", bluetoothYogunluk: deger } } })
      .yazici.bluetoothYogunluk;

  assert.equal(coz(9), VARSAYILAN_BLUETOOTH_YOGUNLUGU);
  assert.equal(coz(0), VARSAYILAN_BLUETOOTH_YOGUNLUGU);
  assert.equal(coz("abc"), VARSAYILAN_BLUETOOTH_YOGUNLUGU);
  assert.equal(coz(undefined), VARSAYILAN_BLUETOOTH_YOGUNLUGU);
  assert.equal(coz(5), 5);
});

test("Bluetooth hedefi seçili değilken doğrudan baskı yapılandırılmamış sayılır", () => {
  const cozulen = findikIslemeAyarlariniCoz(null);
  assert.equal(cozulen.yazici.hedef, "YOK");
  assert.equal(yaziciYapilandirildiMi(cozulen.yazici), false);
  assert.equal(cozulen.yazici.bluetoothYogunluk, VARSAYILAN_BLUETOOTH_YOGUNLUGU);
});
test("USB seri hedefi ayarlara yazılıp geri okunur ve sunucu ayarı gerektirmez", () => {
  const ayarlar: FindikIslemeAyarlari = {
    kasaHesapId: null,
    etiketProfili: "NIMBOT_B1_50x50",
    etiketBaskiDavranisi: "SOR",
    yazici: {
      hedef: "SERIAL_USB",
      kuyrukAdi: null,
      ip: null,
      port: 9100,
      kodSayfasi: "CP857",
      bluetoothYogunluk: 5,
    },
  };
  const cozulen = findikIslemeAyarlariniCoz(findikIslemeAyarBlogunuBirlestir({ tema: "koyu" }, ayarlar));
  assert.equal(cozulen.yazici.hedef, "SERIAL_USB");
  assert.equal(cozulen.yazici.bluetoothYogunluk, 5);
  // USB seri baskı tarayıcıda yapılır; sunucu tarafı doğrudan hedef gerekmez.
  assert.equal(yaziciYapilandirildiMi(cozulen.yazici), true);
  assert.match(yaziciHedefTanimi(cozulen.yazici), /USB seri/);
  assert.match(yaziciHedefTanimi(cozulen.yazici), /5/);
  assert.equal(yaziciHedefGecerliMi("SERIAL_USB"), true);
  // Bilinmeyen hedef sessizce kapalıya düşer.
  const bozuk = findikIslemeAyarlariniCoz({ findikIsleme: { yazici: { hedef: "USB_SERI" } } });
  assert.equal(bozuk.yazici.hedef, "YOK");
});

test("USB seri istemcisi yanıt bekleyicisini paketi yazmadan önce kurar", async () => {
  // USB seri yanıtı çok hızlı gelebildiği için bekleyici yazmadan önce kurulmalı.
  const istemci = new NimbotUsbIstemcisi();
  let yazarkenDinleyici = -1;
  let yazmaSayisi = 0;
  const bekleyenBaslangic = istemci.listenerCount("packetreceived");

  (istemci as unknown as { sendPacket: () => Promise<void> }).sendPacket = async () => {
    yazmaSayisi += 1;
    yazarkenDinleyici = istemci.listenerCount("packetreceived");
  };

  const paket = new NiimbotPacket(RequestCommandId.Connect, [1], [ResponseCommandId.In_Connect]);
  const bekleme = istemci.sendPacketWaitResponse(paket, 2_000);
  // Paket yazıldıktan sonra yanıt gelir; bekleyici yazma anında hazır olmalı.
  await new Promise((coz) => setTimeout(coz, 5));
  istemci.emit("packetreceived", new PacketReceivedEvent(new NiimbotPacket(ResponseCommandId.In_Connect, [3])));
  const sonuc = await bekleme;

  assert.equal(yazmaSayisi, 1);
  assert.equal(yazarkenDinleyici, bekleyenBaslangic + 1);
  assert.equal(sonuc.command, ResponseCommandId.In_Connect);
});

test("USB seri istemcisi istekten önce gelen paketi hazır yanıt olarak kullanır", async () => {
  // Yazıcı port açıldıktan hemen sonra kendiliğinden connect/durum paketi gönderiyor.
  const istemci = new NimbotUsbIstemcisi();
  (istemci as unknown as { sendPacket: () => Promise<void> }).sendPacket = async () => undefined;

  const erken = new NiimbotPacket(ResponseCommandId.In_Connect, [3]);
  istemci.emit("packetreceived", new PacketReceivedEvent(erken));

  const paket = new NiimbotPacket(RequestCommandId.Connect, [1], [ResponseCommandId.In_Connect]);
  const sonuc = await istemci.sendPacketWaitResponse(paket, 500);
  assert.equal(sonuc, erken);

  // Hazır paket bir kez kullanılır; ikinci istek yanıt bekler ve zaman aşımına düşer.
  await assert.rejects(() => istemci.sendPacketWaitResponse(paket, 300), /Yanıt gelmedi/);
});

test("USB seri bilgi sorguları paket zaman aşımından kısa süre bekler", () => {
  assert.ok(NIMBOT_SERI_BILGI_ZAMAN_ASIMI < NIMBOT_SERI_PAKET_ZAMAN_ASIMI);
  assert.ok(NIMBOT_SERI_PAKET_ZAMAN_ASIMI >= 10_000);
  assert.ok(NIMBOT_SERI_PAKET_ARALIGI >= 100);
});

test("USB seri istemcisi kütüphanenin 1 sn varsayılanı yerine geniş zaman aşımı kullanır", () => {
  const istemci = new NimbotUsbIstemcisi();
  assert.equal(istemci.protocol.getPacketTimeout(), NIMBOT_SERI_PAKET_ZAMAN_ASIMI);
  assert.ok(NIMBOT_SERI_PAKET_ZAMAN_ASIMI >= 5000);
  assert.ok(NIMBOT_SERI_BAGLANTI_DENEMESI >= 2);
});
