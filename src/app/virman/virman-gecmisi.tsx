import { ArrowRightLeft } from "lucide-react";
import { n } from "@/lib/queries";
import { paraBirim, tarihSaat } from "@/lib/format";
import { FinansHareket, KasaHesap } from "@/generated/prisma/client";

type Hesap = Pick<KasaHesap, "ad" | "bakiyeTuru">;
type VirmanRow = FinansHareket & { hesap: Hesap };

interface Props {
  virmanlar: VirmanRow[];
}

export function VirmanGecmisi({ virmanlar }: Props) {
  if (virmanlar.length === 0) {
    return (
      <div className="ozet-kart">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
            <ArrowRightLeft className="h-4 w-4 text-sky-100" />
          </div>
          <h3 className="text-base font-bold text-[var(--app-fg)]">Geçmiş Virmanlar</h3>
        </div>
        <p className="mt-2 text-sm text-sky-100">Henüz virman işlemi yok.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
          <ArrowRightLeft className="h-4 w-4 text-sky-100" />
        </div>
        <h3 className="text-base font-bold text-[var(--app-fg)]">Geçmiş Virmanlar</h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-sky-100">
          {virmanlar.length}
        </span>
      </div>

      {/* Mobile: card layout */}
      <div className="space-y-2 md:hidden">
        {virmanlar.map((v) => {
          const isCikis = Number(v.tutar) < 0;
          const mutlakTutar = Math.abs(n(v.tutar));
          return (
            <div key={v.id} className="ozet-kart flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                      isCikis ? "bg-red-900/50 text-red-300" : "bg-emerald-900/50 text-emerald-300"
                    }`}
                  >
                    {isCikis ? "CIK" : "GIR"}
                  </span>
                  <span className="text-sm font-semibold text-[var(--app-fg)]">
                    {v.hesap.ad}
                  </span>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isCikis ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {isCikis ? "-" : "+"}
                  {paraBirim(mutlakTutar, v.hesap.bakiyeTuru)}
                </span>
              </div>
              {v.aciklama && (
                <p className="text-xs text-sky-100">{v.aciklama}</p>
              )}
              <p className="text-[11px] text-sky-500">{tarihSaat(v.createdAt)}</p>
            </div>
          );
        })}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block">
        <div className="relative w-full overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-sky-100">
                  Tarih
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-sky-100">
                  Hesap
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-sky-100">
                  Yön
                </th>
                <th className="h-10 px-3 text-right align-middle text-xs font-semibold uppercase tracking-wide text-sky-100">
                  Tutar
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-sky-100">
                  Açıklama
                </th>
              </tr>
            </thead>
            <tbody>
              {virmanlar.map((v) => {
                const isCikis = Number(v.tutar) < 0;
                const mutlakTutar = Math.abs(n(v.tutar));
                return (
                  <tr
                    key={v.id}
                    className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40"
                  >
                    <td className="p-3 align-middle whitespace-nowrap text-xs text-sky-100">
                      {tarihSaat(v.createdAt)}
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap text-sm font-medium text-[var(--app-fg)]">
                      {v.hesap.ad}
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          isCikis
                            ? "bg-red-900/40 text-red-300"
                            : "bg-emerald-900/40 text-emerald-300"
                        }`}
                      >
                        {isCikis ? "ÇIKIŞ" : "GİRİŞ"}
                      </span>
                    </td>
                    <td
                      className={`p-3 text-right align-middle whitespace-nowrap text-sm font-bold tabular-nums ${
                        isCikis ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {isCikis ? "-" : "+"}
                      {paraBirim(mutlakTutar, v.hesap.bakiyeTuru)}
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap text-xs text-sky-100">
                      {v.aciklama || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
