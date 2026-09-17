CREATE TYPE "SesliNotDurum" AS ENUM ('TASLAK', 'ONAYLANDI', 'IPTAL');

ALTER TYPE "UygulamaModulu" ADD VALUE 'SESLI_NOT';

CREATE TABLE "SesliNot" (
  "id" TEXT NOT NULL,
  "firmaId" TEXT NOT NULL,
  "kullaniciId" TEXT NOT NULL,
  "hamMetin" TEXT NOT NULL,
  "duzeltilmisMetin" TEXT,
  "durum" "SesliNotDurum" NOT NULL DEFAULT 'TASLAK',
  "offlineId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SesliNot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SesliNot_offlineId_key" ON "SesliNot"("offlineId");
CREATE INDEX "SesliNot_firmaId_durum_createdAt_idx" ON "SesliNot"("firmaId", "durum", "createdAt");
CREATE INDEX "SesliNot_kullaniciId_createdAt_idx" ON "SesliNot"("kullaniciId", "createdAt");
ALTER TABLE "SesliNot" ADD CONSTRAINT "SesliNot_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SesliNot" ADD CONSTRAINT "SesliNot_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
