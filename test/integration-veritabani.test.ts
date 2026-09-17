// Gerçek PostgreSQL üzerinde davranış testleri.
//
// Yalnız TEST_DATABASE_URL tanımlıysa çalışır; geliştirme veritabanına asla
// dokunmaz. Her test kendi verisini oluşturup işlemi geri alır (rollback), bu
// yüzden temizlik veya test verisi sızıntısı olmaz.
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { firmaVerileriniSil } from "../src/lib/firma-silme";

const TEST_URL = process.env.TEST_DATABASE_URL;
const skipMesaji = TEST_URL ? undefined : "TEST_DATABASE_URL tanımlı değil — entegrasyon testi atlandı";
const geriAl = Symbol("ROLLBACK");

function istemci() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL! }) });
}

test("aynı satın alma kodu ile ikinci alım fişi veritabanı düzeyinde reddedilir", { skip: skipMesaji }, async () => {
  const prisma = istemci();
  try {
    // İkinci insert P2002 üretince tüm işlem geri alınır; veri kalmaz.
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const firma = await tx.firma.create({ data: { unvan: `IT Offline ${Date.now()}` } });
          const cari = await tx.cariKart.create({ data: { firmaId: firma.id, tur: "URETICI", ad: "IT Üretici" } });
          const depo = await tx.depo.create({ data: { firmaId: firma.id, ad: "IT Depo" } });
          const temel = {
            firmaId: firma.id,
            cariId: cari.id,
            depoId: depo.id,
            kg: 100,
            birimFiyat: 10,
            tutar: 1000,
            durum: "TASLAK" as const,
            satinAlmaKodu: "042",
          };
          await tx.alimFisi.create({ data: { ...temel, fisNo: "IT-1" } });
          await tx.alimFisi.create({ data: { ...temel, fisNo: "IT-2" } });
        }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002",
    );

    const kalan = await prisma.alimFisi.count({ where: { satinAlmaKodu: "042", fisNo: { startsWith: "IT-" } } });
    assert.equal(kalan, 0);
  } finally {
    await prisma.$disconnect();
  }
});

test("audit kaydı veritabanı tetikleyicisiyle güncellenemez ve silinemez", { skip: skipMesaji }, async () => {
  const prisma = istemci();
  try {
    const guncellemeHatasi = await prisma
      .$transaction(async (tx) => {
        const firma = await tx.firma.create({ data: { unvan: `IT Audit ${Date.now()}` } });
        const audit = await tx.auditKaydi.create({ data: { firmaId: firma.id, eylem: "OLUSTUR", aciklama: "it" } });
        await tx.$executeRawUnsafe(`UPDATE "AuditKaydi" SET "aciklama" = 'degistirildi' WHERE "id" = $1`, audit.id);
      })
      .then(() => null)
      .catch((error: unknown) => error);
    assert.ok(guncellemeHatasi, "audit UPDATE reddedilmeliydi");
    assert.match(String((guncellemeHatasi as Error).message), /değiştirilemez|silinemez/);

    const silmeHatasi = await prisma
      .$transaction(async (tx) => {
        const firma = await tx.firma.create({ data: { unvan: `IT Audit Del ${Date.now()}` } });
        const audit = await tx.auditKaydi.create({ data: { firmaId: firma.id, eylem: "OLUSTUR", aciklama: "it" } });
        await tx.$executeRawUnsafe(`DELETE FROM "AuditKaydi" WHERE "id" = $1`, audit.id);
      })
      .then(() => null)
      .catch((error: unknown) => error);
    assert.ok(silmeHatasi, "audit DELETE reddedilmeliydi");
    assert.match(String((silmeHatasi as Error).message), /değiştirilemez|silinemez/);
  } finally {
    await prisma.$disconnect();
  }
});

test("firma sıfırlama yalnız hedef firmayı siler, diğer kiracıyı ve FK sırasını korur", { skip: skipMesaji }, async () => {
  const prisma = istemci();
  try {
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const firmaA = await tx.firma.create({ data: { unvan: `IT A ${Date.now()}` } });
          const firmaB = await tx.firma.create({ data: { unvan: `IT B ${Date.now()}` } });

          const rolA = await tx.yetkiRolu.create({ data: { firmaId: firmaA.id, kod: "IT_ROL", ad: "IT Rol" } });
          const kullaniciA = await tx.kullanici.create({ data: { firmaId: firmaA.id, ad: "IT Kullanıcı A" } });
          await tx.kullaniciRol.create({ data: { kullaniciId: kullaniciA.id, rolId: rolA.id } });
          await tx.auditKaydi.create({ data: { firmaId: firmaA.id, kullaniciId: kullaniciA.id, eylem: "OLUSTUR" } });
          const cariA = await tx.cariKart.create({ data: { firmaId: firmaA.id, tur: "URETICI", ad: "IT Cari A" } });
          const depoA = await tx.depo.create({ data: { firmaId: firmaA.id, ad: "IT Depo A" } });
          await tx.alimFisi.create({ data: { firmaId: firmaA.id, fisNo: "IT-A-1", satinAlmaKodu: "001", cariId: cariA.id, depoId: depoA.id, kg: 10, birimFiyat: 1, tutar: 10, durum: "TASLAK" } });
          // Kullanici'ya Restrict ile bağlı iki model: helper bunları Kullanici'dan önce silmeli.
          const notA = await tx.sesliNot.create({ data: { firmaId: firmaA.id, kullaniciId: kullaniciA.id, hamMetin: "it a" } });
          await tx.finansTaslagi.create({ data: { firmaId: firmaA.id, cariId: cariA.id, sesliNotId: notA.id, olusturanId: kullaniciA.id, hatirlatmaAt: new Date() } });

          const kullaniciB = await tx.kullanici.create({ data: { firmaId: firmaB.id, ad: "IT Kullanıcı B" } });
          await tx.sesliNot.create({ data: { firmaId: firmaB.id, kullaniciId: kullaniciB.id, hamMetin: "it b" } });

          await firmaVerileriniSil(tx, firmaA.id);

          assert.equal(await tx.firma.count({ where: { id: firmaA.id } }), 0);
          assert.equal(await tx.kullanici.count({ where: { firmaId: firmaA.id } }), 0);
          assert.equal(await tx.sesliNot.count({ where: { firmaId: firmaA.id } }), 0);
          assert.equal(await tx.alimFisi.count({ where: { firmaId: firmaA.id } }), 0);

          // Diğer kiracı dokunulmadan durur.
          assert.equal(await tx.firma.count({ where: { id: firmaB.id } }), 1);
          assert.equal(await tx.kullanici.count({ where: { firmaId: firmaB.id } }), 1);
          assert.equal(await tx.sesliNot.count({ where: { firmaId: firmaB.id } }), 1);

          throw geriAl; // test verisinin tamamı geri alınır
        }),
      (error: unknown) => error === geriAl,
    );
  } finally {
    await prisma.$disconnect();
  }
});
