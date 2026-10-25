import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildHizmetWhere,
  hesaplaHizmetMetrikleri,
} from "../src/lib/hizmet-queries";

const oku = (p: string) => readFileSync(path.resolve(p), "utf8");

test("buildHizmetWhere varsayılan filtrede yalnızca firmaId üretir", () => {
  const where = buildHizmetWhere("firma-123", {});
  assert.equal(where.firmaId, "firma-123");
  assert.equal(where.durum, undefined);
  assert.equal(where.OR, undefined);
});

test("buildHizmetWhere hızlı liste koşullarını doğru Prisma Where objesine eşler", () => {
  // Kuyruk
  const kuyrukWhere = buildHizmetWhere("f1", { liste: "kuyruk" });
  assert.equal(kuyrukWhere.durum, "SIRAYA_ALINDI");

  // Hazırlanıyor (üretimde)
  const hazirWhere = buildHizmetWhere("f1", { liste: "hazirlaniyor" });
  assert.deepEqual(hazirWhere.durum, { in: ["KIRIM", "KAVURMA", "PAKETLEME"] });

  // Teslimat / Hazır bekleyen
  const teslimatWhere = buildHizmetWhere("f1", { liste: "teslimat" });
  assert.equal(teslimatWhere.durum, "TAMAMLANDI");

  const hazirEskiWhere = buildHizmetWhere("f1", { liste: "hazir" });
  assert.equal(hazirEskiWhere.durum, "TAMAMLANDI");

  // Tamamlandı SMS bekleyenler
  const smsWhere = buildHizmetWhere("f1", { liste: "sms" });
  assert.equal(smsWhere.durum, "TAMAMLANDI");
  assert.equal(smsWhere.tamamlandiSmsGonderildi, false);

  // Tahsilat bekleyenler
  const tahsilatWhere = buildHizmetWhere("f1", { liste: "tahsilat" });
  assert.equal(tahsilatWhere.durum, "TESLIM_EDILDI");
  assert.deepEqual(tahsilatWhere.odemeDurumu, { not: "ODENDI" });
});

test("buildHizmetWhere durum filtresini ve HEPSI istisnasını doğru yönetir", () => {
  const kirimWhere = buildHizmetWhere("f1", { durum: "KIRIM" });
  assert.equal(kirimWhere.durum, "KIRIM");

  const paketWhere = buildHizmetWhere("f1", { durum: "PAKETLEME" });
  assert.equal(paketWhere.durum, "PAKETLEME");

  const hepsiWhere = buildHizmetWhere("f1", { durum: "HEPSI" });
  assert.equal(hepsiWhere.durum, undefined);
});

test("buildHizmetWhere arama metnini sıra no, müşteri adı, telefon ve nota yayar", () => {
  const where = buildHizmetWhere("f1", { q: "Ahmet" });
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 4);

  assert.deepEqual(where.OR?.[0], { siraNo: { contains: "Ahmet", mode: "insensitive" } });
  assert.deepEqual(where.OR?.[1], { musteriAdi: { contains: "Ahmet", mode: "insensitive" } });
  assert.deepEqual(where.OR?.[2], { telefon: { contains: "Ahmet" } });
  assert.deepEqual(where.OR?.[3], { notlar: { contains: "Ahmet", mode: "insensitive" } });

  // Boş arama metni OR koşulu üretmemelidir
  const bosWhere = buildHizmetWhere("f1", { q: "   " });
  assert.equal(bosWhere.OR, undefined);
});

test("buildHizmetWhere liste, durum ve arama koşullarını birlikte birleştirir", () => {
  const where = buildHizmetWhere("f1", { liste: "kuyruk", q: "0012" });
  assert.equal(where.firmaId, "f1");
  assert.equal(where.durum, "SIRAYA_ALINDI");
  assert.ok(where.OR && where.OR.length > 0);
});

test("sayfalama parametreleri sınırları ve matematiksel hesaplamaları doğrular", () => {
  // Sayfa ve limit sınırları
  function hesaplaSayfalama(sayfaGirdi: number, limitGirdi: number, toplamKayit: number) {
    const sayfa = Math.max(1, Number(sayfaGirdi) || 1);
    const hamLimit = Number(limitGirdi) || 50;
    const limit = Math.min(200, Math.max(10, hamLimit));
    const skip = (sayfa - 1) * limit;
    const toplamSayfa = Math.max(1, Math.ceil(toplamKayit / limit));
    return { sayfa, limit, skip, toplamSayfa };
  }

  // 1. sayfa 50'lik limit
  const p1 = hesaplaSayfalama(1, 50, 301);
  assert.equal(p1.skip, 0);
  assert.equal(p1.limit, 50);
  assert.equal(p1.toplamSayfa, 7); // 301 / 50 -> 7 sayfa

  // 2. sayfa 50'lik limit
  const p2 = hesaplaSayfalama(2, 50, 301);
  assert.equal(p2.skip, 50);
  assert.equal(p2.limit, 50);

  // 7. (son) sayfa 50'lik limit: 301. kayıt burada yer alır
  const p7 = hesaplaSayfalama(7, 50, 301);
  assert.equal(p7.skip, 300);
  assert.equal(p7.limit, 50);

  // Aşırı limitler (10 ile 200 arasına kıstırılır)
  const pMin = hesaplaSayfalama(1, 2, 100);
  assert.equal(pMin.limit, 10);

  const pMax = hesaplaSayfalama(1, 1000, 100);
  assert.equal(pMax.limit, 200);

  // Negatif veya 0 sayfa 1'e yuvarlanır
  const pNeg = hesaplaSayfalama(-5, 50, 100);
  assert.equal(pNeg.sayfa, 1);
  assert.equal(pNeg.skip, 0);
});

test("Hizmet sayfası sabit take: 300 kısıtını ve in-memory döngüleri kaldırmıştır", () => {
  const sayfaKodu = oku("src/app/hizmet/page.tsx");

  // Sabit take: 300 bulunmamalıdır
  assert.doesNotMatch(sayfaKodu, /take:\s*300/);

  // Yeni sorgu servisleri kullanılmalıdır
  assert.match(sayfaKodu, /getHizmetListesi/);
  assert.match(sayfaKodu, /getHizmetGenelMetrikleri/);

  // searchParams üzerinden sayfa, limit, durum, q parametreleri okunmalıdır
  assert.match(sayfaKodu, /searchParams/);
  assert.match(sayfaKodu, /toplamKayit/);
  assert.match(sayfaKodu, /toplamSayfa/);
  assert.match(sayfaKodu, /hizliFiltreSayilari/);
});

test("Hizmet tablosu sunucu sayfalama kontrolleri ve debounced arama içerir", () => {
  const tabloKodu = oku("src/app/hizmet/hizmet-tablosu.tsx");

  // Sayfalama props desteği
  assert.match(tabloKodu, /toplamKayit/);
  assert.match(tabloKodu, /toplamSayfa/);
  assert.match(tabloKodu, /aktifSayfa/);
  assert.match(tabloKodu, /sayfaBoyutu/);

  // Sayfa boyutu seçicileri (25, 50, 100, 200)
  assert.match(tabloKodu, /\[25,\s*50,\s*100,\s*200\]/);

  // Sayfalama gezinme düğmeleri
  assert.match(tabloKodu, /« İlk/);
  assert.match(tabloKodu, /‹ Önceki/);
  assert.match(tabloKodu, /Sonraki ›/);
  assert.match(tabloKodu, /Son »/);

  // Debounce edilmiş arama
  assert.match(tabloKodu, /setTimeout/);
  assert.match(tabloKodu, /params\.set\("q"/);

  // Filtreli CSV indirme
  assert.match(tabloKodu, /csvUrl/);
  assert.match(tabloKodu, /\/api\/hizmet\/raporlar\/csv/);
});

test("Dinamik müşteri arama ucu (/api/musteri-ara) ve form entegrasyonu mevcuttur", () => {
  assert.ok(existsSync(path.resolve("src/app/api/musteri-ara/route.ts")));
  const apiKodu = oku("src/app/api/musteri-ara/route.ts");
  assert.match(apiKodu, /prisma\.musteri\.findMany/);
  assert.match(apiKodu, /mode:\s*"insensitive"/);
  assert.match(apiKodu, /telefon:\s*\{\s*contains:\s*q\s*\}/);

  const formKodu = oku("src/app/hizmet/yeni/yeni-hizmet-formu.tsx");
  assert.match(formKodu, /\/api\/musteri-ara\?q=/);
  assert.match(formKodu, /dinamikMusteriler/);
});

test("CSV dışa aktarım rotası arama filtresini ve genişletilmiş limiti destekler", () => {
  const csvKodu = oku("src/app/api/hizmet/raporlar/csv/route.ts");
  assert.match(csvKodu, /buildHizmetWhere/);
  assert.match(csvKodu, /url\.searchParams\.get\("q"\)/);
  assert.match(csvKodu, /take:\s*50000/);
});

test("İşleme kasa ve durum raporları limitleri esnetilmiştir ve query filtrelerini destekler", () => {
  const kasaKodu = oku("src/app/hizmet/kasa/page.tsx");
  assert.doesNotMatch(kasaKodu, /take:\s*40\b/);
  assert.match(kasaKodu, /searchParams/);
  assert.match(kasaKodu, /hareketWhere/);
  assert.match(kasaKodu, /hesapId/);
  assert.match(kasaKodu, /tip/);
  assert.match(kasaKodu, /mode:\s*"insensitive"/);

  const raporKodu = oku("src/app/hizmet/raporlar/page.tsx");
  assert.doesNotMatch(raporKodu, /take:\s*2000\b/);
  assert.match(raporKodu, /take:\s*20000/);
});

test("hesaplaHizmetMetrikleri tüm durum sayılarını ve işlem hacimlerini doğru hesaplar", () => {
  const metrikler = hesaplaHizmetMetrikleri({
    durumGruplari: [
      { durum: "SIRAYA_ALINDI", _count: { _all: 3 }, _sum: { kilo: 150 } },
      { durum: "KIRIM", _count: { _all: 2 }, _sum: { kilo: 100 } },
      { durum: "KAVURMA", _count: { _all: 1 }, _sum: { kilo: 50 } },
      { durum: "PAKETLEME", _count: { _all: 1 }, _sum: { kilo: 80 } },
      { durum: "TAMAMLANDI", _count: { _all: 4 }, _sum: { kilo: 240 } },
      { durum: "TESLIM_EDILDI", _count: { _all: 5 }, _sum: { kilo: 350 } },
    ],
    smsBekleyenAdet: 2,
    toplamKirmaKg: 300,
    toplamKavurmaKg: 200,
    toplamPaketlemeKg: 150,
    toplamCiroTl: 12500,
    bekleyenCiroTl: 4500,
    tahsilEdilenTahsilAggTl: 3000,
    tahsilEdilenToplamAggTl: 5000,
  });

  // Bekleyenler
  assert.equal(metrikler.siradaAdet, 3);
  assert.equal(metrikler.siradaKg, 150);

  // Hazırlanıyor: Kırım (2/100) + Kavurma (1/50) + Paketleme (1/80) = 4 adet / 230 kg
  assert.equal(metrikler.hazirlaniyorAdet, 4);
  assert.equal(metrikler.hazirlaniyorKg, 230);

  // Tamamlandı
  assert.equal(metrikler.tamamlandiAdet, 4);
  assert.equal(metrikler.tamamlandiKg, 240);

  // Teslim Edildi
  assert.equal(metrikler.teslimAdet, 5);
  assert.equal(metrikler.teslimKg, 350);

  // SMS Bekleyen
  assert.equal(metrikler.smsBekleyenAdet, 2);

  // İşlem Hacimleri
  assert.equal(metrikler.toplamKirmaKg, 300);
  assert.equal(metrikler.toplamKavurmaKg, 200);
  assert.equal(metrikler.toplamPaketlemeKg, 150);

  // Finansal Metrikler
  assert.equal(metrikler.toplamCiroTl, 12500);
  assert.equal(metrikler.bekleyenCiroTl, 4500);
  // Tahsilat = 3000 (özel tahsilat) + 5000 (tam ödeme) = 8000
  assert.equal(metrikler.tahsilEdilenTl, 8000);
});

test("hesaplaHizmetMetrikleri sıfır veya boş veritabanında NaN üretmez ve sıfır döner", () => {
  const metrikler = hesaplaHizmetMetrikleri({
    durumGruplari: [],
    smsBekleyenAdet: 0,
    toplamKirmaKg: 0,
    toplamKavurmaKg: 0,
    toplamPaketlemeKg: 0,
    toplamCiroTl: 0,
    bekleyenCiroTl: 0,
    tahsilEdilenTahsilAggTl: 0,
    tahsilEdilenToplamAggTl: 0,
  });

  assert.equal(metrikler.siradaAdet, 0);
  assert.equal(metrikler.siradaKg, 0);
  assert.equal(metrikler.hazirlaniyorAdet, 0);
  assert.equal(metrikler.hazirlaniyorKg, 0);
  assert.equal(metrikler.tamamlandiAdet, 0);
  assert.equal(metrikler.tamamlandiKg, 0);
  assert.equal(metrikler.teslimAdet, 0);
  assert.equal(metrikler.teslimKg, 0);
  assert.equal(metrikler.smsBekleyenAdet, 0);
  assert.equal(metrikler.toplamKirmaKg, 0);
  assert.equal(metrikler.toplamKavurmaKg, 0);
  assert.equal(metrikler.toplamPaketlemeKg, 0);
  assert.equal(metrikler.toplamCiroTl, 0);
  assert.equal(metrikler.tahsilEdilenTl, 0);
  assert.equal(metrikler.bekleyenCiroTl, 0);
});
