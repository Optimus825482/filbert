import { NextResponse } from "next/server";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { smsKayitlariniGetir } from "@/lib/sms/sms-servisi";
import {
  SMS_DURUM_ETIKETLERI,
  SMS_TIP_ETIKETLERI,
  type SmsKayitDurumu,
  type SmsKayitTipi,
} from "@/lib/sms/types";
import { tarihSaat } from "@/lib/format";

export const dynamic = "force-dynamic";

/** CSV hücresi kaçırma: formül enjeksiyonunu etkisizleştirir, gerekirse tırnaklar. */
function csvAlan(deger: string | number | null | undefined): string {
  let alan = deger === null || deger === undefined ? "" : String(deger);
  alan = alan.replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(alan)) alan = "'" + alan;
  if (/[;"]/.test(alan)) alan = '"' + alan.replace(/"/g, '""') + '"';
  return alan;
}

/** Kuruş tutarını TL metnine çevirir. */
function kurus(deger: number | null): string {
  if (deger === null) return "";
  return (deger / 100).toFixed(2).replace(".", ",");
}

/**
 * SMS Merkezi dışa aktarımı. Filtreler ekrandakiyle aynıdır:
 *   ?durum=HATA   ?tip=KAYIT   ?q=ahmet
 */
export async function GET(request: Request) {
  try {
    await requirePermission("HIZMET", "GORUNTULE");
    const firma = await getCurrentFirma();
    const url = new URL(request.url);
    const durum = url.searchParams.get("durum") ?? "HEPSI";
    const tip = url.searchParams.get("tip") ?? "HEPSI";
    const arama = url.searchParams.get("q") ?? "";

    const kayitlar = await smsKayitlariniGetir(firma.id, {
      durum: durum as SmsKayitDurumu | "HEPSI",
      tip: tip as SmsKayitTipi | "HEPSI",
      arama,
      limit: 5000,
    });

    const satirlar: string[] = [];
    satirlar.push(
      [
        "Zaman",
        "SiraNo",
        "Musteri",
        "Telefon",
        "Tip",
        "Durum",
        "Kredi",
        "BirimMaliyetTL",
        "ToplamMaliyetTL",
        "Saglayici",
        "SaglayiciIsId",
        "TeslimKodu",
        "TeslimZamani",
        "HataKodu",
        "Aciklama",
        "Mesaj",
      ].join(";")
    );

    for (const k of kayitlar) {
      satirlar.push(
        [
          csvAlan(tarihSaat(k.createdAt)),
          csvAlan(k.hizmetIslemi?.siraNo ?? ""),
          csvAlan(k.musteriAdi ?? ""),
          csvAlan(k.telefon),
          csvAlan(SMS_TIP_ETIKETLERI[k.tip as SmsKayitTipi] ?? k.tip),
          csvAlan(SMS_DURUM_ETIKETLERI[k.durum as SmsKayitDurumu] ?? k.durum),
          String(k.parcaSayisi),
          kurus(k.birimMaliyetKurus),
          kurus(k.birimMaliyetKurus === null ? null : k.birimMaliyetKurus * k.parcaSayisi),
          csvAlan(k.saglayici),
          csvAlan(k.saglayiciIsId ?? ""),
          k.saglayiciDurumKodu === null ? "" : String(k.saglayiciDurumKodu),
          csvAlan(k.teslimAt ? tarihSaat(k.teslimAt) : ""),
          csvAlan(k.hataKodu ?? ""),
          csvAlan(k.hataAciklama ?? ""),
          csvAlan(k.mesaj),
        ].join(";")
      );
    }

    const csv = "\uFEFF" + satirlar.join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="findik-isleme-sms-kayitlari.csv"',
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