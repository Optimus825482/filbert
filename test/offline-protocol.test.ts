import assert from "node:assert/strict";
import test from "node:test";
import { offlineKomutuDogrula } from "../src/lib/offline/protocol";
import { sesliNotMetniniDogrula } from "../src/lib/sesli-not";

test("offline sesli-not komutu geçerli şemayı kabul eder", () => {
  const komut = offlineKomutuDogrula({ id: "offlinecommand123", sahipKullaniciId: "12345678-1234-1234-1234-123456789abc", tip: "SESLI_NOT_TASLAGI", payload: { metin: "Depodaki çuvalları say" }, createdAt: "2026-08-25T10:00:00.000Z" });
  assert.equal((komut?.payload as { metin: string }).metin, "Depodaki çuvalları say");
});

test("offline komutu bozuk kimlik ve boş metni reddeder", () => {
  assert.equal(offlineKomutuDogrula({ id: "x", sahipKullaniciId: "12345678-1234-1234-1234-123456789abc", tip: "SESLI_NOT_TASLAGI", payload: { metin: "not" }, createdAt: "2026-08-25T10:00:00.000Z" }), null);
  assert.equal(offlineKomutuDogrula({ id: "offlinecommand123", sahipKullaniciId: "12345678-1234-1234-1234-123456789abc", tip: "SESLI_NOT_TASLAGI", payload: { metin: " " }, createdAt: "2026-08-25T10:00:00.000Z" }), null);
  assert.equal(offlineKomutuDogrula({ id: "offlinecommand123", tip: "SESLI_NOT_TASLAGI", payload: { metin: "not" }, createdAt: "2026-08-25T10:00:00.000Z" }), null);
});

test("sesli not metni kırpılır ve limitlenir", () => {
  assert.equal(sesliNotMetniniDogrula("  not  "), "not");
  assert.equal(sesliNotMetniniDogrula(" "), null);
  assert.equal(sesliNotMetniniDogrula("a".repeat(4_100))?.length, 4_000);
});
