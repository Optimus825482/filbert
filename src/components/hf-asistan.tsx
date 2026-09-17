"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, UserRoundSearch } from "lucide-react";
import { hfCariBakiyesi, hfMusteriAra, type HFMusteri } from "@/lib/actions/hf";

type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function turkceSayi(n: number) { return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(Math.abs(n)); }
function bakiyeMetni(bakiyeler: Record<string, number>) {
  const etiket: Record<string, string> = { TL: "Türk lirası", USD: "Amerikan doları", EUR: "Euro", XAU: "gram altın", FINDIK_KG: "kilogram fındık" };
  const satirlar = Object.entries(bakiyeler).filter(([, deger]) => deger !== 0).map(([tur, deger]) => `${turkceSayi(deger)} ${etiket[tur] ?? tur} ${deger > 0 ? "alacak" : "borç"}`);
  return satirlar.length ? satirlar.join(", ") : "Kayıtlı bakiye hareketi bulunmuyor.";
}

export function HFAsistan() {
  const [aktif, setAktif] = useState(false), [dinliyor, setDinliyor] = useState(false), [adim, setAdim] = useState<"komut" | "musteri" | "teyit">("komut");
  const [adaylar, setAdaylar] = useState<HFMusteri[]>([]), [secilen, setSecilen] = useState<HFMusteri | null>(null), [mesaj, setMesaj] = useState("HF modunu başlatıp mikrofon düğmesine basın.");
  const [bakiye, setBakiye] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const soyle = (metin: string) => { setMesaj(metin); window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(metin)); };
  useEffect(() => () => { recognition.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const sonucuIsle = async (metin: string) => {
    try {
      const temiz = metin.toLocaleLowerCase("tr-TR").trim();
      if (/(durdur|iptal|çıkış)/.test(temiz)) { setAktif(false); setAdim("komut"); soyle("HF modu kapatıldı."); return; }
      if (adim === "komut") {
        if (/(müşteri|musteri).*(ara|bakiy)|\b(bakiye|ara)\b/.test(temiz)) { setAdim("musteri"); soyle("Lütfen aramak istediğiniz müşteri adını söyleyin."); }
        else soyle("Şu anda müşteri ara veya müşteri bakiyesi komutunu söyleyebilirsiniz.");
        return;
      }
      if (adim === "teyit" && secilen) {
        if (/(evet|oku|göster|goster)/.test(temiz)) { const sonuc = await hfCariBakiyesi(secilen.id); if (!sonuc.ok) return soyle(sonuc.hata); const metin2 = `${sonuc.ad} için ${bakiyeMetni(sonuc.bakiyeler)}`; setBakiye(metin2); soyle(metin2); }
        else if (/(hayır|hayir|yok)/.test(temiz)) { setAdim("komut"); soyle("Tamam. Yeni bir komut söyleyebilirsiniz."); }
        else soyle("Bakiyeyi okumamı isterseniz evet, istemezseniz hayır deyin.");
        return;
      }
      const sonuc = await hfMusteriAra(metin);
      if (!sonuc.ok) return soyle(sonuc.hata);
      setAdaylar(sonuc.kayitlar);
      if (sonuc.kayitlar.length === 1) { setSecilen(sonuc.kayitlar[0]); setAdim("teyit"); soyle(`${sonuc.kayitlar[0].ad} bulundu. Bakiyesini okumamı ister misiniz?`); }
      else if (!sonuc.kayitlar.length) soyle("Bu adla aktif bir müşteri bulunamadı. Lütfen tekrar deneyin.");
      else soyle(`${sonuc.kayitlar.length} müşteri bulundu. Ekrandan birini seçin veya adını daha ayrıntılı söyleyin.`);
    } catch {
      // Oturum/bağlantı hatası konuşmalı yardımcıyı sessizce bozmamalı.
      soyle("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };
  const dinlemeyeBasla = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) return soyle("Bu tarayıcı konuşmayı metne dönüştürmeyi desteklemiyor. Güncel Chrome veya Edge kullanın.");
    const r = new Ctor(); recognition.current = r; r.lang = "tr-TR"; r.interimResults = false; r.continuous = false; r.onresult = (e) => { const metin = e.results[0]?.[0]?.transcript; if (metin) void sonucuIsle(metin); }; r.onerror = () => setMesaj("Ses anlaşılamadı. Mikrofon düğmesine yeniden basın."); r.onend = () => setDinliyor(false); setDinliyor(true); r.start();
  };
  const baslat = () => { setAktif(true); setAdim("komut"); setAdaylar([]); setSecilen(null); setBakiye(null); soyle("HF modu açıldı. Müşteri ara veya müşteri bakiyesi diyebilirsiniz."); };
  const adaySec = (aday: HFMusteri) => { setSecilen(aday); setAdim("teyit"); soyle(`${aday.ad} seçildi. Bakiyesini okumamı ister misiniz?`); };
  return <section className="rounded-2xl border border-[#f5c518]/35 bg-[#f5c518]/5 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-extrabold"><UserRoundSearch className="h-4 w-4 text-[#f5c518]" /> HF müşteri yardımcısı</div><p className="mt-1 text-xs text-sky-100">Sürekli dinlemez. Sadece sizin mikrofon düğmesine bastığınız anda müşteri arar ve bakiye okur.</p></div><button type="button" onClick={aktif ? () => { setAktif(false); recognition.current?.stop(); } : baslat} className="rounded-xl bg-[#f5c518] px-3 py-2 text-xs font-extrabold text-[#0b1b3a]">{aktif ? "HF kapat" : "HF başlat"}</button></div>{aktif && <div className="mt-4 space-y-3"><p aria-live="polite" className="rounded-xl bg-slate-950/30 p-3 text-sm text-sky-100">{mesaj}</p><div className="flex flex-wrap gap-2 text-xs text-sky-100"><span className="rounded-full border border-slate-700 px-2 py-1">“Müşteri ara”</span><span className="rounded-full border border-slate-700 px-2 py-1">“Müşteri bakiyesi”</span><span className="rounded-full border border-slate-700 px-2 py-1">“Evet / hayır”</span><span className="rounded-full border border-slate-700 px-2 py-1">“Durdur”</span></div><button type="button" onClick={dinliyor ? () => recognition.current?.stop() : dinlemeyeBasla} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-extrabold text-[#071126]">{dinliyor ? <><Square className="h-4 w-4" /> Dinlemeyi durdur</> : <><Mic className="h-4 w-4" /> Konuşmak için basın</>}</button>{adaylar.length > 1 && <div className="space-y-2">{adaylar.map((aday) => <button key={aday.id} type="button" onClick={() => adaySec(aday)} className="flex w-full items-center justify-between rounded-xl border border-slate-700 px-3 py-2 text-left text-sm hover:border-[#f5c518]"><span>{aday.ad}</span><span className="text-xs text-sky-100">{aday.tur}</span></button>)}</div>}{secilen && <Link href={`/cari/${secilen.id}`} className="inline-flex items-center gap-2 text-xs font-bold text-[#f5c518]">{secilen.ad} kaydını aç <Volume2 className="h-3.5 w-3.5" /></Link>}{bakiye && <p className="text-sm font-bold text-white">{bakiye}</p>}</div>}</section>;
}
