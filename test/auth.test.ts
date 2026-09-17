import test from "node:test";
import assert from "node:assert/strict";
import { sifreDogrula, sifreHashle } from "../src/lib/auth";

test("parola özeti doğru parolayı kabul eder ve yanlış parolayı reddeder", async () => {
  const hash = await sifreHashle("guclu-ve-uzun-parola");
  assert.equal(await sifreDogrula("guclu-ve-uzun-parola", hash), true);
  assert.equal(await sifreDogrula("yanlis-parola", hash), false);
});

test("bozuk veya eski parola özeti giriş hatasına dönüşmez", async () => {
  assert.equal(await sifreDogrula("parola", "seed-only-replace-during-setup"), false);
  assert.equal(await sifreDogrula("parola", "scrypt:salt:01"), false);
});
