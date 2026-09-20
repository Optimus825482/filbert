import Link from "next/link";
import {
  ShoppingBasket, Wallet, Users, FileBarChart, PackageOpen,
  HandCoins, PiggyBank, Receipt, Plus, ArrowRight, ChevronRight,
  BellRing, CheckCircle2, Warehouse, PackageCheck, type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getDashboardOzet, getSonGunlerAlim, getStokOzet } from "@/lib/queries";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { kg, tarihSaat, puan } from "@/lib/format";
import { DurumRozet } from "@/components/rozetler";
import { istanbulGunAraligi } from "@/lib/zaman";

export const dynamic = "force-dynamic";

// Tarih etiketleri sabit saat diliminde üretilir; sunucu saat dilimi farkı
// gün adlarını kaydırmaz.
const GUN_KISA = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short" });
const GUN_UZUN = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });
const BUGUN_UZUN = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long", year: "numeric",
});

// Pano yüzeyleri tek bir sözlükten gelir: aynı panel, aynı kenar.
const PANEL = "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]";
const PANEL_BASLIK = "flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-4 py-3";
const SATIR_HOVER = "transition-colors hover:bg-white/5";

type BekleyenSatir = { href: string; ikon: LucideIcon; etiket: string; rozet: string };

export default async function AnaSayfa() {
  const actor = await requirePagePermission("DASHBOARD", "GORUNTULE");
  const izinli = (modul: Parameters<typeof izinVar>[1], eylem: Parameters<typeof izinVar>[2]) => izinVar(actor, modul, eylem);
  const izinler = {
    alim: izinli("ALIM", "GORUNTULE"),
    randiman: izinli("RANDIMAN", "GORUNTULE"),
    stok: izinli("STOK", "GORUNTULE"),
    emanet: izinli("EMANET", "GORUNTULE"),
    finans: izinli("FINANS", "GORUNTULE"),
    hizmet: izinli("HIZMET", "GORUNTULE"),
  };
  // İş günü sınırı İstanbul'a göre belirlenir; başlıktaki tarih de buradan gelir.
  const { baslangic: bugunBas } = istanbulGunAraligi();
  const bosTrend: Awaited<ReturnType<typeof getSonGunlerAlim>> = [];
  const bosStok: Awaited<ReturnType<typeof getStokOzet>> = [];
  // Pano parasal veri çekmez: tutar/kur yalnızca finans ve rapor ekranlarında okunur.
  const [ozet, bekleyenFinansTaslagi, alimTrendi, depoStok, bekleyenHizmetSayisi] = await Promise.all([
    getDashboardOzet(),
    izinler.finans ? prisma.finansTaslagi.count({ where: { firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] }, hatirlatmaAt: { lte: new Date() } } }) : Promise.resolve(0),
    izinler.alim ? getSonGunlerAlim(7) : Promise.resolve(bosTrend),
    izinler.stok ? getStokOzet() : Promise.resolve(bosStok),
    izinler.hizmet ? prisma.hizmetIslemi.count({ where: { firmaId: actor.firmaId, durum: { in: ["SIRAYA_ALINDI", "HAZIRLANIYOR"] } } }) : Promise.resolve(0),
  ]);
  const bekleyenRandiman = ozet.bekleyenRandiman;
  const sonFisler = ozet.sonFisler;
  const trendToplamKg = alimTrendi.reduce((toplam, gun) => toplam + gun.kg, 0);
  const enYuksekGunKg = alimTrendi.reduce((enBuyuk, gun) => Math.max(enBuyuk, gun.kg), 0);
  const depoSirali = [...depoStok].sort((a, b) => b.kendiKg - a.kendiKg).slice(0, 5);
  const enYuksekDepoKg = depoSirali.reduce((enBuyuk, depo) => Math.max(enBuyuk, depo.kendiKg), 0);

  // Yalnızca gerçekten bekleyen, işlem gerektiren satırlar listelenir.
  const bekleyenler: BekleyenSatir[] = [];
  if (izinler.randiman && bekleyenRandiman > 0) {
    bekleyenler.push({ href: "/randiman", ikon: HandCoins, etiket: "Randıman bekleyen fiş", rozet: `${bekleyenRandiman} fiş` });
  }
  if (izinler.finans && bekleyenFinansTaslagi > 0) {
    bekleyenler.push({ href: "/finans-taslaklari", ikon: BellRing, etiket: "İnceleme bekleyen sesli taslak", rozet: `${bekleyenFinansTaslagi} kayıt` });
  }
  if (izinler.emanet && ozet.emanetKgBorcumuz > 0) {
    bekleyenler.push({ href: "/emanet", ikon: PackageOpen, etiket: "Üreticilere emanet borcu", rozet: kg(ozet.emanetKgBorcumuz) });
  }
  if (izinler.hizmet && bekleyenHizmetSayisi > 0) {
    bekleyenler.push({ href: "/hizmet", ikon: PackageCheck, etiket: "Kırma/paketleme bekleyen", rozet: `${bekleyenHizmetSayisi} sipariş` });
  }

  return (
    <>
      {/* ═══════════ MOBİL GÖRÜNÜM (md altı) ═══════════ */}
      <div className="space-y-4 pb-2 md:hidden">
        <div className="grid grid-cols-2 gap-3">
          {izinli("ALIM", "GORUNTULE") && <MobilModul href="/mod/findik" etiket={"Fındık\nİşlemleri"} ikon={ShoppingBasket} badge={bekleyenRandiman} />}
          {izinli("FINANS", "GORUNTULE") && <MobilModul href="/mod/finans" etiket={"Finans\nİşlemleri"} ikon={Wallet} />}
          {izinli("CARI", "GORUNTULE") && <MobilModul href="/mod/musteri" etiket={"Müşteri\nİşlemleri"} ikon={Users} />}
          {izinli("RAPORLAR", "GORUNTULE") && <MobilModul href="/mod/rapor" etiket="Raporlar" ikon={FileBarChart} />}
        </div>
        {izinler.alim && <div className="rounded-2xl border border-[var(--surface-border)] bg-white/5 px-4 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-100">BUGÜN</div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-sky-100"><b className="tabular-nums text-white">{ozet.bugunFisAdet}</b> fiş</span>
            <span className="text-sky-100">Alım <b className="tabular-nums text-[#f5c518]">{kg(ozet.bugunAlimKg)}</b></span>
          </div>
        </div>}
        <FinansTaslagiUyarisi adet={bekleyenFinansTaslagi} />
      </div>

      {/* ═══════════ MASAÜSTÜ GÖRÜNÜM (md+) ═══════════ */}
      <div className="hidden gap-4 md:grid md:grid-cols-12">

        {/* ── Komut şeridi: başlık, tarih, hızlı işlemler ── */}
        <section className="flex flex-wrap items-end justify-between gap-3 md:col-span-12">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Pano</h1>
            <p className="mt-0.5 text-xs font-semibold text-sky-100">{BUGUN_UZUN.format(bugunBas)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {izinli("ALIM", "OLUSTUR") && <HizliButon href="/alim/yeni" ikon={Plus} etiket="Yeni Alım Fişi" birincil />}
            {izinli("HIZMET", "OLUSTUR") && <HizliButon href="/hizmet/yeni" ikon={PackageCheck} etiket="Kırma & Paketleme" />}
            {izinli("EMANET", "OLUSTUR") && <HizliButon href="/emanet" ikon={PackageOpen} etiket="Emanet Boz" />}
            {izinli("FINANS", "OLUSTUR") && <HizliButon href="/finans/odeme" ikon={HandCoins} etiket="Ödeme" />}
            {izinli("AVANS", "OLUSTUR") && <HizliButon href="/avans" ikon={PiggyBank} etiket="Avans Ver" />}
            {izinli("MASRAF", "OLUSTUR") && <HizliButon href="/masraf" ikon={Receipt} etiket="Masraf" />}
          </div>
        </section>

        {/* ── Metrik şeridi: tek yüzey, aradaki çizgiler yüzeyden gelir ── */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-border)] sm:grid-cols-3 md:col-span-12 xl:grid-cols-4">
          {izinler.alim && <Metrik baslik="BUGÜNKÜ ALIM" deger={kg(ozet.bugunAlimKg)} alt={`${ozet.bugunFisAdet} fiş`} href="/alim" />}
          {izinler.randiman && <Metrik baslik="RANDIMAN BEKLEYEN" deger={String(bekleyenRandiman)} alt={bekleyenRandiman > 0 ? "giriş bekliyor" : "bekleyen yok"} vurgu={bekleyenRandiman > 0} href="/randiman" />}
          {izinler.stok && <Metrik baslik="STOK (KENDİ)" deger={kg(ozet.stokKendi)} alt={izinler.emanet ? `Emanette ${kg(ozet.stokEmanet)}` : undefined} href="/stok" />}
          {izinler.emanet && <Metrik baslik="EMANET BORCUMUZ" deger={kg(ozet.emanetKgBorcumuz)} alt="üreticilere kg olarak" vurgu={ozet.emanetKgBorcumuz > 0} href="/emanet" />}
        </section>

        {/* ── Alım trendi + bekleyen işler ── */}
        {izinler.alim && <section className={`md:col-span-12 lg:col-span-8 ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-white">Son 7 gün · onaylı alım</h2>
              <p className="mt-0.5 text-xs font-semibold text-sky-100">Toplam {kg(trendToplamKg)}</p>
            </div>
            <Link href="/raporlar" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Günlük rapor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-4 py-4">
            <div
              role="img"
              aria-label={`Son 7 günün onaylı alım miktarı. ${alimTrendi.map((gun) => `${GUN_UZUN.format(gun.anahtar)} ${kg(gun.kg)}`).join(", ")}`}
              className="flex h-32 items-end gap-1.5 sm:gap-2"
            >
              {alimTrendi.map((gun, i) => {
                const bugun = i === alimTrendi.length - 1;
                const yuzde = enYuksekGunKg > 0 ? Math.round((gun.kg / enYuksekGunKg) * 100) : 0;
                return (
                  <div key={gun.anahtar.toISOString()} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
                    <div
                      title={`${GUN_UZUN.format(gun.anahtar)} · ${kg(gun.kg)} · ${gun.adet} fiş`}
                      className={`w-full rounded-t ${bugun ? "bg-[#f5c518]" : "bg-sky-400/40"} ${gun.kg > 0 ? "" : "h-1"}`}
                      style={gun.kg > 0 ? { height: `${Math.max(yuzde, 4)}%` } : undefined}
                    />
                    <span className={`text-center text-[10px] font-extrabold uppercase ${bugun ? "text-[#f5c518]" : "text-sky-500"}`}>
                      {GUN_KISA.format(gun.anahtar)}
                    </span>
                  </div>
                );
              })}
            </div>
            {trendToplamKg === 0 && (
              <p className="mt-3 text-center text-xs font-semibold text-sky-100">Son 7 günde onaylı alım kaydı yok. Yeni bir alım fişiyle başlayın.</p>
            )}
          </div>
        </section>}

        <section className={`md:col-span-12 ${izinler.alim ? "lg:col-span-4" : "lg:col-span-12"} ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Yapılacaklar</h2>
            <span className="text-xs font-bold tabular-nums text-sky-500">{bekleyenler.length}</span>
          </div>
          {bekleyenler.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-sky-100">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              Bekleyen iş yok. Tüm fişler işlenmiş durumda.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {bekleyenler.map((satir) => (
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

        {/* ── Defter + depo dağılımı ── */}
        {izinler.alim && <section className={`md:col-span-12 ${izinler.stok ? "lg:col-span-8" : "lg:col-span-12"} ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="text-sm font-extrabold tracking-tight text-white">Son alım fişleri</h2>
            <Link href="/alim" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Tümü <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-left text-[10px] uppercase tracking-wider text-sky-500">
                  <th className="px-4 py-2.5 font-bold">Fiş / Üretici</th>
                  <th className="px-3 py-2.5 font-bold">Tarih</th>
                  <th className="px-3 py-2.5 font-bold text-right">Net kg</th>
                  <th className="px-3 py-2.5 font-bold text-right">Randıman</th>
                  <th className="px-4 py-2.5 font-bold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sonFisler.map((f) => (
                  <tr key={f.id} className={`border-b border-[var(--surface-border)] ${SATIR_HOVER}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white">{f.cari.ad}</div>
                      <div className="text-xs tabular-nums text-sky-500">{f.fisNo}{f.satinAlmaKodu ? ` · ${f.satinAlmaKodu}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-sky-100">{tarihSaat(f.tarih)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">{kg(Number(f.kg))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sky-100">{f.randimanPuan ? puan(f.randimanPuan) : "—"}</td>
                    <td className="px-4 py-2.5"><DurumRozet durum={f.randimanDurumu} /></td>
                  </tr>
                ))}
                {sonFisler.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-sky-100">Henüz alım fişi yok. İlk fişi oluşturduğunuzda burada listelenir.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>}

        {izinler.stok && <section className={`md:col-span-12 ${izinler.alim ? "lg:col-span-4" : "lg:col-span-12"} ${PANEL}`}>
          <div className={PANEL_BASLIK}>
            <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white">
              <Warehouse className="h-4 w-4 text-sky-100" /> Depo stok durumu
            </h2>
            <Link href="/stok" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
              Tümü <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {depoSirali.length === 0 ? (
            <p className="px-4 py-6 text-sm text-sky-100">Tanımlı depo yok. Ayarlar bölümünden depo ekleyin.</p>
          ) : (
            <ul className="divide-y divide-[var(--surface-border)]">
              {depoSirali.map((depo) => (
                <li key={depo.depo} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-white">{depo.depo}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">{kg(depo.kendiKg)}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-border)]">
                    <div
                      className="h-full rounded-full bg-[#f5c518]"
                      style={{ width: `${enYuksekDepoKg > 0 ? Math.round((depo.kendiKg / enYuksekDepoKg) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs font-semibold text-sky-100">
                    {depo.emanetKg > 0 ? `Emanette ${kg(depo.emanetKg)}` : "Emanet kaydı yok"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>}
      </div>
    </>
  );
}

function FinansTaslagiUyarisi({ adet }: { adet: number }) {
  if (!adet) return null;
  return <Link href="/finans-taslaklari" className="flex items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm transition-colors hover:bg-amber-400/15"><span><b className="text-amber-300">{adet} sesli finans taslağı</b><span className="text-sky-100"> inceleme ve kayda dönüştürme bekliyor.</span></span><span className="text-xs font-extrabold text-amber-300">İncele →</span></Link>;
}

// ─── Mobil modül kartı ─────────────────────────────────────
function MobilModul({ href, etiket, ikon: Ikon, badge }: { href: string; etiket: string; ikon: LucideIcon; badge?: number }) {
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

// ─── Masaüstü metrik hücresi (şerit içinde tek yüzey) ───────
function Metrik({ baslik, deger, alt, vurgu, href }: { baslik: string; deger: string; alt?: string; vurgu?: boolean; href?: string }) {
  const icerik = (
    <div className="flex h-full flex-col justify-between gap-2 bg-[var(--surface)] px-4 py-3">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">{baslik}</div>
      <div>
        <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${vurgu ? "text-[#f5c518]" : "text-white"}`}>{deger}</div>
        {alt && <div className="mt-0.5 truncate text-xs font-semibold text-sky-100">{alt}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className={`block h-full ${SATIR_HOVER}`}>{icerik}</Link> : icerik;
}

// ─── Masaüstü hızlı buton ──────────────────────────────────
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
