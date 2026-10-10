-- Fındık İşleme müşteri rehberi (Musteri) ile alım/tedarik carilerini (CariKart) ayırır.
-- HizmetIslemi artık CariKart yerine yalnızca Musteri kaydına bağlanır.

-- CreateTable
CREATE TABLE "Musteri" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "tckn" TEXT,
    "adres" TEXT,
    "notAlani" TEXT,
    "favori" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Musteri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Musteri_firmaId_ad_idx" ON "Musteri"("firmaId", "ad");

-- CreateIndex
CREATE INDEX "Musteri_firmaId_telefon_idx" ON "Musteri"("firmaId", "telefon");

-- AddForeignKey
ALTER TABLE "Musteri" ADD CONSTRAINT "Musteri_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Veri taşıma: mevcut hizmet kayıtlarındaki müşteri bilgilerini yeni rehbere aktar.
INSERT INTO "Musteri" ("id", "firmaId", "ad", "telefon", "aktif", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       h."firmaId",
       h."musteriAdi",
       NULLIF(BTRIM(h."telefon"), ''),
       true,
       MIN(h."createdAt"),
       NOW()
FROM "HizmetIslemi" h
GROUP BY h."firmaId", h."musteriAdi", NULLIF(BTRIM(h."telefon"), '');

-- AlterTable
ALTER TABLE "HizmetIslemi" ADD COLUMN "musteriId" TEXT;

-- Veri taşıma: hizmet kayıtlarını yeni müşteri rehberine bağla.
UPDATE "HizmetIslemi" h
SET "musteriId" = m."id"
FROM "Musteri" m
WHERE m."firmaId" = h."firmaId"
  AND m."ad" = h."musteriAdi"
  AND COALESCE(m."telefon", '') = COALESCE(NULLIF(BTRIM(h."telefon"), ''), '');

-- DropForeignKey
ALTER TABLE "HizmetIslemi" DROP CONSTRAINT "HizmetIslemi_cariId_fkey";

-- DropIndex
DROP INDEX "HizmetIslemi_firmaId_cariId_idx";

-- AlterTable
ALTER TABLE "HizmetIslemi" DROP COLUMN "cariId";

-- CreateIndex
CREATE INDEX "HizmetIslemi_firmaId_musteriId_idx" ON "HizmetIslemi"("firmaId", "musteriId");

-- AddForeignKey
ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri"("id") ON DELETE SET NULL ON UPDATE CASCADE;