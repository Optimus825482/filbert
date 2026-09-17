-- Fındıkta tek çeşit uygulanır. Alım, satış ve sevkiyat kalemlerindeki
-- "cins" (Giresun/Levant/Ordu/Diğer) ayrımı tümüyle kaldırıldı.
ALTER TABLE "AlimFisi" DROP COLUMN "cins";

ALTER TABLE "Satis" DROP COLUMN "cins";

ALTER TABLE "SevkiyatKalem" DROP COLUMN "cins";

DROP TYPE "Cins";
