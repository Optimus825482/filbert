import { cn } from "@/lib/utils";

export function OzetKart({
  baslik,
  deger,
  alt,
  ton = "normal",
}: {
  baslik: string;
  deger: string;
  alt?: string;
  ton?: "normal" | "yesil" | "amber" | "kirmizi";
}) {
  const tonlar = {
    normal: "text-foreground",
    yesil: "text-filbert-700",
    amber: "text-amber-600",
    kirmizi: "text-red-600",
  };
  return (
    <div className="ozet-kart">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums tracking-tight", tonlar[ton])}>{deger}</div>
      {alt && <div className="mt-0.5 text-xs text-muted-foreground">{alt}</div>}
    </div>
  );
}
