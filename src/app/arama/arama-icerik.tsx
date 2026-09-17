"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Search, X, ChevronRight, ChevronLeft, ShoppingBasket, ClipboardList, Calculator, ArrowLeftRight, Truck, PackageOpen, Wallet, Banknote, HandCoins, ArrowDownUp, Receipt, PiggyBank, Users, Warehouse, FileBarChart, type LucideIcon } from "lucide-react";

type Sonuc = { href: string; etiket: string; grup: string; ikon: LucideIcon };
type Cari = { id: string; ad: string; tur: string; bolge: string | null };

const MODUL_OGELERI: Sonuc[] = [
  { href: "/alim/yeni", etiket: "Yeni Alım Fişi", grup: "Fındık", ikon: ShoppingBasket }, { href: "/alim", etiket: "Alım Yönetimi", grup: "Fındık", ikon: ClipboardList }, { href: "/randiman", etiket: "Randıman Takibi", grup: "Fındık", ikon: Calculator }, { href: "/virman", etiket: "Virman Kontrolü", grup: "Fındık", ikon: ArrowLeftRight }, { href: "/emanet", etiket: "Emanetler", grup: "Fındık", ikon: PackageOpen }, { href: "/sevkiyat", etiket: "Sevk Planlama", grup: "Fındık", ikon: Truck }, { href: "/kasa", etiket: "Kasa Hareketleri", grup: "Finans", ikon: Wallet }, { href: "/banka", etiket: "Banka İşlemleri", grup: "Finans", ikon: Banknote }, { href: "/tahsilat", etiket: "Tahsilat", grup: "Finans", ikon: HandCoins }, { href: "/finans/odeme", etiket: "Ödeme", grup: "Finans", ikon: ArrowDownUp }, { href: "/masraf", etiket: "Masraf", grup: "Finans", ikon: Receipt }, { href: "/avans", etiket: "Avans", grup: "Müşteri", ikon: PiggyBank }, { href: "/cari/hesaplar", etiket: "Cari Hesaplar", grup: "Müşteri", ikon: Users }, { href: "/raporlar", etiket: "Günlük Rapor", grup: "Rapor", ikon: FileBarChart }, { href: "/stok", etiket: "Stok Durumu", grup: "Rapor", ikon: Warehouse },
];

export function AramaIcerik({ izinliRotalar, cariAramaYetkisi }: { izinliRotalar: string[]; cariAramaYetkisi: boolean }) {
  const [metin, setMetin] = useState("");
  const [cariler, setCariler] = useState<Cari[]>([]);
  const izinliModuller = MODUL_OGELERI.filter((oge) => izinliRotalar.includes(oge.href));
  useEffect(() => {
    if (!cariAramaYetkisi || metin.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => { try { const r = await fetch(`/api/cari-ara?q=${encodeURIComponent(metin)}`, { signal: controller.signal }); setCariler(r.ok ? await r.json() : []); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setCariler([]); } }, 250);
    return () => { controller.abort(); clearTimeout(t); };
  }, [cariAramaYetkisi, metin]);
  const modulSonuc = metin ? izinliModuller.filter((oge) => oge.etiket.toLocaleLowerCase("tr-TR").includes(metin.toLocaleLowerCase("tr-TR"))) : izinliModuller;
  return <div className="space-y-3">
    <div className="flex items-center gap-2"><Link href="/" aria-label="Geri" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sky-100"><ChevronLeft className="h-5 w-5" /></Link><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-100" /><input autoFocus value={metin} onChange={(e) => { setMetin(e.target.value); if (e.target.value.length < 2) setCariler([]); }} placeholder="Modül veya müşteri ara..." className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-10 text-base text-white placeholder:text-sky-100 focus:border-[#f5c518] focus:outline-none" />{metin && <button type="button" onClick={() => { setMetin(""); setCariler([]); }} aria-label="Temizle" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-sky-100"><X className="h-5 w-5" /></button>}</div></div>
    {cariAramaYetkisi && metin.length >= 2 && cariler.length > 0 && <section><div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">MÜŞTERİLER</div><div className="space-y-1.5">{cariler.map((c) => <Link key={c.id} href={`/cari/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 active:bg-slate-700"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]"><Users className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold text-white">{c.ad}</div><div className="text-xs text-sky-100">{c.tur === "URETICI" ? "Üretici" : c.tur === "TUCCAR" ? "Tüccar" : "Fabrika"}{c.bolge ? ` · ${c.bolge}` : ""}</div></div><ChevronRight className="h-4 w-4 text-sky-500" /></Link>)}</div></section>}
    <section><div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-500">{metin ? "MODÜLLER" : "TÜM MODÜLLER"}</div><div className="space-y-1.5">{modulSonuc.length === 0 && <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center text-sm text-sky-100">Sonuç bulunamadı.</div>}{modulSonuc.map((s) => <Link key={s.href} href={s.href} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2.5 active:bg-slate-700"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]"><s.ikon className="h-5 w-5" /></span><span className="flex-1 truncate text-sm font-extrabold text-white">{s.etiket}</span><span className="text-[10px] uppercase tracking-wide text-sky-500">{s.grup}</span><ChevronRight className="h-4 w-4 text-sky-500" /></Link>)}</div></section>
  </div>;
}
