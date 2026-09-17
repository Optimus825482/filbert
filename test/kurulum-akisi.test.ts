import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const oku = (dosya: string) => readFileSync(path.resolve(dosya), "utf8");

test("ilk kurulum yalnız ortam değişkenlerindeki sistem yöneticisi ve ana parola ile başlar", () => {
  const setup = oku("src/lib/actions/setup.ts");
  const giris = oku("src/lib/actions/giris.ts");
  const girisSik = giris.replace(/\s/g, "");

  assert.match(setup, /SYSTEM_ADMIN_MAIL/);
  assert.match(setup, /SYSTEM_ADMIN_PASS/);
  assert.match(setup, /SYSTEM_MAIN_PASS/);
  assert.match(setup, /uygulamaKurulumu\.findUnique/);
  assert.match(girisSik, /hedef:"\/setup"/);
  assert.match(giris, /await setupYetkisiVer\(\)/);
  assert.match(girisSik, /if\(!yonetici\)\{awaitsetupYetkisiVer\(\)/);
  assert.match(girisSik, /if\(!yonetici\.aktif\)return(await)?basarisiz\(\)/);
  assert.match(setup, /setupYetkisiVar\(\)/);
  assert.match(setup, /Önce sistem yöneticisi bilgileriyle giriş yapın/);
  assert.match(setup, /setupYetkisiniTemizle\(\)/);
  const auth = oku("src/lib/auth.ts");
  assert.match(auth, /SETUP_COOKIE, "", \{ httpOnly: true, sameSite: "strict"/);
  assert.match(auth, /path: "\/setup", maxAge: 0/);
});

test("firma kurulumu sahibi, tam yetkili rolü ve çalışmak için gereken boş tanımları birlikte oluşturur", () => {
  const platform = oku("src/lib/actions/platform.ts");

  assert.match(platform, /requireSistemYonetici\(\)/);
  assert.match(platform, /tx\.sube\.create/);
  assert.match(platform, /tx\.depo\.create/);
  assert.match(platform, /tx\.sezon\.create/);
  assert.match(platform, /Fındık sezonu 1 Ağustos'ta başlar/);
  assert.match(platform, /const baslangicYili = simdi\.getMonth\(\) >= 7/);
  assert.match(platform, /ad: `\$\{baslangicYili\}-\$\{String\(bitisYili\)\.slice\(-2\)\}`/);
  assert.match(platform, /tx\.kasaHesap\.create/);
  assert.match(platform, /kod: "FIRMA_SAHIBI"/);
  assert.match(platform, /izinler: \{ create: \[\.\.\.TAM_YETKI_IZINLERI\] \}/);
  assert.match(platform, /roller: \{ create: \{ rolId: sahipRolu\.id \} \}/);
});

test("firma kurulumu temel tanımlar adımına yönlendirilir, tanımlar yetki gruplarına bağlanır ve sistem yöneticisi oturumu olmadan açılmaz", () => {
  const form = oku("src/app/platform/firma-form.tsx");
  const page = oku("src/app/platform/page.tsx");
  const tanimlar = oku("src/app/platform/[firmaId]/tanimlar/page.tsx");
  const tanimForm = oku("src/app/platform/[firmaId]/tanimlar/tanim-form.tsx");
  const roles = oku("src/app/platform/[firmaId]/yetkiler/page.tsx");

  assert.match(form, /\/platform\/\$\{sonuc\.firmaId\}\/tanimlar/);
  assert.match(page, /if\(!y\?\.aktif\)redirect\("\/giris"\)/);
  assert.match(tanimlar, /kuranSistemYoneticisiId: yonetici\.id/);
  assert.match(tanimlar, /masrafTurleri/);
  assert.match(tanimForm, /kurulumVarsayilanTanimlariOlustur/);
  assert.match(tanimForm, /\/platform\/\$\{firmaId\}\/yetkiler/);
  assert.match(roles, /kuranSistemYoneticisiId: yonetici\.id/);
});

test("kurulum ve uygulama içi rol tanımları aynı geçerli izin sözlüğünü kullanır", () => {
  const permissions = oku("src/lib/rbac/permissions.ts");
  const platform = oku("src/lib/actions/platform.ts");
  const roller = oku("src/lib/actions/roller.ts");

  assert.match(permissions, /export function izinlerGecerli/);
  assert.match(platform, /izinlerGecerli\(izinler\)/);
  assert.match(roller, /izinlerGecerli\(g\.izinler\)/);
  assert.match(roller, /izinlerGecerli\(izinler\)/);
});

test("rol kodları Türkçe karakterleri kaybetmeden ortak kuralla üretilir", async () => {
  const { rolAdiGecerli, rolKoduOlustur } = await import("../src/lib/rbac/rol-kodu");
  const platform = oku("src/lib/actions/platform.ts");
  const roller = oku("src/lib/actions/roller.ts");

  assert.equal(rolKoduOlustur("Şoför / Çiftçi"), "SOFOR_CIFTCI");
  assert.equal(rolKoduOlustur("İşletme Müdürü"), "ISLETME_MUDURU");
  assert.equal(rolAdiGecerli("Şoför"), true);
  assert.equal(rolAdiGecerli("  !!!  "), false);
  assert.match(platform, /rolKoduOlustur\(ad\)/);
  assert.match(roller, /rolKoduOlustur\(g\.ad\)/);
});

test("kullanıcı yetki grupları sonradan düzenlenebilir ve firma sahibi rolü korunur", () => {
  const action = oku("src/lib/actions/kullanici-yonetim.ts");
  const rolAction = oku("src/lib/actions/roller.ts");
  const kullaniciAction = oku("src/lib/actions/tanimlar.ts");
  const arayuz = oku("src/components/ayar/kullanici-tanim.tsx");

  assert.match(action, /Kullanıcıya en az bir yetki grubu atanmalı/);
  assert.match(action, /kod === "FIRMA_SAHIBI"/);
  assert.match(action, /Firma Sahibi rolü bu kullanıcıdan kaldırılamaz/);
  assert.match(rolAction, /kullaniciRolleriniGuncelle/);
  assert.match(kullaniciAction, /Firma Sahibi hesabı pasifleştirilemez/);
  assert.match(arayuz, /kullaniciRolleriniGuncelle/);
  assert.match(arayuz, /Yetkileri düzenle/);
});

test("kullanıcıya rol atama, aktif rolleri seri transaction içinde tekrar doğrular", () => {
  const action = oku("src/lib/actions/kullanici-yonetim.ts");
  const roller = oku("src/lib/actions/roller.ts");

  assert.match(action, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(action, /tx\.yetkiRolu\.findMany/);
  assert.match(action, /aktif: true/);
  assert.match(action, /GECERSIZ_ROL/);
  assert.match(roller, /return kullaniciRolleriniGuncelle\(kullaniciId, rolIds\)/);
  assert.match(roller, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(roller, /KORUMASIZ_KULLANICI/);
  assert.match(roller, /rolIzinleriniGuncelle[\s\S]*tx\.yetkiRolu\.findFirst/);
});

test("kullanıcı pasifleştirme açık oturumları seri transaction içinde kapatır", () => {
  const action = oku("src/lib/actions/tanimlar.ts");
  const baslangic = action.indexOf("export async function toggleKullaniciAktif");
  const parca = action.slice(baslangic);

  assert.match(parca, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(parca, /tx\.oturum\.updateMany/);
  assert.match(parca, /revokedAt: new Date\(\)/);
  assert.match(parca, /Kendi hesabınızı pasifleştiremezsiniz/);
});

test("eski parola ve rol ataması olmayan kullanıcı oluşturma yolu kaldırılmıştır", () => {
  const eskiTanimlar = oku("src/lib/actions/tanimlar.ts");
  const kullaniciYonetimi = oku("src/lib/actions/kullanici-yonetim.ts");

  assert.doesNotMatch(eskiTanimlar, /export async function createKullanici/);
  assert.doesNotMatch(eskiTanimlar, /export async function updateKullanici/);
  assert.match(kullaniciYonetimi, /sifreHash/);
  assert.match(kullaniciYonetimi, /rolIds/);
});

test("firma kimlik bilgileri adres ve telefon dahil sonradan güncellenebilir", () => {
  const action = oku("src/lib/actions/tanimlar.ts");
  const page = oku("src/app/ayarlar/ayar-icerik.tsx");

  assert.match(action, /adres\?: string/);
  assert.match(action, /telefon\?: string/);
  assert.match(action, /Firma adresi girilmedi/);
  assert.match(action, /Firma telefonu girilmedi/);
  assert.match(action, /adres: g\.adres\?\.trim\(\) \?\? firma\.adres/);
  assert.match(action, /telefon: g\.telefon\?\.trim\(\) \?\? firma\.telefon/);
  assert.match(page, /baslik="Adres"/);
  assert.match(page, /baslik="Telefon"/);
  assert.match(page, /adres: adres\.trim\(\)/);
  assert.match(page, /telefon: telefon\.trim\(\)/);
});

test("güvenli çıkış oturumu iptal eder, çerezi temizler ve audit kaydı bırakır", () => {
  const auth = oku("src/lib/auth.ts");
  const action = oku("src/lib/actions/giris.ts");
  const button = oku("src/components/oturum-kapat-butonu.tsx");

  assert.match(auth, /export async function oturumKapat/);
  assert.match(auth, /oturum\.updateMany/);
  assert.match(auth, /eylem: "CIKIS"/);
  assert.match(auth, /maxAge: 0/);
  assert.match(action, /export async function cikisYap/);
  assert.match(button, /router\.replace\("\/giris"\)/);
});
