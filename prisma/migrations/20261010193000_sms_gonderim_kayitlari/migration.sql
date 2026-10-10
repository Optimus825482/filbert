-- Fındık İşleme Modülü: SMS gönderim günlüğü ve sağlayıcı bazlı gönderim
-- ayarları.
--
-- Amaç: SMS entegrasyonunun tüm işleyişi FİLBERT içinden görüntülenip
-- izlenebilsin. Her gönderim denemesi (şablonlu bildirim, toplu gönderim,
-- tekrar gönderim, test) "SmsKaydi" tablosuna yazılır; sağlayıcının döndürdüğü
-- hata kodu, görev kimliği, kredi (parça) adedi ve teslim raporu sonucu aynı
-- satırda tutulur. Kayıtlar silinmez, yalnızca durumu güncellenir.
--
-- "SmsAyari" tablosuna eklenen alanlar:
--   birimMaliyetKurus — SMS başına tahmini maliyet (kuruş), maliyet raporu için
--   kodlama           — "TR" (Türkçe karakter, UCS-2) veya "ASCII" (GSM-7)
--   appname           — sağlayıcı uygulama adı; Netgsm gönderimleri bu etiketle izlenir
-- AlterTable
ALTER TABLE "SmsAyari" ADD COLUMN     "appname" TEXT,
ADD COLUMN     "birimMaliyetKurus" INTEGER,
ADD COLUMN     "kodlama" TEXT NOT NULL DEFAULT 'TR';

-- CreateTable
CREATE TABLE "SmsKaydi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "hizmetIslemiId" TEXT,
    "musteriAdi" TEXT,
    "telefon" TEXT NOT NULL,
    "mesaj" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'BILGILENDIRME',
    "saglayici" TEXT NOT NULL DEFAULT 'TEST',
    "durum" TEXT NOT NULL DEFAULT 'KUYRUKTA',
    "saglayiciIsId" TEXT,
    "hataKodu" TEXT,
    "hataAciklama" TEXT,
    "kodlama" TEXT NOT NULL DEFAULT 'TR',
    "parcaSayisi" INTEGER NOT NULL DEFAULT 1,
    "birimMaliyetKurus" INTEGER,
    "saglayiciDurumKodu" INTEGER,
    "teslimAt" TIMESTAMP(3),
    "denemeAdedi" INTEGER NOT NULL DEFAULT 0,
    "olusturanKullaniciId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsKaydi_firmaId_createdAt_idx" ON "SmsKaydi"("firmaId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsKaydi_firmaId_durum_idx" ON "SmsKaydi"("firmaId", "durum");

-- CreateIndex
CREATE INDEX "SmsKaydi_firmaId_hizmetIslemiId_idx" ON "SmsKaydi"("firmaId", "hizmetIslemiId");

-- CreateIndex
CREATE INDEX "SmsKaydi_saglayiciIsId_idx" ON "SmsKaydi"("saglayiciIsId");

-- AddForeignKey
ALTER TABLE "SmsKaydi" ADD CONSTRAINT "SmsKaydi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsKaydi" ADD CONSTRAINT "SmsKaydi_hizmetIslemiId_fkey" FOREIGN KEY ("hizmetIslemiId") REFERENCES "HizmetIslemi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsKaydi" ADD CONSTRAINT "SmsKaydi_olusturanKullaniciId_fkey" FOREIGN KEY ("olusturanKullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

