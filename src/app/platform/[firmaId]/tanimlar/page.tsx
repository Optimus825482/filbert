import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentOturum } from "@/lib/auth";
import { KurulumTanimlari } from "./tanim-form";

export default async function KurulumTanimlarPage({ params }: { params: Promise<{ firmaId: string }> }) {
  const { firmaId } = await params;
  const yonetici = (await getCurrentOturum())?.sistemYoneticisi;
  if (!yonetici?.aktif) redirect("/giris");
  const firma = await prisma.firma.findFirst({
    where: { id: firmaId, kuranSistemYoneticisiId: yonetici.id },
    include: {
      depolar: { orderBy: { ad: "asc" } },
      hesaplar: { orderBy: { ad: "asc" } },
      masrafTurleri: { orderBy: { ad: "asc" } },
    },
  });
  if (!firma) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-4xl p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kurulum · 2/3</p>
      <h1 className="mt-1 text-3xl font-extrabold">Temel tanımlar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {firma.unvan} için uygulamanın çalışması gereken temel tanımları yapın: depo, kasa/banka hesabı ve masraf türleri.
        Bunları daha sonra Ayarlar &gt; Tanımlar bölümünden güncelleyebilir veya yenilerini ekleyebilirsiniz.
      </p>
      <KurulumTanimlari
        firmaId={firma.id}
        depolar={firma.depolar.map((d) => ({ id: d.id, ad: d.ad }))}
        hesaplar={firma.hesaplar.map((h) => ({ id: h.id, ad: h.ad, tip: h.tip, bankaAdi: h.bankaAdi }))}
        masrafTurleri={firma.masrafTurleri.map((t) => ({ id: t.id, ad: t.ad }))}
      />
    </main>
  );
}
