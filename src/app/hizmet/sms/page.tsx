import { getCurrentFirma } from "@/lib/auth";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { getFirmaSmsAyarlari, smsKayitlariniGetir, smsSayaclari } from "@/lib/sms/sms-servisi";
import {
  SMS_DURUM_ETIKETLERI,
  SMS_TIP_ETIKETLERI,
  type SmsKayitDurumu,
  type SmsKayitTipi,
} from "@/lib/sms/types";
import { istanbulGunAraligi } from "@/lib/zaman";
import { SmsMerkezi, type SmsMerkeziSatiri } from "./sms-merkezi";

export const dynamic = "force-dynamic";

/**
 * SMS Merkezi — gönderilen tüm müşteri bildirimlerinin gönderim ve teslim
 * durumu. Gönderim akışı talep ekranlarında çalışır; bu ekran yalnızca
 * izleme, teslim raporu sorgulama, yeniden gönderme ve dışa aktarma yapar.
 */
export default async function SmsMerkeziPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; tip?: string; q?: string }>;
}) {
  const actor = await requirePagePermission("HIZMET", "GORUNTULE");
  const firma = await getCurrentFirma();
  const params = await searchParams;

  // Filtre değerleri adres çubuğundan gelir; tanınmayan değer "tümü" sayılır.
  const durumHam = params.durum?.trim() || "HEPSI";
  const tipHam = params.tip?.trim() || "HEPSI";
  const arama = params.q?.trim() || "";
  const durum: SmsKayitDurumu | "HEPSI" = durumHam in SMS_DURUM_ETIKETLERI ? (durumHam as SmsKayitDurumu) : "HEPSI";
  const tip: SmsKayitTipi | "HEPSI" = tipHam in SMS_TIP_ETIKETLERI ? (tipHam as SmsKayitTipi) : "HEPSI";

  const { baslangic: bugunBaslangic } = istanbulGunAraligi();

  const [ayarlar, sayaclar, kayitlar] = await Promise.all([
    getFirmaSmsAyarlari(firma.id),
    smsSayaclari(firma.id, bugunBaslangic),
    smsKayitlariniGetir(firma.id, {
      durum,
      tip,
      arama,
      limit: 200,
    }),
  ]);

  const satirlar: SmsMerkeziSatiri[] = kayitlar.map((kayit) => ({
    id: kayit.id,
    telefon: kayit.telefon,
    musteriAdi: kayit.musteriAdi,
    mesaj: kayit.mesaj,
    tip: kayit.tip,
    durum: kayit.durum,
    saglayici: kayit.saglayici,
    saglayiciIsId: kayit.saglayiciIsId,
    hataKodu: kayit.hataKodu,
    hataAciklama: kayit.hataAciklama,
    parcaSayisi: kayit.parcaSayisi,
    birimMaliyetKurus: kayit.birimMaliyetKurus,
    teslimKodu: kayit.saglayiciDurumKodu,
    teslimAt: kayit.teslimAt ? kayit.teslimAt.toISOString() : null,
    createdAt: kayit.createdAt.toISOString(),
    siraNo: kayit.hizmetIslemi?.siraNo ?? null,
  }));

  return (
    <SmsMerkezi
      kayitlar={satirlar}
      sayaclar={sayaclar}
      ayarlar={{
        aktif: ayarlar.aktif,
        saglayici: ayarlar.saglayici,
        baslik: ayarlar.baslik ?? "",
        kodlama: ayarlar.kodlama,
        birimMaliyetKurus: ayarlar.birimMaliyetKurus,
      }}
      filtre={{ durum, tip, arama }}
      guncelleYetkisi={izinVar(actor, "HIZMET", "GUNCELLE")}
    />
  );
}