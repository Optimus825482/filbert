CREATE TYPE "FinansTaslakDurum" AS ENUM ('INCELEME_BEKLIYOR', 'EKSIK_BILGI', 'ONAYLANDI', 'REDDEDILDI');
CREATE TYPE "FinansTaslakTipi" AS ENUM ('ODEME', 'TAHSILAT', 'MASRAF', 'BELIRSIZ');

CREATE TABLE "SesKaydi" (
  "id" TEXT NOT NULL,
  "sesliNotId" TEXT NOT NULL,
  "mimeTipi" TEXT NOT NULL,
  "veri" BYTEA NOT NULL,
  "boyutByte" INTEGER NOT NULL,
  "sureSaniye" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SesKaydi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SesKaydi_sesliNotId_key" ON "SesKaydi"("sesliNotId");
ALTER TABLE "SesKaydi" ADD CONSTRAINT "SesKaydi_sesliNotId_fkey" FOREIGN KEY ("sesliNotId") REFERENCES "SesliNot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinansTaslagi" (
  "id" TEXT NOT NULL,
  "firmaId" TEXT NOT NULL,
  "cariId" TEXT NOT NULL,
  "sesliNotId" TEXT NOT NULL,
  "olusturanId" TEXT NOT NULL,
  "onerilenTip" "FinansTaslakTipi" NOT NULL DEFAULT 'BELIRSIZ',
  "onerilenTutar" DECIMAL(14,3),
  "onerilenParaBirimi" "BakiyeTuru",
  "onerilenAciklama" TEXT,
  "durum" "FinansTaslakDurum" NOT NULL DEFAULT 'INCELEME_BEKLIYOR',
  "hatirlatmaAt" TIMESTAMP(3) NOT NULL,
  "sonHatirlatmaAt" TIMESTAMP(3),
  "hatirlatmaSayisi" INTEGER NOT NULL DEFAULT 0,
  "onaylayanId" TEXT,
  "finansHareketId" TEXT,
  "redNedeni" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinansTaslagi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinansTaslagi_sesliNotId_key" ON "FinansTaslagi"("sesliNotId");
CREATE UNIQUE INDEX "FinansTaslagi_finansHareketId_key" ON "FinansTaslagi"("finansHareketId");
CREATE INDEX "FinansTaslagi_firmaId_durum_hatirlatmaAt_idx" ON "FinansTaslagi"("firmaId", "durum", "hatirlatmaAt");
CREATE INDEX "FinansTaslagi_cariId_createdAt_idx" ON "FinansTaslagi"("cariId", "createdAt");
ALTER TABLE "FinansTaslagi" ADD CONSTRAINT "FinansTaslagi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinansTaslagi" ADD CONSTRAINT "FinansTaslagi_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinansTaslagi" ADD CONSTRAINT "FinansTaslagi_sesliNotId_fkey" FOREIGN KEY ("sesliNotId") REFERENCES "SesliNot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinansTaslagi" ADD CONSTRAINT "FinansTaslagi_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
