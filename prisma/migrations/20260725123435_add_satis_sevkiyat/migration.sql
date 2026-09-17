-- CreateEnum
CREATE TYPE "SevkiyatDurum" AS ENUM ('HAZIRLANIYOR', 'YOLDA', 'TESLIM_EDILDI', 'IPTAL');

-- CreateTable
CREATE TABLE "Satis" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "cariId" TEXT NOT NULL,
    "fisNo" TEXT,
    "tarih" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cins" "Cins" NOT NULL,
    "brutKg" DECIMAL(10,2) NOT NULL,
    "daraKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netKg" DECIMAL(10,2) NOT NULL,
    "birimFiyat" DECIMAL(10,4) NOT NULL,
    "tutar" DECIMAL(12,2) NOT NULL,
    "durum" "FisDurum" NOT NULL DEFAULT 'TASLAK',
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Satis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisKalem" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "depoId" TEXT,
    "kg" DECIMAL(10,2) NOT NULL,
    "birimFiyat" DECIMAL(10,4),
    "tutar" DECIMAL(12,2),

    CONSTRAINT "SatisKalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sevkiyat" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "cariId" TEXT,
    "fisNo" TEXT,
    "tarih" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plaka" TEXT,
    "sofor" TEXT,
    "durum" "SevkiyatDurum" NOT NULL DEFAULT 'HAZIRLANIYOR',
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sevkiyat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SevkiyatKalem" (
    "id" TEXT NOT NULL,
    "sevkiyatId" TEXT NOT NULL,
    "depoId" TEXT,
    "cins" "Cins",
    "kg" DECIMAL(10,2) NOT NULL,
    "not" TEXT,

    CONSTRAINT "SevkiyatKalem_pkey" PRIMARY KEY ("id")
);
