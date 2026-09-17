-- Fiyat kaynakları her firma için bağımsız olmalıdır. Eski tek-kiracılı
-- kayıtlar yalnız tek bir firma varsa ona taşınır; aksi belirsiz veri sessizce
-- başka firmaya atanmaz ve migration açıkça durur.
ALTER TABLE "FiyatKaynak" ADD COLUMN "firmaId" TEXT;

UPDATE "FiyatKaynak"
SET "firmaId" = (SELECT "id" FROM "Firma" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "firmaId" IS NULL
  AND (SELECT COUNT(*) FROM "Firma") = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FiyatKaynak" WHERE "firmaId" IS NULL) THEN
    RAISE EXCEPTION 'FiyatKaynak firma kapsamına güvenle taşınamadı: önce kaynak kayıtlarını bir firmaya bağlayın.';
  END IF;
END $$;

ALTER TABLE "FiyatKaynak" ALTER COLUMN "firmaId" SET NOT NULL;
ALTER TABLE "FiyatKaynak" ADD CONSTRAINT "FiyatKaynak_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FiyatKaynak_firmaId_ad_key" ON "FiyatKaynak"("firmaId", "ad");
CREATE INDEX "FiyatKaynak_firmaId_aktif_idx" ON "FiyatKaynak"("firmaId", "aktif");
