import assert from "node:assert/strict";
import test from "node:test";

import {
  fisNoUret,
  satinAlmaKoduUret,
  tutarHesapla,
} from "../src/lib/hesap";

test("kg, tutar, fiş numarası ve satın alma kodu deterministiktir", () => {
  assert.equal(tutarHesapla(100.001, 122.345), 12234.62);
  assert.equal(tutarHesapla(0, 122.345), 0);
  assert.equal(fisNoUret("AKY", 2026, 123), "AKY-2026-000123");
  assert.equal(satinAlmaKoduUret(1), "001");
  assert.equal(satinAlmaKoduUret(42), "042");
  assert.equal(satinAlmaKoduUret(999), "999");
  // 999 sonrası sayaç kesilmez, kod doğal olarak 4 haneye büyür.
  assert.equal(satinAlmaKoduUret(1000), "1000");
});
