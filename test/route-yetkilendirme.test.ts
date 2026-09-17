import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const korunanEkranlar = [
  ["src/app/alim/yeni/page.tsx", 'requirePagePermission("ALIM", "OLUSTUR")'],
  ["src/app/cari/page.tsx", 'requirePagePermission("CARI", "GORUNTULE")'],
  ["src/app/cari/hesaplar/page.tsx", 'requirePagePermission("CARI", "GORUNTULE")'],
  ["src/app/cari/[id]/page.tsx", 'requirePagePermission("CARI", "GORUNTULE")'],
  ["src/app/finans/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
  ["src/app/tahsilat/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
  ["src/app/satis/yeni/page.tsx", 'requirePagePermission("SATIS", "OLUSTUR")'],
  ["src/app/sevk-yeni/page.tsx", 'requirePagePermission("SEVKIYAT", "OLUSTUR")'],
  ["src/app/ayarlar/page.tsx", "requireAnyPagePermission("],
  ["src/app/mod/findik/page.tsx", 'requirePagePermission("ALIM", "GORUNTULE")'],
  ["src/app/findik-islemleri/page.tsx", 'requirePagePermission("ALIM", "GORUNTULE")'],
  ["src/app/mod/finans/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
  ["src/app/mod/musteri/page.tsx", 'requirePagePermission("CARI", "GORUNTULE")'],
  ["src/app/mod/rapor/page.tsx", 'requirePagePermission("RAPORLAR", "GORUNTULE")'],
  ["src/app/arama/layout.tsx", 'requirePagePermission("DASHBOARD", "GORUNTULE")'],
  ["src/app/api/cari-ara/route.ts", 'requirePermission("CARI", "GORUNTULE")'],
] as const;

test("hassas ikincil ekranlar uygun sayfa izni olmadan veri sorgulamaz", () => {
  for (const [dosya, izin] of korunanEkranlar) {
    const kod = readFileSync(path.resolve(dosya), "utf8");
    assert.match(kod, /import \{[^}]*(?:requirePermission|requirePagePermission|requireAnyPagePermission)[^}]*\} from "@\/lib\/rbac\/guard"/);
    assert.ok(kod.includes(izin), `${dosya}: ${izin} zorunlu olmalı`);
  }
});

test("tüm firma çalışma alanı rotaları sunucu tarafında uygun izni ister", () => {
  const rotaIzinleri = [
    ["src/app/page.tsx", 'requirePagePermission("DASHBOARD", "GORUNTULE")'],
    ["src/app/alim/page.tsx", 'requirePagePermission("ALIM", "GORUNTULE")'],
    ["src/app/avans/page.tsx", 'requirePagePermission("AVANS", "GORUNTULE")'],
    ["src/app/banka/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
    ["src/app/emanet/page.tsx", 'requirePagePermission("EMANET", "GORUNTULE")'],
    ["src/app/finans/odeme/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
    ["src/app/finans-taslaklari/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
    ["src/app/kasa/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
    ["src/app/kar-zarar/page.tsx", 'requirePagePermission("RAPORLAR", "GORUNTULE")'],
    ["src/app/masraf/page.tsx", 'requirePagePermission("MASRAF", "GORUNTULE")'],
    ["src/app/randiman/page.tsx", 'requirePagePermission("RANDIMAN", "GORUNTULE")'],
    ["src/app/raporlar/page.tsx", 'requirePagePermission("RAPORLAR", "GORUNTULE")'],
    ["src/app/satis/page.tsx", 'requirePagePermission("SATIS", "GORUNTULE")'],
    ["src/app/sevkiyat/page.tsx", 'requirePagePermission("SEVKIYAT", "GORUNTULE")'],
    ["src/app/sesli-not/page.tsx", 'requirePagePermission("SESLI_NOT", "GORUNTULE")'],
    ["src/app/stok/page.tsx", 'requirePagePermission("STOK", "GORUNTULE")'],
    ["src/app/virman/page.tsx", 'requirePagePermission("FINANS", "GORUNTULE")'],
    ["src/app/alim/[id]/etiket/page.tsx", 'requirePagePermission("ALIM", "GORUNTULE")'],
    ["src/app/alim/[id]/fis/page.tsx", 'requirePagePermission("ALIM", "GORUNTULE")'],
    ["src/app/satis/[id]/fis/page.tsx", 'requirePagePermission("SATIS", "GORUNTULE")'],
  ] as const;
  for (const [dosya, izin] of rotaIzinleri) {
    const kod = readFileSync(path.resolve(dosya), "utf8").replace(/\s/g, "");
    assert.ok(kod.includes(izin.replace(/\s/g, "")), `${dosya}: ${izin} zorunlu olmalı`);
  }
});

test("uçtan uca test sunucusu paket yöneticisi başlangıcına bağımlı değildir", () => {
  const config = readFileSync(path.resolve("playwright.config.ts"), "utf8");

  assert.match(config, /node \.\/node_modules\/next\/dist\/bin\/next dev -p 3066/);
  assert.doesNotMatch(config, /command: "pnpm dev"/);
});

test("CI proje paket yöneticisini kullanır, boş PostgreSQL üzerinde migration ve kritik tarayıcı testlerini çalıştırır", () => {
  const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
  const packageJson = readFileSync(path.resolve("package.json"), "utf8");

  assert.match(packageJson, /"packageManager": "pnpm@11\.19\.0"/);
  assert.match(workflow, /version: 11\.19\.0/g);
  assert.match(workflow, /image: postgres:17/g);
  assert.match(workflow, /pnpm prisma migrate deploy/g);
  assert.match(workflow, /pnpm prisma migrate diff --from-config-datasource --to-schema prisma\/schema\.prisma --exit-code/);
  assert.match(workflow, /pnpm test:e2e/);
  assert.match(workflow, /pnpm exec playwright install --with-deps chromium/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/filbert_ci:/);
  const setupE2e = readFileSync(path.resolve("e2e/setup-and-cari.spec.ts"), "utf8");
  assert.match(setupE2e, /test\.skip\(!process\.env\.CI/);
  assert.match(setupE2e, /Sistem kurulumunu tamamla/);
  assert.match(setupE2e, /Cari kart oluştur/);
  assert.match(setupE2e, /Pasifleştir/);
});

test("Windows PWA kurulumu izinleri kullanıcı tıklamasıyla ister", () => {
  const pwa = readFileSync(path.resolve("src/components/pwa-install-button.tsx"), "utf8");
  const giris = readFileSync(path.resolve("src/app/giris/page.tsx"), "utf8");

  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /Notification\.requestPermission\(\)/);
  assert.match(pwa, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(pwa, /Windows uygulaması olarak yükle/);
  assert.match(giris, /<PwaInstallButton \/>/);
});

test("offline API çağrısı sesli-not oluşturma izni olmadan işlenmez", () => {
  const kod = readFileSync(path.resolve("src/app/api/offline-sync/route.ts"), "utf8");
  assert.ok(kod.includes('SESLI_NOT_TASLAGI'));
  assert.doesNotMatch(kod, /ALIM_FISI_TASLAGI/);
  assert.ok(kod.includes('izinVar(actor, "SESLI_NOT", "OLUSTUR")'));
  assert.match(kod, /status\s*=\s*mesaj === "Oturum açmanız gerekiyor" \? 401/);
  assert.match(kod, /komut\.sahipKullaniciId !== actor\.id/);
  assert.match(kod, /body = await request\.json\(\)/);
  assert.match(kod, /status === 500 \? "Senkronizasyon başarısız" : mesaj/);
  assert.match(kod, /cache-control": "private, no-store/);
});

test("offline eşitleme kaydı görünürlük dinleyicisini temizler ve paralel istek başlatmaz", () => {
  const kod = readFileSync(path.resolve("src/components/offline-sync-register.tsx"), "utf8");
  assert.match(kod, /let calisiyor = false/);
  assert.match(kod, /document\.removeEventListener\("visibilitychange", gorunurlukDegisti\)/);
  assert.match(kod, /window\.removeEventListener\("online", sync\)/);
});

test("servis çalışanı yalnız başarılı statik varlıkları önbelleğe alır", () => {
  const kod = readFileSync(path.resolve("public/sw.js"), "utf8");

  assert.match(kod, /if \(!response\.ok\) return response;/);
  assert.match(kod, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.doesNotMatch(kod, /url\.pathname\.startsWith\("\/api\/"\)[\s\S]{0,200}cache\.put/);
});

test("müşteri arama API'si yetki hatalarını HTTP yanıtına dönüştürür ve aramayı sınırlar", () => {
  const kod = readFileSync(path.resolve("src/app/api/cari-ara/route.ts"), "utf8");

  assert.ok(kod.includes('requirePermission("CARI", "GORUNTULE")'));
  assert.match(kod, /\.slice\(0, 100\)/);
  assert.match(kod, /mesaj === "Oturum açmanız gerekiyor" \? 401/);
  assert.match(kod, /mesaj === "Bu işlem için yetkiniz yok" \? 403/);
  assert.match(kod, /cache-control": "private, no-store/);
});

test("ses kaydı API'si izin ve audit kaydı olmadan mutasyon yapmaz", () => {
  const kod = readFileSync(path.resolve("src/app/api/sesli-not/[id]/ses-kaydi/route.ts"), "utf8");
  assert.ok(kod.includes("requirePermission(\"SESLI_NOT\", \"GORUNTULE\")"));
  assert.match(kod, /auditKaydi\.create/);
  assert.match(kod, /catch \(error\) \{ return yetkiHatasi\(error\); \}/);
  assert.match(kod, /status === 500 \? "Ses kaydı yüklenemedi" : mesaj/);
});

test("sesli finans taslağı onaydan önce defter hareketi oluşturmaz", () => {
  const kod = readFileSync(path.resolve("src/lib/finans-taslagi.ts"), "utf8");
  assert.doesNotMatch(kod, /finansHareket\.create/);
});

test("sesli finans taslağı yalnız bir kez atomik olarak onaylanır veya reddedilir", () => {
  const kod = readFileSync(path.resolve("src/lib/actions/finans-taslagi.ts"), "utf8");

  assert.match(kod, /finansTaslagi\.updateMany/);
  assert.match(kod, /sahiplenme\.count !== 1/);
  assert.match(kod, /reddetme\.count !== 1/);
  assert.match(kod, /finansHareketId: null/);
  assert.match(kod, /TransactionIsolationLevel\.Serializable/);
});

test("onay ve iptal kontrolleri ekrandaki işlem izinlerine göre görünür", () => {
  const fis = readFileSync(path.resolve("src/components/fis-durum-islemleri.tsx"), "utf8");
  const sevkiyat = readFileSync(path.resolve("src/components/sevkiyat-durum-islemleri.tsx"), "utf8");

  assert.match(fis, /durum === "TASLAK" && onayYetkisi/);
  assert.match(fis, /iptalYetkisi && <button/);
  assert.match(sevkiyat, /if \(durum !== "FABRIKA_EMANET"\) return null;/);
  assert.match(sevkiyat, /guncelleYetkisi && \(/);
});

test("oluşturma yetkisi, onaylı alım veya satış kaydı oluşturmaya tek başına yetmez", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const satis = readFileSync(path.resolve("src/lib/actions/satis.ts"), "utf8");

  assert.match(alim, /g\.durum === "ONAYLI" && !izinVar\(actor, "ALIM", "ONAYLA"\)/);
  assert.match(satis, /g\.durum === "ONAYLI" && !izinVar\(actor, "SATIS", "ONAYLA"\)/);
});

test("alım onayı ve iptali eşzamanlı ikinci hareket üretmeden atomik durum geçişi yapar", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const form = readFileSync(path.resolve("src/components/alim-form.tsx"), "utf8");

  // Taslakta seçilen avans mahsubu fişte hatırlanır ve onay anında uygulanır.
  assert.match(alim, /avansMahsupId: fis\.avansMahsupId \?\? undefined/);
  assert.match(alim, /sahiplenme\.count !== 1/);
  assert.match(alim, /where: \{ id: fisId, durum: "TASLAK" \}/);
  assert.match(alim, /where: \{ id: fisId, durum: fis\.durum \}/);
  assert.match(alim, /TransactionIsolationLevel\.Serializable/);
  // Form, avans mahsubunu taslak ve onaylı akışın her ikisinde de gönderir.
  assert.match(form, /avansMahsupTutar: mahsupTutar > 0 \? mahsupTutar : undefined/);
});

test("satış onayı ve iptali eşzamanlı ikinci hareket üretmeden atomik durum geçişi yapar", () => {
  const satis = readFileSync(path.resolve("src/lib/actions/satis.ts"), "utf8");

  assert.match(satis, /sahiplenme\.count !== 1/);
  assert.match(satis, /where: \{ id: satisId, durum: "TASLAK" \}/);
  assert.match(satis, /where: \{ id: satisId, durum: satis\.durum \}/);
  assert.match(satis, /TransactionIsolationLevel\.Serializable/);
});

test("ayni ve fındık karşılığı avans formu zorunlu depo ve kg girdilerini sunar", () => {
  const page = readFileSync(path.resolve("src/app/avans/page.tsx"), "utf8");
  const form = readFileSync(path.resolve("src/components/avans-form.tsx"), "utf8");

  assert.match(page, /getDepolar/);
  assert.match(page, /depolar=\{depolar\.filter/);
  assert.match(form, /depoId: tur === "AYNI"/);
  assert.match(form, /kg: tur === "AYNI" \|\| tur === "FINDIK_KARSILIGI"/);
  assert.match(form, /Çıkış deposu/);
  assert.match(form, /Fındık karşılığı miktar/);
});

test("finansal oluşturma formları işlem izni olmadan görünmez ve hesap para birimini taşır", () => {
  const avans = readFileSync(path.resolve("src/app/avans/page.tsx"), "utf8");
  const avansForm = readFileSync(path.resolve("src/components/avans-form.tsx"), "utf8");
  const masraf = readFileSync(path.resolve("src/app/masraf/page.tsx"), "utf8");
  const tahsilat = readFileSync(path.resolve("src/app/tahsilat/page.tsx"), "utf8");
  const finansForm = readFileSync(path.resolve("src/components/finans-form.tsx"), "utf8");
  const masrafAction = readFileSync(path.resolve("src/lib/actions/masraf.ts"), "utf8");

  assert.match(avans, /izinVar\(actor, "AVANS", "OLUSTUR"\)/);
  assert.match(masraf, /izinVar\(actor, "MASRAF", "OLUSTUR"\)/);
  assert.match(tahsilat, /izinVar\(actor, "FINANS", "OLUSTUR"\)/);
  assert.match(finansForm, /includes\(hesap\.bakiyeTuru\)\) setBakiyeTuru\(hesap\.bakiyeTuru as/);
  assert.match(avansForm, /const hesap = hesaplar\.find/);
  assert.match(avansForm, /bakiyeTuru !== "TL" && sayiCevir\(tutarDoviz\) <= 0/);
  assert.match(masrafAction, /firmaId: actor\.firmaId, aktif: true/);
});

test("sesli finans taslağı Türkçe ondalık tutarıyla onaylanır ve geçersiz sayı sunucuda reddedilir", () => {
  const form = readFileSync(path.resolve("src/components/finans-taslaklari.tsx"), "utf8");
  const action = readFileSync(path.resolve("src/lib/actions/finans-taslagi.ts"), "utf8");

  assert.match(form, /tutar: sayiCevir\(tutar\)/);
  assert.match(form, /disabled=\{pending \|\| !hesapId \|\| sayiCevir\(tutar\) <= 0\}/);
  assert.match(form, /from "@\/components\/ui\/select"/);
  assert.doesNotMatch(form, /<select/);
  assert.match(form, /router\.refresh\(\)/);
  assert.match(action, /Number\.isFinite\(g\.tutar\)/);
  assert.match(action, /!g\.taslakId \|\| !g\.hesapId/);
  assert.match(action, /console\.error\("finansTaslagiOnayla"/);
  assert.match(action, /console\.error\("finansTaslagiReddet"/);
});

test("sesli finans taslağı ses yüklemesi başarısız olsa da inceleme kuyruğunu korur", () => {
  const form = readFileSync(path.resolve("src/components/sesli-finans-taslagi-form.tsx"), "utf8");

  assert.match(form, /sesYuklenemedi = !yukle\.ok/);
  assert.match(form, /const taslak = await sesliFinansTaslagiOlustur/);
  assert.match(form, /ses dosyası yüklenemedi/);
  assert.match(form, /disabled=\{pending \|\| kayit \|\| !cariId/);
  assert.match(form, /from "@\/components\/ui\/select"/);
  assert.doesNotMatch(form, /<select/);
});

test("sesli not desteği hidrasyon sırasında tarayıcı bilgisini doğrudan okumaz", () => {
  const form = readFileSync(path.resolve("src/components/sesli-not-form.tsx"), "utf8");

  assert.match(form, /useSyncExternalStore/);
  assert.match(form, /\(\) => !!taniyiciGetir\(\), \(\) => false/);
  assert.match(form, /destek === false/);
  assert.doesNotMatch(form, /typeof window !== "undefined" && !!taniyiciGetir/);
  assert.match(form, /disabled=\{pending \|\| dinliyor \|\| metin\.trim\(\)\.length < 2\}/);
});

test("istemci tarihleri uygulamanın sabit saat diliminde gösterilir", () => {
  const sesliNot = readFileSync(path.resolve("src/components/sesli-not-form.tsx"), "utf8");
  const sezon = readFileSync(path.resolve("src/components/ayar/sezon-tanim.tsx"), "utf8");
  const kurtarma = readFileSync(path.resolve("src/app/ayarlar/kurtarma/kurtarma-listesi.tsx"), "utf8");

  assert.match(sesliNot, /timeZone: "Europe\/Istanbul"/);
  assert.match(sezon, /timeZone: "Europe\/Istanbul"/);
  assert.match(kurtarma, /timeZone: "Europe\/Istanbul"/);
  assert.match(kurtarma, /disabled=\{pending\}/);
});

test("günlük iş sorguları İstanbul tarih yardımcılarını kullanır", () => {
  const raporlar = readFileSync(path.resolve("src/app/raporlar/page.tsx"), "utf8");
  const queries = readFileSync(path.resolve("src/lib/queries.ts"), "utf8");
  const dashboard = readFileSync(path.resolve("src/app/page.tsx"), "utf8");

  assert.match(raporlar, /istanbulTarihAnahtari\(\)/);
  assert.match(queries, /istanbulGunAraligi\(tarih\)/);
  assert.match(dashboard, /istanbulGunAraligi\(\)/);
});

test("sevkiyat iptali güncelleme izninden ayrı olarak sunucuda doğrulanır", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  assert.match(sevkiyat, /!izinVar\(actor, "SEVKIYAT", "IPTAL"\)\) return \{ ok: false, hata: "Sevkiyat iptal yetkiniz yok" \}/);
});

test("sevkiyat muhasebeleştirme ve iptali seri transaction içinde atomik durum geçişi yapar", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  assert.match(sevkiyat, /where: \{ id: sevkiyatId, firmaId: firma\.id, durum: "FABRIKA_EMANET" \}/);
  assert.match(sevkiyat, /where: \{ id: sevkiyatId, firmaId, durum: "FABRIKA_EMANET" \}/);
  assert.match(sevkiyat, /mulkiyet: "KENDI"/);
  assert.match(sevkiyat, /TransactionIsolationLevel\.Serializable/);
  assert.match(sevkiyat, /sevkiyat\.updateMany/);
  assert.match(sevkiyat, /sahiplenme\.count !== 1/);
  assert.match(sevkiyat, /Sevkiyat başka bir işlem tarafından güncellendi/);
});

test("satışta seçilen depo zorunludur; onay ve iptal aynı depo bazında stok hareketi üretir", () => {
  const satis = readFileSync(path.resolve("src/lib/actions/satis.ts"), "utf8");
  const form = readFileSync(path.resolve("src/app/satis/yeni/satis-form.tsx"), "utf8");

  assert.match(satis, /depoId: string/);
  assert.match(satis, /Satış için depo seçilmedi/);
  assert.match(satis, /TransactionIsolationLevel\.Serializable/);
  assert.match(satis, /depoId: kalem\.depoId!/);
  assert.match(satis, /kg: Number\(kalem\.kg\)/);
  assert.match(form, /Çıkış deposu/);
  assert.match(form, /depoId,/);
});

test("ayni avans depo ve kendi stok doğrulaması olmadan oluşturulamaz", () => {
  const avans = readFileSync(path.resolve("src/lib/actions/avans.ts"), "utf8");

  assert.match(avans, /g\.tur === "AYNI" && !g\.depoId/);
  assert.match(avans, /Ayni avansta depo seçilmeli/);
  assert.match(avans, /depoId: g\.depoId, mulkiyet: "KENDI"/);
  assert.match(avans, /Depoda yeterli kendi stok yok/);
  assert.match(avans, /TransactionIsolationLevel\.Serializable/);
  assert.match(avans, /hesap\.bakiyeTuru !== g\.bakiyeTuru/);
});

test("masrafın finans etkisi yalnız TL hesabıyla eşleşir", () => {
  const masraf = readFileSync(path.resolve("src/lib/actions/masraf.ts"), "utf8");

  assert.match(masraf, /hesap && hesap\.bakiyeTuru !== "TL"/);
  assert.match(masraf, /Masraf kaydı için yalnız TL hesabı kullanılabilir/);
});

test("finansal mutasyonlar geçersiz enum değerlerini sunucuda reddeder", () => {
  const finans = readFileSync(path.resolve("src/lib/actions/finans.ts"), "utf8");
  const avans = readFileSync(path.resolve("src/lib/actions/avans.ts"), "utf8");
  const masraf = readFileSync(path.resolve("src/lib/actions/masraf.ts"), "utf8");
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");

  assert.match(finans, /Geçersiz finans işlem tipi/);
  assert.match(finans, /Geçersiz para birimi/);
  assert.match(finans, /gecerliSayi\(g\.tutar, 0\.001, TUTAR_MAKS\)/);
  assert.match(finans, /Vade tarihi geçersiz/);
  assert.match(avans, /Geçersiz avans tipi/);
  assert.match(avans, /\["TL", "USD", "EUR", "XAU"\]/);
  assert.match(masraf, /masrafTuru\.findFirst/);
  assert.match(masraf, /Masraf türü bulunamadı/);
  assert.match(alim, /Geçersiz ürün cinsi/);
  assert.match(alim, /Geçersiz mülkiyet türü/);
});

test("virman kaynak ve hedef hesap bakiyelerine ters yönlerde yansır", () => {
  for (const dosya of ["src/app/kasa/page.tsx", "src/app/banka/page.tsx"]) {
    const ekran = readFileSync(path.resolve(dosya), "utf8");
    assert.match(ekran, /if \(h\.tip === "VIRMAN"\) return tutar/);
    assert.match(ekran, /const cikis = hesapEtkisi\(h\) < 0/);
    assert.match(ekran, /paraBirim\(Math\.abs\(hesapEtkisi\(h\)\), h\.bakiyeTuru\)/);
  }
});

test("virman ters kaydı iki hesabı birlikte dengeler", () => {
  const finans = readFileSync(path.resolve("src/lib/actions/finans.ts"), "utf8");

  assert.match(finans, /iliskiliId: cikis\.id/);
  assert.match(finans, /data: \{ iliskiliId: giris\.id \}/);
  assert.match(finans, /if \(original\.iliskiliTipi === "VIRMAN"\)/);
  assert.match(finans, /tersKaynak/);
  assert.match(finans, /tersHedef/);
  assert.match(finans, /Virman iki karşı hareketle birlikte terslendi/);
  assert.match(finans, /TransactionIsolationLevel\.Serializable/);
  assert.match(finans, /mevcutTers = await tx\.finansHareket\.findFirst/);
  assert.match(finans, /Bu hareket için zaten ters kayıt oluşturulmuş/);
});

test("satış stok yeterliliği yalnız oturumdaki firmanın depolarını kullanır", () => {
  const stok = readFileSync(path.resolve("src/lib/queries.ts"), "utf8");
  assert.match(stok, /getCurrentFirmaId/);
  assert.match(stok, /where: \{ firmaId, aktif: true \}/);
});

test("finans virman ekranı stok özetini göstermeden finans yetkisiyle çalışır", () => {
  const virman = readFileSync(path.resolve("src/app/virman/page.tsx"), "utf8");
  assert.match(virman, /requirePagePermission\("FINANS", "GORUNTULE"\)/);
  assert.doesNotMatch(virman, /getStokOzet|depoSayisi|DEPOLAR/);
});

test("tahsilat ve ödeme ekranları işlem türünü birbirinden ayırır", () => {
  const form = readFileSync(path.resolve("src/components/finans-form.tsx"), "utf8");
  const tahsilat = readFileSync(path.resolve("src/app/tahsilat/page.tsx"), "utf8");
  const odeme = readFileSync(path.resolve("src/app/finans/odeme/page.tsx"), "utf8");
  const arama = readFileSync(path.resolve("src/app/arama/arama-icerik.tsx"), "utf8");

  assert.match(form, /sabitTip\?: "ODEME" \| "TAHSILAT"/);
  assert.match(form, /!sabitTip && <div/);
  assert.match(tahsilat, /sabitTip="TAHSILAT"/);
  assert.match(odeme, /sabitTip="ODEME"/);
  assert.match(arama, /href: "\/finans\/odeme", etiket: "Ödeme"/);
});

test("salt görüntüleme yetkisi işlem formlarını ve mutasyon düğmelerini göstermez", () => {
  const emanet = readFileSync(path.resolve("src/app/emanet/page.tsx"), "utf8");
  const randiman = readFileSync(path.resolve("src/app/randiman/page.tsx"), "utf8");
  const bekleyenRandimanlar = readFileSync(path.resolve("src/app/randiman/bekleyen-randimanlar.tsx"), "utf8");
  const sesliNot = readFileSync(path.resolve("src/app/sesli-not/page.tsx"), "utf8");
  const virman = readFileSync(path.resolve("src/app/virman/page.tsx"), "utf8");
  const finansTaslaklari = readFileSync(path.resolve("src/app/finans-taslaklari/page.tsx"), "utf8");
  const finansTaslaklariIcerik = readFileSync(path.resolve("src/components/finans-taslaklari.tsx"), "utf8");

  assert.match(emanet, /izinVar\(actor, "EMANET", "GUNCELLE"\)/);
  assert.match(emanet, /guncelleYetkisi && <div/);
  assert.match(randiman, /izinVar\(actor, "RANDIMAN", "GUNCELLE"\)/);
  assert.match(bekleyenRandimanlar, /guncelleYetkisi && <button/);
  assert.match(sesliNot, /izinVar\(actor, "SESLI_NOT", "OLUSTUR"\)/);
  assert.match(virman, /izinVar\(actor, "FINANS", "OLUSTUR"\)/);
  assert.match(virman, /olusturYetkisi && <VirmanForm/);
  assert.match(finansTaslaklari, /izinVar\(actor,"FINANS","ONAYLA"\)/);
  assert.match(finansTaslaklari, /izinVar\(actor,"FINANS","IPTAL"\)/);
  assert.match(finansTaslaklariIcerik, /onayYetkisi && <button/);
  assert.match(finansTaslaklariIcerik, /iptalYetkisi && <button/);
});

test("masaüstü ve mobil menüler yalnız sunucunun izin verdiği rotaları sunar", () => {
  const layout = readFileSync(path.resolve("src/app/layout.tsx"), "utf8");
  const masaustu = readFileSync(path.resolve("src/components/masaustu-nav.tsx"), "utf8");
  const mobil = readFileSync(path.resolve("src/components/bottom-nav.tsx"), "utf8");

  assert.match(layout, /izinVar\(user, modul, eylem\)/);
  assert.match(layout, /<MobileShell izinliRotalar=\{izinliRotalar\}/);
  assert.match(masaustu, /grup\.ogeler\.filter\(\(oge\) => izinliRotalar\.includes\(oge\.href\)\)/);
  assert.match(masaustu, /izinliRotalar\.includes\("\/ayarlar"\)/);
  assert.doesNotMatch(masaustu, /href: "\/pos"/);
  assert.match(mobil, /izinli\("\/sesli-not"\)/);
  assert.match(mobil, /izinli\("\/ayarlar"\)/);
});

test("gösterge paneli hızlı erişimleri de işlem bazlı izne göre filtreler", () => {
  const anaSayfa = readFileSync(path.resolve("src/app/page.tsx"), "utf8");

  assert.match(anaSayfa, /izinli\("ALIM", "OLUSTUR"\) && <HizliButon/);
  assert.match(anaSayfa, /izinli\("FINANS", "OLUSTUR"\) && <HizliButon/);
  assert.match(anaSayfa, /izinli\("EMANET", "OLUSTUR"\) && <HizliButon/);
  assert.match(anaSayfa, /izinli\("CARI", "GORUNTULE"\) && <MobilModul/);
  assert.match(anaSayfa, /izinli\("RAPORLAR", "GORUNTULE"\) && <MobilModul/);
  assert.match(anaSayfa, /izinler\.finans \? prisma\.finansTaslagi\.count/);
  assert.match(anaSayfa, /\{izinler\.alim && <section/);
});

test("ayarlar alt sekmeleri veri görüntüleme yetkisine göre ayrılır", () => {
  const page = readFileSync(path.resolve("src/app/ayarlar/page.tsx"), "utf8");
  const icerik = readFileSync(path.resolve("src/app/ayarlar/ayar-icerik.tsx"), "utf8");

  assert.match(page, /requireAnyPagePermission\([\s\S]*\["AYARLAR", "GORUNTULE"\],[\s\S]*\["TANIMLAR", "GORUNTULE"\],[\s\S]*\["KULLANICI_YONETIMI", "YONET"\]/);
  assert.match(page, /const tanimGoruntuleYetkisi = izinVar\(actor, "TANIMLAR", "GORUNTULE"\)/);
  assert.match(page, /const kullaniciYonetYetkisi = izinVar\(actor, "KULLANICI_YONETIMI", "YONET"\)/);
  assert.match(page, /kullaniciYonetYetkisi \? getKullanicilar\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(page, /tanimGoruntuleYetkisi \? getPersonel\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(icerik, /sekme\.key !== "tanimlar" \|\| props\.tanimGoruntuleYetkisi/);
  assert.match(icerik, /sekme\.key !== "kullanicilar" \|\| props\.kullaniciYonetYetkisi/);
  assert.match(icerik, /sekme\.key !== "sistem" \|\| props\.sistemGoruntuleYetkisi/);
});

test("tanımlar veya kullanıcı yönetimi yetkisi ayarlar çalışma alanına erişim verir", () => {
  const layout = readFileSync(path.resolve("src/app/layout.tsx"), "utf8");
  const guard = readFileSync(path.resolve("src/lib/rbac/guard.ts"), "utf8");

  assert.match(guard, /export async function requireAnyPagePermission/);
  assert.match(guard, /gerekenler\.some\(\(\[modul, eylem\]\) => izinVar\(user, modul, eylem\)\)/);
  assert.match(layout, /izinVar\(user, "TANIMLAR", "GORUNTULE"\) \|\| izinVar\(user, "KULLANICI_YONETIMI", "YONET"\)/);
  assert.match(layout, /\[\.\.\.rotalar, "\/ayarlar"\]/);
});

test("genel arama yalnız sunucunun yetki verdiği modülleri ve müşteri aramasını sunar", () => {
  const page = readFileSync(path.resolve("src/app/arama/page.tsx"), "utf8");
  const icerik = readFileSync(path.resolve("src/app/arama/arama-icerik.tsx"), "utf8");

  assert.match(page, /ROTA_IZINLERI\.filter/);
  assert.match(page, /izinVar\(user, "CARI", "GORUNTULE"\)/);
  assert.match(icerik, /MODUL_OGELERI\.filter\(\(oge\) => izinliRotalar\.includes\(oge\.href\)\)/);
  assert.match(icerik, /!cariAramaYetkisi \|\| metin\.length < 2/);
});

test("liste ve detay ekranlarındaki yeni kayıt kısayolları oluşturma izni ister", () => {
  const alim = readFileSync(path.resolve("src/app/alim/page.tsx"), "utf8");
  const satis = readFileSync(path.resolve("src/app/satis/page.tsx"), "utf8");
  const sevkiyat = readFileSync(path.resolve("src/app/sevkiyat/page.tsx"), "utf8");
  const cari = readFileSync(path.resolve("src/app/cari/[id]/page.tsx"), "utf8");
  const header = readFileSync(path.resolve("src/components/app-header.tsx"), "utf8");

  assert.match(alim, /izinVar\(actor, "ALIM", "OLUSTUR"\)/);
  assert.match(satis, /izinVar\(actor, "SATIS", "OLUSTUR"\)/);
  assert.match(sevkiyat, /izinVar\(actor, "SEVKIYAT", "OLUSTUR"\)/);
  assert.match(cari, /izinVar\(actor, "FINANS", "OLUSTUR"\)/);
  assert.match(cari, /izinVar\(actor, "AVANS", "OLUSTUR"\)/);
  assert.match(header, /izinVar\(oturum\.kullanici, "ALIM", "OLUSTUR"\)/);
});

test("cari kartı oluşturma ve düzenleme eylemleri ayrı izinlerle görünür", () => {
  const page = readFileSync(path.resolve("src/app/cari/hesaplar/page.tsx"), "utf8");
  const controls = readFileSync(path.resolve("src/components/cari-kart-kontrolleri.tsx"), "utf8");

  assert.match(page, /izinVar\(actor, "CARI", "OLUSTUR"\)/);
  assert.match(page, /izinVar\(actor, "CARI", "GUNCELLE"\)/);
  assert.match(page, /<YeniCariButonu yetkili=\{cariOlusturYetkisi\}/);
  assert.match(page, /<CariDuzenleButonu kayit=\{c\} yetkili=\{cariGuncelleYetkisi\}/);
  assert.match(page, /getCariler\(tur as "URETICI" \| undefined, q, cariGuncelleYetkisi \? "TUMU" : true\)/);
  assert.match(page, /PASİF/);
  assert.match(controls, /Cari kartlar silinmez; işlem geçmişini korumak için pasifleştirilir/);
});

test("masaüstü rotaları kendi modül izinleriyle eşleşir", () => {
  const layout = readFileSync(path.resolve("src/app/layout.tsx"), "utf8");

  assert.match(layout, /\["\/randiman", "RANDIMAN", "GORUNTULE"\]/);
  assert.match(layout, /\["\/emanet", "EMANET", "GORUNTULE"\]/);
  assert.match(layout, /\["\/virman", "FINANS", "GORUNTULE"\]/);
  assert.match(layout, /\["\/avans", "AVANS", "GORUNTULE"\]/);
  assert.match(layout, /\["\/masraf", "MASRAF", "GORUNTULE"\]/);
  assert.match(layout, /\["\/stok", "STOK", "GORUNTULE"\]/);
});

test("ikincil modül menüleri erişilemeyen rotaları listelemez", () => {
  const navigasyon = readFileSync(path.resolve("src/lib/rbac/modul-navigasyon.ts"), "utf8");
  const finansModulu = readFileSync(path.resolve("src/app/mod/finans/page.tsx"), "utf8");
  const musteri = readFileSync(path.resolve("src/app/mod/musteri/page.tsx"), "utf8");
  const rapor = readFileSync(path.resolve("src/app/mod/rapor/page.tsx"), "utf8");
  const findikMobil = readFileSync(path.resolve("src/app/mod/findik/page.tsx"), "utf8");
  const findik = readFileSync(path.resolve("src/app/findik-islemleri/page.tsx"), "utf8");
  const finansLanding = readFileSync(path.resolve("src/app/finans/page.tsx"), "utf8");
  const cari = readFileSync(path.resolve("src/app/cari/page.tsx"), "utf8");

  assert.match(navigasyon, /"\/alim\/yeni": \["ALIM", "OLUSTUR"\]/);
  assert.match(navigasyon, /izinVar\(actor, izin\[0\], izin\[1\]\)/);
  assert.match(finansModulu, /modulleriIzinlereGoreFiltrele\(actor, modüller\)/);
  assert.match(musteri, /modulleriIzinlereGoreFiltrele\(actor, modüller\)/);
  assert.match(rapor, /modulleriIzinlereGoreFiltrele\(actor, modüller\)/);
  assert.match(findikMobil, /modulleriIzinlereGoreFiltrele\(actor, modüller\)/);
  assert.match(findik, /\.filter\(\(madde\) =>/);
  assert.match(finansLanding, /\.filter\(\(madde\) =>/);
  assert.match(cari, /\.filter\(\(madde\) =>/);
});

test("kurtarma ekranı değiştirilebilir tanımları geri yükler, defter kayıtlarında ters kayıt politikasını açıklar", () => {
  const page = readFileSync(path.resolve("src/app/ayarlar/kurtarma/page.tsx"), "utf8");
  const list = readFileSync(path.resolve("src/app/ayarlar/kurtarma/kurtarma-listesi.tsx"), "utf8");
  const recovery = readFileSync(path.resolve("src/lib/recovery.ts"), "utf8");

  assert.match(page, /Finansal ve operasyonel kayıtlar silinmez/);
  assert.match(list, /Silinmez; iptal veya ters kayıtla düzeltilir/);
  assert.doesNotMatch(list, />Yakında</);
  assert.match(recovery, /Tek aktif sezon geri yükleme ile pasifleştirilemez/);
  assert.match(recovery, /sezon\.updateMany/);
  assert.match(recovery, /TransactionIsolationLevel\.Serializable/);
  assert.match(page, /"KullaniciRol"/);
  assert.match(page, /"YetkiRolu"/);
  assert.match(page, /"CariKart"/);
  assert.doesNotMatch(page, /"FiyatKaynak"|"GunlukFiyat"|"KurKayit"|"KrediFaiz"|"UrunTanimi"|"GiderTanimi"/);
  assert.match(recovery, /audit\.hedefTipi === "KullaniciRol"/);
  assert.match(recovery, /audit\.hedefTipi === "YetkiRolu"/);
  assert.match(recovery, /audit\.hedefTipi === "CariKart"/);
  assert.match(recovery, /rol izinleri geri yüklendi/);
  assert.match(recovery, /Firma Sahibi rolü pasifleştirilemez/);
  assert.match(recovery, /Snapshot içindeki rol pasif veya firma kapsamı dışında/);
  assert.match(recovery, /Firma Sahibi hesabı pasifleştirilemez/);
  assert.match(recovery, /tx\.oturum\.updateMany/);
  assert.match(recovery, /return await auditGeriYukleDahili\(auditId\)/);
  assert.match(recovery, /Kayıt geri yüklenemedi\. Kayıt değişmiş veya artık kullanılamıyor olabilir\./);
});

test("beklenmeyen render hataları kullanıcıya güvenli geri dönüş seçenekleri sunar", () => {
  const hata = readFileSync(path.resolve("src/app/error.tsx"), "utf8");
  const genelHata = readFileSync(path.resolve("src/app/global-error.tsx"), "utf8");

  assert.match(hata, /^"use client"/);
  assert.match(hata, /onClick=\{retry\}/);
  assert.match(hata, /href="\/giris"/);
  assert.match(genelHata, /^"use client"/);
  assert.match(genelHata, /<html lang="tr">/);
  assert.match(genelHata, /onClick=\{retry\}/);
});

test("bulunamayan çalışma alanı ekranı anlaşılır ve güvenli bir geri dönüş sunar", () => {
  const kod = readFileSync(path.resolve("src/app/not-found.tsx"), "utf8");

  assert.match(kod, /Aradığınız ekran burada değil/);
  assert.match(kod, /href="\//);
  assert.match(kod, /Ana sayfaya dön/);
});

test("izin eksiği giriş formuna değil açık yetki bilgilendirme ekranına yönlendirilir", () => {
  const guard = readFileSync(path.resolve("src/lib/rbac/guard.ts"), "utf8");
  const proxy = readFileSync(path.resolve("src/proxy.ts"), "utf8");
  const page = readFileSync(path.resolve("src/app/yetkisiz/page.tsx"), "utf8");

  assert.match(guard, /redirect\("\/yetkisiz"\)/);
  assert.match(proxy, /"\/yetkisiz"/);
  assert.match(page, /Bu ekrana erişim yetkiniz yok/);
  assert.match(page, /OturumKapatButonu/);
});
