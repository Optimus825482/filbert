import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { musteriAdiNormallestir, telefonRakamlari } from "../src/lib/musteri";

const oku = (p: string) => readFileSync(path.resolve(p), "utf8");

test("müşteri adı ve telefonu arama için normalleştirilir", () => {
  assert.equal(musteriAdiNormallestir("  Ahmet   Yılmaz "), "Ahmet Yılmaz");
  assert.equal(musteriAdiNormallestir("Ayşe\tDemir"), "Ayşe Demir");
  assert.equal(telefonRakamlari("0532 111 22 33"), "05321112233");
  assert.equal(telefonRakamlari("+90 (532) 111-22-33"), "905321112233");
  assert.equal(telefonRakamlari(null), "");
  assert.equal(telefonRakamlari(""), "");
});

test("işleme müşterileri ayrı Musteri tablosunda tutulur, CariKart'a karışmaz", () => {
  const sema = oku("prisma/schema.prisma");

  // Yeni müşteri rehberi modeli firma kapsamı ve arama indeksleriyle tanımlıdır.
  assert.match(sema, /model Musteri \{/);
  assert.match(sema, /hizmetMusterileri\s+Musteri\[\]/);
  assert.match(sema, /@@index\(\[firmaId, ad\]\)/);

  // Hizmet kaydı yalnız müşteri rehberine bağlanır; cari bağlantısı kalkmıştır.
  const hizmetBlogu = sema.slice(sema.indexOf("model HizmetIslemi {"), sema.indexOf("// Fındık İşleme modülünün müşteri rehberi"));
  assert.match(hizmetBlogu, /musteriId String\?/);
  assert.match(hizmetBlogu, /musteri\s+Musteri\?/);
  assert.doesNotMatch(hizmetBlogu, /\bcariId\b/);
  assert.doesNotMatch(hizmetBlogu, /\bcari\s+CariKart\?/);

  // Cari kart tarafında hizmet kayıtları ilişkisi bulunmaz.
  const cariBlogu = sema.slice(sema.indexOf("model CariKart {"), sema.indexOf("model CariHareket"));
  assert.doesNotMatch(cariBlogu, /hizmetIslemleri/);
});

test("hizmet oluşturma müşteri rehberini kullanır ve cari yazmaz", () => {
  const action = oku("src/lib/actions/hizmet.ts");

  assert.match(action, /import \{ musteriBulVeyaOlustur \} from "@\/lib\/musteri"/);
  assert.match(action, /const musteriId =\s*\n?\s*g\.musteriId\?\.trim\(\) \|\|/);
  assert.match(action, /await musteriBulVeyaOlustur\(tx, firma\.id, g\.musteriAdi, g\.telefon\)/);
  // Kayıt gövdesi müşteri bağlantısını yazar; cari bağlantısı hiç kullanılmaz.
  assert.match(action, /\n\s+musteriId,\n/);
  assert.doesNotMatch(action, /cariId: g\.cariId/);
  assert.doesNotMatch(action, /g\.cariId/);
  // Form seçenekleri cari kart yerine müşteri rehberini okur.
  assert.match(action, /prisma\.musteri\.findMany/);
  assert.match(action, /return \{ musteriler: \[\], kasalar: \[\] \}/);
  const seceneklerBlogu = action.slice(action.indexOf("export async function getHizmetFormSecenekleri"));
  assert.doesNotMatch(seceneklerBlogu, /prisma\.cariKart/);
});

test("yeni talep formu yalnız müşteri rehberinden öneri besler", () => {
  const sayfa = oku("src/app/hizmet/yeni/page.tsx");
  assert.match(sayfa, /prisma\.musteri\.findMany/);
  assert.doesNotMatch(sayfa, /prisma\.cariKart/);
  assert.match(sayfa, /musteriler=\{musteriler\.map/);

  const form = oku("src/app/hizmet/yeni/yeni-hizmet-formu.tsx");
  assert.match(form, /musteriler\?: Array<\{ id: string; ad: string; telefon: string \}>/);
  assert.match(form, /musteriId: seciliMusteriId \|\| undefined/);
  // Alım/tedarik carileri bu forma hiçbir prop olarak girmez.
  assert.doesNotMatch(form, /cariler/);
});

test("müşteri rehberi migration'ı mevcut hizmet kayıtlarını taşır", () => {
  const klasor = "prisma/migrations/20261010180000_findik_isleme_musteri_tablosu";
  assert.ok(existsSync(path.resolve(klasor, "migration.sql")), "migration klasörü bulunmalı");
  const sql = oku(path.join(klasor, "migration.sql"));

  assert.match(sql, /CREATE TABLE "Musteri"/);
  assert.match(sql, /INSERT INTO "Musteri"/);
  assert.match(sql, /FROM "HizmetIslemi" h/);
  assert.match(sql, /UPDATE "HizmetIslemi" h\s*\nSET "musteriId" = m\."id"/);
  assert.match(sql, /ALTER TABLE "HizmetIslemi" DROP COLUMN "cariId"/);
  assert.match(sql, /ADD CONSTRAINT "HizmetIslemi_musteriId_fkey"/);
});
