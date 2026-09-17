import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFirmaId } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { kg, puan, tarih } from "@/lib/format";
import { YazdirBaslat } from "@/components/yazdir-baslat";

export const dynamic = "force-dynamic";

/** Termal etiket (100mm x 60mm) — satın alma kodu büyük barko görünümünde. */
export default async function AlimEtiketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("ALIM", "GORUNTULE");
  const { id } = await params;
  const firmaId = await getCurrentFirmaId();
  const fis = await prisma.alimFisi.findFirst({
    where: { id, cari: { firmaId } },
    include: { cari: true, depo: true },
  });
  if (!fis) notFound();

  const randiman = fis.randimanPuan !== null ? puan(fis.randimanPuan) : "__";

  return (
    <div className="min-h-screen bg-white p-4 text-black">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Alım Etiketi</p>
          <p className="text-xs text-sky-900">Fiş No: {fis.fisNo} · {fis.cari.ad}</p>
        </div>
        <YazdirBaslat etiket="Etiketi Yazdır" />
      </div>

      {/* Termal etiket önizleme — baskıda @page etiket boyutu geçerli olur */}
      <div className="etiket-sayfa mx-auto flex flex-col justify-between border border-slate-300 bg-white p-1 text-black" style={{ width: "96mm", height: "56mm" }}>
        <div className="text-center">
          <div className="font-mono text-6xl font-black leading-none tracking-[0.45em] [text-indent:0.45em]">
            {fis.satinAlmaKodu}
          </div>
          <div className="mt-0.5 border-t border-black pt-0.5 text-center text-[11px] font-bold uppercase tracking-widest">
            Fındık Alım Etiketi
          </div>
        </div>
        <div className="space-y-0.5 text-[13px] font-bold leading-tight">
          <div className="flex justify-between gap-2">
            <span className="uppercase">Müstahsil:</span>
            <span className="text-right">{fis.cari.ad}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="uppercase">Tarih:</span>
            <span className="tabular-nums">{tarih(fis.tarih)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="uppercase">Miktar:</span>
            <span className="tabular-nums">{kg(fis.kg)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="uppercase">Randıman:</span>
            <span className="tabular-nums">{randiman}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
