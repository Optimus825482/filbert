"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Mic, Save, WifiOff } from "lucide-react";
import { sesliNotTaslagiOlustur } from "@/lib/actions/sesli-not";
import { offlineKomutEkle, offlineKomutlariGetir } from "@/lib/offline/outbox";
import { offlineKuyruguEsitle } from "@/lib/offline/sync";
import { Textarea } from "@/components/ui/textarea";

type KonusmaSonucu = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type KonusmaTanima = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: KonusmaSonucu) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type KonusmaYapici = new () => KonusmaTanima;
type Not = { id: string; metin: string; durum: string; kullanici: string; createdAt: string };

function taniyiciGetir(): KonusmaYapici | null {
  const browser = window as unknown as { SpeechRecognition?: KonusmaYapici; webkitSpeechRecognition?: KonusmaYapici };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

function konusmaDestegiDinle() {
  return () => undefined;
}

export function SesliNotForm({ notlar, kullaniciId, saltOkunur = false }: { notlar: Not[]; kullaniciId: string; saltOkunur?: boolean }) {
  const [metin, setMetin] = useState("");
  const [dinliyor, setDinliyor] = useState(false);
  const [durum, setDurum] = useState("");
  const [bekleyen, setBekleyen] = useState(0);
  const [pending, startTransition] = useTransition();
  const taniyici = useRef<KonusmaTanima | null>(null);
  const kuyruguYenile = useCallback(async () => setBekleyen((await offlineKomutlariGetir(kullaniciId)).length), [kullaniciId]);
  const destek = useSyncExternalStore(konusmaDestegiDinle, () => !!taniyiciGetir(), () => false);

  useEffect(() => {
    if (saltOkunur) return;
    queueMicrotask(() => void kuyruguYenile());
    const onSync = () => void kuyruguYenile();
    window.addEventListener("filbert:offline-sync", onSync);
    return () => window.removeEventListener("filbert:offline-sync", onSync);
  }, [kuyruguYenile, saltOkunur]);

  function kaydiBaslat() {
    const Yapici = taniyiciGetir();
    if (!Yapici) {
      setDurum("Bu tarayıcı konuşma tanımayı desteklemiyor. Metni elle girebilirsiniz.");
      return;
    }
    const yeni = new Yapici();
    yeni.lang = "tr-TR";
    yeni.interimResults = false;
    yeni.continuous = false;
    yeni.onresult = (event) => {
      const parca = event.results[0]?.[0]?.transcript?.trim();
      if (parca) setMetin((eski) => `${eski}${eski ? " " : ""}${parca}`);
    };
    yeni.onend = () => setDinliyor(false);
    yeni.onerror = () => {
      setDinliyor(false);
      setDurum("Mikrofon veya konuşma tanıma başlatılamadı.");
    };
    taniyici.current = yeni;
    setDurum("");
    setDinliyor(true);
    yeni.start();
  }

  async function kaydet() {
    if (metin.trim().length < 2) {
      setDurum("Kaydetmek için en az iki karakterlik metin gerekli.");
      return;
    }
    try {
      if (!navigator.onLine) {
        await offlineKomutEkle(kullaniciId, "SESLI_NOT_TASLAGI", { metin });
        setMetin("");
        await kuyruguYenile();
        setDurum("Bağlantı yok: taslak cihazda güvenle sıraya alındı.");
        return;
      }
      const sonuc = await sesliNotTaslagiOlustur(metin);
      if (!sonuc.ok) {
        await offlineKomutEkle(kullaniciId, "SESLI_NOT_TASLAGI", { metin });
        await kuyruguYenile();
        setDurum(`${sonuc.hata ?? "Kayıt hatası"} Taslak offline sıraya alındı.`);
        return;
      }
      setMetin("");
      setDurum("Taslak kaydedildi. Operasyon kaydı oluşturulmadı; önce metni inceleyin.");
    } catch {
      setDurum("İşlem şu anda gerçekleştirilemedi. Bağlantıyı kontrol edip yeniden deneyin.");
    }
  }

  return <div className="space-y-4">
    {!saltOkunur && <section className="ozet-kart space-y-3">
      <p className="text-sm text-sky-100">Ses yalnız metne çevrilir. Kaydetmeden önce metni düzenleyin; bu ekran alım, finans veya stok hareketi oluşturmaz.</p>
      <Textarea value={metin} onChange={(event) => setMetin(event.target.value)} rows={6} maxLength={4000} disabled={pending || dinliyor} placeholder="Konuşun veya notunuzu yazın…" className="bg-slate-950/40 text-sky-50 placeholder:text-sky-200 focus:border-filbert-400" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={dinliyor ? () => taniyici.current?.stop() : kaydiBaslat} className="saha-btn bg-filbert-600 text-white"><Mic className="h-4 w-4" />{dinliyor ? "Dinlemeyi durdur" : "Konuşarak yaz"}</button>
        <button type="button" disabled={pending || dinliyor || metin.trim().length < 2} onClick={() => startTransition(async () => { await kaydet(); })} className="saha-btn border border-slate-600 bg-slate-800 text-white"><Save className="h-4 w-4" />{pending ? "Kaydediliyor..." : "Taslak kaydet"}</button>
        {destek === false && <span className="self-center text-xs text-amber-300">Konuşma tanıma desteklenmiyor</span>}
        {bekleyen > 0 && <button type="button" disabled={pending} onClick={() => startTransition(async () => { await offlineKuyruguEsitle(kullaniciId); await kuyruguYenile(); })} className="saha-btn border border-amber-500/50 bg-amber-500/10 text-amber-200"><WifiOff className="h-4 w-4" />{pending ? "Eşitleniyor..." : `${bekleyen} kayıt bekliyor`}</button>}
      </div>
      {durum && <p className="text-sm text-sky-100" role="status">{durum}</p>}
    </section>}
    <section>
      <h2 className="mb-2 text-sm font-extrabold">Son taslaklar</h2>
      <div className="space-y-2">
        {notlar.map((not) => <article key={not.id} className="ozet-kart"><div className="flex justify-between gap-3 text-xs text-sky-100"><span>{not.kullanici}</span><span>{new Date(not.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{not.metin}</p><span className="mt-2 inline-block rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold">{not.durum}</span></article>)}
        {notlar.length === 0 && <div className="ozet-kart text-sm text-sky-100">Henüz sesli not taslağı yok.</div>}
      </div>
    </section>
  </div>;
}
