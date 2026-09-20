import assert from "node:assert/strict";
import test from "node:test";

import { hizmetSiraNoUret } from "../src/lib/hesap";
import { sablonDoldur, telefonTemizle } from "../src/lib/sms/sms-servisi";
import {
  VARSAYILAN_KAYIT_SABLONU,
  VARSAYILAN_TAMAMLANDI_SABLONU,
} from "../src/lib/sms/types";

test("hizmet sıra numarası 0001 ile başlayan 4 haneli deterministik dizidir", () => {
  assert.equal(hizmetSiraNoUret(1), "0001");
  assert.equal(hizmetSiraNoUret(2), "0002");
  assert.equal(hizmetSiraNoUret(42), "0042");
  assert.equal(hizmetSiraNoUret(999), "0999");
  assert.equal(hizmetSiraNoUret(1000), "1000");
  assert.equal(hizmetSiraNoUret(9999), "9999");
  // 9999 sonrasında taşma olmadan doğal hane artışını korur
  assert.equal(hizmetSiraNoUret(10005), "10005");
});

test("telefon numarası normalizasyonu Türkiye SMS standartlarına uygun temizlenir", () => {
  assert.equal(telefonTemizle("0532 123 45 67"), "905321234567");
  assert.equal(telefonTemizle("+90 (532) 123-4567"), "905321234567");
  assert.equal(telefonTemizle("5321234567"), "905321234567");
  assert.equal(telefonTemizle("0544 999 88 77"), "905449998877");
});

test("SMS şablon doldurucu anahtar kelimeleri doğru eşler ve doldurur", () => {
  const metin = sablonDoldur(VARSAYILAN_KAYIT_SABLONU, {
    musteri_adi: "Ahmet Yılmaz",
    sira_no: "0001",
    kilo: "150.5",
    hizmetler: "Kırma, Kavurma",
    firma_adi: "Filbert Fındık",
  });

  assert.ok(metin.includes("Ahmet Yılmaz"));
  assert.ok(metin.includes("0001"));
  assert.ok(metin.includes("150.5"));
  assert.ok(metin.includes("Kırma, Kavurma"));
  assert.ok(metin.includes("Filbert Fındık"));
  assert.doesNotMatch(metin, /\{musteri_adi\}/);
  assert.doesNotMatch(metin, /\{sira_no\}/);
});

test("hazır ve tamamlandı SMS şablonu tutar ve sıra numarasını doğru formatlar", () => {
  const metin = sablonDoldur(VARSAYILAN_TAMAMLANDI_SABLONU, {
    musteri_adi: "Mehmet Demir",
    sira_no: "0015",
    kilo: "80",
    hizmetler: "Kırma + Vakumlu Paketleme",
    tutar: "1.200,00 TL",
    firma_adi: "Filbert Fındık",
  });

  assert.ok(metin.includes("Mehmet Demir"));
  assert.ok(metin.includes("0015"));
  assert.ok(metin.includes("1.200,00 TL"));
  assert.ok(metin.includes("tamamlanmıştır"));
  assert.ok(metin.includes("Teslim alabilirsiniz"));
});

test("WhatsApp bildirim linki temizlenmiş telefon ve url kodlanmış metin içerir", () => {
  const tel = telefonTemizle("0532 555 44 33");
  const metin = "Sayın Ali Kaya, #0023 nolu siparişiniz hazır!";
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(metin)}`;

  assert.equal(tel, "905325554433");
  assert.ok(url.startsWith("https://wa.me/905325554433?text="));
  assert.ok(url.includes(encodeURIComponent(metin)));
});

