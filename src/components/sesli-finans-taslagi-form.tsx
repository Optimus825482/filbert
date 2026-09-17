"use client";

import { useRef, useState, useTransition } from "react";
import { Mic, Save } from "lucide-react";
import { sesliNotTaslagiOlustur } from "@/lib/actions/sesli-not";
import { sesliFinansTaslagiOlustur } from "@/lib/actions/finans-taslagi";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Cari = { id: string; ad: string };

export function SesliFinansTaslagiForm({ cariler }: { cariler: Cari[] }) {
  const [cariId, setCariId] = useState("");
  const [metin, setMetin] = useState("");
  const [kayit, setKayit] = useState(false);
  const [durum, setDurum] = useState("");
  const [pending, startTransition] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<Blob | null>(null);

  async function sesKaydiniBaslat() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      chunks.current = [];
      next.ondataavailable = (event) => chunks.current.push(event.data);
      next.onstop = () => {
        audio.current = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setKayit(false);
        setDurum("Ses kaydı hazır; taslakla birlikte saklanacak.");
      };
      recorder.current = next;
      next.start();
      setKayit(true);
      setDurum("");
    } catch {
      setDurum("Mikrofon izni alınamadı.");
    }
  }

  async function olustur() {
    if (!cariId || metin.trim().length < 2) {
      setDurum("Müşteri seçip en az iki karakterlik açıklama girin.");
      return;
    }

    const not = await sesliNotTaslagiOlustur(metin);
    if (!not.ok) {
      setDurum(not.hata ?? "Sesli not kaydedilemedi");
      return;
    }

    let sesYuklenemedi = false;
    if (audio.current) {
      const form = new FormData();
      form.set("audio", new File([audio.current], "sesli-finans.webm", { type: audio.current.type || "audio/webm" }));
      const yukle = await fetch(`/api/sesli-not/${not.notId}/ses-kaydi`, { method: "POST", body: form });
      sesYuklenemedi = !yukle.ok;
    }

    const taslak = await sesliFinansTaslagiOlustur({ sesliNotId: not.notId, cariId, onerilenAciklama: metin });
    if (!taslak.ok) {
      setDurum(taslak.hata ?? "Finans taslağı oluşturulamadı");
      return;
    }

    setMetin("");
    setCariId("");
    audio.current = null;
    setDurum(sesYuklenemedi ? "Finans taslağı inceleme kuyruğuna alındı; ses dosyası yüklenemedi." : "Finans taslağı inceleme kuyruğuna alındı. Bir saat sonra hatırlatılır.");
  }

  return <section className="ozet-kart space-y-3">
    <h2 className="text-sm font-extrabold">Sesli finans taslağı</h2>
    <p className="text-xs text-sky-100">Bu işlem finans kaydı oluşturmaz; müşteriyle ilişkili ses ve metin taslağını muhasebe incelemesine gönderir.</p>
    <Select value={cariId} onValueChange={setCariId} disabled={pending || kayit}>
      <SelectTrigger className="h-11 w-full bg-slate-950 text-sky-50"><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
      <SelectContent>{cariler.map((cari) => <SelectItem key={cari.id} value={cari.id}>{cari.ad}</SelectItem>)}</SelectContent>
    </Select>
    <Textarea value={metin} onChange={(event) => setMetin(event.target.value)} rows={3} maxLength={4000} disabled={pending || kayit} placeholder="Örn: Erkan Erdem'e 5.000 TL ödeme yapılacak." className="bg-slate-950 text-sky-50 placeholder:text-sky-200" />
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => void (kayit ? recorder.current?.stop() : sesKaydiniBaslat())} className="saha-btn bg-filbert-600 text-white"><Mic className="h-4 w-4" />{kayit ? "Ses kaydını durdur" : "Ses kaydı al"}</button>
      <button type="button" disabled={pending || kayit || !cariId || metin.trim().length < 2} onClick={() => startTransition(async () => { await olustur(); })} className="saha-btn border border-slate-600 bg-slate-800 text-white"><Save className="h-4 w-4" />{pending ? "Gönderiliyor..." : "İncelemeye gönder"}</button>
    </div>
    {durum && <p role="status" className="text-sm text-sky-100">{durum}</p>}
  </section>;
}
