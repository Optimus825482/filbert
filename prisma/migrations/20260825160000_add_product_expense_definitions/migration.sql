-- Kullanıcı arayüzünde yer alan ürün ve gider tanımları Prisma şemasında
-- bulunmasına rağmen önceki migration zincirinde fiziksel olarak
-- oluşturulmamıştı. Bu iki firma kapsamlı tablo, boş kurulumdan itibaren
-- tanım ekranının güvenle açılmasını sağlar.

CREATE TABLE "UrunTanimi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrunTanimi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GiderTanimi" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiderTanimi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UrunTanimi_firmaId_ad_key" ON "UrunTanimi"("firmaId", "ad");
CREATE UNIQUE INDEX "GiderTanimi_firmaId_ad_key" ON "GiderTanimi"("firmaId", "ad");

ALTER TABLE "UrunTanimi"
  ADD CONSTRAINT "UrunTanimi_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiderTanimi"
  ADD CONSTRAINT "GiderTanimi_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
