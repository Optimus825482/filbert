"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, Save } from "lucide-react";
import { updateSmsAyarlari, testSmsGonder } from "@/lib/actions/hizmet-tanimlar";
import type { SmsSaglayici } from "@/lib/sms/types";
import { VARSAYILAN_KAYIT_SABLONU, VARSAYILAN_TAMAMLANDI_SABLONU } from "@/lib/sms/types";

interface Props {
  ayarlar: {
    aktif: boolean;
    saglayici: string;
    apiUrl?: string;
    kullaniciAdi?: string;
    sifre?: string;
    baslik?: string;
    kayitSablonu: string;
    tamamlandiSablonu: string;
    otomatikGirisSms: boolean;
  };
  guncelleYetkisi: boolean;
}

export function SmsAyarTanim({ ayarlar, guncelleYetkisi }: Props) {
  const [isPending, startTransition] = useTransition();

  // Form State
  const [aktif, setAktif] = useState(ayarlar.aktif);
  const [saglayici, setSaglayici] = useState<SmsSaglayici>(
    (ayarlar.saglayici as SmsSaglayici) || "TEST"
  );
  const [apiUrl, setApiUrl] = useState(ayarlar.apiUrl || "");
  const [kullaniciAdi, setKullaniciAdi] = useState(ayarlar.kullaniciAdi || "");
  const [sifre, setSifre] = useState(ayarlar.sifre || "");
  const [baslik, setBaslik] = useState(ayarlar.baslik || "");
  const [kayitSablonu, setKayitSablonu] = useState(
    ayarlar.kayitSablonu || VARSAYILAN_KAYIT_SABLONU
  );
  const [tamamlandiSablonu, setTamamlandiSablonu] = useState(
    ayarlar.tamamlandiSablonu || VARSAYILAN_TAMAMLANDI_SABLONU
  );
  const [otomatikGirisSms, setOtomatikGirisSms] = useState(ayarlar.otomatikGirisSms);

  // Test SMS State
  const [testTel, setTestTel] = useState("");
  const [testPending, setTestPending] = useState(false);

  function degiskenEkle(sablonTipi: "KAYIT" | "TAMAMLANDI", degisken: string) {
    if (sablonTipi === "KAYIT") {
      setKayitSablonu((onceki) => onceki + ` {${degisken}}`);
    } else {
      setTamamlandiSablonu((onceki) => onceki + ` {${degisken}}`);
    }
  }

  function handleKaydet() {
    startTransition(async () => {
      const res = await updateSmsAyarlari({
        aktif,
        saglayici,
        apiUrl: apiUrl.trim() || undefined,
        kullaniciAdi: kullaniciAdi.trim() || undefined,
        sifre: sifre.trim() || undefined,
        baslik: baslik.trim() || undefined,
        kayitSablonu,
        tamamlandiSablonu,
        otomatikGirisSms,
      });

      if (!res.ok) {
        toast.error(res.hata || "SMS ayarları kaydedilemedi");
        return;
      }
      toast.success("SMS ayarları ve şablonları güncellendi.");
    });
  }

  async function handleTestGonder() {
    if (!testTel.trim()) {
      toast.error("Lütfen test edilecek telefon numarasını giriniz.");
      return;
    }

    setTestPending(true);
    try {
      const res = await testSmsGonder(testTel.trim());
      if (res.ok) {
        toast.success(`Test SMS'i iletildi! (${res.mesajId || "Başarılı"})`);
      } else {
        toast.error(res.hata || "Test SMS gönderilemedi");
      }
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setTestPending(false);
    }
  }

  const degiskenListesi = [
    { anahtar: "musteri_adi", aciklama: "Müşteri Ad Soyad" },
    { anahtar: "sira_no", aciklama: "4 Haneli Sıra No (0001)" },
    { anahtar: "kilo", aciklama: "Fındık Kilosu" },
    { anahtar: "hizmetler", aciklama: "İşlemler (Kırma, Kavurma vb.)" },
    { anahtar: "tutar", aciklama: "Toplam Hizmet Tutarı" },
    { anahtar: "firma_adi", aciklama: "Firma Ünvanı" },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Genel Durum & Sağlayıcı ─── */}
      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#f5c518]" />
            <div>
              <h2 className="text-base font-bold text-white">SMS Servis Sağlayıcı Ayarları</h2>
              <p className="text-xs text-sky-200">
                Müşteri bildirimleri için SMS sağlayıcı entegrasyonu
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold text-white">
            <span>SMS Servisi:</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                aktif ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-800 text-sky-200"
              }`}
            >
              {aktif ? "Aktif" : "Pasif"}
            </span>
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              className="h-4 w-4 rounded accent-[#f5c518]"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sağlayıcı Seçimi */}
          <div>
            <label className="mb-1 block text-xs font-bold text-sky-200">SMS Sağlayıcı</label>
            <select
              value={saglayici}
              onChange={(e) => setSaglayici(e.target.value as SmsSaglayici)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
            >
              <option value="NETGSM" className="bg-[#081226] text-white">
                Netgsm (XML / HTTP GET)
              </option>
              <option value="ILETIMERKEZI" className="bg-[#081226] text-white">
                İletiMerkezi (JSON REST API)
              </option>
              <option value="GENERIC_HTTP" className="bg-[#081226] text-white">
                Özel Webhook / Generic HTTP POST
              </option>
              <option value="TEST" className="bg-[#081226] text-white">
                Test / Simülasyon Modu (Kredi Harcamaz)
              </option>
            </select>
          </div>

          {/* Gönderici Başlığı (Originator) */}
          <div>
            <label className="mb-1 block text-xs font-bold text-sky-200">
              Gönderici Başlığı (Originator / Header)
            </label>
            <input
              type="text"
              placeholder="Örn: FILBERT veya FIRMAADI"
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white uppercase placeholder-white/30 focus:border-[#f5c518] focus:outline-none"
            />
          </div>

          {/* Kullanıcı Adı / API Key */}
          <div>
            <label className="mb-1 block text-xs font-bold text-sky-200">
              Kullanıcı Adı / API Key
            </label>
            <input
              type="text"
              placeholder="API Kullanıcı adı veya anahtar"
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#f5c518] focus:outline-none"
            />
          </div>

          {/* Şifre / API Secret */}
          <div>
            <label className="mb-1 block text-xs font-bold text-sky-200">Şifre / API Secret</label>
            <input
              type="password"
              placeholder="••••••••"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#f5c518] focus:outline-none"
            />
          </div>

          {/* Generic API URL (opsiyonel) */}
          {saglayici === "GENERIC_HTTP" && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-sky-200">Webhook / API URL</label>
              <input
                type="url"
                placeholder="https://sms-api.servis.com/send"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#f5c518] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Otomatik Kayıt SMS Toggle */}
        <div className="mt-4 border-t border-white/5 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-sky-200">
            <input
              type="checkbox"
              checked={otomatikGirisSms}
              onChange={(e) => setOtomatikGirisSms(e.target.checked)}
              className="h-4 w-4 rounded accent-[#f5c518]"
            />
            <span>Yeni sipariş oluşturulduğunda otomatik sıra numarası SMS&apos;i gönder</span>
          </label>
        </div>
      </div>

      {/* ─── SMS Şablonları ─── */}
      <div className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-white">SMS Mesaj Şablonları</h3>
          <p className="text-xs text-sky-200">
            Müşterilere otomatik giden SMS metinlerini ve değişkenlerini özelleştirin
          </p>
        </div>

        {/* Değişken Kısayolları */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
            Kullanılabilir Değişkenler:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {degiskenListesi.map((d) => (
              <span
                key={d.anahtar}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-amber-200"
                title={d.aciklama}
              >
                {`{${d.anahtar}}`}
              </span>
            ))}
          </div>
        </div>

        {/* 1. Kayıt / Sıraya Alındı Şablonu */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold text-sky-200">
              1. Kayıt Bildirim Şablonu (Sıraya Alındı)
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => degiskenEkle("KAYIT", "sira_no")}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-white/10"
              >
                + Sıra No
              </button>
              <button
                type="button"
                onClick={() => degiskenEkle("KAYIT", "kilo")}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-white/10"
              >
                + Kilo
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={kayitSablonu}
            onChange={(e) => setKayitSablonu(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white focus:border-[#f5c518] focus:outline-none"
          />
        </div>

        {/* 2. Tamamlandı / Hazır Şablonu */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold text-sky-200">
              2. Tamamlandı Bildirim Şablonu (Teslim Alabilirsiniz)
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => degiskenEkle("TAMAMLANDI", "sira_no")}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-white/10"
              >
                + Sıra No
              </button>
              <button
                type="button"
                onClick={() => degiskenEkle("TAMAMLANDI", "tutar")}
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-white/10"
              >
                + Tutar
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={tamamlandiSablonu}
            onChange={(e) => setTamamlandiSablonu(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white focus:border-[#f5c518] focus:outline-none"
          />
        </div>

        {/* Kaydet Butonu */}
        {guncelleYetkisi && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleKaydet}
              className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-5 py-2.5 text-xs font-black text-[#081226] hover:bg-[#e5b508] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Ayarları ve Şablonları Kaydet
            </button>
          </div>
        )}
      </div>

      {/* ─── Test SMS Gönderimi ─── */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-200">
          Entegrasyon Testi
        </h4>
        <p className="mt-0.5 text-xs text-sky-300">
          Ayarları test etmek için bir telefon numarası girip test SMS&apos;i gönderebilirsiniz.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="tel"
            placeholder="0532 000 00 00"
            value={testTel}
            onChange={(e) => setTestTel(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-sm text-white placeholder-white/30 focus:border-[#f5c518] focus:outline-none sm:w-64"
          />
          <button
            type="button"
            disabled={testPending || !testTel.trim()}
            onClick={handleTestGonder}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/20 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {testPending ? "Gönderiliyor..." : "Test SMS Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
