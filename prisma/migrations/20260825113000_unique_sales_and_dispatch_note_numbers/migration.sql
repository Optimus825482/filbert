-- Firma bazlı belge numarası, uygulama dışındaki doğrudan yazımlarda da
-- yinelenmemelidir. PostgreSQL UNIQUE, NULL fiş numaralarını birbirinden
-- bağımsız tutar; yalnız üretilmiş belge numaraları için kural uygular.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Satis"
    WHERE "fisNo" IS NOT NULL
    GROUP BY "firmaId", "fisNo"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Satis tablosunda firma bazlı yinelenen fisNo bulundu; migration uygulanmadan önce düzeltilmeli';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Sevkiyat"
    WHERE "fisNo" IS NOT NULL
    GROUP BY "firmaId", "fisNo"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Sevkiyat tablosunda firma bazlı yinelenen fisNo bulundu; migration uygulanmadan önce düzeltilmeli';
  END IF;
END $$;

ALTER TABLE "Satis" ADD CONSTRAINT "Satis_firmaId_fisNo_key" UNIQUE ("firmaId", "fisNo");
ALTER TABLE "Sevkiyat" ADD CONSTRAINT "Sevkiyat_firmaId_fisNo_key" UNIQUE ("firmaId", "fisNo");
