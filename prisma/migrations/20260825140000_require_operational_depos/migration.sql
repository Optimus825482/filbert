-- Uygulama akışında alım, emanet, satış ve sevkiyat fiziksel bir depoya
-- bağlanmadan oluşturulamaz. Bu geçiş aynı kuralı veritabanı katmanında da
-- uygular. Eski eksik kayıt varsa otomatik ve belirsiz bir düzeltme yapmaz.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AlimFisi" WHERE "depoId" IS NULL) THEN
    RAISE EXCEPTION 'AlimFisi tablosunda depoId olmayan kayıt bulundu; migration uygulanmadan önce depo atanmalı';
  END IF;

  IF EXISTS (SELECT 1 FROM "Emanet" WHERE "depoId" IS NULL) THEN
    RAISE EXCEPTION 'Emanet tablosunda depoId olmayan kayıt bulundu; migration uygulanmadan önce depo atanmalı';
  END IF;

  IF EXISTS (SELECT 1 FROM "SatisKalem" WHERE "depoId" IS NULL) THEN
    RAISE EXCEPTION 'SatisKalem tablosunda depoId olmayan kayıt bulundu; migration uygulanmadan önce depo atanmalı';
  END IF;

  IF EXISTS (SELECT 1 FROM "SevkiyatKalem" WHERE "depoId" IS NULL) THEN
    RAISE EXCEPTION 'SevkiyatKalem tablosunda depoId olmayan kayıt bulundu; migration uygulanmadan önce depo atanmalı';
  END IF;
END $$;

ALTER TABLE "AlimFisi" ALTER COLUMN "depoId" SET NOT NULL;
ALTER TABLE "Emanet" ALTER COLUMN "depoId" SET NOT NULL;
ALTER TABLE "SatisKalem" ALTER COLUMN "depoId" SET NOT NULL;
ALTER TABLE "SevkiyatKalem" ALTER COLUMN "depoId" SET NOT NULL;

-- Önceki ilişkiler SET NULL davranışıyla oluşturulmuştu. Artık depo referansı
-- zorunlu olduğundan bir operasyon kaydının deposu silinemez.
ALTER TABLE "SatisKalem" DROP CONSTRAINT "SatisKalem_depoId_fkey";
ALTER TABLE "SatisKalem"
  ADD CONSTRAINT "SatisKalem_depoId_fkey"
  FOREIGN KEY ("depoId") REFERENCES "Depo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SevkiyatKalem" DROP CONSTRAINT "SevkiyatKalem_depoId_fkey";
ALTER TABLE "SevkiyatKalem"
  ADD CONSTRAINT "SevkiyatKalem_depoId_fkey"
  FOREIGN KEY ("depoId") REFERENCES "Depo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
