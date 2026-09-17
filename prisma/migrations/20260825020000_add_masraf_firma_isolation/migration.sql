-- Masraf cari/hesap seçilmeden de oluşturulabildiği için firma sınırı doğrudan
-- kayıtta tutulur. Mevcut geliştirme veritabanı boş olarak başlatılmıştır.
ALTER TABLE "Masraf" ADD COLUMN "firmaId" TEXT NOT NULL;

ALTER TABLE "Masraf"
  ADD CONSTRAINT "Masraf_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Masraf_firmaId_tarih_idx" ON "Masraf"("firmaId", "tarih");
