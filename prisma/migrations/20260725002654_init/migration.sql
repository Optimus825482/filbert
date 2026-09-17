-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('PATRON', 'MUHASEBE', 'KANTAR', 'SAHA', 'SALT_OKUNUR');

-- CreateEnum
CREATE TYPE "CariTur" AS ENUM ('URETICI', 'TUCCAR', 'FABRIKA');

-- CreateEnum
CREATE TYPE "BakiyeTuru" AS ENUM ('TL', 'USD', 'EUR', 'XAU', 'FINDIK_KG');

-- CreateEnum
CREATE TYPE "Yon" AS ENUM ('BORC', 'ALACAK');

-- CreateEnum
CREATE TYPE "KaynakTipi" AS ENUM ('ACILIS', 'ALIM', 'EMANET_BOZMA', 'AVANS', 'ODEME', 'TAHSILAT', 'MASRAF', 'SATIS', 'KUR_FARKI');

-- CreateEnum
CREATE TYPE "FisDurum" AS ENUM ('TASLAK', 'ONAYLI', 'IPTAL');

-- CreateEnum
CREATE TYPE "RandimanDurum" AS ENUM ('BEKLIYOR', 'TAMAM', 'GEREKMIYOR');

-- CreateEnum
CREATE TYPE "FiyatYontemi" AS ENUM ('GUNLUK_TABLO', 'PUAN_CARPAN', 'MANUEL', 'RADAR');

-- CreateEnum
CREATE TYPE "YansimaModu" AS ENUM ('FIYATA', 'KILOYA');

-- CreateEnum
CREATE TYPE "Mulkiyet" AS ENUM ('KENDI', 'EMANET');

-- CreateEnum
CREATE TYPE "EmanetDurum" AS ENUM ('ACIK', 'KISMI_BOZULDU', 'KAPANDI', 'ESKIYE_CEVRILDI');

-- CreateEnum
CREATE TYPE "EmanetHareketTip" AS ENUM ('GIRIS', 'BOZMA', 'ESKIYE_CEVIRME', 'IADE');

-- CreateEnum
CREATE TYPE "AvansTur" AS ENUM ('NAKIT', 'AYNI', 'FINDIK_KARSILIGI');

-- CreateEnum
CREATE TYPE "AvansDurum" AS ENUM ('ACIK', 'KAPANDI');

-- CreateEnum
CREATE TYPE "FinansTip" AS ENUM ('ODEME', 'TAHSILAT', 'VIRMAN');

-- CreateEnum
CREATE TYPE "HesapTip" AS ENUM ('KASA', 'BANKA');

-- CreateEnum
CREATE TYPE "MasrafTur" AS ENUM ('NAKLIYE', 'KANTAR', 'HAMALIYE', 'KOMISYON', 'DEPO', 'DIGER');

-- CreateEnum
CREATE TYPE "StokHareketTip" AS ENUM ('ALIM_GIRIS', 'SEVK_CIKIS', 'TRANSFER', 'DUZELTME', 'MULKIYET_DONUSUM');

-- CreateEnum
CREATE TYPE "FiyatKaynakTip" AS ENUM ('TMO', 'BORSA', 'FISKOBIRLIK', 'SERBEST', 'OZEL');

-- CreateEnum
CREATE TYPE "Cins" AS ENUM ('GIRESUN', 'LEVANT', 'ORDU', 'DIGER');

-- CreateEnum
CREATE TYPE "CekimYontemi" AS ENUM ('SCRAPING', 'MANUEL');

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL,
    "unvan" TEXT NOT NULL,
    "vergiNo" TEXT,
    "vergiDairesi" TEXT,
    "ayarlar" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sube" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'MERKEZ',
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "subeId" TEXT,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "rol" "Rol" NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sezon" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sezon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariKart" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "tur" "CariTur" NOT NULL,
    "ad" TEXT NOT NULL,
    "tckn" TEXT,
    "vergiNo" TEXT,
    "telefon" TEXT,
    "bolge" TEXT,
    "favori" BOOLEAN NOT NULL DEFAULT false,
    "notAlani" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariKart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CariHareket" (
    "id" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "yon" "Yon" NOT NULL,
    "bakiyeTuru" "BakiyeTuru" NOT NULL,
    "tutar" DECIMAL(18,3) NOT NULL,
    "kaynakTipi" "KaynakTipi" NOT NULL,
    "kaynakId" TEXT,
    "vadeTarihi" DATE,
    "sezonId" TEXT,
    "aciklama" TEXT,
    "olusturanId" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CariHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlimFisi" (
    "id" TEXT NOT NULL,
    "fisNo" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "subeId" TEXT,
    "sezonId" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cins" "Cins" NOT NULL,
    "brutKg" DECIMAL(12,3) NOT NULL,
    "daraKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "daraTipi" TEXT,
    "daraAdet" INTEGER,
    "netKg" DECIMAL(12,3) NOT NULL,
    "randimanDurumu" "RandimanDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "fiyatYontemi" "FiyatYontemi" NOT NULL DEFAULT 'GUNLUK_TABLO',
    "birimFiyat" DECIMAL(10,2) NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "bolge" TEXT,
    "mulkiyetKaynak" "Mulkiyet" NOT NULL DEFAULT 'KENDI',
    "durum" "FisDurum" NOT NULL DEFAULT 'ONAYLI',
    "onaylayanId" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlimFisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Randiman" (
    "id" TEXT NOT NULL,
    "fisId" TEXT NOT NULL,
    "numuneBrutG" DECIMAL(8,2) NOT NULL,
    "saglamIcG" DECIMAL(8,2) NOT NULL,
    "bezikG" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "puan" DECIMAL(5,2) NOT NULL,
    "yansimaModu" "YansimaModu" NOT NULL DEFAULT 'FIYATA',
    "uygulananFiyat" DECIMAL(10,2) NOT NULL,
    "not" TEXT,

    CONSTRAINT "Randiman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GunlukFiyat" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "cins" "Cins" NOT NULL,
    "bazPuan" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "fiyatTl" DECIMAL(10,2) NOT NULL,
    "puanCarpanTl" DECIMAL(10,2),
    "kaynak" TEXT NOT NULL DEFAULT 'MANUEL',

    CONSTRAINT "GunlukFiyat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emanet" (
    "id" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "sezonId" TEXT,
    "durum" "EmanetDurum" NOT NULL DEFAULT 'ACIK',
    "acilisTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emanet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmanetHareket" (
    "id" TEXT NOT NULL,
    "emanetId" TEXT NOT NULL,
    "tip" "EmanetHareketTip" NOT NULL,
    "kg" DECIMAL(12,3) NOT NULL,
    "fiyatId" TEXT,
    "tutarTl" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmanetHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avans" (
    "id" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "tur" "AvansTur" NOT NULL,
    "tutarTl" DECIMAL(14,2) NOT NULL,
    "bakiyeTuru" "BakiyeTuru" NOT NULL DEFAULT 'TL',
    "tutarDoviz" DECIMAL(14,3),
    "aciklama" TEXT,
    "kalanTl" DECIMAL(14,2) NOT NULL,
    "durum" "AvansDurum" NOT NULL DEFAULT 'ACIK',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvansMahsup" (
    "id" TEXT NOT NULL,
    "avansId" TEXT NOT NULL,
    "hedefTipi" TEXT NOT NULL,
    "hedefId" TEXT NOT NULL,
    "tutarTl" DECIMAL(14,2) NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvansMahsup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KrediFaiz" (
    "id" TEXT NOT NULL,
    "banka" TEXT NOT NULL DEFAULT 'Ziraat Bankası',
    "urun" TEXT NOT NULL DEFAULT 'Tüketici Kredisi',
    "vadeAraligi" TEXT NOT NULL,
    "aylikOran" DECIMAL(6,4) NOT NULL,
    "gecerlilikTarihi" DATE NOT NULL,
    "kaynakUrl" TEXT,
    "cekimYontemi" "CekimYontemi" NOT NULL DEFAULT 'MANUEL',

    CONSTRAINT "KrediFaiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KasaHesap" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "subeId" TEXT,
    "ad" TEXT NOT NULL,
    "tip" "HesapTip" NOT NULL,
    "bakiyeTuru" "BakiyeTuru" NOT NULL DEFAULT 'TL',
    "bankaAdi" TEXT,
    "iban" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KasaHesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinansHareket" (
    "id" TEXT NOT NULL,
    "tip" "FinansTip" NOT NULL,
    "cariId" TEXT,
    "hesapId" TEXT NOT NULL,
    "bakiyeTuru" "BakiyeTuru" NOT NULL DEFAULT 'TL',
    "tutar" DECIMAL(14,3) NOT NULL,
    "kur" DECIMAL(12,6),
    "vadeTarihi" DATE,
    "dekontNo" TEXT,
    "iliskiliTipi" TEXT,
    "iliskiliId" TEXT,
    "durum" "FisDurum" NOT NULL DEFAULT 'ONAYLI',
    "aciklama" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinansHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Masraf" (
    "id" TEXT NOT NULL,
    "tur" "MasrafTur" NOT NULL,
    "tutar" DECIMAL(14,2) NOT NULL,
    "bakiyeTuru" "BakiyeTuru" NOT NULL DEFAULT 'TL',
    "cariId" TEXT,
    "iliskiliAlimId" TEXT,
    "maliyeteYansit" BOOLEAN NOT NULL DEFAULT false,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aciklama" TEXT,

    CONSTRAINT "Masraf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depo" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "subeId" TEXT,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Depo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokHareket" (
    "id" TEXT NOT NULL,
    "depoId" TEXT NOT NULL,
    "tip" "StokHareketTip" NOT NULL,
    "kg" DECIMAL(12,3) NOT NULL,
    "mulkiyet" "Mulkiyet" NOT NULL,
    "sezonId" TEXT,
    "bolge" TEXT,
    "randimanPuan" DECIMAL(5,2),
    "maliyetBirimTl" DECIMAL(10,2),
    "kaynakTipi" TEXT,
    "kaynakId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokHareket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiyatKaynak" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tip" "FiyatKaynakTip" NOT NULL,
    "url" TEXT,
    "scrapingAktif" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FiyatKaynak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiyatKayit" (
    "id" TEXT NOT NULL,
    "kaynakId" TEXT NOT NULL,
    "tarih" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cins" "Cins" NOT NULL,
    "dusukTl" DECIMAL(10,2),
    "yuksekTl" DECIMAL(10,2),
    "ortalamaTl" DECIMAL(10,2),
    "not" TEXT,

    CONSTRAINT "FiyatKayit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KurKayit" (
    "id" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "paraBirimi" TEXT NOT NULL,
    "alis" DECIMAL(12,4) NOT NULL,
    "satis" DECIMAL(12,4) NOT NULL,
    "kaynak" TEXT NOT NULL DEFAULT 'MANUEL',

    CONSTRAINT "KurKayit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CariKart_firmaId_tur_idx" ON "CariKart"("firmaId", "tur");

-- CreateIndex
CREATE INDEX "CariKart_firmaId_ad_idx" ON "CariKart"("firmaId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "CariHareket_offlineId_key" ON "CariHareket"("offlineId");

-- CreateIndex
CREATE INDEX "CariHareket_cariId_bakiyeTuru_idx" ON "CariHareket"("cariId", "bakiyeTuru");

-- CreateIndex
CREATE INDEX "CariHareket_createdAt_idx" ON "CariHareket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlimFisi_fisNo_key" ON "AlimFisi"("fisNo");

-- CreateIndex
CREATE UNIQUE INDEX "AlimFisi_offlineId_key" ON "AlimFisi"("offlineId");

-- CreateIndex
CREATE INDEX "AlimFisi_tarih_idx" ON "AlimFisi"("tarih");

-- CreateIndex
CREATE INDEX "AlimFisi_cariId_tarih_idx" ON "AlimFisi"("cariId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "Randiman_fisId_key" ON "Randiman"("fisId");

-- CreateIndex
CREATE UNIQUE INDEX "GunlukFiyat_firmaId_tarih_cins_key" ON "GunlukFiyat"("firmaId", "tarih", "cins");

-- CreateIndex
CREATE INDEX "EmanetHareket_emanetId_idx" ON "EmanetHareket"("emanetId");

-- CreateIndex
CREATE UNIQUE INDEX "FinansHareket_offlineId_key" ON "FinansHareket"("offlineId");

-- CreateIndex
CREATE INDEX "FinansHareket_createdAt_idx" ON "FinansHareket"("createdAt");

-- CreateIndex
CREATE INDEX "FinansHareket_cariId_idx" ON "FinansHareket"("cariId");

-- CreateIndex
CREATE INDEX "StokHareket_depoId_mulkiyet_idx" ON "StokHareket"("depoId", "mulkiyet");

-- CreateIndex
CREATE INDEX "FiyatKayit_kaynakId_tarih_idx" ON "FiyatKayit"("kaynakId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "KurKayit_tarih_paraBirimi_key" ON "KurKayit"("tarih", "paraBirimi");

-- AddForeignKey
ALTER TABLE "Sube" ADD CONSTRAINT "Sube_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kullanici" ADD CONSTRAINT "Kullanici_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sezon" ADD CONSTRAINT "Sezon_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariKart" ADD CONSTRAINT "CariKart_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CariHareket" ADD CONSTRAINT "CariHareket_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlimFisi" ADD CONSTRAINT "AlimFisi_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Randiman" ADD CONSTRAINT "Randiman_fisId_fkey" FOREIGN KEY ("fisId") REFERENCES "AlimFisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GunlukFiyat" ADD CONSTRAINT "GunlukFiyat_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emanet" ADD CONSTRAINT "Emanet_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmanetHareket" ADD CONSTRAINT "EmanetHareket_emanetId_fkey" FOREIGN KEY ("emanetId") REFERENCES "Emanet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avans" ADD CONSTRAINT "Avans_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvansMahsup" ADD CONSTRAINT "AvansMahsup_avansId_fkey" FOREIGN KEY ("avansId") REFERENCES "Avans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KasaHesap" ADD CONSTRAINT "KasaHesap_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinansHareket" ADD CONSTRAINT "FinansHareket_hesapId_fkey" FOREIGN KEY ("hesapId") REFERENCES "KasaHesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depo" ADD CONSTRAINT "Depo_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareket" ADD CONSTRAINT "StokHareket_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiyatKayit" ADD CONSTRAINT "FiyatKayit_kaynakId_fkey" FOREIGN KEY ("kaynakId") REFERENCES "FiyatKaynak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
