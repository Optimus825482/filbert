-- Migration geçmişinin fiziksel şeması Prisma tanımıyla eşitlenir.
-- Şemada tanımlı olmayan eski depo indeksleri kaldırılır; emanetin bağlı
-- alım fişi silinirse kaynak ilişkisi zorunlu olmayan alan olduğu için
-- yalnız bağlantı temizlenir.

DROP INDEX IF EXISTS "AlimFisi_depoId_idx";
DROP INDEX IF EXISTS "Emanet_depoId_idx";

ALTER TABLE "Emanet" DROP CONSTRAINT IF EXISTS "Emanet_alimFisiId_fkey";
ALTER TABLE "Emanet"
  ADD CONSTRAINT "Emanet_alimFisiId_fkey"
  FOREIGN KEY ("alimFisiId") REFERENCES "AlimFisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Firma" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Kullanici" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Oturum" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SistemYoneticisi" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "UygulamaKurulumu" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "YetkiRolu" ALTER COLUMN "updatedAt" DROP DEFAULT;
