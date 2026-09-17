-- Kapalı-devre sadeleştirme:
--   kg (net) tek alan, randıman fiş üzerinde, 3 haneli satın alma kodu,
--   fabrika emanet sevkiyat durumu, fiyat radar/kur/kredi/ürün-gider tanım
--   modellerinin kaldırılması.

-- AlterEnum
BEGIN;
CREATE TYPE "EmanetDurum_new" AS ENUM ('ACIK', 'KISMI_BOZULDU', 'KAPANDI');
ALTER TABLE "public"."Emanet" ALTER COLUMN "durum" DROP DEFAULT;
ALTER TABLE "public"."Emanet" ALTER COLUMN "durum" TYPE "EmanetDurum_new" USING ("durum"::text::"EmanetDurum_new");
ALTER TYPE "EmanetDurum" RENAME TO "EmanetDurum_old";
ALTER TYPE "EmanetDurum_new" RENAME TO "EmanetDurum";
DROP TYPE "public"."EmanetDurum_old";
ALTER TABLE "Emanet" ALTER COLUMN "durum" SET DEFAULT 'ACIK';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EmanetHareketTip_new" AS ENUM ('GIRIS', 'BOZMA', 'IADE');
ALTER TABLE "EmanetHareket" ALTER COLUMN "tip" TYPE "EmanetHareketTip_new" USING ("tip"::text::"EmanetHareketTip_new");
ALTER TYPE "EmanetHareketTip" RENAME TO "EmanetHareketTip_old";
ALTER TYPE "EmanetHareketTip_new" RENAME TO "EmanetHareketTip";
DROP TYPE "public"."EmanetHareketTip_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RandimanDurum_new" AS ENUM ('BEKLIYOR', 'TAMAM');
ALTER TABLE "public"."AlimFisi" ALTER COLUMN "randimanDurumu" DROP DEFAULT;
ALTER TABLE "public"."AlimFisi" ALTER COLUMN "randimanDurumu" TYPE "RandimanDurum_new" USING ("randimanDurumu"::text::"RandimanDurum_new");
ALTER TYPE "RandimanDurum" RENAME TO "RandimanDurum_old";
ALTER TYPE "RandimanDurum_new" RENAME TO "RandimanDurum";
DROP TYPE "public"."RandimanDurum_old";
ALTER TABLE "AlimFisi" ALTER COLUMN "randimanDurumu" SET DEFAULT 'BEKLIYOR';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SevkiyatDurum_new" AS ENUM ('FABRIKA_EMANET', 'SATILDI', 'IPTAL');
ALTER TABLE "public"."Sevkiyat" ALTER COLUMN "durum" DROP DEFAULT;
ALTER TABLE "public"."Sevkiyat" ALTER COLUMN "durum" TYPE "SevkiyatDurum_new" USING ("durum"::text::"SevkiyatDurum_new");
ALTER TYPE "SevkiyatDurum" RENAME TO "SevkiyatDurum_old";
ALTER TYPE "SevkiyatDurum_new" RENAME TO "SevkiyatDurum";
DROP TYPE "public"."SevkiyatDurum_old";
ALTER TABLE "Sevkiyat" ALTER COLUMN "durum" SET DEFAULT 'FABRIKA_EMANET';
COMMIT;

-- DropForeignKey
ALTER TABLE "FiyatKayit" DROP CONSTRAINT "FiyatKayit_kaynakId_fkey";

-- DropForeignKey
ALTER TABLE "FiyatKaynak" DROP CONSTRAINT "FiyatKaynak_firmaId_fkey";

-- DropForeignKey
ALTER TABLE "GiderTanimi" DROP CONSTRAINT "GiderTanimi_firmaId_fkey";

-- DropForeignKey
ALTER TABLE "GunlukFiyat" DROP CONSTRAINT "GunlukFiyat_firmaId_fkey";

-- DropForeignKey
ALTER TABLE "KrediFaiz" DROP CONSTRAINT "KrediFaiz_firmaId_fkey";

-- DropForeignKey
ALTER TABLE "KurKayit" DROP CONSTRAINT "KurKayit_firmaId_fkey";

-- DropForeignKey
ALTER TABLE "Randiman" DROP CONSTRAINT "Randiman_fisId_fkey";

-- DropForeignKey
ALTER TABLE "UrunTanimi" DROP CONSTRAINT "UrunTanimi_firmaId_fkey";

-- DropIndex
DROP INDEX "AlimFisi_offlineId_key";

-- DropIndex
DROP INDEX "CariHareket_offlineId_key";

-- DropIndex
DROP INDEX "FinansHareket_offlineId_key";

-- AlterTable (AlimFisi: yeni alanlar önce nullable eklenir, veri taşınır, sonra eski alanlar düşer)
ALTER TABLE "AlimFisi"
ADD COLUMN     "kg" DECIMAL(12,3),
ADD COLUMN     "randimanPuan" DECIMAL(5,2),
ADD COLUMN     "satinAlmaKodu" TEXT;

-- Backfill: netKg → kg, mevcut randıman puanı taşınır, satın alma kodu firma
-- bazlı createdAt sırasıyla 001'den numaralanır (999 sonrası doğal büyür).
UPDATE "AlimFisi" SET
  "kg" = "netKg",
  "randimanPuan" = (
    SELECT r."puan" FROM "Randiman" r WHERE r."fisId" = "AlimFisi"."id" LIMIT 1
  );
WITH sirali AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "firmaId" ORDER BY "createdAt", "id") AS sira
  FROM "AlimFisi"
)
UPDATE "AlimFisi" a
SET "satinAlmaKodu" = LPAD(s.sira::text, 3, '0')
FROM sirali s
WHERE s."id" = a."id";

ALTER TABLE "AlimFisi"
DROP COLUMN "brutKg",
DROP COLUMN "daraAdet",
DROP COLUMN "daraKg",
DROP COLUMN "daraTipi",
DROP COLUMN "fiyatYontemi",
DROP COLUMN "netKg",
DROP COLUMN "offlineId",
ALTER COLUMN "kg" SET NOT NULL,
ALTER COLUMN "satinAlmaKodu" SET NOT NULL,
ALTER COLUMN "birimFiyat" DROP NOT NULL,
ALTER COLUMN "tutar" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CariHareket" DROP COLUMN "offlineId";

-- AlterTable
ALTER TABLE "EmanetHareket" DROP COLUMN "fiyatId";

-- AlterTable
ALTER TABLE "FinansHareket" DROP COLUMN "offlineId";

-- AlterTable (Satis: tablo boş; kg yeniden adlandırılır)
ALTER TABLE "Satis" DROP COLUMN "brutKg",
DROP COLUMN "daraKg",
DROP COLUMN "netKg",
ADD COLUMN     "kg" DECIMAL(12,3) NOT NULL,
ADD COLUMN     "sevkiyatId" TEXT,
ALTER COLUMN "birimFiyat" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "tutar" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "SatisKalem" ALTER COLUMN "kg" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "birimFiyat" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "tutar" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Sevkiyat" ALTER COLUMN "durum" SET DEFAULT 'FABRIKA_EMANET';

-- AlterTable
ALTER TABLE "SevkiyatKalem" ALTER COLUMN "kg" SET DATA TYPE DECIMAL(12,3);

-- DropTable
DROP TABLE "FiyatKayit";

-- DropTable
DROP TABLE "FiyatKaynak";

-- DropTable
DROP TABLE "GiderTanimi";

-- DropTable
DROP TABLE "GunlukFiyat";

-- DropTable
DROP TABLE "KrediFaiz";

-- DropTable
DROP TABLE "KurKayit";

-- DropTable
DROP TABLE "Randiman";

-- DropTable
DROP TABLE "UrunTanimi";

-- DropEnum
DROP TYPE "CekimYontemi";

-- DropEnum
DROP TYPE "FiyatKaynakTip";

-- DropEnum
DROP TYPE "FiyatYontemi";

-- DropEnum
DROP TYPE "YansimaModu";

-- CreateIndex
CREATE UNIQUE INDEX "AlimFisi_firmaId_satinAlmaKodu_key" ON "AlimFisi"("firmaId", "satinAlmaKodu");

-- CreateIndex
CREATE UNIQUE INDEX "Firma_vergiNo_key" ON "Firma"("vergiNo");

-- CreateIndex
CREATE UNIQUE INDEX "Sezon_firmaId_ad_key" ON "Sezon"("firmaId", "ad");

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_sevkiyatId_fkey" FOREIGN KEY ("sevkiyatId") REFERENCES "Sevkiyat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
