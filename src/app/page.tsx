import Link from "next/link";
import {
  ShoppingBasket, Wallet, Users, FileBarChart, PackageOpen,
  HandCoins, PiggyBank, Receipt, Plus, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getDashboardOzet } from "@/lib/queries";
import { izinVar, requirePagePermission } from "@/lib/rbac/guard";
import { kg, paraTL, tarihSaat, puan } from "@/lib/format";
import { DurumRozet } from "@/components/rozetler";
import { istanbulGunAraligi } from "@/lib/zaman";

export const dynamic = "force-dynamic";

export default async function AnaSayfa() {
  const actor = await requirePagePermission("DASHBOARD", "GORUNTULE");
  const izinli = (modul: Parameters<typeof izinVar>[1], eylem: Parameters<typeof izinVar>[2]) => izinVar(actor, modul, eylem);
  const izinler = {
    alim: izinli("ALIM", "GORUNTULE"),
    randiman: izinli("RANDIMAN", "GORUNTULE"),
    stok: izinli("STOK", "GORUNTULE"),
    emanet: izinli("EMANET", "GORUNTULE"),
    finans: izinli("FINANS", "GORUNTULE"),
  };
  const { baslangic: bugunBas } = istanbulGunAraligi();
  const [ozet, bekleyenFinansTaslagi, odeme] = await Promise.all([
    getDashboardOzet(),
    izinler.finans ? prisma.finansTaslagi.count({ where: { firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] }, hatirlatmaAt: { lte: new Date() } } }) : Promise.resolve(0),
    izinler.finans ? prisma.finansHareket.aggregate({ where: { createdAt: { gte: bugunBas }, tip: "ODEME", durum: "ONAYLI", hesap: { firmaId: actor.firmaId } }, _sum: { tutar: true } }) : Promise.resolve({ _sum: { tutar: null } }),
  ]);
  const bekleyenRandiman = ozet.bekleyenRandiman;
  const sonFisler = ozet.sonFisler;
  const odemeTutar = Number(odeme._sum.tutar ?? 0);

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
        {(izinler.alim || izinler.finans) && <div className="rounded-2xl border border-[var(--surface-border)] bg-white/5 px-4 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-100">BUGÜN</div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            {izinler.alim && <><span className="text-sky-100"><b className="tabular-nums text-white">{ozet.bugunFisAdet}</b> fiş · <b className="tabular-nums text-white">{kg(ozet.bugunAlimKg)}</b></span><span className="text-sky-100">Alım <b className="tabular-nums text-[#f5c518]">{paraTL(ozet.bugunAlimTutar)}</b></span></>}
            {izinler.finans && <span className="text-sky-100">Ödeme <b className="tabular-nums text-[#f5c518]">{paraTL(odemeTutar)}</b></span>}
          </div>
        </div>}
        <FinansTaslagiUyarisi adet={bekleyenFinansTaslagi} />
      </div>

      {/* ═══════════ MASAÜSTÜ GÖRÜNÜM (md+) ═══════════ */}
      <div className="hidden space-y-5 md:block">
        {/* KPI rayı */}
        <section className="grid grid-cols-4 gap-4">
          {izinler.alim && <Kpi baslik="BUGÜNKÜ ALIM" deger={kg(ozet.bugunAlimKg)} alt={`${ozet.bugunFisAdet} fiş · ${paraTL(ozet.bugunAlimTutar)}`} aksan />}
          {izinler.randiman && <Kpi baslik="RANDIMAN BEKLEYEN" deger={String(bekleyenRandiman)} alt="fiş tamamlanmayı bekliyor" uyari={bekleyenRandiman > 0} href="/randiman" />}
          {izinler.stok && <Kpi baslik="STOK (KENDİ)" deger={kg(ozet.stokKendi)} alt={izinler.emanet ? `Emanette: ${kg(ozet.stokEmanet)}` : undefined} href="/stok" />}
          {izinler.emanet && <Kpi baslik="EMANET BORCUMUZ" deger={kg(ozet.emanetKgBorcumuz)} alt="üreticilere kg olarak" uyari={ozet.emanetKgBorcumuz > 0} href="/emanet" />}
        </section>
        <FinansTaslagiUyarisi adet={bekleyenFinansTaslagi} />

        {/* Hızlı işlemler */}
        <section className="flex flex-wrap gap-2">
          {izinli("ALIM", "OLUSTUR") && <HizliButon href="/alim/yeni" ikon={Plus} etiket="Yeni Alım Fişi" birincil />}
          {izinli("EMANET", "OLUSTUR") && <HizliButon href="/emanet" ikon={PackageOpen} etiket="Emanet Boz" />}
          {izinli("FINANS", "OLUSTUR") && <HizliButon href="/finans/odeme" ikon={HandCoins} etiket="Ödeme" />}
          {izinli("AVANS", "OLUSTUR") && <HizliButon href="/avans" ikon={PiggyBank} etiket="Avans Ver" />}
          {izinli("MASRAF", "OLUSTUR") && <HizliButon href="/masraf" ikon={Receipt} etiket="Masraf" />}
        </section>

        {/* Defter — son fişler tablosu */}
        {izinler.alim && <section className="rounded-2xl border border-slate-800 bg-[#0a1830]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <h2 className="text-sm font-extrabold tracking-tight">Son Alım Fişleri</h2>
              <Link href="/alim" className="flex items-center gap-1 text-xs font-bold text-[#f5c518]">
                Tümü <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-sky-500">
                  <th className="px-5 py-2.5 font-bold">Fiş / Üretici</th>
                  <th className="px-3 py-2.5 font-bold">Tarih</th>
                  <th className="px-3 py-2.5 font-bold text-right">Net kg</th>
                  <th className="px-3 py-2.5 font-bold text-right">Randıman</th>
                  <th className="px-3 py-2.5 font-bold text-right">Tutar</th>
                  <th className="px-5 py-2.5 font-bold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sonFisler.map((f) => (
                  <tr key={f.id} className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <div className="font-bold">{f.cari.ad}</div>
                      <div className="text-xs tabular-nums text-sky-500">{f.fisNo}{f.satinAlmaKodu ? ` · ${f.satinAlmaKodu}` : ""}</div>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-sky-100">{tarihSaat(f.tarih)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{kg(Number(f.kg))}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-sky-100">{f.randimanPuan ? puan(f.randimanPuan) : "—"}</td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums text-[#f5c518]">{paraTL(f.tutar)}</td>
                    <td className="px-5 py-3"><DurumRozet durum={f.randimanDurumu} /></td>
                  </tr>
                ))}
                {sonFisler.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-sky-500">Henüz fiş yok.</td></tr>
                )}
              </tbody>
            </table>
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

// ─── Masaüstü KPI kartı ────────────────────────────────────
function Kpi({ baslik, deger, alt, aksan, uyari, href }: { baslik: string; deger: string; alt?: string; aksan?: boolean; uyari?: boolean; href?: string }) {
  const icerik = (
    <div className={`h-full rounded-2xl border p-4 ${aksan ? "border-[#f5c518]/40 bg-[#f5c518]/5" : "border-slate-800 bg-[#0a1830]"} transition-colors`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">{baslik}</div>
      <div className={`mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight ${uyari ? "text-amber-400" : "text-white"}`}>{deger}</div>
      {alt && <div className="mt-0.5 text-xs text-sky-500">{alt}</div>}
    </div>
  );
  return href ? <Link href={href} className="block transition-transform duration-150 ease-out hover:-translate-y-0.5">{icerik}</Link> : icerik;
}

// ─── Masaüstü hızlı buton ──────────────────────────────────
function HizliButon({ href, ikon: Ikon, etiket, birincil }: { href: string; ikon: LucideIcon; etiket: string; birincil?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform duration-150 ease-out active:scale-[0.97] ${
        birincil
          ? "bg-[#f5c518] text-[#0b1b3a] shadow-[0_2px_0_#7a5b08]"
          : "border border-slate-700 bg-[#0a1830] text-sky-100 hover:border-slate-600"
      }`}
    >
      <Ikon className="h-4 w-4" />
      {etiket}
    </Link>
  );
}
