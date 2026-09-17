-- Sevkiyat, araç ve personel kayıtları zaten firmaId taşır. Bu geçiş, ilişkiyi
-- veritabanı düzeyinde de zorunlu kılar; doğrudan yazımla sahipsiz kayıt
-- oluşmasını engeller. Önce mevcut veri açıkça doğrulanır.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Sevkiyat" kayit
    LEFT JOIN "Firma" firma ON firma.id = kayit."firmaId"
    WHERE firma.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Sevkiyat tablosunda geçersiz firmaId bulundu; migration uygulanmadan önce düzeltilmeli';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Arac" kayit
    LEFT JOIN "Firma" firma ON firma.id = kayit."firmaId"
    WHERE firma.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Arac tablosunda geçersiz firmaId bulundu; migration uygulanmadan önce düzeltilmeli';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Personel" kayit
    LEFT JOIN "Firma" firma ON firma.id = kayit."firmaId"
    WHERE firma.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Personel tablosunda geçersiz firmaId bulundu; migration uygulanmadan önce düzeltilmeli';
  END IF;
END $$;

ALTER TABLE "Sevkiyat"
  ADD CONSTRAINT "Sevkiyat_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Arac"
  ADD CONSTRAINT "Arac_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Personel"
  ADD CONSTRAINT "Personel_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Sevkiyat_firmaId_tarih_idx" ON "Sevkiyat"("firmaId", "tarih");
CREATE INDEX "Personel_firmaId_aktif_idx" ON "Personel"("firmaId", "aktif");
