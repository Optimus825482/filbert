-- AlterEnum
ALTER TYPE "StokHareketTip" ADD VALUE 'SATIS_CIKIS';

-- AlterTable
ALTER TABLE "Sevkiyat" ADD COLUMN     "aracId" TEXT;

-- CreateTable
CREATE TABLE "Arac" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "plaka" TEXT NOT NULL,
    "marka" TEXT,
    "tip" TEXT NOT NULL DEFAULT 'KAMYON',
    "sofor" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personel" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tckn" TEXT,
    "telefon" TEXT,
    "gorev" TEXT NOT NULL DEFAULT 'SAHA',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Personel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arac_firmaId_plaka_key" ON "Arac"("firmaId", "plaka");

-- CreateIndex
CREATE INDEX "Satis_tarih_idx" ON "Satis"("tarih");

-- CreateIndex
CREATE INDEX "Satis_cariId_tarih_idx" ON "Satis"("cariId", "tarih");

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalem" ADD CONSTRAINT "SatisKalem_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalem" ADD CONSTRAINT "SatisKalem_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sevkiyat" ADD CONSTRAINT "Sevkiyat_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sevkiyat" ADD CONSTRAINT "Sevkiyat_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SevkiyatKalem" ADD CONSTRAINT "SevkiyatKalem_sevkiyatId_fkey" FOREIGN KEY ("sevkiyatId") REFERENCES "Sevkiyat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SevkiyatKalem" ADD CONSTRAINT "SevkiyatKalem_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
