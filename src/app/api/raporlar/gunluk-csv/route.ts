import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/guard";
import { getGunlukRapor } from "@/lib/queries";
import { istanbulTarihMetniniCoz, istanbulTarihAnahtari } from "@/lib/zaman";
import { kg, paraTL } from "@/lib/format";

export const dynamic = "force-dynamic";

/** CSV hücresini kaçırır: satır sonlarını temizler, formül enjeksiyonunu
 *  (=, +, -, @ ile başlayan değerleri) etkisizleştirir ve gerekirse tırnaklar. */
function csvAlan(deger: string): string {
  let alan = deger.replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(alan)) alan = "'" + alan;
  if (/[;"]/.test(alan)) alan = '"' + alan.replace(/"/g, '""') + '"';
  return alan;
}

export async function GET(request: Request) {
  try {
    await requirePermission("RAPORLAR", "GORUNTULE");
    const url = new URL(request.url);
    const t = url.searchParams.get("t");
    const tarih = t ? istanbulTarihMetniniCoz(t) : istanbulTarihAnahtari();
    if (!tarih) return NextResponse.json({ hata: "Geçersiz tarih" }, { status: 400 });

    const r = await getGunlukRapor(tarih);

    const satirlar: string[] = [];
    satirlar.push("Tur;Tarih;Cari/FisNo;Miktar;Tutar;Aciklama");

    for (const f of r.fisler) {
      satirlar.push(["Alim", f.tarih.toISOString().slice(0, 10), csvAlan(`${f.cari.ad} (${f.fisNo})`), kg(Number(f.kg)), paraTL(f.tutar), csvAlan(`Randiman: ${f.randimanPuan ? Number(f.randimanPuan).toString() : "-"}`)].join(";"));
    }
    for (const o of r.odemeler) {
      satirlar.push(["Odeme", o.createdAt.toISOString().slice(0, 10), csvAlan(o.hesap.ad), "", paraTL(o.tutar), csvAlan(o.aciklama ?? "")].join(";"));
    }
    for (const th of r.tahsilatlar) {
      satirlar.push(["Tahsilat", th.createdAt.toISOString().slice(0, 10), csvAlan(th.hesap.ad), "", paraTL(th.tutar), csvAlan(th.aciklama ?? "")].join(";"));
    }
    for (const m of r.masraflar) {
      satirlar.push(["Masraf", m.tarih.toISOString().slice(0, 10), "", "", paraTL(m.tutar), csvAlan(m.aciklama ?? m.tur)].join(";"));
    }

    const csv = "\uFEFF" + satirlar.join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"gunluk-rapor-" + tarih.toISOString().slice(0, 10) + ".csv\"",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "";
    const status = mesaj === "Oturum açmanız gerekiyor" ? 401 : mesaj === "Bu işlem için yetkiniz yok" ? 403 : 500;
    return NextResponse.json({ hata: status === 500 ? "CSV oluşturulamadı" : mesaj }, { status });
  }
}