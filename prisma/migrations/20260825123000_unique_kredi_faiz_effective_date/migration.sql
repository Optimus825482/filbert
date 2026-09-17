-- Aynı firma için aynı kredi ürününün aynı geçerlilik gününde tek oranı olur.
-- Eski yinelenen kayıtlar varsa migration sessiz veri kaybı yapmaz.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "KrediFaiz"
    GROUP BY "firmaId", "banka", "urun", "vadeAraligi", "gecerlilikTarihi"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Yinelenen KrediFaiz kayıtları var; migration öncesi birleştirilmelidir.';
  END IF;
END $$;

CREATE UNIQUE INDEX "KrediFaiz_firmaId_banka_urun_vadeAraligi_gecerlilikTarihi_key"
  ON "KrediFaiz"("firmaId", "banka", "urun", "vadeAraligi", "gecerlilikTarihi");
