-- Kur değerleri her firmanın kendi finans tanımıdır. Eski ortak kayıtlar,
-- mevcut ilk firmaya güvenli şekilde bağlanır; veri yoksa hiç satır etkilenmez.
ALTER TABLE "KurKayit" ADD COLUMN "firmaId" TEXT;

UPDATE "KurKayit"
SET "firmaId" = (
  SELECT "id" FROM "Firma" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "firmaId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "KurKayit" WHERE "firmaId" IS NULL) THEN
    RAISE EXCEPTION 'KurKayit firma kapsamına taşınamadı: en az bir Firma kaydı gerekli.';
  END IF;
END $$;

ALTER TABLE "KurKayit" ALTER COLUMN "firmaId" SET NOT NULL;
DROP INDEX "KurKayit_tarih_paraBirimi_key";
CREATE UNIQUE INDEX "KurKayit_firmaId_tarih_paraBirimi_key" ON "KurKayit"("firmaId", "tarih", "paraBirimi");
CREATE INDEX "KurKayit_firmaId_tarih_idx" ON "KurKayit"("firmaId", "tarih");
ALTER TABLE "KurKayit" ADD CONSTRAINT "KurKayit_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
