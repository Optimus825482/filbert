-- Kredi faizleri firma verisidir. Eski bir veritabanında sahipliği bilinmeyen
-- kayıt varsa sessizce bir firmaya bağlamak yerine migration durur; böylece
-- yöneticinin kaydı doğru firmaya taşıması gerekir.
ALTER TABLE "KrediFaiz" ADD COLUMN "firmaId" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "KrediFaiz") THEN
    RAISE EXCEPTION 'KrediFaiz kayıtları firma sahipliği olmadan taşınamaz; önce kayıtları uygun firmaya atayın.';
  END IF;
END $$;

ALTER TABLE "KrediFaiz" ALTER COLUMN "firmaId" SET NOT NULL;

CREATE INDEX "KrediFaiz_firmaId_gecerlilikTarihi_idx" ON "KrediFaiz"("firmaId", "gecerlilikTarihi");

ALTER TABLE "KrediFaiz"
  ADD CONSTRAINT "KrediFaiz_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
