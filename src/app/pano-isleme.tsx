import Link from "next/link";
import {
  ArrowRight, BellRing, Boxes, CheckCircle2, ChevronRight, ClipboardList, Flame,
  HandCoins, MessageSquareWarning, PackageOpen, PackageSearch, Plus, Scissors,
  Timer, Truck, Wallet, type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSonGunlerHizmet, islemeSayaclari, n } from "@/lib/queries";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { kg, tarihSaat } from "@/lib/format";
import { istanbulGunAraligi } from "@/lib/zaman";
import {
  TALEP_DURUM_ADLARI,
  URETIM_DURUMLARI,
  durumDagilimiDilimleri,
  type DurumDilimi,
} from "@/lib/findik-isleme";

type Aktor = Awaited<ReturnType<typeof requirePagePermission>>;

// Pano yüzeyleri alım panosuyla aynı sözlükten gelir: aynı panel, aynı kenar.
const PANEL = "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]";
const PANEL_BASLIK = "flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-4 py-3";
const SATIR_HOVER = "transition-colors hover:bg-white/5";

const GUN_KISA = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short" });
const GUN_UZUN = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });
const BUGUN_UZUN = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long", year: "numeric",
});

const ASAMA_IKONU: Record<string, LucideIcon> = {
  SIRAYA_ALINDI: ClipboardList,
  KIRIM: Scissors,
  KAVURMA: Flame,
  PAKETLEME: Boxes,
};

/**
 * Fındık İşleme Modülü panosu. Pano modüle göre ayrılır: bu ekran yalnızca
 * kırma / kavurma / paketleme taleplerini, teslim-tahsilat durumunu ve işleme
 * kuyruğunu gösterir. Alım fişi, randıman, emanet ve depo verisi burada yer
 * almaz — onlar Fındık Alım Modülü panosundadır.
 */
export async function PanoIsleme({ actor }: { actor: Aktor }) {
  const hizmetVar = izinVar(actor, "HIZMET", "GORUNTULE");
  const olusturabilir = izinVar(actor, "HIZMET", "OLUSTUR");
  const { baslangic: bugunBas } = istanbulGunAraligi();

  if (!hizmetVar) {
    return (
      <section className={`${PANEL} p-6`}>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Pano</h1>
        <p className="mt-2 text-sm text-sky-100">
          Fındık İşleme panosunu görmek için <b className="text-white">HİZMET</b> görüntüleme yetkiniz olmalıdır.
        </p>
      </section>
    );
  }

  // Pano parasal veri çekmez: tutar yalnızca rapor ve kasa ekranlarında okunur.
  const [sayaclar, trend, acikTalepler, hazirListesi, sonTalepler] = await Promise.all([
    islemeSayaclari(actor.firmaId),
    getSonGunlerHizmet(7),
    prisma.hizmetIslemi.findMany({
      where: { firmaId: actor.firmaId, durum: { in: [...URETIM_DURUMLARI] } },
      select: { durum: true, kilo: true },
    }),
    prisma.hizmetIslemi.findMany({
      where: { firmaId: actor.firmaId, durum: "TAMAMLANDI" },
      orderBy: { tamamlandiAt: "asc" },
      take: 5,
      select: { id: true, siraNo: true, musteriAdi: true, kilo: true, tamamlandiAt: true },
    }),
    prisma.hizmetIslemi.findMany({
      where: { firmaId: actor.firmaId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, siraNo: true, musteriAdi: true, kilo: true, durum: true,
        createdAt: true, kirma: true, kavurma: true, paketleme: true,
      },
    }),
  ]);

  const asamaSayilari = URETIM_DURUMLARI.map((kod) => {
    const satirlar = acikTalepler.filter((talep) => talep.durum === kod);
    return { kod, adet: satirlar.length, kg: satirlar.reduce((toplam, talep) => toplam + n(talep.kilo), 0) };
  });
  const enYuksekAsamaAdet = asamaSayilari.reduce((enBuyuk, asama) => Math.max(enBuyuk, asama.adet), 0);
  const uretimdeToplam = sayaclar.bekleyenTalep + sayaclar.uretimdeTalep;

  const dagilim = durumDagilimiDilimleri(sayaclar.durumDagilimi);
  const trendToplamKg = trend.reduce((toplam, gun) => toplam + gun.kg, 0);
  const trendTamamlananAdet = trend.reduce((toplam, gun) => toplam + gun.tamamlananAdet, 0);
  const bugun = trend[trend.length - 1] ?? { kg: 0, adet: 0, tamamlananAdet: 0 };

  const yapilacaklar: { href: string; ikon: LucideIcon; etiket: string; rozet: string }[] = [];
  if (sayaclar.hazirBekleyen > 0) {
    yapilacaklar.push({ href: "/hizmet?liste=teslimat", ikon: Truck, etiket: "Teslimatı bekleyen hazır talep", rozet: `${sayaclar.hazirBekleyen} talep` });
  }
  if (sayaclar.smsBekleyen > 0) {
    yapilacaklar.push({ href: "/hizmet?liste=sms", ikon: BellRing, etiket: "Tamamlandı bildirimi gönderilmedi", rozet: `${sayaclar.smsBekleyen} talep` });
  }
  if (sayaclar.tahsilatBekleyen > 0) {
    yapilacaklar.push({ href: "/hizmet/raporlar", ikon: Timer, etiket: "Teslim edildi, tahsilat bekliyor", rozet: `${sayaclar.tahsilatBekleyen} talep` });
  }

  return (
    <>
      {/* ═══════════ MOBİL GÖRÜNÜM (md altı) ═══════════ */}
      <div className="space-y-4 pb-2 md:hidden">
        <div className="grid grid-cols-2 gap-3">
          {olusturabilir && <MobilKutu href="/hizmet/yeni" etiket={"Yeni\nTalep"} ikon={Plus} />}
          <MobilKutu href="/hizmet" etiket={"Talep\nKuyruğu"} ikon={PackageSearch} badge={uretimdeToplam} />
          <MobilKutu href="/hizmet?liste=teslimat" etiket={"Teslimat"} ikon={Truck} />
          <MobilKutu href="/hizmet/kasa" etiket={"Kasa"} ikon={Wallet} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MobilKpi etiket="Bekleyen" deger={sayaclar.bekleyenTalep} ek={kg(sayaclar.bekleyenKg)} renk="#38bdf8" />
          <MobilKpi etiket="Bugün tamamlanan" deger={sayaclar.bugunTamamlanan} renk="#34d399" />
          <MobilKpi etiket="Teslim bekleyen" deger={sayaclar.teslimBekleyen} renk="#a78bfa" />
          <MobilKpi etiket="Mesaj gönderilmedi" deger={sayaclar.smsBekleyen} renk="#fb923c" />
        </div>
        <div className="rounded-2xl border border-[var(--surface-border)] bg-white/5 px-4 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-100">BUGÜN</div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-sky-100"><b className="tabular-nums text-white">{bugun.adet}</b> gelen</span>
            <span className="text-sky-100"><b className="tabular-nums text-emerald-400">{bugun.tamamlananAdet}</b> tamamlanan</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-sky-100">İşleme alınan <b className="tabular-nums text-[#f5c518]">{kg(bugun.kg)}</b></div>
        </div>
        <section className={PANEL}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Talep durum dağılımı</h2>
            <span className="text-xs font-bold tabular-nums text-sky-500">{dagilim.toplam}</span>
          </div>
          <Donut toplam={dagilim.toplam} dilimler={dagilim.dilimler} />
        </section>
      </div>

      {/* ═══════════ MASAÜSTÜ GÖRÜNÜM (md+) ═══════════ */}
      <div className="hidden gap-4 md:grid md:grid-cols-12">

        <section className="flex flex-wrap items-end justify-between gap-3 md:col-span-12">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Pano</h1>
            <p className="mt-0.5 text-xs font-semibold text-sky-100">{BUGUN_UZUN.format(bugunBas)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-xl border border-[#f5c518]/25 bg-[#f5c518]/10 px-3 py-2 text-[11px] font-extrabold tracking-wide text-[#f5c518]">
              <PackageSearch className="h-4 w-4" /> Fındık İşleme Modülü
            </span>
            {olusturabilir && <HizliButon href="/hizmet/yeni" ikon={Plus} etiket="Yeni Talep" birincil />}
            <HizliButon href="/hizmet" ikon={PackageSearch} etiket="Talep Kuyruğu" />
            <HizliButon href="/hizmet?liste=teslimat" ikon={Truck} etiket="Teslimat" />
            <HizliButon href="/hizmet/kasa" ikon={Wallet} etiket="Kasa" />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 md:col-span-12">
          <Kpi baslik="Bekleyen talep" deger={sayaclar.bekleyenTalep} ek={kg(sayaclar.bekleyenKg)} toplam={dagilim.toplam} alt="işleme alınmayı bekliyor" ikon={ClipboardList} renk="#38bdf8" href="/hizmet?liste=kuyruk" />
          <Kpi baslik="Üretimde" deger={sayaclar.uretimdeTalep} toplam={dagilim.toplam} alt="kırım · kavurma · paketleme" ikon={Boxes} renk="#f5c518" href="/hizmet" />
          <Kpi baslik="Bugün tamamlanan" deger={sayaclar.bugunTamamlanan} toplam={dagilim.toplam} alt="bugün tamamlandı işaretlendi" ikon={CheckCircle2} renk="#34d399" href="/hizmet/raporlar" />
          <Kpi baslik="Teslim edilmeyi bekleyen" deger={sayaclar.teslimBekleyen} toplam={dagilim.toplam} alt="hazır, müşteri almadı" ikon={PackageOpen} renk="#a78bfa" href="/hizmet?liste=teslimat" />
          <Kpi baslik="Mesaj gönderilmeyen" deger={sayaclar.smsBekleyen} toplam={sayaclar.teslimBekleyen} alt="tamamlandı bildirimi bekliyor" ikon={MessageSquareWarning} renk="#fb923c" href="/hizmet?liste=sms" />
          <Kpi baslik="Tahsilat bekleyen" deger={sayaclar.tahsilatBekleyen} toplam={sayaclar.teslimEdilen} alt="teslim edildi, ödeme yok" ikon={HandCoins} renk="#f87171" href="/hizmet/raporlar" />
        </section>

        <section className={`md:col-span-12 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">SMS bildirimleri</h2>
              <p className="mt-0.5 text-xs font-semibold text-sky-100">
                Bugün {sayaclar.sms.bugunGonderilen} gönderim · {sayaclar.sms.bugunTeslim} teslim ·{" "}
                {sayaclar.sms.bugunHatali} hata
              </p>
            </div>
            <Link href="/hizmet/sms" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              SMS Merkezi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {[
              { etiket: "Bugün gönderilen", deger: sayaclar.sms.bugunGonderilen, renk: "#38bdf8" },
              { etiket: "Bugün teslim edilen", deger: sayaclar.sms.bugunTeslim, renk: "#34d399" },
              { etiket: "Bugün hatalı", deger: sayaclar.sms.bugunHatali, renk: "#f87171" },
              { etiket: "Teslim raporu bekleyen", deger: sayaclar.sms.raporBekleyen, renk: "#a78bfa" },
            ].map((olcu) => (
              <div key={olcu.etiket} className="rounded-xl border border-[var(--surface-border)] bg-black/10 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-sky-300">{olcu.etiket}</div>
                <div className="mt-0.5 text-xl font-black" style={{ color: olcu.renk }}>
                  {olcu.deger}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`md:col-span-12 lg:col-span-4 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">Talep durum dağılımı</h2>
              <p className="mt-0.5 text-xs font-semibold text-sky-100">Toplam {dagilim.toplam} talep</p>
            </div>
            <Link href="/hizmet" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Talepler <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Donut toplam={dagilim.toplam} dilimler={dagilim.dilimler} />
        </section>

        <section className={`md:col-span-12 lg:col-span-4 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">Fındık işleme kuyruğu</h2>
              <p className="mt-0.5 text-xs font-semibold text-sky-100">Üretimde {uretimdeToplam} talep · {kg(sayaclar.uretimdeKg)}</p>
            </div>
            <Link href="/hizmet" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Kuyruğa git <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-[var(--surface-border)]">
            {asamaSayilari.map((asama) => {
              const Ikon = ASAMA_IKONU[asama.kod] ?? ClipboardList;
              const yuzde = enYuksekAsamaAdet > 0 ? Math.round((asama.adet / enYuksekAsamaAdet) * 100) : 0;
              return (
                <li key={asama.kod} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Ikon className="h-4 w-4 text-[#f5c518]" />
                      {TALEP_DURUM_ADLARI[asama.kod] ?? asama.kod}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                      {asama.adet} <span className="text-xs font-semibold text-sky-100">· {kg(asama.kg)}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-border)]">
                    <div className="h-full rounded-full bg-[#f5c518]" style={{ width: `${yuzde}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {uretimdeToplam === 0 && (
            <p className="px-4 pb-4 text-xs font-semibold text-sky-100">Üretimde bekleyen talep yok. Yeni talep kaydıyla başlayın.</p>
          )}
        </section>

        <section className={`md:col-span-12 lg:col-span-4 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Yapılacaklar</h2>
            <span className="text-xs font-bold tabular-nums text-sky-500">{yapilacaklar.length}</span>
          </div>
          {yapilacaklar.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-sky-100">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              Bekleyen iş yok. Tüm talepler teslim edilmiş durumda.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {yapilacaklar.map((satir) => (
                <li key={satir.href}>
                  <Link href={satir.href} className={`flex items-center gap-3 px-4 py-3 ${SATIR_HOVER}`}>
                    <satir.ikon className="h-4 w-4 shrink-0 text-[#f5c518]" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-white">{satir.etiket}</span>
                    <span className="shrink-0 rounded-full bg-amber-900/70 px-2.5 py-0.5 text-xs font-extrabold tabular-nums text-amber-200">{satir.rozet}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-sky-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`md:col-span-12 lg:col-span-7 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">Son 7 gün · işleme hareketi</h2>
              <p className="mt-0.5 text-xs font-semibold text-sky-100">
                Gelen {kg(trendToplamKg)} · Tamamlanan {trendTamamlananAdet} talep
              </p>
            </div>
            <Link href="/hizmet/raporlar" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Durum raporları <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-5 px-4 py-4">
            <MiniGrafik
              baslik="Gelen talep · kg"
              renk="#f5c518"
              ozet={`Toplam ${kg(trendToplamKg)}`}
              gunler={trend.map((gun) => ({
                anahtar: gun.anahtar,
                deger: gun.kg,
                ipucu: `${GUN_UZUN.format(gun.anahtar)} · ${kg(gun.kg)} · ${gun.adet} talep`,
              }))}
            />
            <MiniGrafik
              baslik="Tamamlanan talep · adet"
              renk="#34d399"
              ozet={`Toplam ${trendTamamlananAdet}`}
              gunler={trend.map((gun) => ({
                anahtar: gun.anahtar,
                deger: gun.tamamlananAdet,
                ipucu: `${GUN_UZUN.format(gun.anahtar)} · ${gun.tamamlananAdet} tamamlanan talep`,
              }))}
            />
            {trendToplamKg === 0 && trendTamamlananAdet === 0 && (
              <p className="text-center text-xs font-semibold text-sky-100">Son 7 günde işleme hareketi yok. Yeni bir talep kaydıyla başlayın.</p>
            )}
          </div>
        </section>

        <section className={`md:col-span-12 lg:col-span-5 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Teslimat · hazırlananlar</h2>
            <Link href="/hizmet?liste=teslimat" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Tümü <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {hazirListesi.length === 0 ? (
            <p className="px-4 py-6 text-sm text-sky-100">Teslim bekleyen hazır talep yok.</p>
          ) : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {hazirListesi.map((talep) => (
                <li key={talep.id}>
                  <Link href={`/hizmet/${talep.id}/etiket`} className={`flex items-center gap-3 px-4 py-3 ${SATIR_HOVER}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{talep.musteriAdi}</span>
                      <span className="block text-xs tabular-nums text-sky-500">
                        #{talep.siraNo}{talep.tamamlandiAt ? ` · ${tarihSaat(talep.tamamlandiAt)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">{kg(Number(talep.kilo))}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-sky-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`md:col-span-12 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Son talepler</h2>
            <Link href="/hizmet" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Tümü <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-[10px] uppercase tracking-wider text-sky-500">
                  <th className="px-4 py-2.5 font-bold">Sıra / Müşteri</th>
                  <th className="px-3 py-2.5 font-bold">İşlemler</th>
                  <th className="px-3 py-2.5 font-bold">Geliş</th>
                  <th className="px-3 py-2.5 font-bold text-right">Kg</th>
                  <th className="px-4 py-2.5 font-bold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sonTalepler.map((talep) => (
                  <tr key={talep.id} className={`border-b border-[var(--surface-border)] ${SATIR_HOVER}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white">{talep.musteriAdi}</div>
                      <div className="text-xs tabular-nums text-sky-500">#{talep.siraNo}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {talep.kirma && <Cip>Kırma</Cip>}
                        {talep.kavurma && <Cip>Kavurma</Cip>}
                        {talep.paketleme && <Cip>Paket</Cip>}
                        {!talep.kirma && !talep.kavurma && !talep.paketleme && <span className="text-xs text-sky-500">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-sky-100">{tarihSaat(talep.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">{kg(Number(talep.kilo))}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-bold text-sky-100">
                        {TALEP_DURUM_ADLARI[talep.durum] ?? talep.durum}
                      </span>
                    </td>
                  </tr>
                ))}
                {sonTalepler.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-sky-100">Henüz işleme talebi yok. İlk talebi oluşturduğunuzda burada listelenir.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Cip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-sky-100">{children}</span>;
}

function MobilKutu({ href, etiket, ikon: Ikon, badge }: { href: string; etiket: string; ikon: LucideIcon; badge?: number }) {
  return (
    <Link
      href={href}
      className="modul-ana relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-[#f5c518] to-[#d4a30f] px-3 py-4 text-center shadow-[0_4px_0_#7a5b08] transition-transform duration-150 ease-out active:scale-[0.97] active:shadow-none select-none"
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-extrabold text-white shadow">
          {badge}
        </span>
      )}
      <Ikon className="h-10 w-10 text-[#0b1b3a]" strokeWidth={2.25} />
      <span className="whitespace-pre-line text-sm font-extrabold leading-tight text-[#0b1b3a]">{etiket}</span>
    </Link>
  );
}

// ─── Pano KPI kartı (masaüstü) ─────────────────────────────
function Kpi({
  baslik, deger, ek, toplam, alt, ikon: Ikon, renk, href,
}: {
  baslik: string;
  deger: number;
  /** Adedin yanında gösterilen ikincil değer (örn. toplam kg). */
  ek?: string;
  toplam: number;
  alt: string;
  ikon: LucideIcon;
  renk: string;
  href: string;
}) {
  const yuzde = toplam > 0 ? Math.min(100, Math.round((deger / toplam) * 100)) : 0;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 ${SATIR_HOVER}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[10px] font-extrabold uppercase leading-tight tracking-[0.1em] text-sky-500">{baslik}</span>
        <Ikon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: renk }} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-extrabold leading-none tabular-nums tracking-tight text-white">{deger}</span>
        {ek && <span className="text-xs font-bold tabular-nums text-sky-100">{ek}</span>}
      </div>
      <div className="mt-auto space-y-1.5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-border)]"
          title={`${baslik}: ${yuzde}%`}
        >
          <div className="h-full rounded-full" style={{ width: `${yuzde}%`, backgroundColor: renk }} />
        </div>
        <div className="truncate text-[11px] font-semibold text-sky-100">{alt}</div>
      </div>
    </Link>
  );
}

// ─── Mobil KPI hücresi ─────────────────────────────────────
function MobilKpi({ etiket, deger, ek, renk }: { etiket: string; deger: number; ek?: string; renk: string }) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: renk }} />
        <span className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-wider text-sky-100">{etiket}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-extrabold leading-none tabular-nums text-white">{deger}</span>
        {ek && <span className="text-[11px] font-bold tabular-nums text-sky-100">{ek}</span>}
      </div>
    </div>
  );
}

// ─── Durum dağılımı (donut) ────────────────────────────────
const DONUT_YARICAP = 15.91549430918954;

function Donut({ toplam, dilimler }: { toplam: number; dilimler: readonly DurumDilimi[] }) {
  if (toplam <= 0) {
    return (
      <p className="px-4 py-6 text-sm text-sky-100">
        Henüz işleme talebi yok. İlk talebi oluşturduğunuzda dağılım burada görünür.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 42 42"
          role="img"
          aria-label={`Talep durum dağılımı: ${dilimler.map((d) => `${d.ad} ${d.adet}`).join(", ")}`}
          className="h-40 w-40 -rotate-90"
        >
          <circle cx="21" cy="21" r={DONUT_YARICAP} fill="none" stroke="var(--surface-border)" strokeWidth="5" />
          {dilimler.map((d) => {
            const uzunluk = Math.max(d.yuzde - 1, 0.8);
            return (
              <circle
                key={d.kod}
                cx="21"
                cy="21"
                r={DONUT_YARICAP}
                fill="none"
                stroke={d.renk}
                strokeWidth="5"
                strokeDasharray={`${uzunluk} ${100 - uzunluk}`}
                strokeDashoffset={-d.baslangicYuzde}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold leading-none tabular-nums text-white">{toplam}</span>
          <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-widest text-sky-500">talep</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {dilimler.map((d) => (
          <li key={d.kod} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.renk }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-white">{d.ad}</span>
            <span className="shrink-0 font-bold tabular-nums text-white">{d.adet}</span>
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-sky-100">
              {Math.round(d.yuzde)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Günlük seri için mini çubuk grafik ────────────────────
type GrafikGunu = { anahtar: Date; deger: number; ipucu: string };

function MiniGrafik({ baslik, renk, ozet, gunler }: { baslik: string; renk: string; ozet: string; gunler: GrafikGunu[] }) {
  const enYuksek = gunler.reduce((enBuyuk, gun) => Math.max(enBuyuk, gun.deger), 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-sky-500">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: renk }} />
          {baslik}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-sky-100">{ozet}</span>
      </div>
      <div
        role="img"
        aria-label={`${baslik}. ${gunler.map((gun) => gun.ipucu).join(", ")}`}
        className="flex h-24 items-end gap-1.5 sm:gap-2"
      >
        {gunler.map((gun, i) => {
          const dunBugun = i === gunler.length - 1;
          const yuzde = enYuksek > 0 ? Math.round((gun.deger / enYuksek) * 100) : 0;
          return (
            <div
              key={gun.anahtar.toISOString()}
              title={gun.ipucu}
              className={`w-full min-w-0 flex-1 rounded-t ${gun.deger > 0 ? "" : "h-1"}`}
              style={
                gun.deger > 0
                  ? { height: `${Math.max(yuzde, 4)}%`, backgroundColor: renk, opacity: dunBugun ? 1 : 0.5 }
                  : { backgroundColor: "var(--surface-border)" }
              }
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {gunler.map((gun, i) => (
          <span
            key={gun.anahtar.toISOString()}
            className={`min-w-0 flex-1 text-center text-[10px] font-extrabold uppercase ${i === gunler.length - 1 ? "text-[#f5c518]" : "text-sky-500"}`}
          >
            {GUN_KISA.format(gun.anahtar)}
          </span>
        ))}
      </div>
    </div>
  );
}

function HizliButon({ href, ikon: Ikon, etiket, birincil }: { href: string; ikon: LucideIcon; etiket: string; birincil?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform duration-150 ease-out active:scale-[0.97] ${
        birincil
          ? "bg-[#f5c518] text-[#0b1b3a] shadow-[0_2px_0_#7a5b08]"
          : "border border-[var(--surface-border)] bg-[var(--surface)] text-sky-100 hover:border-sky-500"
      }`}
    >
      <Ikon className="h-4 w-4" />
      {etiket}
    </Link>
  );
}