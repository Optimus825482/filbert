import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULLER,
  NAV_GRUPLARI,
  aktifModulBelirle,
  dbModulKodu,
  dbModuluCoz,
  modulAnaRota,
  modulCoz,
  modulIdGecerliMi,
  navGrubuGorunur,
  rotaModulu,
} from "../src/lib/modul";
import { alimModulu, islemModulu } from "../src/lib/modul-tanimlari";

test("modül kimliği yalnızca alim/islem değerlerini kabul eder", () => {
  assert.equal(modulIdGecerliMi("alim"), true);
  assert.equal(modulIdGecerliMi("islem"), true);
  assert.equal(modulIdGecerliMi("finans"), false);
  assert.equal(modulIdGecerliMi(null), false);
  assert.equal(modulCoz("islem"), "islem");
  assert.equal(modulCoz("ISLEME"), null);
  assert.equal(modulCoz(undefined), null);
});

test("veritabanı enum değerleri modül kimliğine çift yönlü çevrilir", () => {
  assert.equal(dbModuluCoz("ISLEME"), "islem");
  assert.equal(dbModuluCoz("ALIM"), "alim");
  // Bilinmeyen/eski değerler alım modülüne düşer; davranış değişmez.
  assert.equal(dbModuluCoz(undefined), "alim");
  assert.equal(dbModuluCoz("BASKA"), "alim");
  assert.equal(dbModulKodu("islem"), "ISLEME");
  assert.equal(dbModulKodu("alim"), "ALIM");
  assert.equal(modulAnaRota("islem"), "/mod/islem");
  assert.equal(modulAnaRota("alim"), "/mod/alim");
});

test("istek yolu modüle eşlenir, modüle özel olmayan ekranlar boş döner", () => {
  assert.equal(rotaModulu("/mod/islem"), "islem");
  assert.equal(rotaModulu("/hizmet"), "islem");
  assert.equal(rotaModulu("/hizmet/kasa"), "islem");
  assert.equal(rotaModulu("/hizmet/ayarlar"), "islem");
  assert.equal(rotaModulu("/mod/alim"), "alim");
  assert.equal(rotaModulu("/mod/findik"), "alim");
  assert.equal(rotaModulu("/alim/yeni"), "alim");
  assert.equal(rotaModulu("/randiman"), "alim");
  assert.equal(rotaModulu("/emanet"), "alim");
  assert.equal(rotaModulu("/virman"), "alim");
  assert.equal(rotaModulu("/sevkiyat"), "alim");
  // Modüle özel olmayan ekranlar: kullanıcının son tercihi geçerlidir.
  assert.equal(rotaModulu("/ayarlar"), null);
  assert.equal(rotaModulu("/kasa"), null);
  assert.equal(rotaModulu("/raporlar"), null);
  // Ön ek tuzağı: /hizmetler işleme modülü sayılmaz.
  assert.equal(rotaModulu("/hizmetler"), null);
});

test("aktif modül yol → çerez → varsayılan sırasıyla belirlenir", () => {
  assert.equal(aktifModulBelirle({ yol: "alim", cerez: "islem", varsayilan: "ISLEME" }), "alim");
  assert.equal(aktifModulBelirle({ yol: null, cerez: "islem", varsayilan: "ALIM" }), "islem");
  assert.equal(aktifModulBelirle({ yol: null, cerez: null, varsayilan: "ISLEME" }), "islem");
  assert.equal(aktifModulBelirle({ yol: null, cerez: "gecersiz", varsayilan: "ALIM" }), "alim");
  assert.equal(aktifModulBelirle({ yol: null, cerez: null, varsayilan: null }), "alim");
});

test("kenar çubuğu grupları modüllere göre ayrılır", () => {
  // İşleme modülü: yalnızca kendi grubu + GENEL.
  assert.equal(navGrubuGorunur("GENEL", "islem"), true);
  assert.equal(navGrubuGorunur("FINDIK İŞLEME", "islem"), true);
  assert.equal(navGrubuGorunur("FINDIK ALIM", "islem"), false);
  assert.equal(navGrubuGorunur("FİNANS YÖNETİMİ", "islem"), false);
  assert.equal(navGrubuGorunur("MÜŞTERİ", "islem"), false);
  assert.equal(navGrubuGorunur("RAPORLAR", "islem"), false);
  // Alım modülü: işleme grubu görünmez.
  assert.equal(navGrubuGorunur("FINDIK ALIM", "alim"), true);
  assert.equal(navGrubuGorunur("FİNANS YÖNETİMİ", "alim"), true);
  assert.equal(navGrubuGorunur("MÜŞTERİ", "alim"), true);
  assert.equal(navGrubuGorunur("RAPORLAR", "alim"), true);
  assert.equal(navGrubuGorunur("FINDIK İŞLEME", "alim"), false);
  // Modül bilinmiyorsa (eski oturum) menüler daraltılmaz.
  assert.equal(navGrubuGorunur("FINDIK İŞLEME", null), true);
  assert.equal(navGrubuGorunur("FINDIK ALIM", null), true);
  // Eşlemede tanımsız başlık her modülde görünür.
  assert.equal(navGrubuGorunur("BILINMEYEN", "islem"), true);
  assert.equal(Object.keys(NAV_GRUPLARI).length, 6);
});

test("işleme modülü yalnızca işleme ekranlarını, alım modülü işleme ekranı içermez", () => {
  const isleme = islemModulu({ bekleyenTalep: 0, uretimdeTalep: 0, hazirBekleyen: 0, smsBekleyen: 0 });
  assert.equal(isleme.id, "islem");
  assert.ok(isleme.altModuller.every((t) => t.href.split("?")[0].startsWith("/hizmet")));
  const islemeKasasi = isleme.altModuller.find((t) => t.href === "/hizmet/kasa");
  assert.ok(islemeKasasi, "işleme kasası menüde olmalı");
  assert.equal(islemeKasasi?.ikon, "isleme-kasa");

  const alim = alimModulu({ bekleyenRandiman: 0 });
  assert.equal(alim.id, "alim");
  assert.ok(alim.altModuller.every((t) => !t.href.startsWith("/hizmet")));
});

test("modül tanımları geçiş etiketi ve karşı modülü tutarlı taşır", () => {
  assert.equal(MODULLER.alim.karsiModul, "islem");
  assert.equal(MODULLER.islem.karsiModul, "alim");
  assert.equal(MODULLER.alim.izinModulu, "ALIM");
  assert.equal(MODULLER.islem.izinModulu, "HIZMET");
  assert.equal(MODULLER.alim.gecEtiketi, "Fındık Alım Modülüne Geç");
  assert.equal(MODULLER.islem.gecEtiketi, "Fındık İşleme Modülüne Geç");
});