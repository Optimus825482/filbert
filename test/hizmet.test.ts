import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hizmetSiraNoUret } from "../src/lib/hesap";
import { buildHizmetWhere } from "../src/lib/hizmet-queries";
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

test("fındık işleme tablosu mobil kart görünümü ve dokunmatik filtre desteği sunar", () => {
  const dosya = readFileSync(
    path.resolve("src/app/hizmet/hizmet-tablosu.tsx"),
    "utf8"
  );
  // Mobil görünüm için kart listesi
  assert.match(dosya, /block md:hidden/);
  // Masaüstü için tablo
  assert.match(dosya, /hidden md:block overflow-x-auto/);
  // Mobilde yatay kaydırılabilir durum ve hızlı filtre çubuğu
  assert.match(dosya, /overflow-x-auto/);
  // Doğrudan telefon arama (tel:) desteği
  assert.match(dosya, /tel:\$\{k\.telefon\}/);
});

test("yeni hizmet formu hızlı kilo ekleme tuşları ve yapışık mobil çubuk içerir", () => {
  const formDosyasi = readFileSync(
    path.resolve("src/app/hizmet/yeni/yeni-hizmet-formu.tsx"),
    "utf8"
  );
  // Hızlı kilo ekleme fonksiyonları
  assert.match(formDosyasi, /handleKiloEkle/);
  assert.match(formDosyasi, /handleKiloSifirla/);
  // Hızlı ekleme dizi ve şablonu (5, 10, 25, 50, 100 kg)
  assert.match(formDosyasi, /\[5,\s*10,\s*25,\s*50,\s*100\]/);
  assert.match(formDosyasi, /\+\{kgDeger\} kg/);
  // Mobilde alta yapışan ve güvenli alan boşluğu olan kaydetme çubuğu
  assert.match(formDosyasi, /sticky bottom-0/);
});

test("hizmet raporları sayfasında seçici sorgu projeksiyonu ve mobil kart görünümü bulunur", () => {
  const raporDosyasi = readFileSync(
    path.resolve("src/app/hizmet/raporlar/page.tsx"),
    "utf8"
  );
  // Sadece ihtiyaç duyulan alanların çekildiği select projeksiyonu
  assert.match(raporDosyasi, /select:\s*\{/);
  assert.match(raporDosyasi, /siraNo:\s*true/);
  assert.match(raporDosyasi, /kilo:\s*true/);
  // Mobil kart desteği
  assert.match(raporDosyasi, /block divide-y divide-white\/5 md:hidden/);
  assert.match(raporDosyasi, /hidden overflow-x-auto md:block/);
});

test("buildHizmetWhere sorgu derleyici # ile başlayan sıra no ve biçimli telefon aramalarını doğru çözer", () => {
  // # ile arama yapıldığında hem # ile hem de temizlenmiş sıra no eşleşir
  const whereSira = buildHizmetWhere("firma-1", { q: "#0042" });
  assert.equal(whereSira.firmaId, "firma-1");
  const orListesi = whereSira.OR as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(orListesi));
  assert.ok(orListesi.some((item) => JSON.stringify(item).includes("0042")));

  // Boşluklu/parantezli telefon araması rakamları ayıklayarak sorguya dahil eder
  const whereTel = buildHizmetWhere("firma-1", { q: "0532 999 88 77" });
  const orTel = whereTel.OR as Array<Record<string, unknown>>;
  assert.ok(orTel.some((item) => JSON.stringify(item).includes("05329998877")));
});

test("hizmet tablosu mobil kompakt sayfalama kontrolleri ve rahat dokunmatik alanlar sunar", () => {
  const tabloDosyasi = readFileSync(
    path.resolve("src/app/hizmet/hizmet-tablosu.tsx"),
    "utf8"
  );
  // Mobilde kompakt sayfalama
  assert.match(tabloDosyasi, /sm:hidden/);
  assert.match(tabloDosyasi, /hidden items-center gap-1 sm:inline-flex/);
  // Dokunmatik buton min yükseklik kuralı
  assert.match(tabloDosyasi, /min-h-\[34px\]/);
});

test("fındık işleme kasası ve ana paneli mobil hızlı gezinme ve filtreleme sunar", () => {
  const kasaSayfasi = readFileSync(
    path.resolve("src/app/hizmet/kasa/page.tsx"),
    "utf8"
  );
  // Kasa hareket türü filtre hapları (Tümü / Tahsilatlar / Ödemeler)
  assert.match(kasaSayfasi, /tip=TAHSILAT/);
  assert.match(kasaSayfasi, /tip=ODEME/);

  const anaSayfa = readFileSync(
    path.resolve("src/app/hizmet/page.tsx"),
    "utf8"
  );
  // Ana sayfada doğrudan Kasa linki
  assert.match(anaSayfa, /href="\/hizmet\/kasa"/);
});



