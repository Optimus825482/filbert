import test from "node:test";
import assert from "node:assert/strict";
import { basarisizGirisKaydet, basariliGirisTemizle, girisDenemeKayitSayisi, girisEngelliMi, girisSinirlayiciyiSifirla } from "../src/lib/guvenlik/giris-sinirlayici";
import { readFileSync } from "node:fs";
import path from "node:path";

test("beş başarısız giriş denemesinden sonra e-posta geçici olarak engellenir", () => {
  girisSinirlayiciyiSifirla(); const eposta = "ornek@firma.com"; const an = 1_000;
  for (let sayac = 0; sayac < 5; sayac += 1) basarisizGirisKaydet(eposta, an);
  assert.equal(girisEngelliMi(eposta, an), true);
  assert.equal(girisEngelliMi(eposta, an + 15 * 60 * 1000), false);
});

test("başarılı giriş önceki başarısız denemeleri temizler", () => {
  girisSinirlayiciyiSifirla(); const eposta = "ornek@firma.com";
  basarisizGirisKaydet(eposta); basariliGirisTemizle(eposta);
  assert.equal(girisEngelliMi(eposta), false);
});

test("farklı e-posta denemeleri sınırlayıcı belleğini sabit kapasitede tutar", () => {
  girisSinirlayiciyiSifirla();
  for (let sayac = 0; sayac < 10_001; sayac += 1) basarisizGirisKaydet(`kullanici-${sayac}@firma.com`, 1_000);
  assert.equal(girisDenemeKayitSayisi(), 10_000);
});

test("giriş sunucuda e-posta ve parola boyutlarını sınırlar", () => {
  const kod = readFileSync(path.resolve("src/lib/actions/giris.ts"), "utf8");
  const sıkıKod = kod.replace(/\s/g, "");
  assert.match(sıkıKod, /eposta\.length>320/);
  assert.match(sıkıKod, /sifre\.length>1024/);
  assert.match(kod, /\^\\S\+@\\S\+\\\.\\S\+\$/);
});

test("giriş altyapı hatasını kontrollü sonuca, form ise bekleme durumundan çıkışa dönüştürür", () => {
  const action = readFileSync(path.resolve("src/lib/actions/giris.ts"), "utf8");
  const form = readFileSync(path.resolve("src/app/giris/giris-form.tsx"), "utf8");

  assert.match(action, /console\.error\("girisYap", error\)/);
  assert.match(action, /Giriş şu anda doğrulanamadı\. Lütfen tekrar deneyin\./);
  assert.match(form, /try \{/);
  assert.match(form, /finally \{/);
  assert.match(form, /setBusy\(false\)/);
});
