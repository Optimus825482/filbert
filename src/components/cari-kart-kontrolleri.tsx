"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, UserRound } from "lucide-react";
import { cariAktifliginiDegistir, cariGuncelle, cariOlustur, type CariGirdi } from "@/lib/actions/cari";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CariSatir = {
  id: string;
  ad: string;
  tur: "URETICI" | "TUCCAR" | "FABRIKA";
  tckn: string | null;
  vergiNo: string | null;
  telefon: string | null;
  bolge: string | null;
  notAlani: string | null;
  favori: boolean;
  aktif: boolean;
};

type FormDurumu = CariGirdi;
const BOS_FORM: FormDurumu = { ad: "", tur: "URETICI", tckn: "", vergiNo: "", telefon: "", bolge: "", notAlani: "", favori: false };
const TUR_ETIKETLERI = { URETICI: "Üretici", TUCCAR: "Tüccar", FABRIKA: "Fabrika" } as const;

function formdan(kayit?: CariSatir): FormDurumu {
  if (!kayit) return BOS_FORM;
  return { ad: kayit.ad, tur: kayit.tur, tckn: kayit.tckn ?? "", vergiNo: kayit.vergiNo ?? "", telefon: kayit.telefon ?? "", bolge: kayit.bolge ?? "", notAlani: kayit.notAlani ?? "", favori: kayit.favori };
}

function CariFormu({ kayit, onTamamla }: { kayit?: CariSatir; onTamamla: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormDurumu>(() => formdan(kayit));

  function alan<K extends keyof FormDurumu>(ad: K, deger: FormDurumu[K]) {
    setForm((onceki) => ({ ...onceki, [ad]: deger }));
  }

  function kaydet() {
    startTransition(async () => {
      const sonuc = kayit ? await cariGuncelle(kayit.id, form) : await cariOlustur(form);
      if (!sonuc.ok) {
        toast.error("Cari kart kaydedilemedi", { description: sonuc.hata });
        return;
      }
      toast.success(kayit ? "Cari kart güncellendi" : "Cari kart oluşturuldu", { description: form.ad.trim() });
      onTamamla();
      router.refresh();
    });
  }

  function aktifligiDegistir() {
    if (!kayit) return;
    startTransition(async () => {
      const sonuc = await cariAktifliginiDegistir(kayit.id);
      if (!sonuc.ok) {
        toast.error("Cari kart güncellenemedi", { description: sonuc.hata });
        return;
      }
      toast.success(kayit.aktif ? "Cari kart pasifleştirildi" : "Cari kart aktifleştirildi", { description: kayit.ad });
      onTamamla();
      router.refresh();
    });
  }

  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cari-ad">Ad / ünvan</Label><Input id="cari-ad" className="saha-input" value={form.ad} onChange={(event) => alan("ad", event.target.value)} maxLength={120} autoFocus placeholder="Ör. Erkan Erdem veya Akaydın Tarım" /></div>
      <div className="space-y-1.5"><Label htmlFor="cari-tur">Cari türü</Label><Select value={form.tur} onValueChange={(deger) => alan("tur", deger as FormDurumu["tur"])}><SelectTrigger id="cari-tur" className="saha-input w-full bg-slate-800"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TUR_ETIKETLERI).map(([kod, etiket]) => <SelectItem key={kod} value={kod}>{etiket}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="cari-telefon">Telefon</Label><Input id="cari-telefon" className="saha-input" value={form.telefon} onChange={(event) => alan("telefon", event.target.value)} inputMode="tel" maxLength={30} placeholder="05xx xxx xx xx" /></div>
      <div className="space-y-1.5"><Label htmlFor="cari-tckn">TCKN</Label><Input id="cari-tckn" className="saha-input" value={form.tckn} onChange={(event) => alan("tckn", event.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={11} placeholder="11 hane" /></div>
      <div className="space-y-1.5"><Label htmlFor="cari-vergi">Vergi no</Label><Input id="cari-vergi" className="saha-input" value={form.vergiNo} onChange={(event) => alan("vergiNo", event.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={10} placeholder="10 hane" /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cari-bolge">Bölge</Label><Input id="cari-bolge" className="saha-input" value={form.bolge} onChange={(event) => alan("bolge", event.target.value)} maxLength={100} placeholder="Ör. Hendek / Sakarya" /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cari-not">Not</Label><Textarea id="cari-not" className="min-h-20" value={form.notAlani} onChange={(event) => alan("notAlani", event.target.value)} maxLength={1000} placeholder="İsteğe bağlı operasyon notu" /></div>
    </div>
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm font-bold text-sky-50"><input type="checkbox" checked={form.favori} onChange={(event) => alan("favori", event.target.checked)} className="size-4 accent-emerald-500" /> Sık kullanılan cari</label>
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={pending || form.ad.trim().length < 2} onClick={kaydet} className="saha-btn bg-[var(--primary)] text-white">{pending ? "Kaydediliyor..." : kayit ? "Bilgileri güncelle" : "Cari kart oluştur"}</button>
      {kayit && <button type="button" disabled={pending} onClick={aktifligiDegistir} className="saha-btn border border-slate-500 bg-slate-800 text-sky-50">{kayit.aktif ? "Pasifleştir" : "Aktifleştir"}</button>}
    </div>
    {kayit && <p className="text-xs font-semibold text-sky-100">Cari kartlar silinmez; işlem geçmişini korumak için pasifleştirilir.</p>}
  </div>;
}

function CariDialogu({ kayit, acik, kapat }: { kayit?: CariSatir; acik: boolean; kapat: () => void }) {
  return <Dialog open={acik} onOpenChange={(yeniAcik) => { if (!yeniAcik) kapat(); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{kayit ? "Cari kartı düzenle" : "Yeni cari kart"}</DialogTitle><DialogDescription>Bu kart alım, satış, avans ve tahsilat işlemlerinde güvenli şekilde seçilir.</DialogDescription></DialogHeader><CariFormu key={kayit?.id ?? "yeni"} kayit={kayit} onTamamla={kapat} /></DialogContent></Dialog>;
}

export function YeniCariButonu({ yetkili }: { yetkili: boolean }) {
  const [acik, setAcik] = useState(false);
  if (!yetkili) return null;
  return <><button type="button" onClick={() => setAcik(true)} className="saha-btn shrink-0 bg-[var(--primary)] px-4 text-white"><Plus className="size-4" /> Yeni cari</button><CariDialogu acik={acik} kapat={() => setAcik(false)} /></>;
}

export function CariDuzenleButonu({ kayit, yetkili }: { kayit: CariSatir; yetkili: boolean }) {
  const [acik, setAcik] = useState(false);
  if (!yetkili) return null;
  return <><button type="button" onClick={() => setAcik(true)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-600 px-2.5 text-xs font-bold text-sky-50 hover:border-emerald-300"><Pencil className="size-3.5" /> Düzenle</button><CariDialogu kayit={kayit} acik={acik} kapat={() => setAcik(false)} /></>;
}

export function CariBosDurum({ yetkili }: { yetkili: boolean }) {
  return <div className="rounded-xl border border-dashed border-slate-600 p-6 text-center"><UserRound className="mx-auto size-7 text-emerald-200" /><p className="mt-2 font-extrabold text-white">Henüz cari kart yok</p><p className="mt-1 text-sm font-semibold text-sky-100">{yetkili ? "İlk üretici, tüccar veya fabrika kartını ekleyerek başlayın." : "Cari kayıt ekleme yetkiniz bulunmuyor."}</p></div>;
}
