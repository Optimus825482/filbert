import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("iş kayıtları için doğrudan kalıcı silme aksiyonu bulunmaz", () => {
  const actionDirectory = path.resolve("src/lib/actions");
  const kaynak = readdirSync(actionDirectory)
    .filter((name) => name.endsWith(".ts") && name !== "reset-firma.ts")
    .map((name) => readFileSync(path.join(actionDirectory, name), "utf8"))
    .join("\n");

  assert.doesNotMatch(kaynak, /\.(alimFisi|satis|sevkiyat|emanet|finansHareket|masraf|avans)\.delete(?:Many)?\(/);
  assert.match(kaynak, /ters kayıt|ters kayıt ile dengelendi|silinmedi/i);
});

test("audit kaydı veritabanı katmanında ekleme dışında değiştirilemez", () => {
  const migration = readFileSync(path.resolve("prisma/migrations/20260825150000_make_audit_log_immutable/migration.sql"), "utf8");
  const securityModel = readFileSync(path.resolve("docs/security-model.md"), "utf8");

  assert.match(migration, /BEFORE UPDATE OR DELETE ON "AuditKaydi"/);
  assert.match(migration, /AuditKaydi kayıtları değiştirilemez veya silinemez/);
  assert.match(migration, /CREATE TRIGGER "AuditKaydi_immutable"/);
  assert.match(securityModel, /PostgreSQL tetikleyicisi audit satırlarında `UPDATE` ve `DELETE` işlemlerini reddeder/);
});

test("uygulama boş başlangıçla kurulur; yıkıcı örnek seed tanımlı değildir", () => {
  const prismaConfig = readFileSync(path.resolve("prisma.config.ts"), "utf8");

  assert.doesNotMatch(prismaConfig, /seed\s*:/);
  assert.equal(existsSync(path.resolve("prisma/seed.ts")), false);
});

test("alım ve emanet stok hareketleri zorunlu kayıtlı kaynak depoyu izler", () => {
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const emanet = readFileSync(path.resolve("src/lib/actions/emanet.ts"), "utf8");

  assert.match(schema, /model AlimFisi[\s\S]*depoId\s+String[\s\S]*onDelete: Restrict/);
  assert.match(schema, /model Emanet[\s\S]*depoId\s+String[\s\S]*onDelete: Restrict/);
  assert.match(alim, /Alım için depo seçilmedi/);
  assert.match(alim, /depoId: depo\.id/);
  assert.match(emanet, /Emanetin kaynak deposu tanımlı değil/);
  assert.match(emanet, /depoId: emanet\.depoId/);
  assert.match(emanet, /emanetKalanKg\(tx,/);
  assert.match(emanet, /TransactionIsolationLevel\.Serializable/);
});

test("operasyon kalemleri veritabanında da deposuz oluşturulamaz", () => {
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
  const migration = readFileSync(path.resolve("prisma/migrations/20260825140000_require_operational_depos/migration.sql"), "utf8");

  assert.match(schema, /model SatisKalem \{[\s\S]*depoId\s+String[\s\S]*onDelete: Restrict/);
  assert.match(schema, /model SevkiyatKalem \{[\s\S]*depoId\s+String[\s\S]*onDelete: Restrict/);
  assert.match(migration, /AlimFisi tablosunda depoId olmayan kayıt bulundu/);
  assert.match(migration, /Emanet tablosunda depoId olmayan kayıt bulundu/);
  assert.match(migration, /SatisKalem tablosunda depoId olmayan kayıt bulundu/);
  assert.match(migration, /SevkiyatKalem tablosunda depoId olmayan kayıt bulundu/);
  assert.match(migration, /ALTER COLUMN "depoId" SET NOT NULL/);
});

test("cari kart mutasyonları firma sınırı, işlem izni ve audit kaydıyla korunur", () => {
  const action = readFileSync(path.resolve("src/lib/actions/cari.ts"), "utf8");
  const recovery = readFileSync(path.resolve("src/lib/recovery.ts"), "utf8");
  const recoveryAction = readFileSync(path.resolve("src/lib/actions/kurtarma.ts"), "utf8");

  assert.match(action, /requirePermission\("CARI", "OLUSTUR"\)/);
  assert.match(action, /requirePermission\("CARI", "GUNCELLE"\)/);
  assert.match(action, /where: \{ id, firmaId: actor\.firmaId \}/);
  assert.match(action, /hedefTipi: "CariKart"/);
  assert.doesNotMatch(action, /cariKart\.delete/);
  assert.match(readFileSync(path.resolve("src/lib/queries.ts"), "utf8"), /aktif: boolean \| "TUMU" = true/);
  assert.match(readFileSync(path.resolve("src/lib/queries.ts"), "utf8"), /aktif === "TUMU" \? \{\} : \{ aktif \}/);
  assert.match(recovery, /Cari kart snapshot geçersiz/);
  assert.match(recovery, /tx\.cariKart\.findFirst\(\{ where: \{ id: targetId, firmaId: actor\.firmaId \} \}/);
  assert.match(recoveryAction, /revalidatePath\("\/cari\/\[id\]", "page"\)/);
});

test("emanet alımı kendi kaynak fişine bağlanır; iptal başka emanetleri kapatmaz", () => {
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const iptal = alim.slice(alim.indexOf("export async function iptalEtAlimFisi"));

  assert.match(schema, /model Emanet[\s\S]*alimFisiId\s+String\?\s+@unique/);
  assert.match(alim, /alimFisiId: fis\.id/);
  assert.match(iptal, /findUnique\(\{ where: \{ alimFisiId: fis\.id \}/);
  assert.match(iptal, /tip: "IADE", kg/);
  assert.match(iptal, /Bu emanet alımı üzerinde sonraki işlem var/);
  assert.doesNotMatch(alim, /ESKIYE_CEVIRME/);
  assert.doesNotMatch(alim, /where: \{ cariId: fis\.cariId, sezonId: fis\.sezonId \}[\s\S]{0,100}durum: "KAPANDI"/);
});

test("alım avans mahsubu yalnız aynı firma ve seçilen üreticinin açık avansından yapılır", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");

  assert.match(alim, /findFirst\(\{ where: \{ id: g\.avansMahsupId, cariId: g\.cariId, cari: \{ firmaId: firma\.id \} \} \}\)/);
  assert.match(alim, /cariId: g\.cariId, durum: "ACIK", cari: \{ firmaId: firma\.id \}/);
  assert.match(alim, /cariId: fis\.cariId, durum: "ACIK"/);
  assert.match(alim, /TransactionIsolationLevel\.Serializable/);
});

test("alım fişi numara sayacı firma kapsamında atomik ve çakışmaya dayanıklıdır", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

  assert.match(alim, /tx\.alimFisi\.count\(\{ where: \{ firmaId: firma\.id \} \}\)/);
  assert.match(alim, /firmaId: firma\.id/);
  assert.match(alim, /TransactionIsolationLevel\.Serializable/);
  assert.match(alim, /e\.code === "P2034" \|\| e\.code === "P2002"/);
  assert.match(schema, /model AlimFisi \{[\s\S]*firmaId\s+String[\s\S]*@@unique\(\[firmaId, fisNo\]\)/);
});

test("satın alma kodu firma alım sayacından üretilir ve firma bazında tektir", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const hesap = readFileSync(path.resolve("src/lib/hesap.ts"), "utf8");
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

  // Sayaç fiş numarasıyla aynı firma kapsamlı sayımdan gelir.
  assert.match(alim, /const sayac = await tx\.alimFisi\.count\(\{ where: \{ firmaId: firma\.id \} \}\)/);
  assert.match(alim, /satinAlmaKoduUret\(sayac \+ 1\)/);
  assert.match(alim, /satinAlmaKodu,/);
  // 3 haneli pad: 001, 002, ...
  assert.match(hesap, /export function satinAlmaKoduUret\(sira: number\): string \{/);
  assert.match(hesap, /padStart\(3, "0"\)/);
  assert.match(schema, /@@unique\(\[firmaId, satinAlmaKodu\]\)/);
});

test("onaylı alımın onaylayan kimliği istemci girdisi yerine oturum aktöründen gelir", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");

  assert.match(alim, /onaylayanId: g\.durum === "ONAYLI" \? actor\.id : undefined/);
  assert.doesNotMatch(alim, /onaylayanId: g\.durum === "ONAYLI" \? g\.kullaniciId/);
  assert.doesNotMatch(alim, /kullaniciId\?: string;/);
});

test("alım fişi onayı TASLAK durumundan koşullu updateMany ile atomik geçiş yapar", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const onay = alim.slice(alim.indexOf("export async function onaylaAlimFisi"));

  assert.match(onay, /updateMany\(\{ where: \{ id: fisId, durum: "TASLAK" \}, data: \{ durum: "ONAYLI" \} \}\)/);
  assert.match(onay, /sahiplenme\.count !== 1/);
  assert.match(onay, /TransactionIsolationLevel\.Serializable/);
  // Onaylı hareketler ortak yardımcıyla üretilir.
  assert.match(onay, /createOnayliHareketler\(/);
});

test("alım fişi iptali koşullu updateMany ile sahiplenilir ve karşı hareketler üretir", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const iptal = alim.slice(alim.indexOf("export async function iptalEtAlimFisi"));

  assert.match(iptal, /updateMany\(\{ where: \{ id: fisId, durum: fis\.durum \}, data: \{ durum: "IPTAL" \} \}\)/);
  assert.match(iptal, /sahiplenme\.count !== 1/);
  // Stok ters kaydı
  assert.match(iptal, /tip: "DUZELTME"/);
  assert.match(iptal, /kg: -kg/);
  // Peşin alımda TL alacak, emanet alımda kg alacak ters kaydı
  assert.match(iptal, /yon: "ALACAK",[\s\S]*bakiyeTuru: "TL"/);
  assert.match(iptal, /yon: "ALACAK",[\s\S]*bakiyeTuru: "FINDIK_KG"/);
  assert.match(iptal, /TransactionIsolationLevel\.Serializable/);
});

test("satış fişi numara sayacı firma kapsamında atomik ve çakışmaya dayanıklıdır", () => {
  const satis = readFileSync(path.resolve("src/lib/actions/satis.ts"), "utf8");
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

  assert.match(satis, /tx\.satis\.count\(\{ where: \{ firmaId: firma\.id \} \}\)/);
  assert.match(satis, /TransactionIsolationLevel\.Serializable/);
  assert.match(satis, /e\.code === "P2034" \|\| e\.code === "P2002"/);
  assert.doesNotMatch(satis, /const sayac = await prisma\.satis\.count/);
  assert.match(schema, /model Satis \{[\s\S]*@@unique\(\[firmaId, fisNo\]\)/);
});

test("sevkiyat fişi numara sayacı firma kapsamında atomik ve çakışmaya dayanıklıdır", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");

  assert.match(sevkiyat, /tx\.sevkiyat\.count\(\{ where: \{ firmaId: firma\.id \} \}\)/);
  assert.match(sevkiyat, /TransactionIsolationLevel\.Serializable/);
  assert.match(sevkiyat, /e\.code === "P2034" \|\| e\.code === "P2002"/);
  assert.doesNotMatch(sevkiyat, /const sayac = await prisma\.sevkiyat\.count/);
  assert.match(schema, /model Sevkiyat \{[\s\S]*@@unique\(\[firmaId, fisNo\]\)/);
});

test("sevkiyat oluşturmada kendi stok kontrolü yapılır ve kayıt FABRIKA_EMANET ile açılır", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  const olustur = sevkiyat.slice(sevkiyat.indexOf("export async function createSevkiyat"));

  // Sevk anında kendi stoktan çıkış kontrolü transaction içinde yapılır.
  assert.match(olustur, /stokHareket\.aggregate\(\{ where: \{ depoId: depo\.id, mulkiyet: "KENDI" \}, _sum: \{ kg: true \} \}\)/);
  assert.match(olustur, /Depoda yeterli kendi stok yok/);
  assert.match(olustur, /durum: "FABRIKA_EMANET"/);
  assert.match(olustur, /tip: "SEVK_CIKIS"/);
  assert.match(olustur, /kg: -g\.kg/);
  assert.match(olustur, /TransactionIsolationLevel\.Serializable/);
  // Eski hazırlanıyor/yolda/teslim durumları kalktı.
  assert.doesNotMatch(sevkiyat, /HAZIRLANIYOR|YOLDA|TESLIM_EDILDI|"TESLIM"/);
});

test("muhasebelestirSevkiyat çift çağrıda koşullu updateMany sayacıyla korunur", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  const muhasebe = sevkiyat.slice(sevkiyat.indexOf("export async function muhasebelestirSevkiyat"));

  assert.match(muhasebe, /sevkiyat\.updateMany\(\{\s*where: \{ id: sevkiyatId, firmaId: firma\.id, durum: "FABRIKA_EMANET" \},\s*data: \{ durum: "SATILDI" \},\s*\}\)/);
  assert.match(muhasebe, /sahiplenme\.count !== 1/);
  // Satış kaydı sevkiyata bağlı olur; fabrika carisine TL alacak yazılır.
  assert.match(muhasebe, /tx\.satis\.create\(/);
  assert.match(muhasebe, /sevkiyatId: sevkiyat\.id/);
  assert.match(muhasebe, /yon: "ALACAK",[\s\S]*bakiyeTuru: "TL"/);
  assert.match(muhasebe, /TransactionIsolationLevel\.Serializable/);
});

test("sevkiyat iptali koşullu updateMany ile sahiplenilir ve stok depoya iade edilir", () => {
  const sevkiyat = readFileSync(path.resolve("src/lib/actions/sevkiyat.ts"), "utf8");
  const iptal = sevkiyat.slice(sevkiyat.indexOf("export async function iptalEtSevkiyat"));

  assert.match(iptal, /sevkiyat\.updateMany\(\{\s*where: \{ id: sevkiyatId, firmaId, durum: "FABRIKA_EMANET" \},\s*data: \{ durum: "IPTAL" \},\s*\}\)/);
  assert.match(iptal, /sahiplenme\.count !== 1/);
  // Stok iadesi pozitif kg ile DUZELTME hareketidir.
  assert.match(iptal, /tip: "DUZELTME"/);
  assert.match(iptal, /kg: Number\(k\.kg\)/);
  // Satılmış sevkiyat iptal edilemez.
  assert.match(iptal, /Satılan sevkiyat iptal edilemez/);
});

test("emanet muhasebeleştirmesi kg borcunu düşer, TL borç yazar ve mülkiyet dönüşür", () => {
  const emanet = readFileSync(path.resolve("src/lib/actions/emanet.ts"), "utf8");
  const muhasebe = emanet.slice(emanet.indexOf("export async function muhasebelestirEmanet"));

  assert.match(muhasebe, /tip: "BOZMA", kg: g\.kg, tutarTl: tutar/);
  assert.match(muhasebe, /yon: "ALACAK",[\s\S]*bakiyeTuru: "FINDIK_KG"/);
  assert.match(muhasebe, /yon: "BORC",[\s\S]*bakiyeTuru: "TL"/);
  assert.match(muhasebe, /tip: "MULKIYET_DONUSUM"/);
  assert.match(muhasebe, /mulkiyet: "KENDI"/);
  // Sezon devri/eskiye çevirme kalktı.
  assert.doesNotMatch(emanet, /eskiyeCevirEmanet|emanetSezonaDevret|ESKIYE_CEVRILDI/);
});

test("sevkiyat kaynaklı satışlar bağımsız satış onay/iptal akışıyla yönetilemez", () => {
  const satis = readFileSync(path.resolve("src/lib/actions/satis.ts"), "utf8");
  const onay = satis.slice(satis.indexOf("export async function onaylaSatis"));
  const iptal = satis.slice(satis.indexOf("export async function iptalEtSatis"));

  assert.match(onay, /satis\.sevkiyatId\) return \{ ok: false, hata: "Bu satış bir sevkiyat muhasebeleştirmesidir; sevkiyat üzerinden yönetilir" \}/);
  assert.match(iptal, /satis\.sevkiyatId\) return \{ ok: false, hata: "Bu satış bir sevkiyat muhasebeleştirmesidir; satış iptali sevkiyat akışında yönetilir" \}/);
});

test("firma kapsamı sevkiyat, araç ve personel için veritabanı ilişkisiyle de korunur", () => {
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
  const migration = readFileSync(path.resolve("prisma/migrations/20260825130000_add_missing_firma_foreign_keys/migration.sql"), "utf8");

  assert.match(schema, /model Sevkiyat \{[\s\S]*firma\s+Firma\s+@relation\(fields: \[firmaId\], references: \[id\], onDelete: Restrict\)[\s\S]*@@index\(\[firmaId, tarih\]\)/);
  assert.match(schema, /model Arac \{[\s\S]*firma\s+Firma\s+@relation\(fields: \[firmaId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(schema, /model Personel \{[\s\S]*firma\s+Firma\s+@relation\(fields: \[firmaId\], references: \[id\], onDelete: Restrict\)[\s\S]*@@index\(\[firmaId, aktif\]\)/);
  assert.match(migration, /Sevkiyat tablosunda geçersiz firmaId bulundu/);
  assert.match(migration, /Arac tablosunda geçersiz firmaId bulundu/);
  assert.match(migration, /Personel tablosunda geçersiz firmaId bulundu/);
  assert.match(migration, /"Sevkiyat_firmaId_fkey"/);
  assert.match(migration, /"Arac_firmaId_fkey"/);
  assert.match(migration, /"Personel_firmaId_fkey"/);
});

test("randıman girişi yalnız oturumdaki firmaya ait alım fişini işleyebilir", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const baslangic = alim.indexOf("export async function randimanGir");
  const randimanAction = alim.slice(baslangic);

  assert.ok(baslangic >= 0);
  assert.match(randimanAction, /alimFisi\.findFirst/);
  assert.match(randimanAction, /where: \{ id: fisId, cari: \{ firmaId: actor\.firmaId \} \}/);
  assert.doesNotMatch(randimanAction, /alimFisi\.findUnique\(\{\s*where: \{ id: fisId/);
});

test("randıman girişi eşzamanlı ikinci istekte çift kayıt üretmez", () => {
  const alim = readFileSync(path.resolve("src/lib/actions/alim.ts"), "utf8");
  const govde = alim.slice(alim.indexOf("export async function randimanGir"));

  assert.match(govde, /where: \{ id: fis\.id, randimanDurumu: "BEKLIYOR" \}/);
  assert.match(govde, /sahiplenme\.count !== 1/);
  assert.match(govde, /RANDIMAN_ZATEN_ISLENDI/);
  assert.match(govde, /TransactionIsolationLevel\.Serializable/);
});

test("tek aktif sezon eşzamanlı tanım güncellemeleriyle pasifleştirilemez", () => {
  const tanimlar = readFileSync(path.resolve("src/lib/actions/tanimlar.ts"), "utf8");
  const baslangic = tanimlar.indexOf("export async function toggleSezonAktif");
  const sezonAction = tanimlar.slice(baslangic);

  assert.match(sezonAction, /aktifSayisi <= 1/);
  assert.match(sezonAction, /Tek aktif sezon pasifleştirilemez/);
  assert.match(sezonAction, /TransactionIsolationLevel\.Serializable/);
});

test("firma sıfırlama yalnız hedef kiracıyı siler, platformdaki diğer firmalara dokunmaz", () => {
  const action = readFileSync(path.resolve("src/lib/actions/reset-firma.ts"), "utf8");
  const silme = readFileSync(path.resolve("src/lib/firma-silme.ts"), "utf8");

  assert.match(action, /export async function firmaVerileriniSifirla\(firmaId\?: string\)/);
  assert.match(action, /firmaVerileriniSil\(tx, firma\.id\)/);
  assert.match(silme, /export async function firmaVerileriniSil\(tx: Prisma\.TransactionClient, firmaId: string\)/);
  // Filtresiz toplu silme kalmamalı; her deleteMany hedefe bağlı olmalı.
  assert.doesNotMatch(silme, /deleteMany\(\{\s*\}\)/);
  assert.match(silme, /tx\.firma\.delete\(\{ where: \{ id: firmaId \} \}\)/);
  // Kullanici'ya Restrict ile bağlı modeller Kullanici silinmeden temizlenmeli.
  assert.match(silme, /tx\.sesliNot\.deleteMany/);
  assert.match(silme, /tx\.finansTaslagi\.deleteMany/);
  assert.match(silme, /"firmaId" = \$1 OR "kullaniciId" IN \(SELECT "id" FROM "Kullanici" WHERE "firmaId" = \$1\)/);
});

test("ses kaydı ve sesli not listesi not sahibine (veya finans onaycısına) kısıtlanır", () => {
  const route = readFileSync(path.resolve("src/app/api/sesli-not/[id]/ses-kaydi/route.ts"), "utf8");
  const page = readFileSync(path.resolve("src/app/sesli-not/page.tsx"), "utf8");

  assert.match(route, /kullaniciId: actor\.id/);
  assert.match(page, /kullaniciId: actor\.id/);
});

test("günlük rapor ve panel özeti İstanbul gün aralığıyla sorgulanır", () => {
  const queries = readFileSync(path.resolve("src/lib/queries.ts"), "utf8");
  const gunluk = queries.slice(queries.indexOf("export async function getGunlukRapor"));
  const panel = queries.slice(queries.indexOf("export async function getDashboardOzet"));

  assert.match(gunluk, /istanbulGunAraligi\(tarih\)/);
  assert.match(panel, /istanbulGunAraligi\(\)/);
});

test("günlük CSV dışa aktarımı formül enjeksiyonunu etkisizleştirir ve doğru yetki hatası eşler", () => {
  const csv = readFileSync(path.resolve("src/app/api/raporlar/gunluk-csv/route.ts"), "utf8");

  assert.match(csv, /function csvAlan/);
  assert.ok(csv.includes("[=+\\-@]"), "formül enjeksiyonu deseni bulunmalı");
  assert.match(csv, /"Oturum açmanız gerekiyor" \? 401/);
  assert.match(csv, /"Bu işlem için yetkiniz yok" \? 403/);
  assert.doesNotMatch(csv, /Oturum acmaniz gerekiyor/);
});
