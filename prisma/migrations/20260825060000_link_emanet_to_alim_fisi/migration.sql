-- Emanet alımının iptali yalnız kendi kaynak fişindeki emaneti kapatmalıdır.
-- Eski satırlar nullable bırakılır; uygulama onları tahmine dayalı kapatmaz.
ALTER TABLE "Emanet" ADD COLUMN "alimFisiId" TEXT;

CREATE UNIQUE INDEX "Emanet_alimFisiId_key" ON "Emanet"("alimFisiId");

ALTER TABLE "Emanet"
  ADD CONSTRAINT "Emanet_alimFisiId_fkey"
  FOREIGN KEY ("alimFisiId") REFERENCES "AlimFisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
