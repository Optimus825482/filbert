/**
 * Fındık İşleme Modülü e2e artıklarını temizler.
 *
 * `e2e/findik-isleme.spec.ts` paylaşılan geliştirme veritabanına talep kaydı ve
 * alım modülünde hızlı müstahsil kaydı yazar. Bu betik yalnızca test betiğinin
 * ürettiği kayıtları hedefler; gerçek iş kayıtlarına dokunmaz:
 *   - işleme müşteri rehberi (`Musteri`): `Z… Musteri` veya eski `E2eFindik…`
 *   - alım carileri (`CariKart`): `Z… Mustahsil` (bağlı kaydı yoksa)
 *   - talepler (`HizmetIslemi`) ve bunlara bağlı tahsilat `FinansHareket` satırları
 *
 * Varsayılan davranış kuru çalıştırmadır: ne silineceğini listeler.
 * Silmek için:  pnpm e2e:temizle -- --uygula
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

const UYGULA = process.argv.includes("--uygula") || process.argv.includes("--apply");

/** Test üretimi kabul edilen müşteri adları. */
const TEST_MUSTERI_KALIBI = /^(Z[0-9A-Z]{3} Musteri$|E2eFindik)/;
/** Test üretimi kabul edilen hızlı müstahsil adları. */
const TEST_MUSTAHSIL_KALIBI = /^Z[0-9A-Z]{3} Mustahsil$/;

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

  const musteriAdaylari = await prisma.musteri.findMany({
    where: { OR: [{ ad: { startsWith: "E2eFindik" } }, { ad: { startsWith: "Z" } }] },
    select: { id: true, ad: true },
  });
  const musteriHedefleri = musteriAdaylari.filter((m) => TEST_MUSTERI_KALIBI.test(m.ad));

  const cariAdaylari = await prisma.cariKart.findMany({
    where: { ad: { startsWith: "Z" } },
    select: { id: true, ad: true },
  });
  const cariHedefleri = cariAdaylari.filter((c) => TEST_MUSTAHSIL_KALIBI.test(c.ad));

  if (hedefler.length === 0 && musteriHedefleri.length === 0 && cariHedefleri.length === 0) {
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

  // Bağlı kaydı olan cariler silinmez; yalnızca testin açtığı boş kartlar hedeflenir.
  const silinebilirCariler: { id: string; ad: string }[] = [];
  const bagliCariler: { ad: string; adet: number }[] = [];
  for (const c of cariHedefleri) {
    const sayilar = await Promise.all([
      prisma.cariHareket.count({ where: { cariId: c.id } }),
      prisma.alimFisi.count({ where: { cariId: c.id } }),
      prisma.emanet.count({ where: { cariId: c.id } }),
      prisma.avans.count({ where: { cariId: c.id } }),
      prisma.finansTaslagi.count({ where: { cariId: c.id } }),
      prisma.satis.count({ where: { cariId: c.id } }),
      prisma.sevkiyat.count({ where: { cariId: c.id } }),
      prisma.masraf.count({ where: { cariId: c.id } }),
    ]);
    const toplam = sayilar.reduce((a, b) => a + b, 0);
    if (toplam === 0) silinebilirCariler.push(c);
    else bagliCariler.push({ ad: c.ad, adet: toplam });
  }

  console.log(
    `Test kaydı: ${hedefler.length} × HizmetIslemi, ${iliskiliFinans.length} × FinansHareket, ` +
      `${musteriHedefleri.length} × Musteri, ${silinebilirCariler.length} × CariKart`
  );
  for (const k of hedefler) {
    console.log(`  - #${k.siraNo} ${k.musteriAdi} [${k.durum}] ${k.id}`);
  }
  for (const m of musteriHedefleri) {
    console.log(`  * müşteri rehberi: ${m.ad} ${m.id}`);
  }
  for (const c of silinebilirCariler) {
    console.log(`  * müstahsil carisi: ${c.ad} ${c.id}`);
  }
  for (const c of bagliCariler) {
    console.log(`  ! ${c.ad} bağlı kaydı olduğu için silinmedi (${c.adet})`);
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
    if (hedefler.length > 0) {
      await tx.hizmetIslemi.deleteMany({ where: { id: { in: hedefler.map((k) => k.id) } } });
    }
    if (musteriHedefleri.length > 0) {
      await tx.musteri.deleteMany({ where: { id: { in: musteriHedefleri.map((m) => m.id) } } });
    }
    if (silinebilirCariler.length > 0) {
      await tx.cariKart.deleteMany({ where: { id: { in: silinebilirCariler.map((c) => c.id) } } });
    }
  });

  console.log("\nTemizlik uygulandı.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });