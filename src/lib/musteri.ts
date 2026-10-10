import type { Prisma } from "@/generated/prisma/client";

/**
 * Fındık İşleme modülünün müşteri rehberi yardımcıları.
 *
 * Buradaki müşteriler yalnızca kırma/kavurma/paketleme hizmeti alan kişilerdir.
 * Alım/tedarik tarafında mal alınan kişiler (müstahsil, tüccar, fabrika) ise
 * `CariKart` tablosunda tutulur; iki kayıt kümesi bilinçli olarak ayrıdır.
 */

type IslemIstemcisi = Prisma.TransactionClient;

export function musteriAdiNormallestir(ad: string): string {
  return ad.trim().replace(/\s+/g, " ");
}

export function telefonRakamlari(telefon?: string | null): string {
  return (telefon ?? "").replace(/\D/g, "");
}

/**
 * Ad + telefon eşleşen müşteriyi bulur; yoksa yeni müşteri kaydı açar.
 * Hizmet kaydı oluşturulurken müşteri rehberinin kendiliğinden güncel kalmasını sağlar.
 */
export async function musteriBulVeyaOlustur(
  tx: IslemIstemcisi,
  firmaId: string,
  ad: string,
  telefon: string
): Promise<string> {
  const temizAd = musteriAdiNormallestir(ad);
  const rakamlar = telefonRakamlari(telefon);

  // Telefonlar veritabanında rakamlara indirgenmiş olarak tutulur; eski
  // kayıtlarda biçimlendirilmiş ("0532 111 22 33" gibi) değerler bulunabileceği
  // için adaylar rakam karşılaştırmasıyla eşleştirilir.
  const adaylar = await tx.musteri.findMany({
    where: { firmaId, ad: { equals: temizAd, mode: "insensitive" } },
    select: { id: true, telefon: true },
    take: 25,
  });
  const eslesen = adaylar.find((a) => telefonRakamlari(a.telefon) === rakamlar);
  if (eslesen) return eslesen.id;

  const yeni = await tx.musteri.create({
    data: { firmaId, ad: temizAd, telefon: rakamlar.length > 0 ? rakamlar : null },
    select: { id: true },
  });
  return yeni.id;
}