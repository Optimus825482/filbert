import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { TALEP_DURUM_ADLARI } from "@/lib/findik-isleme";
import { tarihSaat } from "@/lib/format";
import type { HizmetDurumu, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/** CSV hücresi kaçırma: formül enjeksiyonunu etkisizleştirir, gerekirse tırnaklar. */
function csvAlan(deger: string | number | null | undefined): string {
  let alan = deger === null || deger === undefined ? "" : String(deger);
  alan = alan.replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(alan)) alan = "'" + alan;
  if (/[;"]/.test(alan)) alan = '"' + alan.replace(/"/g, '""') + '"';
  return alan;
}

function sayi(deger: unknown): string {
  return Number(deger ?? 0)
    .toFixed(2)
    .replace(".", ",");
}

/**
 * Fındık İşleme Modülü — durum bazlı talep raporu (CSV).
 *   ?durum=KIRIM     → tek aşama
 *   ?liste=hazir     → işi bitmiş, teslim alınmamış talepler
 *   ?liste=sms       → tamamlandı bildirimi gönderilmemiş talepler
 *   ?liste=tahsilat  → teslim edilmiş, tahsilatı bekleyen talepler
 */
export async function GET(request: Request) {
  try {
    await requirePermission("HIZMET", "GORUNTULE");
    const firma = await getCurrentFirma();
    const url = new URL(request.url);
    const durum = url.searchParams.get("durum");
    const liste = url.searchParams.get("liste");

    const where: Prisma.HizmetIslemiWhereInput = { firmaId: firma.id };
    let dosyaEtiketi = "tum-talepler";

    if (liste === "hazir") {
      where.durum = "TAMAMLANDI";
      dosyaEtiketi = "hazir-teslim-alinmayanlar";
    } else if (liste === "sms") {
      where.durum = "TAMAMLANDI";
      where.tamamlandiSmsGonderildi = false;
      dosyaEtiketi = "sms-bekleyenler";
    } else if (liste === "tahsilat") {
      where.durum = "TESLIM_EDILDI";
      where.odemeDurumu = { not: "ODENDI" };
      dosyaEtiketi = "tahsilat-bekleyenler";
    } else if (durum && durum !== "HEPSI") {
      where.durum = durum as HizmetDurumu;
      dosyaEtiketi = durum.toLowerCase();
    }

    const kayitlar = await prisma.hizmetIslemi.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { siraSayisi: "asc" }],
      take: 5000,
    });

    const satirlar: string[] = [];
    satirlar.push(
      [
        "SiraNo",
        "Musteri",
        "Telefon",
        "FindikKg",
        "Islemler",
        "Durum",
        "OdemeDurumu",
        "ToplamTutar",
        "TahsilEdilen",
        "KayitSMS",
        "TamamlandiSMS",
        "TeslimHatirlatma",
        "EtiketBaskisi",
        "Olusturma",
        "Kirim",
        "Kavurma",
        "Paketleme",
        "Tamamlanma",
        "Teslim",
        "Notlar",
      ].join(";")
    );

    for (const k of kayitlar) {
      const islemler = [
        k.kirma ? "Kirim" : "",
        k.kavurma ? "Kavurma" : "",
        k.paketleme ? "Vakumlu" : "",
      ]
        .filter(Boolean)
        .join("+");

      satirlar.push(
        [
          csvAlan(k.siraNo),
          csvAlan(k.musteriAdi),
          csvAlan(k.telefon),
          sayi(k.kilo),
          csvAlan(islemler),
          csvAlan(TALEP_DURUM_ADLARI[k.durum] ?? k.durum),
          csvAlan(k.odemeDurumu),
          sayi(k.toplamTutar),
          sayi(k.tahsilEdilenTutar),
          k.girisSmsGonderildi ? "Gonderildi" : "Gonderilmedi",
          k.tamamlandiSmsGonderildi ? "Gonderildi" : "Gonderilmedi",
          String(k.teslimSmsSayisi),
          String(k.etiketBasildiSayisi),
          csvAlan(tarihSaat(k.createdAt)),
          csvAlan(k.kirimAt ? tarihSaat(k.kirimAt) : ""),
          csvAlan(k.kavurmaAt ? tarihSaat(k.kavurmaAt) : ""),
          csvAlan(k.paketlemeAt ? tarihSaat(k.paketlemeAt) : ""),
          csvAlan(k.tamamlandiAt ? tarihSaat(k.tamamlandiAt) : ""),
          csvAlan(k.teslimAt ? tarihSaat(k.teslimAt) : ""),
          csvAlan(k.notlar ?? ""),
        ].join(";")
      );
    }

    const csv = "\uFEFF" + satirlar.join("\n");
    const dosyaAdi = 'findik-isleme-' + dosyaEtiketi + ".csv";
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="' + dosyaAdi + '"',
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "";
    const status =
      mesaj === "Oturum açmanız gerekiyor" ? 401 : mesaj === "Bu işlem için yetkiniz yok" ? 403 : 500;
    return NextResponse.json({ hata: status === 500 ? "CSV oluşturulamadı" : mesaj }, { status });
  }
}
