import assert from "node:assert/strict";
import test from "node:test";
import {
  BIRIM_FIYAT_MAKS,
  GRAM_MAKS,
  KALEM_MAKS,
  KG_MAKS,
  TUTAR_MAKS,
  gecerliPozitifSayi,
  gecerliSayi,
  kalemSayisiGecerli,
  parolaGecerli,
} from "../src/lib/dogrulama";

test("gecerliSayi taşan, sonlu olmayan ve yanlış tipteki değerleri reddeder", () => {
  assert.equal(gecerliSayi(1e308, 0, KG_MAKS), false);
  assert.equal(gecerliSayi(Number.POSITIVE_INFINITY, 0, KG_MAKS), false);
  assert.equal(gecerliSayi(Number.NaN, 0, KG_MAKS), false);
  assert.equal(gecerliSayi("100" as unknown as number, 0, KG_MAKS), false);
  assert.equal(gecerliSayi(-1, 0, KG_MAKS), false);
  assert.equal(gecerliSayi(KG_MAKS + 0.001, 0, KG_MAKS), false);
  assert.equal(gecerliSayi(KG_MAKS, 0, KG_MAKS), true);
  assert.equal(gecerliSayi(0, 0, KG_MAKS), true);
  assert.equal(gecerliSayi(12.5, 0.001, KG_MAKS), true);
});

test("gecerliPozitifSayi sıfırı, negatifi ve üst sınır aşımını reddeder", () => {
  assert.equal(gecerliPozitifSayi(0, TUTAR_MAKS), false);
  assert.equal(gecerliPozitifSayi(-5, TUTAR_MAKS), false);
  assert.equal(gecerliPozitifSayi(TUTAR_MAKS + 1, TUTAR_MAKS), false);
  assert.equal(gecerliPozitifSayi(0.001, TUTAR_MAKS), true);
});

test("kalemSayisiGecerli boş, tanımsız ve aşırı uzun kalem listelerini reddeder", () => {
  assert.equal(kalemSayisiGecerli([]), false);
  assert.equal(kalemSayisiGecerli(null), false);
  assert.equal(kalemSayisiGecerli(undefined), false);
  assert.equal(kalemSayisiGecerli(new Array(KALEM_MAKS + 1).fill({ kg: 1 })), false);
  assert.equal(kalemSayisiGecerli([{ kg: 1 }]), true);
  assert.equal(kalemSayisiGecerli(new Array(KALEM_MAKS).fill({ kg: 1 })), true);
});

test("iş alanı üst sınırları tutarlı ve makuldür", () => {
  assert.ok(GRAM_MAKS > 0 && GRAM_MAKS < KG_MAKS);
  assert.ok(BIRIM_FIYAT_MAKS > 0 && BIRIM_FIYAT_MAKS < TUTAR_MAKS);
  assert.ok(KALEM_MAKS >= 1);
});

test("parolaGecerli en az 6 karakter ve harf+rakam ister", () => {
  assert.equal(parolaGecerli("ab1"), false); // kısa
  assert.equal(parolaGecerli("abcdef"), false); // rakam yok
  assert.equal(parolaGecerli("123456"), false); // harf yok
  assert.equal(parolaGecerli(""), false);
  assert.equal(parolaGecerli(undefined), false);
  assert.equal(parolaGecerli("abc123"), true); // tam sınır
  assert.equal(parolaGecerli("a1b2c3"), true);
  assert.equal(parolaGecerli("şifre1"), true); // Türkçe harf kabul edilir
  assert.equal(parolaGecerli("abc123!@#"), true); // özel karakterli ama zorunlu değil
  assert.equal(parolaGecerli("abcde1"), true); // özel karakter/büyük harf zorunlu değil
});
