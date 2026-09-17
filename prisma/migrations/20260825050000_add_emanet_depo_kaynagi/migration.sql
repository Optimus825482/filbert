-- Emanet hareketlerinin fiziksel stokla aynı depoda izlenmesi için kaynak depo.
-- Nullable tutulur: geçmiş kayıtlar korunur; yeni emanetler uygulama katmanında
-- zorunlu depo ile oluşturulur.
ALTER TABLE "Emanet" ADD COLUMN "depoId" TEXT;
ALTER TABLE "AlimFisi" ADD COLUMN "depoId" TEXT;

CREATE INDEX "Emanet_depoId_idx" ON "Emanet"("depoId");
CREATE INDEX "AlimFisi_depoId_idx" ON "AlimFisi"("depoId");

ALTER TABLE "Emanet"
  ADD CONSTRAINT "Emanet_depoId_fkey"
  FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlimFisi"
  ADD CONSTRAINT "AlimFisi_depoId_fkey"
  FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
