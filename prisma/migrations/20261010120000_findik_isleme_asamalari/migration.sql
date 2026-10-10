-- Fındık İşleme Modülü: kırma / kavurma / paketleme aşama durumları, aşama
-- zaman damgaları, etiket yazıcı profili ve teslim bildirimi takibi.
--
-- Eski "HAZIRLANIYOR" durumu aşama takibine geçilirken "KIRIM" aşamasına
-- taşınır; mevcut kayıtlar korunur ve enum yeniden oluşturulur.

ALTER TABLE "HizmetIslemi" ALTER COLUMN "durum" DROP DEFAULT;

ALTER TYPE "HizmetDurumu" RENAME TO "HizmetDurumu_eski";

CREATE TYPE "HizmetDurumu" AS ENUM (
  'SIRAYA_ALINDI',
  'KIRIM',
  'KAVURMA',
  'PAKETLEME',
  'TAMAMLANDI',
  'TESLIM_EDILDI',
  'IPTAL'
);

ALTER TABLE "HizmetIslemi"
  ALTER COLUMN "durum" TYPE "HizmetDurumu"
  USING (CASE "durum"::text WHEN 'HAZIRLANIYOR' THEN 'KIRIM' ELSE "durum"::text END)::"HizmetDurumu";

ALTER TABLE "HizmetIslemi" ALTER COLUMN "durum" SET DEFAULT 'SIRAYA_ALINDI';

DROP TYPE "HizmetDurumu_eski";

ALTER TABLE "HizmetIslemi"
  ADD COLUMN "etiketProfili" TEXT NOT NULL DEFAULT 'NIMBOT_B1_50x50',
  ADD COLUMN "kirimAt" TIMESTAMP(3),
  ADD COLUMN "kavurmaAt" TIMESTAMP(3),
  ADD COLUMN "paketlemeAt" TIMESTAMP(3),
  ADD COLUMN "teslimSmsSayisi" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teslimSmsAt" TIMESTAMP(3);
