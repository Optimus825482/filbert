-- AlterTable
ALTER TABLE "AlimFisi" ADD COLUMN     "avansMahsupId" TEXT,
ADD COLUMN     "avansMahsupTutar" DECIMAL(14,2);

-- AddForeignKey
ALTER TABLE "AlimFisi" ADD CONSTRAINT "AlimFisi_avansMahsupId_fkey" FOREIGN KEY ("avansMahsupId") REFERENCES "Avans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Masraf" ADD CONSTRAINT "Masraf_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Masraf" ADD CONSTRAINT "Masraf_iliskiliAlimId_fkey" FOREIGN KEY ("iliskiliAlimId") REFERENCES "AlimFisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;