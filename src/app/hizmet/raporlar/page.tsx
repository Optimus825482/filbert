import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePagePermission } from "@/lib/rbac/guard";
import { kg, paraTL, tarihSaat } from "@/lib/format";
import { TALEP_ASAMALARI, TALEP_DURUM_ADLARI } from "@/lib/findik-isleme";
import { suAnMs } from "@/lib/zaman";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  PackageCheck,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

const GUN_MS = 24 * 60 * 60 * 1000;

type DurumOzeti = {
  kod: string;
  ad: string;
  adet: number;
  kg: number;
  tutar: number;
};

function ortalamaSure(damgalar: Array<[Date | null, Date | null]>): string {
  const gecerli = damgalar
    .filter(([bas, bit]: [Date | null, Date | null]) => bas && bit && bit.getTime() >= bas.getTime())
    .map(([bas, bit]: [Date | null, Date | null]) => (bit as Date).getTime() - (bas as Date).getTime());
  if (gecerli.length === 0) return "—";
  const ortMs = gecerli.reduce((t, s) => t + s, 0) / gecerli.length;
  const saat = ortMs / (60 * 60 * 1000);
  if (saat < 24) return `${saat.toFixed(1)} saat`;
  return `${(saat / 24).toFixed(1)} gün`;
}

export default async function HizmetRaporlariPage() {
  await requirePagePermission("HIZMET", "GORUNTULE");
  const firma = await getCurrentFirma();

  const kayitlar = await prisma.hizmetIslemi.findMany({
    where: { firmaId: firma.id },
    orderBy: [{ createdAt: "desc" }],
    take: 2000,
  });

  const ozetler = new Map<string, DurumOzeti>();
  for (const asama of TALEP_ASAMALARI) {
    ozetler.set(asama.kod, { kod: asama.kod, ad: asama.ad, adet: 0, kg: 0, tutar: 0 });
  }
  ozetler.set("IPTAL", { kod: "IPTAL", ad: "İptal", adet: 0, kg: 0, tutar: 0 });

  for (const k of kayitlar) {
    const ozet = ozetler.get(k.durum);
    if (!ozet) continue;
    ozet.adet += 1;
    ozet.kg += Number(k.kilo);
    ozet.tutar += Number(k.toplamTutar);
  }

  const teslimBekleyenler = kayitlar
    .filter((k) => k.durum === "TAMAMLANDI")
    .sort((a, b) => (a.tamamlandiAt?.getTime() ?? 0) - (b.tamamlandiAt?.getTime() ?? 0));

  const bildirimBekleyenler = teslimBekleyenler.filter((k) => !k.tamamlandiSmsGonderildi);

  const teslimEdilipTahsilEdilmeyenler = kayitlar.filter(
    (k) => k.durum === "TESLIM_EDILDI" && k.odemeDurumu !== "ODENDI"
  );

  const simdiMs = suAnMs();
  const uzunBekleyenler = kayitlar.filter(
    (k) => k.durum === "SIRAYA_ALINDI" && simdiMs - k.createdAt.getTime() > 3 * GUN_MS
  );

  const ortalamaKirim = ortalamaSure(kayitlar.map((k) => [k.createdAt, k.kirimAt]));
  const ortalamaKavurma = ortalamaSure(kayitlar.map((k) => [k.kirimAt, k.kavurmaAt]));
  const ortalamaPaketleme = ortalamaSure(kayitlar.map((k) => [k.kavurmaAt, k.paketlemeAt]));
  const ortalamaTamamlama = ortalamaSure(kayitlar.map((k) => [k.createdAt, k.tamamlandiAt]));
  const ortalamaTeslim = ortalamaSure(kayitlar.map((k) => [k.tamamlandiAt, k.teslimAt]));

  const hazirToplamKg = teslimBekleyenler.reduce((t, k) => t + Number(k.kilo), 0);
  const tahsilBekleyenTl = teslimEdilipTahsilEdilmeyenler.reduce((t, k) => t + Number(k.toplamTutar), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Fındık İşleme · Durum Raporları
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-sky-200">
            Bekleyen, üretimde, hazır ve teslim edilen taleplerin aşama bazlı takibi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/hizmet/raporlar/csv"
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Tümünü CSV İndir
          </a>
          <Link
            href="/hizmet"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Talep Listesi
          </Link>
        </div>
      </div>

      {/* ─── Durum Dağılımı ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-extrabold text-white">Durum Dağılımı</h2>
          <span className="text-xs font-bold text-sky-300">{kayitlar.length} talep (son 2000)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-wider text-sky-200">
              <tr>
                <th className="px-4 py-2.5">Durum</th>
                <th className="px-4 py-2.5 text-right">Talep</th>
                <th className="px-4 py-2.5 text-right">Miktar</th>
                <th className="px-4 py-2.5 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {Array.from(ozetler.values()).map((o) => (
                <tr key={o.kod} className="hover:bg-white/5">
                  <td className="px-4 py-2.5 font-bold text-white">{o.ad}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-black text-white">{o.adet}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sky-200">{kg(o.kg)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#f5c518]">{paraTL(o.tutar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Aşama Süreleri ─── */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-extrabold text-white">
          <TrendingUp className="h-4 w-4 text-[#f5c518]" /> Ortalama Aşama Süreleri
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { ad: "Talep → Kırım", deger: ortalamaKirim },
            { ad: "Kırım → Kavurma", deger: ortalamaKavurma },
            { ad: "Kavurma → Paketleme", deger: ortalamaPaketleme },
            { ad: "Talep → Tamamlanma", deger: ortalamaTamamlama },
            { ad: "Tamamlanma → Teslim", deger: ortalamaTeslim },
          ].map((s) => (
            <div key={s.ad} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">{s.ad}</div>
              <div className="mt-1 font-mono text-lg font-black text-white">{s.deger}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Teslimat · Hazırlananlar ─── */}
      <section className="rounded-2xl border border-purple-500/30 bg-purple-950/20 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <PackageCheck className="h-4 w-4 text-purple-300" />
            Teslimat · Hazırlananlar
            <span className="rounded-full bg-purple-500/25 px-2 py-0.5 font-mono text-xs text-purple-200">
              {teslimBekleyenler.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-sky-200">
            <span>
              Toplam {kg(hazirToplamKg)} — bildirim gönderilmemiş:{" "}
              <b className="text-amber-300">{bildirimBekleyenler.length}</b>
            </span>
            <a
              href="/api/hizmet/raporlar/csv?liste=teslimat"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-white/10 hover:text-white"
            >
              <Download className="h-3 w-3" /> CSV
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-wider text-sky-200">
              <tr>
                <th className="px-4 py-2.5">Sıra</th>
                <th className="px-4 py-2.5">Müşteri</th>
                <th className="px-4 py-2.5 text-right">Miktar</th>
                <th className="px-4 py-2.5 text-right">Tutar</th>
                <th className="px-4 py-2.5">Tamamlanma</th>
                <th className="px-4 py-2.5 text-center">Bildirim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teslimBekleyenler.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sky-400">
                    Teslim bekleyen hazır talep yok.
                  </td>
                </tr>
              ) : (
                teslimBekleyenler.slice(0, 50).map((k) => (
                  <tr key={k.id} className="hover:bg-white/5">
                    <td className="px-4 py-2.5 font-mono font-black text-[#f5c518]">#{k.siraNo}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white">{k.musteriAdi}</div>
                      <div className="font-mono text-xs text-sky-300">{k.telefon}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white">{kg(Number(k.kilo))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#f5c518]">
                      {paraTL(Number(k.toplamTutar))}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-sky-200">
                      {k.tamamlandiAt ? tarihSaat(k.tamamlandiAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {k.tamamlandiSmsGonderildi ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {k.teslimSmsSayisi}× gönderildi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300">
                          <BellRing className="h-3.5 w-3.5" /> Gönderilmedi
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-xs text-sky-200">
          Yeniden bildirim göndermek için{" "}
          <Link href="/hizmet" className="font-bold text-[#f5c518] underline">
            Talep Listesi
          </Link>{" "}
          ekranındaki <b>&quot;Teslimat · Hazırlanan&quot;</b> hızlı listesini kullanın; kayıtları
          seçip <b>&quot;Seçilenlere SMS Gönder&quot;</b> ile toplu bildirim yapabilirsiniz.
        </div>
      </section>

      {/* ─── Tahsilat Bekleyen Teslimler ─── */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            Teslim Edildi · Tahsilat Bekliyor
            <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 font-mono text-xs text-emerald-200">
              {teslimEdilipTahsilEdilmeyenler.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-200">
            <span>Toplam {paraTL(tahsilBekleyenTl)}</span>
            <a
              href="/api/hizmet/raporlar/csv?liste=tahsilat"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-white/10 hover:text-white"
            >
              <Download className="h-3 w-3" /> CSV
            </a>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {teslimEdilipTahsilEdilmeyenler.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-sky-400">
              Tahsilat bekleyen teslim yok.
            </div>
          ) : (
            teslimEdilipTahsilEdilmeyenler.slice(0, 25).map((k) => (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-[#f5c518]">#{k.siraNo}</span>
                  <span className="font-bold text-white">{k.musteriAdi}</span>
                  <span className="font-mono text-xs text-sky-300">{k.telefon}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-sky-200">{kg(Number(k.kilo))}</span>
                  <span className="font-mono font-bold text-[#f5c518]">{paraTL(Number(k.toplamTutar))}</span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
                    {k.odemeDurumu === "VERESIYE" ? "Veresiye" : "Ödenmedi"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ─── Uzun Süre Bekleyenler ─── */}
      <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Clock className="h-4 w-4 text-amber-300" />
            3 Günden Fazla Bekleyenler
            <span className="rounded-full bg-amber-500/25 px-2 py-0.5 font-mono text-xs text-amber-200">
              {uzunBekleyenler.length}
            </span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {uzunBekleyenler.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-sky-400">
              Uzun süredir bekleyen talep yok.
            </div>
          ) : (
            uzunBekleyenler.slice(0, 25).map((k) => (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-[#f5c518]">#{k.siraNo}</span>
                  <span className="font-bold text-white">{k.musteriAdi}</span>
                  <span className="font-mono text-xs text-sky-300">{k.telefon}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-sky-200">{kg(Number(k.kilo))}</span>
                  <span className="text-amber-300">
                    {Math.floor((simdiMs - k.createdAt.getTime()) / GUN_MS)} gündür bekliyor
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ─── Kullanılmayan durum adları sözlüğü ile tutarlılık notu ─── */}
      <p className="text-[11px] text-sky-400">
        Durum adları: {TALEP_ASAMALARI.map((a) => TALEP_DURUM_ADLARI[a.kod]).join(" · ")} · İptal
      </p>
    </div>
  );
}
