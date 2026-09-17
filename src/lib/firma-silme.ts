import type { Prisma } from "@/generated/prisma/client";

/**
 * Tek bir firmanın tüm operasyonel verisini siler. Sunucu aksiyonundan ayrıdır
 * ki gerçek bir işlem (transaction) içinde test edilebilsin.
 *
 * Kurallar:
 * - Her silme hedef `firmaId`'ye (veya ona bağlı kimliklere) sınırlıdır;
 *   platformdaki başka bir kiracıya dokunulmaz.
 * - `Kullanici`'ya Restrict ile bağlı modeller (SesliNot, FinansTaslagi)
 *   Kullanici silinmeden önce temizlenir.
 * - Audit kayıtları değiştirilemez olduğundan yalnız bu firmanın satırları,
 *   tetikleyici aynı işlem içinde geçici olarak kapatılarak silinir. ALTER
 *   transactional olduğu için işlem geri alınırsa tetikleyici de eski haline döner.
 */
export async function firmaVerileriniSil(tx: Prisma.TransactionClient, firmaId: string) {
  const [kullanicilar, roller, cariler, depolar, satislar, sevkiyatlar, emanetler, avanslar, notlar] = await Promise.all([
    tx.kullanici.findMany({ where: { firmaId }, select: { id: true } }),
    tx.yetkiRolu.findMany({ where: { firmaId }, select: { id: true } }),
    tx.cariKart.findMany({ where: { firmaId }, select: { id: true } }),
    tx.depo.findMany({ where: { firmaId }, select: { id: true } }),
    tx.satis.findMany({ where: { firmaId }, select: { id: true } }),
    tx.sevkiyat.findMany({ where: { firmaId }, select: { id: true } }),
    tx.emanet.findMany({ where: { cari: { firmaId } }, select: { id: true } }),
    tx.avans.findMany({ where: { cari: { firmaId } }, select: { id: true } }),
    tx.sesliNot.findMany({ where: { firmaId }, select: { id: true } }),
  ]);

  const kullaniciIds = kullanicilar.map((k) => k.id);
  const rolIds = roller.map((r) => r.id);
  const cariIds = cariler.map((c) => c.id);
  const depoIds = depolar.map((d) => d.id);
  const satisIds = satislar.map((s) => s.id);
  const sevkiyatIds = sevkiyatlar.map((s) => s.id);
  const emanetIds = emanetler.map((e) => e.id);
  const avansIds = avanslar.map((a) => a.id);
  const notIds = notlar.map((n) => n.id);

  await tx.$executeRawUnsafe(`ALTER TABLE "AuditKaydi" DISABLE TRIGGER "AuditKaydi_immutable"`);

  // Yalnız bu firmanın audit izleri; değiştirilemez tetikleyici geçici olarak kapalı.
  await tx.$executeRawUnsafe(
    `DELETE FROM "AuditKaydi" WHERE "firmaId" = $1 OR "kullaniciId" IN (SELECT "id" FROM "Kullanici" WHERE "firmaId" = $1)`,
    firmaId,
  );

  // Bağımlı (child) kayıtlar
  await tx.sesKaydi.deleteMany({ where: { sesliNotId: { in: notIds } } });
  await tx.finansTaslagi.deleteMany({ where: { firmaId } });
  // SesliNot hem Kullanici'ya hem Firma'ya Restrict ile bağlıdır; Kullanici
  // silinmeden önce mutlaka temizlenmelidir.
  await tx.sesliNot.deleteMany({ where: { id: { in: notIds } } });
  await tx.emanetHareket.deleteMany({ where: { emanetId: { in: emanetIds } } });
  await tx.avansMahsup.deleteMany({ where: { avansId: { in: avansIds } } });
  await tx.satisKalem.deleteMany({ where: { satisId: { in: satisIds } } });
  await tx.sevkiyatKalem.deleteMany({ where: { sevkiyatId: { in: sevkiyatIds } } });
  await tx.cariHareket.deleteMany({ where: { cariId: { in: cariIds } } });
  await tx.stokHareket.deleteMany({ where: { depoId: { in: depoIds } } });

  // Üst (parent) operasyonel kayıtlar
  await tx.emanet.deleteMany({ where: { id: { in: emanetIds } } });
  await tx.avans.deleteMany({ where: { id: { in: avansIds } } });
  await tx.alimFisi.deleteMany({ where: { firmaId } });
  await tx.satis.deleteMany({ where: { firmaId } });
  await tx.sevkiyat.deleteMany({ where: { firmaId } });
  await tx.masraf.deleteMany({ where: { firmaId } });
  await tx.masrafTuru.deleteMany({ where: { firmaId } });
  await tx.finansHareket.deleteMany({ where: { firmaId } });
  await tx.kasaHesap.deleteMany({ where: { firmaId } });
  await tx.arac.deleteMany({ where: { firmaId } });
  await tx.personel.deleteMany({ where: { firmaId } });
  await tx.depo.deleteMany({ where: { firmaId } });
  await tx.cariKart.deleteMany({ where: { firmaId } });
  await tx.sezon.deleteMany({ where: { firmaId } });

  // Yetkilendirme ve oturumlar
  await tx.kullaniciRol.deleteMany({ where: { OR: [{ rolId: { in: rolIds } }, { kullaniciId: { in: kullaniciIds } }] } });
  await tx.rolIzni.deleteMany({ where: { rolId: { in: rolIds } } });
  await tx.oturum.deleteMany({ where: { kullaniciId: { in: kullaniciIds } } });
  await tx.kullanici.deleteMany({ where: { firmaId } });
  await tx.yetkiRolu.deleteMany({ where: { firmaId } });
  await tx.sube.deleteMany({ where: { firmaId } });

  // Firma kaydının kendisi
  await tx.firma.delete({ where: { id: firmaId } });

  await tx.$executeRawUnsafe(`ALTER TABLE "AuditKaydi" ENABLE TRIGGER "AuditKaydi_immutable"`);
}
