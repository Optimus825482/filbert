import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { DURUM_RENKLERI, durumDagilimiDilimleri } from "../src/lib/findik-isleme";

const oku = (p: string) => readFileSync(path.resolve(p), "utf8");

test("durum dağılımı dilimleri donut grafiği için boşluksuz sıralanır", () => {
  const { toplam, dilimler } = durumDagilimiDilimleri({
    SIRAYA_ALINDI: 4,
    KIRIM: 2,
    KAVURMA: 0,
    PAKETLEME: 1,
    TAMAMLANDI: 3,
    TESLIM_EDILDI: 2,
    IPTAL: 0,
  });

  assert.equal(toplam, 12);
  // Sıfır adetli durumlar grafikte yer almaz.
  assert.deepEqual(
    dilimler.map((d) => d.kod),
    ["SIRAYA_ALINDI", "KIRIM", "PAKETLEME", "TAMAMLANDI", "TESLIM_EDILDI"]
  );
  assert.equal(dilimler[0].baslangicYuzde, 0);

  // Her dilim bir öncekinin bittiği yerden başlar; yay toplamı %100'e tamamlanır.
  for (let i = 1; i < dilimler.length; i += 1) {
    const beklenen = dilimler[i - 1].baslangicYuzde + dilimler[i - 1].yuzde;
    assert.ok(Math.abs(dilimler[i].baslangicYuzde - beklenen) < 1e-9);
  }
  const son = dilimler[dilimler.length - 1];
  assert.ok(Math.abs(son.baslangicYuzde + son.yuzde - 100) < 1e-9);

  const beklenenAdet: Record<string, number> = {
    SIRAYA_ALINDI: 4,
    KIRIM: 2,
    PAKETLEME: 1,
    TAMAMLANDI: 3,
    TESLIM_EDILDI: 2,
  };
  for (const dilim of dilimler) {
    assert.equal(dilim.renk, DURUM_RENKLERI[dilim.kod]);
    assert.ok(dilim.ad.length > 0, "dilim okunur bir ad taşımalı");
    assert.equal(dilim.adet, beklenenAdet[dilim.kod]);
  }
});

test("boş sayaçta dağılım sıfır toplamla boş döner", () => {
  const { toplam, dilimler } = durumDagilimiDilimleri({});
  assert.equal(toplam, 0);
  assert.equal(dilimler.length, 0);
});

test("pano KPI'ları bekleyen, bugün tamamlanan, teslim ve mesaj bekleyenleri gösterir", () => {
  const sayfa = oku("src/app/pano-isleme.tsx");

  // İstenen dört KPI etiketi de panoda yer alır.
  assert.match(sayfa, /baslik="Bekleyen talep"/);
  assert.match(sayfa, /baslik="Bugün tamamlanan"/);
  assert.match(sayfa, /baslik="Teslim edilmeyi bekleyen"/);
  assert.match(sayfa, /baslik="Mesaj gönderilmeyen"/);

  // Sayaçlar sorgu katmanından gelir.
  assert.match(sayfa, /sayaclar\.bekleyenTalep/);
  assert.match(sayfa, /sayaclar\.bugunTamamlanan/);
  assert.match(sayfa, /sayaclar\.teslimBekleyen/);
  assert.match(sayfa, /sayaclar\.smsBekleyen/);
  assert.match(sayfa, /sayaclar\.tahsilatBekleyen/);

  // Grafiksel destek: durum dağılımı donut + günlük mini çubuk grafikler.
  assert.match(sayfa, /durumDagilimiDilimleri\(sayaclar\.durumDagilimi\)/);
  assert.match(sayfa, /<Donut toplam=\{dagilim\.toplam\} dilimler=\{dagilim\.dilimler\} \/>/);
  assert.match(sayfa, /baslik="Gelen talep · kg"/);
  assert.match(sayfa, /baslik="Tamamlanan talep · adet"/);

  // Grafikler erişilebilirlik için metin karşılığı taşır.
  assert.match(sayfa, /role="img"/);
  assert.match(sayfa, /aria-label=/);
});

test("pano sayaçları sorgusu KPI alanlarını tek turda döner", () => {
  const sorgular = oku("src/lib/queries.ts");

  assert.match(sorgular, /bugunTamamlanan/);
  assert.match(sorgular, /teslimBekleyen/);
  assert.match(sorgular, /tahsilatBekleyen/);
  assert.match(sorgular, /durumDagilimi: Object\.fromEntries/);
  assert.match(sorgular, /tamamlandiAt: \{ gte: bugunBaslangic \}/);

  // Günlük seri, tamamlanan talepleri de kendi gününe yazar.
  assert.match(sorgular, /tamamlananAdet/);
  assert.match(sorgular, /tamamlandiAt: \{ gte: ilkBaslangic, lt: sonBitis \}/);
});