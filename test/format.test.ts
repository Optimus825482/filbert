import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { sayiCevir, tarih, tarihSaat } from "../src/lib/format";
import { istanbulGunAraligi, istanbulTarihAnahtari, istanbulTarihMetniniCoz } from "../src/lib/zaman";

test("sayiCevir Türkçe binlik ve ondalık ayraçlarını tutarlı yorumlar", () => {
  assert.equal(sayiCevir("1.234,56"), 1234.56);
  assert.equal(sayiCevir("1.234"), 1234);
  assert.equal(sayiCevir("1.234.567"), 1234567);
  assert.equal(sayiCevir("-1.234"), -1234);
  assert.equal(sayiCevir("1234.56"), 1234.56);
  assert.equal(sayiCevir("geçersiz"), 0);
});

test("iş tarihleri cihaz saat diliminden bağımsız olarak İstanbul saatinde gösterilir", () => {
  const an = "2026-08-31T21:30:00.000Z";

  assert.equal(tarih(an), "01.09.2026");
  assert.match(tarihSaat(an), /01[./]09.*00:30/);
});

test("ayar tarihi İstanbul saat diliminde gösterilir", () => {
  const ayarlar = readFileSync(path.resolve("src/app/ayarlar/ayar-icerik.tsx"), "utf8");

  assert.match(ayarlar, /function tarihFormat[\s\S]*timeZone: "Europe\/Istanbul"/);
});

test("İstanbul iş günü anahtarı ve zaman aralığı sunucu saat diliminden bağımsızdır", () => {
  const an = new Date("2026-08-31T21:30:00.000Z");
  const anahtar = istanbulTarihAnahtari(an);
  const aralik = istanbulGunAraligi(an);

  assert.equal(anahtar.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(aralik.baslangic.toISOString(), "2026-08-31T21:00:00.000Z");
  assert.equal(aralik.bitis.toISOString(), "2026-09-01T21:00:00.000Z");
  assert.equal(istanbulTarihMetniniCoz("2026-09-01")?.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(istanbulTarihMetniniCoz("2026-02-30"), null);
});
