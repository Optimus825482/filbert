-- Modül ayrımı: Fındık Alım Modülü ve Fındık İşleme Modülü.
--
-- 1) Kasa hesapları modüle bağlanır. İşleme modülünün kendi kasası ayrı
--    yönetilir; alım modülünün kasa ekranı işleme kasasını görüntüler.
-- 2) Kullanıcının giriş sonrası hangi modülün açılacağı kullanıcı kaydında
--    tutulur (Ayarlar ekranından ve kullanıcı kaydından seçilebilir).
--
-- Mevcut kayıtlar alım modülünde kalır; davranış değişmez.

CREATE TYPE "FirmaModulu" AS ENUM ('ALIM', 'ISLEME');

ALTER TABLE "KasaHesap" ADD COLUMN "modul" "FirmaModulu" NOT NULL DEFAULT 'ALIM';

ALTER TABLE "Kullanici" ADD COLUMN "varsayilanModul" "FirmaModulu" NOT NULL DEFAULT 'ALIM';