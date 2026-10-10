-- Fındık İşleme Modülü: hazır olup teslim alınmayan talepler için
-- ayrı SMS hatırlatma şablonu (kayıt ve tamamlandı şablonlarından bağımsız).

ALTER TABLE "SmsAyari" ADD COLUMN "teslimHatirlatmaSablonu" TEXT;
