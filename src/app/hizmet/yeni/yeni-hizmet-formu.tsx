"use client";

import { useState, useTransition, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Save,
  ArrowLeft,
  Sparkles,
  Phone,
  User,
  Scale,
  FileText,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createHizmetKaydi } from "@/lib/actions/hizmet";
import { tutarHesapla } from "@/lib/hesap";

interface HizmetTipiSecenek {
  id: string;
  ad: string;
  kirma: boolean;
  kavurma: boolean;
  paketleme: boolean;
  varsayilanBirimFiyat: number;
}

export interface MusteriOneri {
  id?: string;
  ad: string;
  telefon: string;
  tur?: string;
  kaynak?: "CARI" | "GECMIS";
}

interface Props {
  hizmetTipleri: HizmetTipiSecenek[];
  cariler?: Array<{ id: string; ad: string; telefon: string; tur: string }>;
  musteriOnerileri?: MusteriOneri[];
  smsAktif: boolean;
  otomatikGirisSms: boolean;
}

export function YeniHizmetFormu({
  hizmetTipleri,
  cariler = [],
  musteriOnerileri = [],
  smsAktif,
  otomatikGirisSms,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [seciliCariId, setSeciliCariId] = useState("");
  const [musteriAdi, setMusteriAdi] = useState("");
  const [telefon, setTelefon] = useState("");
  const [aramaOdak, setAramaOdak] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tüm müşteri önerilerini birleştir
  const tumOneriler: MusteriOneri[] = useMemo(() => {
    if (musteriOnerileri.length > 0) return musteriOnerileri;
    return cariler.map((c) => ({
      id: c.id,
      ad: c.ad,
      telefon: c.telefon,
      tur: c.tur,
      kaynak: "CARI" as const,
    }));
  }, [musteriOnerileri, cariler]);

  // Canlı arama filtresi (Ad veya Telefon)
  const filtrelenmisOneriler = useMemo(() => {
    const q = musteriAdi.trim().toLocaleLowerCase("tr-TR");
    if (!q || q.length < 1) return [];
    const qRakam = q.replace(/\D/g, "");
    return tumOneriler
      .filter((m) => {
        const adUygun = m.ad.toLocaleLowerCase("tr-TR").includes(q);
        const telUygun = qRakam.length >= 2 && m.telefon.replace(/\D/g, "").includes(qRakam);
        return adUygun || telUygun;
      })
      .slice(0, 8);
  }, [musteriAdi, tumOneriler]);

  // Tıklama dışı algılama (Açılır listeyi kapatmak için)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAramaOdak(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMusteriSec(m: MusteriOneri) {
    setMusteriAdi(m.ad);
    setTelefon(m.telefon || "");
    setSeciliCariId(m.id || "");
    setAramaOdak(false);
    toast.info(`${m.ad} seçildi, telefon numarası otomatik dolduruldu.`);
  }
  const [kiloStr, setKiloStr] = useState("");
  const [kirma, setKirma] = useState(true);
  const [kavurma, setKavurma] = useState(false);
  const [paketleme, setPaketleme] = useState(false);
  const [paketTipi, setPaketTipi] = useState<string>("1_KG");
  const [paketAdedi, setPaketAdedi] = useState<string>("");
  const [seciliTipId, setSeciliTipId] = useState<string>("");
  const [birimFiyatStr, setBirimFiyatStr] = useState("");
  const [toplamTutarStr, setToplamTutarStr] = useState("");
  const [manuelTutar, setManuelTutar] = useState(false);
  const [notlar, setNotlar] = useState("");
  const [smsGonderilsin, setSmsGonderilsin] = useState(otomatikGirisSms);

  // Otomatik Tutar Güncelleme
  function tutariGuncelle(yeniKilo: number, yeniBirimFiyat: number) {
    if (!manuelTutar) {
      const hesaplanan = tutarHesapla(yeniKilo, yeniBirimFiyat);
      setToplamTutarStr(hesaplanan > 0 ? String(hesaplanan) : "");
    }
  }

  // Kilo değiştiğinde
  function handleKiloChange(val: string) {
    setKiloStr(val);
    const k = parseFloat(val.replace(",", ".")) || 0;
    const f = parseFloat(birimFiyatStr.replace(",", ".")) || 0;
    tutariGuncelle(k, f);
  }

  // Birim Fiyat değiştiğinde
  function handleBirimFiyatChange(val: string) {
    setBirimFiyatStr(val);
    const k = parseFloat(kiloStr.replace(",", ".")) || 0;
    const f = parseFloat(val.replace(",", ".")) || 0;
    tutariGuncelle(k, f);
  }

  // Hazır Hizmet Tipi Seçildiğinde
  function handleTipSecimi(tip: HizmetTipiSecenek) {
    setSeciliTipId(tip.id);
    setKirma(tip.kirma);
    setKavurma(tip.kavurma);
    setPaketleme(tip.paketleme);
    setBirimFiyatStr(String(tip.varsayilanBirimFiyat));
    const k = parseFloat(kiloStr.replace(",", ".")) || 0;
    tutariGuncelle(k, tip.varsayilanBirimFiyat);
  }

  // Checkbox'lar değiştiğinde
  function handleCheckboxToggle(hedef: "kirma" | "kavurma" | "paketleme") {
    let yeniK = kirma;
    let yeniV = kavurma;
    let yeniP = paketleme;

    if (hedef === "kirma") {
      yeniK = !kirma;
      setKirma(yeniK);
    } else if (hedef === "kavurma") {
      yeniV = !kavurma;
      setKavurma(yeniV);
    } else if (hedef === "paketleme") {
      yeniP = !paketleme;
      setPaketleme(yeniP);
    }

    // Seçilen kombinasyona uyan hazır tip var mı kontrol et
    const eslesenTip = hizmetTipleri.find(
      (t) => t.kirma === yeniK && t.kavurma === yeniV && t.paketleme === yeniP
    );

    if (eslesenTip) {
      setSeciliTipId(eslesenTip.id);
      setBirimFiyatStr(String(eslesenTip.varsayilanBirimFiyat));
      const k = parseFloat(kiloStr.replace(",", ".")) || 0;
      tutariGuncelle(k, eslesenTip.varsayilanBirimFiyat);
    } else {
      setSeciliTipId("");
    }
  }

  // Kaydetme İşlemi
  function handleSubmit(etiketYazdir: boolean) {
    const k = parseFloat(kiloStr.replace(",", "."));
    if (!musteriAdi.trim()) {
      toast.error("Lütfen müşteri adı soyadı giriniz.");
      return;
    }
    if (!telefon.trim()) {
      toast.error("Lütfen müşteri telefon numarası giriniz.");
      return;
    }
    if (isNaN(k) || k <= 0) {
      toast.error("Lütfen geçerli bir fındık kilosu giriniz.");
      return;
    }
    if (!kirma && !kavurma && !paketleme) {
      toast.error("Lütfen yapılacak en az bir hizmeti seçiniz.");
      return;
    }

    const birimFiyat = parseFloat(birimFiyatStr.replace(",", ".")) || 0;
    const toplamTutar = parseFloat(toplamTutarStr.replace(",", ".")) || 0;

    startTransition(async () => {
      const res = await createHizmetKaydi({
        musteriAdi: musteriAdi.trim(),
        telefon: telefon.trim(),
        kilo: k,
        kirma,
        kavurma,
        paketleme,
        paketTipi: paketleme ? paketTipi : undefined,
        paketAdedi: paketleme && paketAdedi ? parseInt(paketAdedi, 10) : undefined,
        cariId: seciliCariId || undefined,
        hizmetTipiId: seciliTipId || undefined,
        birimFiyatManuel: birimFiyat,
        toplamTutarManuel: toplamTutar,
        notlar: notlar.trim() || undefined,
        smsGonderilsin,
      });

      if (!res.ok) {
        toast.error(res.hata || "Kayıt oluşturulamadı");
        return;
      }

      toast.success(`Hizmet kaydı oluşturuldu! Sıra No: #${res.siraNo}`);
      if (res.smsGitti) {
        toast.info(`Müşteriye (${telefon}) bilgilendirme SMS'i gönderildi.`);
      }

      if (etiketYazdir && res.id) {
        router.push(`/hizmet/${res.id}/etiket`);
      } else {
        router.push("/hizmet");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* ─── Başlık Barı ─── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/hizmet"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-sky-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-white">Yeni Hizmet Kaydı</h1>
            <p className="text-xs text-sky-200">Fındık kırma, kavurma ve paketleme siparişi</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-xl">
        {/* ─── 1. Müşteri Bilgileri & Cari Rehberi ─── */}
        <div className="space-y-3">
          {cariler.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5">
              <span className="text-xs font-bold text-sky-200">Rehberden Seç:</span>
              <select
                value={seciliCariId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSeciliCariId(cid);
                  if (cid) {
                    const bul = cariler.find((c) => c.id === cid);
                    if (bul) {
                      setMusteriAdi(bul.ad);
                      if (bul.telefon) setTelefon(bul.telefon);
                    }
                  }
                }}
                className="flex-1 rounded-lg border border-white/10 bg-[#081226] px-3 py-1.5 text-xs font-semibold text-white focus:border-[#f5c518] focus:outline-none"
              >
                <option value="">-- Kayıtlı Müşteri / Üretici Seçiniz (İsteğe Bağlı) --</option>
                {cariler.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ad} {c.telefon ? `(${c.telefon})` : ""} [{c.tur}]
                  </option>
                ))}
              </select>
              {seciliCariId && (
                <button
                  type="button"
                  onClick={() => {
                    setSeciliCariId("");
                  }}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-white/5"
                >
                  Temizle
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Müşteri Adı ve Canlı Öneri Listesi */}
            <div className="relative" ref={containerRef}>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-200">
                  <User className="h-3.5 w-3.5 text-[#f5c518]" /> Müşteri Adı Soyadı *
                </label>
                {seciliCariId && (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Rehber Kayıtlı
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="İsim yazmaya başlayın (örn: Ahmet)..."
                value={musteriAdi}
                onFocus={() => setAramaOdak(true)}
                onChange={(e) => {
                  setMusteriAdi(e.target.value);
                  setAramaOdak(true);
                  if (seciliCariId) setSeciliCariId("");
                }}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
              />

              {/* Canlı Eşleşen Müşteriler Listesi */}
              {aramaOdak && filtrelenmisOneriler.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-sky-400/30 bg-[#081226]/98 p-1.5 shadow-2xl backdrop-blur-md">
                  <div className="mb-1 flex items-center justify-between border-b border-white/10 px-2 py-1 text-[11px] font-bold text-sky-300">
                    <span>Kayıtlı Müşteri Önerileri ({filtrelenmisOneriler.length})</span>
                    <span className="text-[10px] text-sky-400/70">Seçmek için dokunun</span>
                  </div>
                  {filtrelenmisOneriler.map((m, idx) => (
                    <button
                      key={m.id || `${m.ad}-${m.telefon}-${idx}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleMusteriSec(m);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5c518]/15 text-[#f5c518]">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{m.ad}</p>
                          <p className="font-mono text-[11px] text-sky-300">
                            {m.telefon || "Telefon kayıtlı değil"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                            m.kaynak === "CARI"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-sky-500/20 text-sky-200 border-sky-500/40"
                          }`}
                        >
                          {m.kaynak === "CARI"
                            ? m.tur === "URETICI"
                              ? "Müstahsil"
                              : "Cari Kart"
                            : "Önceki Hizmet"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-200">
                <Phone className="h-3.5 w-3.5 text-[#f5c518]" /> Telefon Numarası *
              </label>
              <input
                type="tel"
                required
                placeholder="0532 000 00 00"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 font-mono text-sm font-semibold text-white placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ─── 2. Fındık Miktarı (Kilo) ─── */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-200">
            <Scale className="h-3.5 w-3.5 text-[#f5c518]" /> Getirdiği Fındık Miktarı (KG) *
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={kiloStr}
              onChange={(e) => handleKiloChange(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-2xl font-black text-[#f5c518] placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-black text-sky-300">
              KG
            </span>
          </div>
        </div>

        {/* ─── 3. Hizmet Seçimi ─── */}
        <div className="space-y-3">
          <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-200">
            <span>Yapılacak Hizmetler *</span>
            <span className="text-[11px] font-normal text-sky-300">En az 1 seçim yapınız</span>
          </label>

          {/* Hazır Paket Seçiciler Varsa */}
          {hizmetTipleri.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hizmetTipleri.map((tip) => {
                const aktif = seciliTipId === tip.id;
                return (
                  <button
                    key={tip.id}
                    type="button"
                    onClick={() => handleTipSecimi(tip)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                      aktif
                        ? "border-[#f5c518] bg-[#f5c518]/15 text-[#f5c518] shadow-sm"
                        : "border-white/10 bg-white/5 text-sky-200 hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{tip.ad}</span>
                    <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-sky-200">
                      {tip.varsayilanBirimFiyat} ₺/kg
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hizmet Checkbox'ları */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {/* Kırma */}
            <label
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                kirma
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-black/20 text-sky-300 hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-bold">Kırma</span>
              <input
                type="checkbox"
                checked={kirma}
                onChange={() => handleCheckboxToggle("kirma")}
                className="h-4 w-4 rounded accent-emerald-500"
              />
            </label>

            {/* Kavurma */}
            <label
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                kavurma
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  : "border-white/10 bg-black/20 text-sky-300 hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-bold">Kavurma</span>
              <input
                type="checkbox"
                checked={kavurma}
                onChange={() => handleCheckboxToggle("kavurma")}
                className="h-4 w-4 rounded accent-amber-500"
              />
            </label>

            {/* Vakumlu Paketleme */}
            <label
              className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                paketleme
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-white/10 bg-black/20 text-sky-300 hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-bold">Vakumlu Paketleme</span>
              <input
                type="checkbox"
                checked={paketleme}
                onChange={() => handleCheckboxToggle("paketleme")}
                className="h-4 w-4 rounded accent-sky-500"
              />
            </label>
          </div>

          {/* Vakumlu Paketleme Boyutu & Adedi */}
          {paketleme && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-3.5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-200">
                Vakumlu Paketleme Detayları
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-sky-300">
                    Paket Boyutu
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: "1_KG", etiket: "1 KG" },
                      { key: "500_GR", etiket: "500 GR" },
                      { key: "250_GR", etiket: "250 GR" },
                      { key: "OZEL", etiket: "Özel" },
                    ].map((boyut) => (
                      <button
                        key={boyut.key}
                        type="button"
                        onClick={() => setPaketTipi(boyut.key)}
                        className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                          paketTipi === boyut.key
                            ? "bg-[#f5c518] text-[#081226]"
                            : "border border-white/10 bg-black/20 text-sky-200 hover:bg-white/5"
                        }`}
                      >
                        {boyut.etiket}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-sky-300">
                    Tahmini / İstenen Paket Sayısı
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Örn: 50"
                    value={paketAdedi}
                    onChange={(e) => setPaketAdedi(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 font-mono text-sm text-white placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 4. Fiyat & Tutar Hesaplama ─── */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-white/5 bg-black/30 p-3.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-bold text-sky-200">
              <span>Birim Fiyat (TL/KG)</span>
              <span className="text-[10px] text-sky-400">Kilo başına</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={birimFiyatStr}
                onChange={(e) => handleBirimFiyatChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-sm font-bold text-white focus:border-[#f5c518] focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-sky-300">
                ₺
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-bold text-sky-200">
              <span>Toplam Hizmet Tutarı</span>
              <span className="text-[10px] text-sky-400">İsteğe göre düzenlenebilir</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={toplamTutarStr}
                onChange={(e) => {
                  setToplamTutarStr(e.target.value);
                  setManuelTutar(true);
                }}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-base font-black text-[#f5c518] focus:border-[#f5c518] focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#f5c518]">
                ₺
              </span>
            </div>
          </div>
        </div>

        {/* ─── 5. Müşteri Notları ─── */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-200">
            <FileText className="h-3.5 w-3.5 text-[#f5c518]" /> Varsa Özel Not / Talimat
          </label>
          <textarea
            rows={2}
            placeholder="Örn: Çuvallara 1'er kg vakumlansın, az kavrulsun..."
            value={notlar}
            onChange={(e) => setNotlar(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
          />
        </div>

        {/* ─── 6. SMS Bildirimi Seçeneği ─── */}
        {smsAktif && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
            <label className="flex cursor-pointer items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-sky-400" />
                <div>
                  <div className="text-xs font-bold text-white">
                    Müşteriye Sıra Numarası SMS&apos;i Gönder
                  </div>
                  <div className="text-[11px] text-sky-300">
                    Kayıt tamamlandığında {telefon || "müşteriye"} otomatik SMS iletilecektir.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={smsGonderilsin}
                onChange={(e) => setSmsGonderilsin(e.target.checked)}
                className="h-4 w-4 rounded accent-[#f5c518]"
              />
            </label>
          </div>
        )}

        {/* ─── Butonlar ─── */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit(false)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4 text-sky-300" />
            Sadece Kaydet
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit(true)}
            className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-5 py-2.5 text-sm font-black text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Kaydet ve Etiket Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
