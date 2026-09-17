"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kurulumDepoOlustur, kurulumHesapOlustur, kurulumMasrafTuruOlustur, kurulumVarsayilanTanimlariOlustur } from "@/lib/actions/platform";

interface Props {
  firmaId: string;
  depolar: { id: string; ad: string }[];
  hesaplar: { id: string; ad: string; tip: string; bankaAdi: string | null }[];
  masrafTurleri: { id: string; ad: string }[];
}

export function KurulumTanimlari({ firmaId, depolar, hesaplar, masrafTurleri }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mesaj, setMesaj] = useState("");

  const [depoAd, setDepoAd] = useState("");
  const [hesapAd, setHesapAd] = useState("");
  const [hesapTip, setHesapTip] = useState<"KASA" | "BANKA">("KASA");
  const [bankaAdi, setBankaAdi] = useState("");
  const [iban, setIban] = useState("");
  const [masrafTuruAd, setMasrafTuruAd] = useState("");

  async function calistir(islem: () => Promise<{ ok: boolean; hata?: string }>, basari: string, temizle?: () => void) {
    setMesaj("");
    const r = await islem();
    if (r.ok) {
      setMesaj(basari);
      temizle?.();
      router.refresh();
    } else {
      setMesaj(r.hata ?? "İşlem başarısız");
    }
  }

  return (
    <div className="mt-7 space-y-6">
      {/* Hızlı başlangıç */}
      <section className="rounded-xl border bg-cyan-50 p-4">
        <h2 className="font-bold">Hızlı başlangıç</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tek tuşla önerilen varsayılanları oluşturur: <b>Merkez Depo</b>, <b>Merkez Kasa</b> ve yaygın masraf türleri
          (Nakliye, Kantar, Hamaliye, Komisyon, Depo, Diğer). Mevcut tanımlar korunur, yalnız eksikler eklenir.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => calistir(() => kurulumVarsayilanTanimlariOlustur(firmaId), "Varsayılan tanımlar hazır."))}
          className="mt-3 rounded bg-filbert-600 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {pending ? "Oluşturuluyor..." : "Varsayılanları oluştur"}
        </button>
      </section>

      {/* Depolar */}
      <section className="rounded-xl border p-4">
        <h2 className="font-bold">Depolar</h2>
        <p className="mt-1 text-sm text-muted-foreground">Alım, sevkiyat ve stok hareketlerinin işleneceği depolar.</p>
        <div className="mt-3 flex gap-2">
          <input value={depoAd} onChange={(e) => setDepoAd(e.target.value)} className="flex-1 rounded border p-2" placeholder="ör: Merkez Depo" />
          <button
            type="button"
            disabled={pending || !depoAd.trim()}
            onClick={() => startTransition(() => calistir(() => kurulumDepoOlustur(firmaId, depoAd), "Depo eklendi.", () => setDepoAd("")))}
            className="rounded bg-filbert-600 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
        {depolar.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {depolar.map((d) => <li key={d.id} className="rounded-full border px-3 py-1">{d.ad}</li>)}
          </ul>
        )}
      </section>

      {/* Kasa / Banka */}
      <section className="rounded-xl border p-4">
        <h2 className="font-bold">Kasa / Banka Hesapları</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tahsilat, ödeme, masraf ve virman işlemlerinin işleneceği hesaplar.</p>
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <select value={hesapTip} onChange={(e) => setHesapTip(e.target.value as "KASA" | "BANKA")} className="rounded border p-2">
              <option value="KASA">Kasa</option>
              <option value="BANKA">Banka</option>
            </select>
            <input value={hesapAd} onChange={(e) => setHesapAd(e.target.value)} className="flex-1 rounded border p-2" placeholder={hesapTip === "KASA" ? "ör: Merkez Kasa" : "ör: Ziraat Vadesiz"} />
            <button
              type="button"
              disabled={pending || !hesapAd.trim() || (hesapTip === "BANKA" && !bankaAdi.trim())}
              onClick={() => startTransition(() => calistir(() => kurulumHesapOlustur(firmaId, { ad: hesapAd, tip: hesapTip, bankaAdi: hesapTip === "BANKA" ? bankaAdi : undefined, iban: iban || undefined }), "Hesap eklendi.", () => { setHesapAd(""); setBankaAdi(""); setIban(""); }))}
              className="rounded bg-filbert-600 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              Ekle
            </button>
          </div>
          {hesapTip === "BANKA" && (
            <div className="grid grid-cols-2 gap-2">
              <input value={bankaAdi} onChange={(e) => setBankaAdi(e.target.value)} className="rounded border p-2" placeholder="Banka adı (zorunlu)" />
              <input value={iban} onChange={(e) => setIban(e.target.value)} className="rounded border p-2" placeholder="IBAN (opsiyonel)" />
            </div>
          )}
        </div>
        {hesaplar.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {hesaplar.map((h) => <li key={h.id} className="rounded-full border px-3 py-1">{h.ad} · {h.tip === "KASA" ? "Kasa" : `Banka${h.bankaAdi ? ` (${h.bankaAdi})` : ""}`}</li>)}
          </ul>
        )}
      </section>

      {/* Masraf türleri */}
      <section className="rounded-xl border p-4">
        <h2 className="font-bold">Masraf Türleri</h2>
        <p className="mt-1 text-sm text-muted-foreground">Masraf kaydı girilirken seçilecek türler (ör: Nakliye, Kantar...).</p>
        <div className="mt-3 flex gap-2">
          <input value={masrafTuruAd} onChange={(e) => setMasrafTuruAd(e.target.value)} className="flex-1 rounded border p-2" placeholder="ör: Nakliye" />
          <button
            type="button"
            disabled={pending || !masrafTuruAd.trim()}
            onClick={() => startTransition(() => calistir(() => kurulumMasrafTuruOlustur(firmaId, masrafTuruAd), "Masraf türü eklendi.", () => setMasrafTuruAd("")))}
            className="rounded bg-filbert-600 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            Ekle
          </button>
        </div>
        {masrafTurleri.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {masrafTurleri.map((t) => <li key={t.id} className="rounded-full border px-3 py-1">{t.ad}</li>)}
          </ul>
        )}
      </section>

      {mesaj && <p className="text-sm font-semibold">{mesaj}</p>}

      <button
        type="button"
        onClick={() => router.replace(`/platform/${firmaId}/yetkiler`)}
        className="rounded bg-filbert-600 px-6 py-3 font-bold text-white"
      >
        Devam et: Yetki grupları →
      </button>
    </div>
  );
}
