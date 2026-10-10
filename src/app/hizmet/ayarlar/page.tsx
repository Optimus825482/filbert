import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { getFirmaSmsAyarlari } from "@/lib/sms/sms-servisi";
import { findikIslemeAyarlariniCoz } from "@/lib/findik-isleme";
import { windowsYazicilariniListele } from "@/lib/yazici/gonder";
import { ArrowLeft } from "lucide-react";
import { IslemeAyarFormu } from "./isleme-ayar-formu";

export const dynamic = "force-dynamic";

export default async function HizmetAyarlarPage() {
  await requirePagePermission("HIZMET", "GORUNTULE");
  const firma = await getCurrentFirma();

  const [kasalar, smsAyari, yaziciListesi] = await Promise.all([
    prisma.kasaHesap.findMany({
      where: { firmaId: firma.id, aktif: true },
      select: { id: true, ad: true, tip: true, modul: true },
      orderBy: { ad: "asc" },
    }),
    getFirmaSmsAyarlari(firma.id),
    windowsYazicilariniListele(),
  ]);

  const ayarlar = findikIslemeAyarlariniCoz(firma.ayarlar);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Fındık İşleme Ayarları</h1>
          <p className="mt-0.5 text-xs font-semibold text-sky-200">
            Tahsilat kasası, etiket yazıcı profili ve SMS bildirim yapılandırması
          </p>
        </div>
        <Link
          href="/hizmet"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Talep Listesi
        </Link>
      </div>

      <IslemeAyarFormu
        kasalar={kasalar.map((k) => ({ id: k.id, ad: k.ad, tip: k.tip, modul: k.modul }))}
        mevcutKasaHesapId={ayarlar.kasaHesapId}
        mevcutEtiketProfili={ayarlar.etiketProfili}
        mevcutYazici={ayarlar.yazici}
        yazicilar={yaziciListesi.ok ? yaziciListesi.adlar : []}
        yaziciListesiHatasi={yaziciListesi.ok ? null : yaziciListesi.hata}
        smsAktif={smsAyari.aktif || smsAyari.saglayici === "TEST"}
        smsSaglayici={smsAyari.saglayici}
        otomatikGirisSms={smsAyari.otomatikGirisSms}
        firmaAdi={firma.unvan}
      />
    </div>
  );
}
