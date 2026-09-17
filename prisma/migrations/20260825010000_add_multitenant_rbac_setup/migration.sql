-- Çok-firmalı kurulum, platform yöneticisi ve rol-tabanlı yetkilendirme.
-- Mevcut "Rol" enumu kaldırılmaz: "Kullanici"."rol" geçiş dönemi etiketi
-- olarak nullable bırakılır; erişim denetimi yeni RBAC tablolarından yapılır.

-- CreateEnum
CREATE TYPE "PlatformRol" AS ENUM ('SISTEM_YONETICISI');

-- CreateEnum
CREATE TYPE "UygulamaModulu" AS ENUM (
    'DASHBOARD', 'ALIM', 'RANDIMAN', 'EMANET', 'AVANS', 'CARI', 'FINANS',
    'MASRAF', 'STOK', 'SATIS', 'SEVKIYAT', 'TANIMLAR', 'RAPORLAR',
    'AYARLAR', 'KULLANICI_YONETIMI'
);

-- CreateEnum
CREATE TYPE "IzinEylemi" AS ENUM ('GORUNTULE', 'OLUSTUR', 'GUNCELLE', 'SIL', 'ONAYLA', 'IPTAL', 'YONET');

-- CreateEnum
CREATE TYPE "AuditEylemi" AS ENUM ('KURULUM', 'GIRIS', 'CIKIS', 'OLUSTUR', 'GUNCELLE', 'SIL', 'ONAYLA', 'IPTAL', 'YETKILENDIR');

-- AlterTable
ALTER TABLE "Firma"
    ADD COLUMN "adres" TEXT,
    ADD COLUMN "il" TEXT,
    ADD COLUMN "ilce" TEXT,
    ADD COLUMN "postaKodu" TEXT,
    ADD COLUMN "telefon" TEXT,
    ADD COLUMN "eposta" TEXT,
    ADD COLUMN "aktif" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "kurulumTamamlandiAt" TIMESTAMP(3),
    ADD COLUMN "kuranSistemYoneticisiId" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Kullanici"
    ADD COLUMN "eposta" TEXT,
    ADD COLUMN "sifreHash" TEXT,
    ADD COLUMN "sonGirisAt" TIMESTAMP(3),
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Kullanici" ALTER COLUMN "rol" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SistemYoneticisi" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "eposta" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" "PlatformRol" NOT NULL DEFAULT 'SISTEM_YONETICISI',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGirisAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SistemYoneticisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UygulamaKurulumu" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "ilkKurulumTamamlandiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sistemYoneticisiId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UygulamaKurulumu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YetkiRolu" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "sistemRolu" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YetkiRolu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolIzni" (
    "rolId" TEXT NOT NULL,
    "modul" "UygulamaModulu" NOT NULL,
    "eylem" "IzinEylemi" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolIzni_pkey" PRIMARY KEY ("rolId", "modul", "eylem")
);

-- CreateTable
CREATE TABLE "KullaniciRol" (
    "kullaniciId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KullaniciRol_pkey" PRIMARY KEY ("kullaniciId", "rolId")
);

-- CreateTable
CREATE TABLE "Oturum" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "sistemYoneticisiId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAdresi" TEXT,
    "kullaniciAracisi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Oturum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditKaydi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT,
    "kullaniciId" TEXT,
    "sistemYoneticisiId" TEXT,
    "modul" "UygulamaModulu",
    "eylem" "AuditEylemi" NOT NULL,
    "hedefTipi" TEXT,
    "hedefId" TEXT,
    "oncekiVeri" JSONB,
    "sonrakiVeri" JSONB,
    "ipAdresi" TEXT,
    "kullaniciAracisi" TEXT,
    "aciklama" TEXT,
    "basarili" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SistemYoneticisi_eposta_key" ON "SistemYoneticisi"("eposta");
CREATE UNIQUE INDEX "UygulamaKurulumu_sistemYoneticisiId_key" ON "UygulamaKurulumu"("sistemYoneticisiId");
CREATE UNIQUE INDEX "Kullanici_eposta_key" ON "Kullanici"("eposta");
CREATE INDEX "Kullanici_firmaId_aktif_idx" ON "Kullanici"("firmaId", "aktif");
CREATE UNIQUE INDEX "YetkiRolu_firmaId_kod_key" ON "YetkiRolu"("firmaId", "kod");
CREATE INDEX "YetkiRolu_firmaId_aktif_idx" ON "YetkiRolu"("firmaId", "aktif");
CREATE INDEX "KullaniciRol_rolId_idx" ON "KullaniciRol"("rolId");
CREATE UNIQUE INDEX "Oturum_tokenHash_key" ON "Oturum"("tokenHash");
CREATE INDEX "Oturum_kullaniciId_expiresAt_idx" ON "Oturum"("kullaniciId", "expiresAt");
CREATE INDEX "Oturum_sistemYoneticisiId_expiresAt_idx" ON "Oturum"("sistemYoneticisiId", "expiresAt");
CREATE INDEX "AuditKaydi_firmaId_createdAt_idx" ON "AuditKaydi"("firmaId", "createdAt");
CREATE INDEX "AuditKaydi_kullaniciId_createdAt_idx" ON "AuditKaydi"("kullaniciId", "createdAt");
CREATE INDEX "AuditKaydi_sistemYoneticisiId_createdAt_idx" ON "AuditKaydi"("sistemYoneticisiId", "createdAt");
CREATE INDEX "AuditKaydi_hedefTipi_hedefId_idx" ON "AuditKaydi"("hedefTipi", "hedefId");

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_kuranSistemYoneticisiId_fkey"
    FOREIGN KEY ("kuranSistemYoneticisiId") REFERENCES "SistemYoneticisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UygulamaKurulumu" ADD CONSTRAINT "UygulamaKurulumu_sistemYoneticisiId_fkey"
    FOREIGN KEY ("sistemYoneticisiId") REFERENCES "SistemYoneticisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "YetkiRolu" ADD CONSTRAINT "YetkiRolu_firmaId_fkey"
    FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolIzni" ADD CONSTRAINT "RolIzni_rolId_fkey"
    FOREIGN KEY ("rolId") REFERENCES "YetkiRolu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KullaniciRol" ADD CONSTRAINT "KullaniciRol_kullaniciId_fkey"
    FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KullaniciRol" ADD CONSTRAINT "KullaniciRol_rolId_fkey"
    FOREIGN KEY ("rolId") REFERENCES "YetkiRolu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Oturum" ADD CONSTRAINT "Oturum_kullaniciId_fkey"
    FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Oturum" ADD CONSTRAINT "Oturum_sistemYoneticisiId_fkey"
    FOREIGN KEY ("sistemYoneticisiId") REFERENCES "SistemYoneticisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditKaydi" ADD CONSTRAINT "AuditKaydi_firmaId_fkey"
    FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditKaydi" ADD CONSTRAINT "AuditKaydi_kullaniciId_fkey"
    FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditKaydi" ADD CONSTRAINT "AuditKaydi_sistemYoneticisiId_fkey"
    FOREIGN KEY ("sistemYoneticisiId") REFERENCES "SistemYoneticisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
