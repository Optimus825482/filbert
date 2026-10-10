/**
 * Fındık İşleme Modülü e2e artıklarını temizler.
 *
 * `e2e/findik-isleme.spec.ts` paylaşılan geliştirme veritabanına talep kaydı
 * yazar. Bu betik yalnızca test betiğinin ürettiği kayıtları (müşteri adı
 * `Z… Musteri` veya eski `E2eFindik…` ön ekiyle başlayanlar) ve bunlara bağlı
 * tahsilat `FinansHareket` satırlarını hedefler; gerçek iş kayıtlarına dokunmaz.
 *
 * Varsayılan davranış kuru çalıştırmadır: ne silineceğini listeler.
 * Silmek için:  pnpm e2e:temizle -- --uygula
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const UYGULA = process.argv.includes("--uygula") || process.argv.includes("--apply");

/** Test üretimi kabul edilen müşteri adları. */
const TEST_MUSTERI_KALIBI = /^(Z[0-9A-Z]{3} Musteri$|E2eFindik)/;

async function main() {
  const adaylar = await prisma.hizmetIslemi.findMany({
    where: { OR: [{ musteriAdi: { startsWith: "E2eFindik" } }, { musteriAdi: { startsWith: "Z" } }] },
    select: {
      id: true,
      siraNo: true,
      musteriAdi: true,
      durum: true,
      finansHareketId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const hedefler = adaylar.filter((k) => TEST_MUSTERI_KALIBI.test(k.musteriAdi));

  if (hedefler.length === 0) {
    console.log("Temizlenecek test kaydı bulunamadı.");
    return;
  }

  const finansIdleri = hedefler.map((k) => k.finansHareketId).filter((v): v is string => Boolean(v));
  const iliskiliFinans = await prisma.finansHareket.findMany({
    where: {
      OR: [
        { id: { in: finansIdleri } },
        { iliskiliTipi: "HIZMET", iliskiliId: { in: hedefler.map((k) => k.id) } },
      ],
    },
    select: { id: true, tip: true, tutar: true, aciklama: true },
  });

  console.log(`Test kaydı: ${hedefler.length} × HizmetIslemi, ${iliskiliFinans.length} × FinansHareket`);
  for (const k of hedefler) {
    console.log(`  - #${k.siraNo} ${k.musteriAdi} [${k.durum}] ${k.id}`);
  }
  for (const f of iliskiliFinans) {
    console.log(`  ~ ${f.tip} ${Number(f.tutar).toFixed(2)} TL — ${f.aciklama ?? ""} (${f.id})`);
  }

  if (!UYGULA) {
    console.log("\nKuru çalıştırma tamamlandı. Silmek için: pnpm e2e:temizle -- --uygula");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (iliskiliFinans.length > 0) {
      await tx.finansHareket.deleteMany({ where: { id: { in: iliskiliFinans.map((f) => f.id) } } });
    }
    await tx.hizmetIslemi.deleteMany({ where: { id: { in: hedefler.map((k) => k.id) } } });
  });

  console.log("\nTemizlik uygulandı.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
