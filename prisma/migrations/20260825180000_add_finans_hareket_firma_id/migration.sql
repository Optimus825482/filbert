-- FinansHareket'e doğrudan firma referansı ekle.
-- Mevcut kayıtların firma kimliği, bağlı olduğu hesabın firmasından türetilir.

ALTER TABLE "FinansHareket" ADD COLUMN "firmaId" TEXT NOT NULL DEFAULT '';

UPDATE "FinansHareket" fh
SET "firmaId" = kh."firmaId"
FROM "KasaHesap" kh
WHERE fh."hesapId" = kh.id;

ALTER TABLE "FinansHareket"
  ALTER COLUMN "firmaId" DROP DEFAULT,
  ADD CONSTRAINT "FinansHareket_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinansHareket_firmaId_idx" ON "FinansHareket"("firmaId");
