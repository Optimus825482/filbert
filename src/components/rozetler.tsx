import { cn } from "@/lib/utils";
import { paraBirim } from "@/lib/format";

const RENK: Record<string, string> = {
  TL: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
  USD: "bg-sky-900/60 text-sky-200 border-sky-700",
  EUR: "bg-indigo-900/60 text-indigo-200 border-indigo-700",
  XAU: "bg-amber-900/60 text-amber-200 border-amber-700",
  FINDIK_KG: "bg-orange-900/60 text-orange-200 border-orange-700",
};

export function BakiyeRozet({ tur, tutar }: { tur: string; tutar: number }) {
  if (Math.abs(tutar) < 0.0005) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums",
        RENK[tur] ?? "bg-muted"
      )}
    >
      {paraBirim(tutar, tur)}
    </span>
  );
}

export function DurumRozet({ durum }: { durum: string }) {
  const map: Record<string, { etiket: string; sinif: string }> = {
    TASLAK: { etiket: "Taslak", sinif: "bg-amber-900/70 text-amber-200" },
    ONAYLI: { etiket: "Onaylı", sinif: "bg-emerald-900/70 text-emerald-200" },
    IPTAL: { etiket: "İptal", sinif: "bg-red-900/70 text-red-200" },
    HAZIRLANIYOR: { etiket: "Hazırlanıyor", sinif: "bg-slate-700 text-sky-100" },
    YOLDA: { etiket: "Yolda", sinif: "bg-sky-900/70 text-sky-200" },
    TESLIM_EDILDI: { etiket: "Teslim edildi", sinif: "bg-emerald-900/70 text-emerald-200" },
    BEKLIYOR: { etiket: "Randıman Bekliyor", sinif: "bg-amber-900/70 text-amber-200" },
    TAMAM: { etiket: "Randıman Tamam", sinif: "bg-emerald-900/70 text-emerald-200" },
    ACIK: { etiket: "Açık", sinif: "bg-sky-900/70 text-sky-200" },
    KISMI_BOZULDU: { etiket: "Kısmen Bozuldu", sinif: "bg-amber-900/70 text-amber-200" },
    KAPANDI: { etiket: "Kapandı", sinif: "bg-slate-700 text-sky-100" },
  };
  const d = map[durum] ?? { etiket: durum, sinif: "bg-slate-700 text-sky-100" };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", d.sinif)}>{d.etiket}</span>;
}
