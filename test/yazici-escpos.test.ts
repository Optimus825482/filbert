import assert from "node:assert/strict";
import test from "node:test";

import {
  EscPos,
  escposMetinKodla,
  etiketSatirlaraSar,
  etiketOlcusu,
  hizmetEtiketiOlustur,
  islemSatirlari,
  testEtiketiVerisi,
  type EtiketVerisi,
} from "../src/lib/yazici/escpos";
import {
  VARSAYILAN_FINDIK_ISLEME_AYARLARI,
  findikIslemeAyarBlogunuBirlestir,
  findikIslemeAyarlariniCoz,
  yaziciHedefTanimi,
  yaziciYapilandirildiMi,
} from "../src/lib/findik-isleme";

/** Bayt dizisi içinde bir alt diziyi arar; bulunamazsa -1 döner. */
function diziIndeksi(kaynak: number[], aranan: number[]): number {
  for (let i = 0; i + aranan.length <= kaynak.length; i++) {
    let eslesiyor = true;
    for (let j = 0; j < aranan.length; j++) {
      if (kaynak[i + j] !== aranan[j]) {
        eslesiyor = false;
        break;
      }
    }
    if (eslesiyor) return i;
  }
  return -1;
}

function baytlar(veri: Uint8Array): number[] {
  return Array.from(veri);
}

/** Etiket baytları içinde verilen metnin kodlanmış hâlini arar. */
function metinVar(bayt: number[], aranan: string): boolean {
  return diziIndeksi(bayt, escposMetinKodla(aranan, "CP857")) !== -1;
}

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

test("Türkçe harfler PC857 kod sayfası baytlarına doğru çevrilir", () => {
  const kodlu = escposMetinKodla("çÇğĞıİöÖşŞüÜ", "CP857");
  assert.deepEqual(kodlu, [0x87, 0x80, 0xa7, 0xa6, 0x8d, 0x98, 0x94, 0x99, 0x9f, 0x9e, 0x81, 0x9a]);
});

test("ASCII modunda Türkçe harfler sadeleştirilir ve kod sayfası dışı karakter ? olur", () => {
  assert.equal(Buffer.from(escposMetinKodla("Şükrü", "ASCII")).toString("utf8"), "Sukru");
  assert.deepEqual(escposMetinKodla("√", "ASCII"), [0x3f]);
  // ₺ işareti TL olarak sadeleşir (tek baytlık kod sayfalarında karşılığı yoktur).
  assert.equal(Buffer.from(escposMetinKodla("200₺", "ASCII")).toString("utf8"), "200TL");
});

test("EscPos başlatma, kod sayfası, hizalama, kalın ve ters baskı komutlarını üretir", () => {
  const escpos = new EscPos("CP857");
  escpos.baslat().hizala("orta").kalin(true).ters(true).satir("A");
  const b = baytlar(escpos.cikti());
  assert.deepEqual(b.slice(0, 3), [0x1b, 0x40, 0x1b]); // ESC @
  assert.notEqual(diziIndeksi(b, [0x1b, 0x74, 13]), -1); // ESC t 13 (PC857)
  assert.notEqual(diziIndeksi(b, [0x1b, 0x61, 1]), -1); // ESC a 1 (orta)
  assert.notEqual(diziIndeksi(b, [0x1b, 0x45, 1]), -1); // ESC E 1 (kalın)
  assert.notEqual(diziIndeksi(b, [0x1d, 0x42, 1]), -1); // GS B 1 (ters)

  const ascii = new EscPos("ASCII");
  ascii.baslat();
  assert.notEqual(diziIndeksi(baytlar(ascii.cikti()), [0x1b, 0x74, 0]), -1); // ESC t 0
});

test("QR kod Epson model 2 komut dizisi ve veri uzunluğu doğru hesaplanır", () => {
  const escpos = new EscPos("CP857");
  escpos.baslat().qr("FILBERT-HIZMET:0042", { modulBoyutu: 4, hataDuzeyi: "M" });
  const b = baytlar(escpos.cikti());

  assert.notEqual(diziIndeksi(b, [0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), -1); // model 2
  assert.notEqual(diziIndeksi(b, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 4]), -1); // modül boyutu 4
  assert.notEqual(diziIndeksi(b, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49]), -1); // hata düzeyi M

  const veri = escposMetinKodla("FILBERT-HIZMET:0042", "CP857");
  const uzunluk = veri.length + 3;
  const depoOnEki = [0x1d, 0x28, 0x6b, uzunluk & 0xff, (uzunluk >> 8) & 0xff, 0x31, 0x50, 0x30];
  const depoKonumu = diziIndeksi(b, [...depoOnEki, ...veri]);
  assert.notEqual(depoKonumu, -1);
  assert.notEqual(diziIndeksi(b, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), -1); // bas
});

test("etiket satır sarma kelime sınırlarını korur ve uzun kelimeyi sert böler", () => {
  assert.deepEqual(etiketSatirlaraSar("KISA METIN", 32), ["KISA METIN"]);
  const satirlar = etiketSatirlaraSar("bir iki üç dört beş altı yedi sekiz dokuz on", 12);
  for (const satir of satirlar) assert.ok(satir.length <= 12, `satır sınırı aştı: ${satir}`);
  assert.deepEqual(satirlar.join(" "), "bir iki üç dört beş altı yedi sekiz dokuz on");
  assert.deepEqual(etiketSatirlaraSar("ABCDEFGHIJ", 4), ["ABCD", "EFGH", "IJ"]);
});

test("işlem kutuları talepte seçilen kırma/kavurma/paketlemeyi işaretler", () => {
  assert.deepEqual(islemSatirlari({ kirma: true, kavurma: false, paketleme: true }), [
    "[X] Kırma",
    "[ ] Kavurma",
    "[X] Vakumlu Paketleme",
  ]);
});

test("50×50 ve 80×70 profilleri farklı satır genişliği ve QR modül boyutu kullanır", () => {
  assert.equal(etiketOlcusu("NIMBOT_B1_50x50").satirGenisligi, 32);
  assert.equal(etiketOlcusu("TERMAL_80x70").satirGenisligi, 48);
  assert.ok(etiketOlcusu("TERMAL_80x70").qrModulBoyutu > etiketOlcusu("NIMBOT_B1_50x50").qrModulBoyutu);
});

test("hizmet etiketi; müşteri, miktar, işlem kutuları, tarih ve QR verisini içerir", () => {
  const bayt = baytlar(hizmetEtiketiOlustur(ORNEK, "NIMBOT_B1_50x50", "CP857"));

  assert.deepEqual(bayt.slice(0, 2), [0x1b, 0x40]); // ESC @ ile başlar
  assert.ok(metinVar(bayt, "AKAYDIN TARIM"));
  assert.ok(metinVar(bayt, "TALEP #0042"));
  assert.ok(metinVar(bayt, "TELEFON: 05321112233"));
  assert.ok(metinVar(bayt, "MİKTAR: 25.00 KG"));
  assert.ok(metinVar(bayt, "[X] Kırma"));
  assert.ok(metinVar(bayt, "[ ] Vakumlu Paketleme"));
  assert.ok(metinVar(bayt, "TARİH: 10.10.2026 14:30"));
  assert.ok(metinVar(bayt, "TUTAR: 200.00 TL"));
  // QR verisi ham baytlarda bulunur (model 2 depo komutundan sonra).
  assert.ok(metinVar(bayt, "FILBERT-HIZMET:0042"));
  // Türkçe harfler PC857 baytlarına dönüşür (MİKTAR → 0x8d).
  assert.ok(bayt.includes(0x8d));
});

test("kopya sayısı birden fazla olduğunda etikette kopya numarası yazılır", () => {
  const bayt = baytlar(
    hizmetEtiketiOlustur({ ...ORNEK, kopyaNo: 2, kopyaSayisi: 3 }, "TERMAL_80x70", "CP857")
  );
  assert.ok(metinVar(bayt, "Kopya 2/3"));
});

test("tahsil edilmiş talep etiketinde TAHSİL EDİLDİ şerhi basılır", () => {
  const bayt = baytlar(
    hizmetEtiketiOlustur({ ...ORNEK, odemeDurumu: "ODENDI" }, "NIMBOT_B1_50x50", "CP857")
  );
  assert.ok(metinVar(bayt, "TAHSİL EDİLDİ"));
});

test("ayarlar bloğu yazıcı hedefini çözer, korur ve doğrular", () => {
  const cozulen = findikIslemeAyarlariniCoz({
    findikIsleme: {
      kasaHesapId: "kasa-1",
      etiketProfili: "TERMAL_80x70",
      yazici: { hedef: "WINDOWS_KUYRUK", kuyrukAdi: "Nimbot B1", ip: null, port: 9100, kodSayfasi: "CP857" },
    },
  });
  assert.equal(cozulen.yazici.hedef, "WINDOWS_KUYRUK");
  assert.equal(cozulen.yazici.kuyrukAdi, "Nimbot B1");
  assert.equal(yaziciYapilandirildiMi(cozulen.yazici), true);
  assert.equal(yaziciHedefTanimi(cozulen.yazici), "Nimbot B1");

  // Bilinmeyen hedef ve bozuk port varsayılana döner.
  const bozuk = findikIslemeAyarlariniCoz({
    findikIsleme: { yazici: { hedef: "YAZICI_YOK", port: 0, kodSayfasi: "X" } },
  });
  assert.equal(bozuk.yazici.hedef, "YOK");
  assert.equal(bozuk.yazici.port, 9100);
  assert.equal(bozuk.yazici.kodSayfasi, "CP857");
  assert.equal(yaziciYapilandirildiMi(bozuk.yazici), false);
  assert.equal(yaziciHedefTanimi(bozuk.yazici), "kapalı");

  // Ağ hedefi IP:port olarak okunur.
  const ag = findikIslemeAyarlariniCoz({
    findikIsleme: { yazici: { hedef: "AG_9100", ip: "192.168.1.50", port: 9100 } },
  });
  assert.equal(yaziciHedefTanimi(ag.yazici), "192.168.1.50:9100");
  assert.equal(yaziciYapilandirildiMi(ag.yazici), true);

  // Yazıcı bloğu yazılırken diğer firma ayarları korunur.
  const birlesik = findikIslemeAyarBlogunuBirlestir(
    { tema: "koyu", findikIsleme: { kasaHesapId: "eski" } },
    cozulen
  );
  assert.equal(birlesik.tema, "koyu");
  assert.deepEqual(birlesik.findikIsleme, {
    kasaHesapId: "kasa-1",
    etiketProfili: "TERMAL_80x70",
    etiketBaskiDavranisi: "SOR",
    yazici: {
      hedef: "WINDOWS_KUYRUK",
      kuyrukAdi: "Nimbot B1",
      ip: null,
      port: 9100,
      kodSayfasi: "CP857",
      bluetoothYogunluk: 3,
    },
  });
});

test("ayar yoksa varsayılan olarak doğrudan yazıcı kapalıdır", () => {
  assert.equal(VARSAYILAN_FINDIK_ISLEME_AYARLARI.yazici.hedef, "YOK");
  const cozulen = findikIslemeAyarlariniCoz(null);
  assert.equal(cozulen.yazici.hedef, "YOK");
  assert.equal(yaziciYapilandirildiMi(cozulen.yazici), false);
});

test("test etiketi verisi üretilebilir ve baskıya hazır bayt dizisi oluşur", () => {
  const veri = testEtiketiVerisi("AKAYDIN TARIM");
  const bayt = baytlar(hizmetEtiketiOlustur(veri, "NIMBOT_B1_50x50", "CP857"));
  assert.ok(bayt.length > 100);
  assert.ok(metinVar(bayt, "TEST MÜŞTERİ"));
});
