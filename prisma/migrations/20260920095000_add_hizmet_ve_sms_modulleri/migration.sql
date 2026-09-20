-- 1. UygulamaModulu enumuna HIZMET modülünü ekle
ALTER TYPE "UygulamaModulu" ADD VALUE IF NOT EXISTS 'HIZMET';

-- 2. HizmetDurumu enumunu oluştur
DO $$ BEGIN
    CREATE TYPE "HizmetDurumu" AS ENUM ('SIRAYA_ALINDI', 'HAZIRLANIYOR', 'TAMAMLANDI', 'TESLIM_EDILDI', 'IPTAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. HizmetTipi tablosunu oluştur
CREATE TABLE IF NOT EXISTS "HizmetTipi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kirma" BOOLEAN NOT NULL DEFAULT false,
    "kavurma" BOOLEAN NOT NULL DEFAULT false,
    "paketleme" BOOLEAN NOT NULL DEFAULT false,
    "varsayilanBirimFiyat" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HizmetTipi_pkey" PRIMARY KEY ("id")
);

-- 4. HizmetIslemi tablosunu oluştur
CREATE TABLE IF NOT EXISTS "HizmetIslemi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "siraNo" TEXT NOT NULL,
    "siraSayisi" INTEGER NOT NULL,
    "musteriAdi" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "kilo" DECIMAL(10,2) NOT NULL,
    "kirma" BOOLEAN NOT NULL DEFAULT false,
    "kavurma" BOOLEAN NOT NULL DEFAULT false,
    "paketleme" BOOLEAN NOT NULL DEFAULT false,
    "paketTipi" TEXT,
    "paketAdedi" INTEGER,
    "cariId" TEXT,
    "hizmetTipiId" TEXT,
    "hizmetTipiAdi" TEXT,
    "birimFiyat" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "toplamTutar" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notlar" TEXT,
    "durum" "HizmetDurumu" NOT NULL DEFAULT 'SIRAYA_ALINDI',
    "odemeDurumu" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "odemeYontemi" TEXT,
    "kasaHesapId" TEXT,
    "finansHareketId" TEXT,
    "tahsilatAt" TIMESTAMP(3),
    "tahsilEdilenTutar" DECIMAL(10,2),
    "girisSmsGonderildi" BOOLEAN NOT NULL DEFAULT false,
    "tamamlandiSmsGonderildi" BOOLEAN NOT NULL DEFAULT false,
    "etiketBasildiSayisi" INTEGER NOT NULL DEFAULT 0,
    "olusturanKullaniciId" TEXT,
    "hazirlaniyorAt" TIMESTAMP(3),
    "tamamlandiAt" TIMESTAMP(3),
    "teslimAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HizmetIslemi_pkey" PRIMARY KEY ("id")
);

-- 5. SmsAyari tablosunu oluştur
CREATE TABLE IF NOT EXISTS "SmsAyari" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT false,
    "saglayici" TEXT NOT NULL DEFAULT 'TEST',
    "apiUrl" TEXT,
    "kullaniciAdi" TEXT,
    "sifre" TEXT,
    "baslik" TEXT,
    "kayitSablonu" TEXT,
    "tamamlandiSablonu" TEXT,
    "otomatikGirisSms" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsAyari_pkey" PRIMARY KEY ("id")
);

-- 6. HizmetSiraSayaci tablosunu oluştur
CREATE TABLE IF NOT EXISTS "HizmetSiraSayaci" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "sonSira" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HizmetSiraSayaci_pkey" PRIMARY KEY ("id")
);

-- 7. İndeksler ve Benzersizlik Kısıtları
CREATE UNIQUE INDEX IF NOT EXISTS "HizmetTipi_firmaId_ad_key" ON "HizmetTipi"("firmaId", "ad");
CREATE INDEX IF NOT EXISTS "HizmetTipi_firmaId_aktif_idx" ON "HizmetTipi"("firmaId", "aktif");

CREATE UNIQUE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_siraNo_key" ON "HizmetIslemi"("firmaId", "siraNo");
CREATE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_durum_idx" ON "HizmetIslemi"("firmaId", "durum");
CREATE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_odemeDurumu_idx" ON "HizmetIslemi"("firmaId", "odemeDurumu");
CREATE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_createdAt_idx" ON "HizmetIslemi"("firmaId", "createdAt");
CREATE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_telefon_idx" ON "HizmetIslemi"("firmaId", "telefon");
CREATE INDEX IF NOT EXISTS "HizmetIslemi_firmaId_cariId_idx" ON "HizmetIslemi"("firmaId", "cariId");

CREATE UNIQUE INDEX IF NOT EXISTS "SmsAyari_firmaId_key" ON "SmsAyari"("firmaId");
CREATE UNIQUE INDEX IF NOT EXISTS "HizmetSiraSayaci_firmaId_key" ON "HizmetSiraSayaci"("firmaId");

-- 8. İlişkiler ve Dış Anahtarlar (Foreign Keys)
DO $$ BEGIN
    ALTER TABLE "HizmetTipi" ADD CONSTRAINT "HizmetTipi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_cariId_fkey" FOREIGN KEY ("cariId") REFERENCES "CariKart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_hizmetTipiId_fkey" FOREIGN KEY ("hizmetTipiId") REFERENCES "HizmetTipi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_kasaHesapId_fkey" FOREIGN KEY ("kasaHesapId") REFERENCES "KasaHesap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_finansHareketId_fkey" FOREIGN KEY ("finansHareketId") REFERENCES "FinansHareket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetIslemi" ADD CONSTRAINT "HizmetIslemi_olusturanKullaniciId_fkey" FOREIGN KEY ("olusturanKullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SmsAyari" ADD CONSTRAINT "SmsAyari_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HizmetSiraSayaci" ADD CONSTRAINT "HizmetSiraSayaci_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
