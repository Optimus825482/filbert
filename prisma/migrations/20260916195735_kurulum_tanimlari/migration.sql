-- Kurulum tanımları: masraf türleri firma bazlı tanım tablosuna taşınır.
-- Masraf.tur artık tanım adını (string) saklar.

-- AlterTable: enum -> text (eski kayıtların etiketleri Türkçeleştirilir)
BEGIN;
ALTER TABLE "Masraf" ALTER COLUMN "tur" DROP DEFAULT;
ALTER TABLE "Masraf" ALTER COLUMN "tur" TYPE TEXT USING ("tur"::text);
UPDATE "Masraf" SET "tur" = 'Nakliye' WHERE "tur" = 'NAKLIYE';
UPDATE "Masraf" SET "tur" = 'Kantar' WHERE "tur" = 'KANTAR';
UPDATE "Masraf" SET "tur" = 'Hamaliye' WHERE "tur" = 'HAMALIYE';
UPDATE "Masraf" SET "tur" = 'Komisyon' WHERE "tur" = 'KOMISYON';
UPDATE "Masraf" SET "tur" = 'Depo' WHERE "tur" = 'DEPO';
UPDATE "Masraf" SET "tur" = 'Diğer' WHERE "tur" = 'DIGER';
COMMIT;

-- CreateTable: firma bazlı masraf türü tanımları
CREATE TABLE "MasrafTuru" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasrafTuru_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasrafTuru_firmaId_ad_key" ON "MasrafTuru"("firmaId", "ad");
CREATE INDEX "MasrafTuru_firmaId_aktif_idx" ON "MasrafTuru"("firmaId", "aktif");

-- AddForeignKey
ALTER TABLE "MasrafTuru" ADD CONSTRAINT "MasrafTuru_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mevcut firmalara varsayılan masraf türleri
INSERT INTO "MasrafTuru" ("id", "firmaId", "ad", "aktif", "createdAt")
SELECT gen_random_uuid()::text, f."id", t."ad", true, CURRENT_TIMESTAMP
FROM "Firma" f
CROSS JOIN (VALUES ('Nakliye'), ('Kantar'), ('Hamaliye'), ('Komisyon'), ('Depo'), ('Diğer')) AS t("ad")
WHERE NOT EXISTS (SELECT 1 FROM "MasrafTuru" mt WHERE mt."firmaId" = f."id" AND mt."ad" = t."ad");

-- DropEnum
DROP TYPE "MasrafTur";
