"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { finansTaslagiOnayla, finansTaslagiReddet } from "@/lib/actions/finans-taslagi";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { sayiCevir } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Taslak = { id: string; sesliNotId: string; cari: string; metin: string; sesVar: boolean; tip: string; tutar: number | null; paraBirimi: string | null };
type Hesap = { id: string; ad: string; paraBirimi: string };

export function FinansTaslaklari({ taslaklar, hesaplar, onayYetkisi, iptalYetkisi }: { taslaklar: Taslak[]; hesaplar: Hesap[]; onayYetkisi: boolean; iptalYetkisi: boolean }) {
  const [mesaj, setMesaj] = useState("");
  return <div className="space-y-3">
    {taslaklar.map((taslak) => <TaslakKart key={taslak.id} taslak={taslak} hesaplar={hesaplar} onayYetkisi={onayYetkisi} iptalYetkisi={iptalYetkisi} bildir={setMesaj} />)}
    {taslaklar.length === 0 && <div className="ozet-kart text-sm text-sky-100">İnceleme bekleyen finans taslağı yok.</div>}
    {mesaj && <p role="status" className="text-sm text-sky-100">{mesaj}</p>}
  </div>;
}

function TaslakKart({ taslak, hesaplar, onayYetkisi, iptalYetkisi, bildir }: { taslak: Taslak; hesaplar: Hesap[]; onayYetkisi: boolean; iptalYetkisi: boolean; bildir: (mesaj: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tip, setTip] = useState<"ODEME" | "TAHSILAT">(taslak.tip === "TAHSILAT" ? "TAHSILAT" : "ODEME");
  const [tutar, setTutar] = useState(taslak.tutar?.toString() ?? "");
  const [hesapId, setHesapId] = useState("");
  const para = (taslak.paraBirimi ?? "TL") as "TL" | "USD" | "EUR" | "XAU";
  const uygunHesaplar = hesaplar.filter((hesap) => hesap.paraBirimi === para);
  return <article className="ozet-kart space-y-3">
    <div className="flex justify-between gap-2"><div><b>{taslak.cari}</b><p className="mt-1 whitespace-pre-wrap text-sm text-sky-100">{taslak.metin}</p></div>{taslak.sesVar && <audio controls src={`/api/sesli-not/${taslak.sesliNotId}/ses-kaydi`} className="max-w-44" />}</div>
    {onayYetkisi && <div className="grid gap-2 sm:grid-cols-3">
      <Select value={tip} onValueChange={(value) => setTip(value as "ODEME" | "TAHSILAT")}><SelectTrigger className="h-10 w-full bg-slate-950 text-sky-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ODEME">Ödeme</SelectItem><SelectItem value="TAHSILAT">Tahsilat</SelectItem></SelectContent></Select>
      <Input value={tutar} onChange={(event) => setTutar(event.target.value)} inputMode="decimal" placeholder="Tutar" className="h-10 bg-slate-950 text-sky-50 placeholder:text-sky-200" />
      <Select value={hesapId} onValueChange={setHesapId}><SelectTrigger className="h-10 w-full bg-slate-950 text-sky-50"><SelectValue placeholder={`${para} hesabı seçin`} /></SelectTrigger><SelectContent>{uygunHesaplar.map((hesap) => <SelectItem key={hesap.id} value={hesap.id}>{hesap.ad}</SelectItem>)}</SelectContent></Select>
    </div>}
    {(onayYetkisi || iptalYetkisi) && <div className="flex gap-2">
      {onayYetkisi && <button type="button" disabled={pending || !hesapId || sayiCevir(tutar) <= 0} onClick={() => startTransition(async () => { const sonuc = await sunucuIslemi(() => finansTaslagiOnayla({ taslakId: taslak.id, hesapId, tip, tutar: sayiCevir(tutar), bakiyeTuru: para })); if (!sonuc) return; bildir(sonuc.ok ? "Finans kaydı oluşturuldu." : sonuc.hata ?? "Onaylanamadı"); if (sonuc.ok) router.refresh(); })} className="saha-btn bg-emerald-600 text-white"><Check className="h-4 w-4" />{pending ? "İşleniyor..." : "Onayla ve kaydet"}</button>}
      {iptalYetkisi && <button type="button" disabled={pending} onClick={() => startTransition(async () => { const sonuc = await sunucuIslemi(() => finansTaslagiReddet(taslak.id)); if (!sonuc) return; bildir(sonuc.ok ? "Taslak reddedildi." : sonuc.hata ?? "Reddedilemedi"); if (sonuc.ok) router.refresh(); })} className="saha-btn border border-red-500/50 text-red-200"><X className="h-4 w-4" />Reddet</button>}
    </div>}
  </article>;
}
