import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { kg, paraTL, puan, tarih } from "@/lib/format";
import { YazdirBaslat } from "@/components/yazdir-baslat";

export const dynamic = "force-dynamic";

/** A4 alım fişi — firma başlıklı, imza alanlı resmî fiş. */
export default async function AlimFisPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("ALIM", "GORUNTULE");
  const { id } = await params;
  const firma = await getCurrentFirma();
  const fis = await prisma.alimFisi.findFirst({
    where: { id, cari: { firmaId: firma.id } },
    include: { cari: true, depo: true },
  });
  if (!fis) notFound();

  const pesin = fis.mulkiyetKaynak === "KENDI";

  return (
    <div className="min-h-screen bg-white p-4 text-black">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Alım Fişi</p>
          <p className="text-xs text-sky-900">Fiş No: {fis.fisNo} · {fis.cari.ad}</p>
        </div>
        <YazdirBaslat etiket="Fişi Yazdır" />
      </div>

      <div className="fis-sayfa mx-auto max-w-[180mm] border border-slate-300 bg-white p-8 text-black">
        {/* Firma başlığı */}
        <div className="border-b-2 border-black pb-3 text-center">
          <h1 className="text-2xl font-black uppercase tracking-wide">{firma.unvan}</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest">Fındık Alım Fişi</p>
        </div>

        {/* Fiş künyesi */}
        <div className="mt-3 flex justify-between border-b border-slate-400 pb-2 text-sm font-bold">
          <span>Fiş No: <span className="tabular-nums">{fis.fisNo}</span></span>
          <span>Satın Alma Kodu: <span className="font-mono tracking-[0.3em]">{fis.satinAlmaKodu}</span></span>
          <span>Tarih: <span className="tabular-nums">{tarih(fis.tarih)}</span></span>
        </div>

        {/* Fiş bilgileri tablosu */}
        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="w-1/3 py-2 font-bold">Müstahsil</td>
              <td className="py-2">{fis.cari.ad}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="py-2 font-bold">Depo</td>
              <td className="py-2">{fis.depo.ad}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="py-2 font-bold">Miktar</td>
              <td className="py-2 tabular-nums">{kg(fis.kg)}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="py-2 font-bold">Randıman</td>
              <td className="py-2 tabular-nums">{fis.randimanPuan !== null ? puan(fis.randimanPuan) : "Belirlenmedi"}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="py-2 font-bold">Mülkiyet</td>
              <td className="py-2 font-bold">{pesin ? "PEŞİN" : "EMANET"}</td>
            </tr>
            {pesin && (
              <>
                <tr className="border-b border-slate-300">
                  <td className="py-2 font-bold">Birim Fiyat</td>
                  <td className="py-2 tabular-nums">{fis.birimFiyat !== null ? paraTL(fis.birimFiyat) : "—"}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="py-2 font-bold">Tutar</td>
                  <td className="py-2 tabular-nums font-bold">{fis.tutar !== null ? paraTL(fis.tutar) : "—"}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* İmza alanları */}
        <div className="mt-16 grid grid-cols-2 gap-16 text-center text-sm font-bold">
          <div className="border-t border-black pt-1">Müstahsil İmzası</div>
          <div className="border-t border-black pt-1">Teslim Alan İmzası</div>
        </div>
      </div>
    </div>
  );
}
