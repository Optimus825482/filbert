-- Alım fiş numaraları her firma için bağımsızdır. Eski kayıtlarda firma,
-- alımın cari kartından kesin olarak türetilir; ilişkisiz kayıt varsa sessiz
-- atama yapılmaz ve migration açıkça durur.
ALTER TABLE "AlimFisi" ADD COLUMN "firmaId" TEXT;

UPDATE "AlimFisi" AS fis
SET "firmaId" = cari."firmaId"
FROM "CariKart" AS cari
WHERE cari."id" = fis."cariId"
  AND fis."firmaId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AlimFisi" WHERE "firmaId" IS NULL) THEN
    RAISE EXCEPTION 'AlimFisi firma kapsamına güvenle taşınamadı: ilişkili cari kartı olmayan kayıt var.';
  END IF;
END $$;

DROP INDEX "AlimFisi_fisNo_key";
ALTER TABLE "AlimFisi" ALTER COLUMN "firmaId" SET NOT NULL;
ALTER TABLE "AlimFisi" ADD CONSTRAINT "AlimFisi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AlimFisi_firmaId_tarih_idx" ON "AlimFisi"("firmaId", "tarih");
CREATE UNIQUE INDEX "AlimFisi_firmaId_fisNo_key" ON "AlimFisi"("firmaId", "fisNo");
