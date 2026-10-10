import assert from "node:assert/strict";
import test from "node:test";

import { ImageEncoder, PageColorType } from "@mmote/niimbluelib";

import {
  NIMBOT_BASLIK_NOKTASI,
  esikliNoktaKaynagi,
  nimbotEtiketIcerigi,
  nimbotOlcusu,
  nimbotPunto,
  pikselParlakligi,
  qrMatrisiOlustur,
  qrNoktaOlcusu,
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
import type { EtiketVerisi } from "../src/lib/yazici/escpos";

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

test("Etiket içeriği ekrandaki ve ESC/POS etiketindeki sırayı izler", () => {
  const satirlar = nimbotEtiketIcerigi(ORNEK);
  const duz = satirlar
    .filter((s) => s.tip === "metin")
    .map((s) => s.metin ?? "");

  assert.equal(duz[0], "AKAYDIN TARIM");
  assert.equal(duz[1], "TALEP #0042");
  assert.equal(duz[2], "MÜŞTERİ: Şükrü Çağlayan");
  assert.equal(duz[3], "TELEFON: 05321112233");
  assert.equal(duz[4], "MİKTAR: 25.00 KG");
  assert.ok(duz.includes("YAPILACAK İŞLEMLER:"));
  assert.ok(duz.includes("[X] Kırma"));
  assert.ok(duz.includes("[X] Kavurma"));
  assert.ok(duz.includes("[ ] Vakumlu Paketleme"));
  assert.ok(duz.includes("Paket: 25x 1 KG"));
  assert.ok(duz.includes("TARİH: 10.10.2026 14:30"));
  assert.ok(duz.includes("TUTAR: 200.00 TL"));
});

test("QR kodu etiketin en sonunda ve doğru içerikle yer alır", () => {
  const satirlar = nimbotEtiketIcerigi(ORNEK);
  const son = satirlar[satirlar.length - 1];
  assert.equal(son.tip, "qr");
  assert.equal(son.veri, "FILBERT-HIZMET:0042");
  assert.equal(satirlar.filter((s) => s.tip === "qr").length, 1);
});

test("Ödeme durumu etikete ters (siyah zemin) şerit olarak eklenir", () => {
  const odendi = nimbotEtiketIcerigi({ ...ORNEK, odemeDurumu: "ODENDI" });
  const tahsil = odendi.find((s) => s.metin === "TAHSİL EDİLDİ");
  assert.ok(tahsil);
  assert.equal(tahsil.ters, true);
  assert.equal(tahsil.hizala, "orta");

  const veresiye = nimbotEtiketIcerigi({ ...ORNEK, odemeDurumu: "VERESIYE" });
  const serit = veresiye.find((s) => s.metin === "VERESİYE");
  assert.equal(serit?.ters, true);

  // Ödenmemiş talepte şerit eklenmez.
  const bekleyen = nimbotEtiketIcerigi(ORNEK);
  assert.equal(bekleyen.some((s) => s.ters), false);
});

test("Kopya bilgisi ve not yalnızca gerektiğinde eklenir", () => {
  const tek = nimbotEtiketIcerigi(ORNEK);
  assert.equal(tek.some((s) => s.metin?.startsWith("Kopya")), false);
  assert.equal(tek.some((s) => s.metin?.startsWith("NOT:")), false);

  const coklu = nimbotEtiketIcerigi({
    ...ORNEK,
    kopyaNo: 2,
    kopyaSayisi: 3,
    notlar: "  Çuvallar ayrı teslim edilecek  ",
  });
  assert.ok(coklu.some((s) => s.metin === "Kopya 2/3"));
  assert.ok(coklu.some((s) => s.metin === "NOT: Çuvallar ayrı teslim edilecek"));
});

test("Tuval ölçüsü B1 baskı kafasına (384 nokta) sabitlenir", () => {
  const b1 = nimbotOlcusu("NIMBOT_B1_50x50");
  assert.equal(b1.genislik, NIMBOT_BASLIK_NOKTASI);
  assert.equal(b1.yukseklik, 384);
  assert.equal(b1.olcek, 1);

  // 80×70 mm profil B1'e sığacak biçimde küçültülür.
  const termal = nimbotOlcusu("TERMAL_80x70");
  assert.equal(termal.genislik, NIMBOT_BASLIK_NOKTASI);
  assert.equal(termal.yukseklik, NIMBOT_BASLIK_NOKTASI);
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
