import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { tarihSaat, kg, paraTL } from "@/lib/format";
import { getFirmaSmsAyarlari } from "@/lib/sms/sms-servisi";
import { HizmetTablosu, type HizmetSatir } from "./hizmet-tablosu";
import { Clock, Play, CheckCircle2, PackageCheck, Banknote, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HizmetPage() {
  await requirePagePermission("HIZMET", "GORUNTULE");
  const firma = await getCurrentFirma();

  const [kayitlar, smsAyari, kasalar] = await Promise.all([
    prisma.hizmetIslemi.findMany({
      where: { firmaId: firma.id },
      orderBy: [{ createdAt: "desc" }, { siraSayisi: "desc" }],
      take: 300,
    }),
    getFirmaSmsAyarlari(firma.id),
    prisma.kasaHesap.findMany({
      where: { firmaId: firma.id, aktif: true },
      select: { id: true, ad: true, tip: true },
      orderBy: { ad: "asc" },
    }),
  ]);

  // Rapor / Metrik Hesaplamaları
  let siradaAdet = 0;
  let siradaKg = 0;
  let hazirlaniyorAdet = 0;
  let hazirlaniyorKg = 0;
  let tamamlandiAdet = 0;
  let tamamlandiKg = 0;
  let teslimAdet = 0;
  let teslimKg = 0;

  // Hacim & Ciro İstatistikleri
  let toplamKirmaKg = 0;
  let toplamKavurmaKg = 0;
  let toplamPaketlemeKg = 0;
  let toplamCiroTl = 0;
  let tahsilEdilenTl = 0;
  let bekleyenCiroTl = 0;

  for (const k of kayitlar) {
    if (k.durum === "IPTAL") continue;

    const kilo = Number(k.kilo);
    const tutar = Number(k.toplamTutar);

    if (k.kirma) toplamKirmaKg += kilo;
    if (k.kavurma) toplamKavurmaKg += kilo;
    if (k.paketleme) toplamPaketlemeKg += kilo;
    toplamCiroTl += tutar;

    if (k.odemeDurumu === "ODENDI") {
      tahsilEdilenTl += k.tahsilEdilenTutar ? Number(k.tahsilEdilenTutar) : tutar;
    } else {
      bekleyenCiroTl += tutar;
    }

    if (k.durum === "SIRAYA_ALINDI") {
      siradaAdet += 1;
      siradaKg += kilo;
    } else if (k.durum === "HAZIRLANIYOR") {
      hazirlaniyorAdet += 1;
      hazirlaniyorKg += kilo;
    } else if (k.durum === "TAMAMLANDI") {
      tamamlandiAdet += 1;
      tamamlandiKg += kilo;
    } else if (k.durum === "TESLIM_EDILDI") {
      teslimAdet += 1;
      teslimKg += kilo;
    }
  }

  const satirVerileri: HizmetSatir[] = kayitlar.map((k) => ({
    id: k.id,
    siraNo: k.siraNo,
    siraSayisi: k.siraSayisi,
    musteriAdi: k.musteriAdi,
    telefon: k.telefon,
    kilo: Number(k.kilo),
    kirma: k.kirma,
    kavurma: k.kavurma,
    paketleme: k.paketleme,
    paketTipi: k.paketTipi,
    paketAdedi: k.paketAdedi,
    cariId: k.cariId,
    odemeDurumu: k.odemeDurumu,
    odemeYontemi: k.odemeYontemi,
    kasaHesapId: k.kasaHesapId,
    tahsilEdilenTutar: k.tahsilEdilenTutar ? Number(k.tahsilEdilenTutar) : null,
    hizmetTipiAdi: k.hizmetTipiAdi,
    birimFiyat: Number(k.birimFiyat),
    toplamTutar: Number(k.toplamTutar),
    notlar: k.notlar,
    durum: k.durum,
    girisSmsGonderildi: k.girisSmsGonderildi,
    tamamlandiSmsGonderildi: k.tamamlandiSmsGonderildi,
    etiketBasildiSayisi: k.etiketBasildiSayisi,
    createdAt: k.createdAt.toISOString(),
    tarihSaatStr: tarihSaat(k.createdAt),
  }));

  return (
    <div className="space-y-6">
      {/* ─── Başlık ─── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Fındık Kırma & Paketleme Hizmeti
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-sky-200">
            Ev kullanımı / fason müşteriler için kırma, kavurma, vakumlu paketleme ve sıra takibi
          </p>
        </div>
      </div>

      {/* ─── Metrik Kartları (Bekleyenler, Hazırlananlar, Tamamlananlar) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Sırada Bekleyenler */}
        <div className="rounded-2xl border border-blue-500/30 bg-blue-950/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-300">
              Sırada Bekleyen
            </span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">
            {siradaAdet} <span className="text-xs font-normal text-blue-300">sipariş</span>
          </div>
          <div className="mt-1 font-mono text-xs font-extrabold text-[#f5c518]">
            {kg(siradaKg)}
          </div>
        </div>

        {/* Hazırlanıyor */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              Hazırlanıyor
            </span>
            <Play className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">
            {hazirlaniyorAdet} <span className="text-xs font-normal text-amber-300">sipariş</span>
          </div>
          <div className="mt-1 font-mono text-xs font-extrabold text-[#f5c518]">
            {kg(hazirlaniyorKg)}
          </div>
        </div>

        {/* Tamamlandı (Teslim Bekleyen) */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
              Hazır (Teslim Bekliyor)
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">
            {tamamlandiAdet} <span className="text-xs font-normal text-emerald-300">sipariş</span>
          </div>
          <div className="mt-1 font-mono text-xs font-extrabold text-[#f5c518]">
            {kg(tamamlandiKg)}
          </div>
        </div>

        {/* Teslim Edildi */}
        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
              Teslim Edilen
            </span>
            <PackageCheck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-white">
            {teslimAdet} <span className="text-xs font-normal text-purple-300">sipariş</span>
          </div>
          <div className="mt-1 font-mono text-xs font-extrabold text-sky-200">
            {kg(teslimKg)}
          </div>
        </div>
      </div>

      {/* ─── Hacim & Ciro Rapor Paneli ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* İşlem Dağılımı */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200">
            <Scale className="h-4 w-4 text-[#f5c518]" />
            Toplam İşlem Hacmi (Kabuklu Fındık)
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/5 bg-white/5 p-2">
              <div className="text-[10px] font-bold text-sky-300">Kırma</div>
              <div className="mt-0.5 font-mono text-sm font-black text-white">{kg(toplamKirmaKg)}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-2">
              <div className="text-[10px] font-bold text-sky-300">Kavurma</div>
              <div className="mt-0.5 font-mono text-sm font-black text-amber-300">{kg(toplamKavurmaKg)}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-2">
              <div className="text-[10px] font-bold text-sky-300">Paketleme</div>
              <div className="mt-0.5 font-mono text-sm font-black text-sky-300">{kg(toplamPaketlemeKg)}</div>
            </div>
          </div>
        </div>

        {/* Ciro ve Tahsilat */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200">
              <Banknote className="h-4 w-4 text-emerald-400" />
              Hizmet Cirosu & Kasa Tahsilat Durumu
            </div>
            <span className="text-[11px] font-mono text-sky-300">Toplam: {paraTL(toplamCiroTl)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Tahsil Edilen (Kasa)
              </div>
              <div className="mt-1 font-mono text-lg font-black text-emerald-400">
                {paraTL(tahsilEdilenTl)}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Bekleyen / Veresiye
              </div>
              <div className="mt-1 font-mono text-lg font-black text-amber-300">
                {paraTL(bekleyenCiroTl)}
              </div>
            </div>

            <div className="hidden rounded-xl border border-white/5 bg-white/5 p-2.5 sm:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Tahsilat Oranı
              </div>
              <div className="mt-1 font-mono text-lg font-black text-white">
                %{toplamCiroTl > 0 ? Math.round((tahsilEdilenTl / toplamCiroTl) * 100) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Hizmet Tablosu (Operasyonlar, Filtreler, Durumlar, SMS) ─── */}
      <HizmetTablosu
        kayitlar={satirVerileri}
        smsAktif={smsAyari.aktif || smsAyari.saglayici === "TEST"}
        kasalar={kasalar.map((k) => ({ id: k.id, ad: k.ad, tip: k.tip }))}
        firmaAdi={firma.unvan}
      />
    </div>
  );
}
