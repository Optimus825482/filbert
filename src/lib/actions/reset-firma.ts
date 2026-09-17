"use server";

import { prisma } from "@/lib/db";
import { requireSistemYonetici } from "@/lib/auth";
import { firmaVerileriniSil } from "@/lib/firma-silme";
import { revalidatePath } from "next/cache";

type Sonuc = { ok: boolean; hata?: string };

export async function mevcutFirmaGetir() {
  await requireSistemYonetici();
  const firma = await prisma.firma.findFirst({
    where: { aktif: true },
    include: {
      kullanicilar: { select: { id: true, ad: true, eposta: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return firma ? {
    id: firma.id,
    unvan: firma.unvan,
    adres: firma.adres ?? "",
    telefon: firma.telefon ?? "",
    vergiNo: firma.vergiNo ?? "",
    sahip: firma.kullanicilar[0] ?? null,
  } : null;
}

/**
 * Tek bir firmanın operasyonel verisini siler. `firmaId` verilmezse en son
 * kurulan aktif firma hedeflenir. Silme mantığı `firmaVerileriniSil` içindedir
 * ve tüm işlemler hedef kiracıya kısıtlıdır; platformdaki diğer firmalar korunur.
 */
export async function firmaVerileriniSifirla(firmaId?: string): Promise<Sonuc> {
  const yonetici = await requireSistemYonetici();
  try {
    const firma = firmaId
      ? await prisma.firma.findUnique({ where: { id: firmaId } })
      : await prisma.firma.findFirst({ where: { aktif: true }, orderBy: { createdAt: "desc" } });
    if (!firma) return { ok: false, hata: "Sıfırlanacak firma bulunamadı" };

    // Sıfırlama, firmayı kuran sistem yöneticisiyle sınırlıdır; böylece herhangi
    // bir yönetici başka bir operasyon kiracısının verisini toptan silemez.
    if (firma.kuranSistemYoneticisiId && firma.kuranSistemYoneticisiId !== yonetici.id) {
      return { ok: false, hata: "Bu firmayı sıfırlama yetkiniz yok" };
    }

    await prisma.$transaction(async (tx) => {
      await firmaVerileriniSil(tx, firma.id);
    }, { timeout: 30_000 });

    // Silme işlemi firmanın audit satırlarını da sildiği için kalıcı bir iz,
    // hedef firma kimliğine bağlı olmadan platform yöneticisi üzerinden yazılır.
    await prisma.auditKaydi.create({
      data: {
        sistemYoneticisiId: yonetici.id,
        eylem: "SIL",
        hedefTipi: "Firma",
        hedefId: firma.id,
        oncekiVeri: { unvan: firma.unvan, vergiNo: firma.vergiNo ?? null },
        aciklama: `Firma operasyonel verisi sıfırlandı: ${firma.unvan}`,
      },
    });

    revalidatePath("/platform");
    return { ok: true };
  } catch (error) {
    console.error("firmaVerileriniSifirla", error);
    return { ok: false, hata: "Firma verileri silinemedi" };
  }
}
