"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Printer,
  MessageSquare,
  CheckCircle2,
  Play,
  XCircle,
  Send,
  Phone,
  MessageCircle,
  Banknote,
  Check,
} from "lucide-react";
import {
  updateHizmetDurumu,
  topluHizmetDurumuGuncelle,
  topluSmsGonder,
  hizmetSmsTekrarGonder,
  iptalHizmetKaydi,
  hizmetTahsilatKaydet,
} from "@/lib/actions/hizmet";
import { telefonTemizle } from "@/lib/sms/sms-servisi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface HizmetSatir {
  id: string;
  siraNo: string;
  siraSayisi: number;
  musteriAdi: string;
  telefon: string;
  kilo: number;
  kirma: boolean;
  kavurma: boolean;
  paketleme: boolean;
  paketTipi?: string | null;
  paketAdedi?: number | null;
  cariId?: string | null;
  odemeDurumu?: string | null;
  odemeYontemi?: string | null;
  kasaHesapId?: string | null;
  tahsilEdilenTutar?: number | null;
  hizmetTipiAdi?: string | null;
  birimFiyat: number;
  toplamTutar: number;
  notlar?: string | null;
  durum: "SIRAYA_ALINDI" | "HAZIRLANIYOR" | "TAMAMLANDI" | "TESLIM_EDILDI" | "IPTAL";
  girisSmsGonderildi: boolean;
  tamamlandiSmsGonderildi: boolean;
  etiketBasildiSayisi: number;
  createdAt: string;
  tarihSaatStr: string;
}

interface Props {
  kayitlar: HizmetSatir[];
  smsAktif: boolean;
  kasalar?: Array<{ id: string; ad: string; tip: string }>;
  firmaAdi?: string;
}

export function HizmetTablosu({ kayitlar, smsAktif, kasalar = [], firmaAdi = "" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Arama & Filtre State
  const [arama, setArama] = useState("");
  const [durumFiltresi, setDurumFiltresi] = useState<string>("HEPSI");

  // Toplu Seçim State
  const [seciliIds, setSeciliIds] = useState<string[]>([]);

  // Tamamlandı SMS Onay Modalı State
  const [smsOnayModalAcik, setSmsOnayModalAcik] = useState(false);
  const [hedefKayit, setHedefKayit] = useState<HizmetSatir | null>(null);

  // Toplu SMS Onay Modalı State
  const [topluSmsModalAcik, setTopluSmsModalAcik] = useState(false);

  // Tahsilat Modalı State
  const [tahsilatModalAcik, setTahsilatModalAcik] = useState(false);
  const [tahsilatKayit, setTahsilatKayit] = useState<HizmetSatir | null>(null);
  const [tahsilatYontem, setTahsilatYontem] = useState<"NAKIT" | "POS" | "HAVALE" | "VERESIYE">("NAKIT");
  const [tahsilatKasaId, setTahsilatKasaId] = useState<string>(kasalar[0]?.id || "");
  const [tahsilatTutarStr, setTahsilatTutarStr] = useState<string>("");
  const [tahsilatTeslimEt, setTahsilatTeslimEt] = useState<boolean>(true);

  function handleTahsilatAc(kayit: HizmetSatir) {
    setTahsilatKayit(kayit);
    setTahsilatTutarStr(String(kayit.toplamTutar));
    setTahsilatYontem((kayit.odemeYontemi as "NAKIT" | "POS" | "HAVALE" | "VERESIYE") || "NAKIT");
    setTahsilatKasaId(kayit.kasaHesapId || kasalar[0]?.id || "");
    setTahsilatTeslimEt(kayit.durum !== "TESLIM_EDILDI");
    setTahsilatModalAcik(true);
  }

  function handleTahsilatOnayla() {
    if (!tahsilatKayit) return;
    const tutar = parseFloat(tahsilatTutarStr.replace(",", ".")) || tahsilatKayit.toplamTutar;

    startTransition(async () => {
      const res = await hizmetTahsilatKaydet({
        hizmetId: tahsilatKayit.id,
        odemeYontemi: tahsilatYontem,
        kasaHesapId: tahsilatYontem !== "VERESIYE" ? tahsilatKasaId : undefined,
        tutar,
        teslimEt: tahsilatTeslimEt,
      });

      if (!res.ok) {
        toast.error(res.hata || "Tahsilat kaydedilemedi");
        return;
      }

      toast.success(
        `#${tahsilatKayit.siraNo} ${
          tahsilatYontem === "VERESIYE" ? "Veresiye olarak kaydedildi" : "Tahsilat kasaya işlendi!"
        }`
      );
      setTahsilatModalAcik(false);
      router.refresh();
    });
  }

  function handleWhatsAppGonder(kayit: HizmetSatir) {
    const tel = telefonTemizle(kayit.telefon);
    const islemler = [];
    if (kayit.kirma) islemler.push("Kırma");
    if (kayit.kavurma) islemler.push("Kavurma");
    if (kayit.paketleme) islemler.push("Paketleme");
    const islemStr = islemler.join(" + ") || "Hizmet";

    const metin = `Sayın ${kayit.musteriAdi}, #${kayit.siraNo} sıra no'lu ${kayit.kilo} kg fındığınızın ${islemStr} işlemi hazırlanmıştır. Tutar: ${kayit.toplamTutar} TL. Teslim alabilirsiniz. ${firmaAdi}`.trim();

    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(metin)}`, "_blank");
  }

  // Filtrelenmiş Liste
  const filtrelenmis = kayitlar.filter((k) => {
    // Durum filtresi
    if (durumFiltresi !== "HEPSI" && k.durum !== durumFiltresi) {
      return false;
    }
    // Arama metni
    if (arama.trim()) {
      const q = arama.trim().toLowerCase();
      const siraNoEslesir = k.siraNo.toLowerCase().includes(q);
      const adEslesir = k.musteriAdi.toLowerCase().includes(q);
      const telEslesir = k.telefon.toLowerCase().includes(q);
      const notEslesir = k.notlar?.toLowerCase().includes(q) ?? false;
      return siraNoEslesir || adEslesir || telEslesir || notEslesir;
    }
    return true;
  });

  // Çoklu Seçim Fonksiyonları
  function toggleSecim(id: string) {
    setSeciliIds((onceki) =>
      onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id]
    );
  }

  function toggleTumunuSec() {
    if (seciliIds.length === filtrelenmis.length) {
      setSeciliIds([]);
    } else {
      setSeciliIds(filtrelenmis.map((k) => k.id));
    }
  }

  // Durum Değiştirme Aksiyonu
  function handleDurumDegistir(kayit: HizmetSatir, yeniDurum: HizmetSatir["durum"]) {
    // Eğer TAMAMLANDI durumuna alınıyorsa kullanıcıya SMS sor
    if (yeniDurum === "TAMAMLANDI") {
      setHedefKayit(kayit);
      setSmsOnayModalAcik(true);
      return;
    }

    startTransition(async () => {
      const res = await updateHizmetDurumu(kayit.id, yeniDurum, false);
      if (!res.ok) {
        toast.error(res.hata || "Durum güncellenemedi");
        return;
      }
      toast.success(`#${kayit.siraNo} durumu güncellendi.`);
      router.refresh();
    });
  }

  // Tamamlandı Modalında Karar
  function handleTamamlandiOnayla(smsGonderilsin: boolean) {
    if (!hedefKayit) return;
    const kayit = hedefKayit;
    setSmsOnayModalAcik(false);

    startTransition(async () => {
      const res = await updateHizmetDurumu(kayit.id, "TAMAMLANDI", smsGonderilsin);
      if (!res.ok) {
        toast.error(res.hata || "Durum güncellenemedi");
        return;
      }

      toast.success(
        `#${kayit.siraNo} tamamlandı olarak işaretlendi!${
          res.smsGitti ? " Müşteriye SMS gönderildi." : ""
        }`
      );
      router.refresh();
    });
  }

  // Toplu Durum Güncelleme
  function handleTopluDurum(yeniDurum: HizmetSatir["durum"]) {
    if (seciliIds.length === 0) return;
    startTransition(async () => {
      const res = await topluHizmetDurumuGuncelle(seciliIds, yeniDurum, false);
      if (!res.ok) {
        toast.error(res.hata || "Toplu işlem başarısız");
        return;
      }
      toast.success(`${res.guncellenenAdet} kayıt ${yeniDurum} durumuna alındı.`);
      setSeciliIds([]);
      router.refresh();
    });
  }

  // Toplu SMS Gönderimi
  function handleTopluSmsGonder() {
    if (seciliIds.length === 0) return;
    setTopluSmsModalAcik(false);

    startTransition(async () => {
      const res = await topluSmsGonder(seciliIds);
      if (!res.ok) {
        toast.error(res.hata || "Toplu SMS gönderilemedi");
        return;
      }
      toast.success(
        `${res.basariliAdet} müşteriye SMS gönderildi.${
          res.hataliAdet > 0 ? ` (${res.hataliAdet} hata)` : ""
        }`
      );
      setSeciliIds([]);
      router.refresh();
    });
  }

  // Tekil SMS Tekrar Gönder
  function handleTekrarSms(id: string, tip: "KAYIT" | "TAMAMLANDI") {
    startTransition(async () => {
      const res = await hizmetSmsTekrarGonder(id, tip);
      if (res.ok) {
        toast.success("SMS başarıyla iletildi.");
        router.refresh();
      } else {
        toast.error(res.hata || "SMS gönderilemedi");
      }
    });
  }

  // İptal Et
  function handleIptal(kayit: HizmetSatir) {
    if (!confirm(`#${kayit.siraNo} numaralı ${kayit.musteriAdi} kaydını iptal etmek istediğinize emin misiniz?`)) {
      return;
    }
    startTransition(async () => {
      const res = await iptalHizmetKaydi(kayit.id);
      if (res.ok) {
        toast.info(`#${kayit.siraNo} kaydı iptal edildi.`);
        router.refresh();
      } else {
        toast.error(res.hata || "İptal edilemedi");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ─── Kontrol & Filtre Çubuğu ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Arama Kutusu ve SMS Durumu */}
        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
            <input
              type="text"
              placeholder="Sıra No, Müşteri, Telefon..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-4 text-sm text-white placeholder:text-sky-300/50 focus:border-[#f5c518] focus:outline-none"
            />
          </div>
          {smsAktif ? (
            <span className="hidden items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-bold text-emerald-400 md:inline-flex" title="Otomatik SMS Bildirimi Aktif">
              <MessageSquare className="h-3 w-3" />
              SMS Aktif
            </span>
          ) : (
            <span className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-bold text-sky-300 md:inline-flex" title="SMS Servisi Pasif veya Test Modunda">
              <MessageSquare className="h-3 w-3" />
              SMS Pasif
            </span>
          )}
        </div>

        {/* Durum Sekmeleri / Filtreler */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {[
            { key: "HEPSI", etiket: "Tümü" },
            { key: "SIRAYA_ALINDI", etiket: "Sırada" },
            { key: "HAZIRLANIYOR", etiket: "Hazırlanıyor" },
            { key: "TAMAMLANDI", etiket: "Tamamlandı" },
            { key: "TESLIM_EDILDI", etiket: "Teslim Edildi" },
          ].map((sekme) => (
            <button
              key={sekme.key}
              type="button"
              onClick={() => setDurumFiltresi(sekme.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                durumFiltresi === sekme.key
                  ? "bg-[#f5c518] text-[#081226] shadow-sm"
                  : "text-sky-200 hover:bg-white/5 hover:text-white"
              }`}
            >
              {sekme.etiket}
            </button>
          ))}
        </div>

        {/* Yeni Kayıt Butonu */}
        <Link
          href="/hizmet/yeni"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2 text-sm font-extrabold text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Yeni Hizmet Kaydı
        </Link>
      </div>

      {/* ─── Toplu İşlem Çubuğu (Seçim Varsa) ─── */}
      {seciliIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-950/80 p-3 shadow-lg backdrop-blur">
          <div className="text-xs font-bold text-sky-200">
            <span className="font-mono text-sm text-[#f5c518]">{seciliIds.length}</span> kayıt seçildi
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTopluDurum("HAZIRLANIYOR")}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
            >
              <Play className="h-3.5 w-3.5" /> Hazırlanıyor Yap
            </button>

            <button
              type="button"
              onClick={() => handleTopluDurum("TAMAMLANDI")}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Tamamlandı Yap
            </button>

            <button
              type="button"
              onClick={() => setTopluSmsModalAcik(true)}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-sky-500"
            >
              <Send className="h-3.5 w-3.5" /> Seçilenlere SMS Gönder
            </button>

            <button
              type="button"
              onClick={() => setSeciliIds([])}
              className="rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-sky-200 hover:bg-white/10"
            >
              Seçimi Kaldır
            </button>
          </div>
        </div>
      )}

      {/* ─── Liste Tablosu ─── */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-wider text-sky-200">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={
                    filtrelenmis.length > 0 &&
                    seciliIds.length === filtrelenmis.length
                  }
                  onChange={toggleTumunuSec}
                  className="h-4 w-4 rounded accent-[#f5c518]"
                />
              </th>
              <th className="px-3 py-3">Sıra No</th>
              <th className="px-3 py-3">Müşteri</th>
              <th className="px-3 py-3 text-right">Miktar (KG)</th>
              <th className="px-3 py-3">İşlemler</th>
              <th className="px-3 py-3 text-right">Tutar</th>
              <th className="px-3 py-3">Durum</th>
              <th className="px-3 py-3 text-center">SMS</th>
              <th className="px-3 py-3 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-medium">
            {filtrelenmis.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sky-400">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              filtrelenmis.map((k) => {
                const secili = seciliIds.includes(k.id);

                return (
                  <tr
                    key={k.id}
                    className={`transition-colors hover:bg-white/5 ${
                      secili ? "bg-sky-950/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={secili}
                        onChange={() => toggleSecim(k.id)}
                        className="h-4 w-4 rounded accent-[#f5c518]"
                      />
                    </td>

                    {/* Sıra No */}
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center rounded-lg bg-[#f5c518]/15 px-2.5 py-1 font-mono text-base font-black text-[#f5c518] ring-1 ring-[#f5c518]/30">
                        #{k.siraNo}
                      </div>
                      <div className="mt-0.5 text-[10px] text-sky-400">
                        {k.tarihSaatStr}
                      </div>
                    </td>

                    {/* Müşteri Adı & Tel */}
                    <td className="px-3 py-3">
                      <div className="font-bold text-white">{k.musteriAdi}</div>
                      <div className="flex items-center gap-1 font-mono text-xs text-sky-300">
                        <Phone className="h-3 w-3" />
                        {k.telefon}
                      </div>
                      {k.notlar && (
                        <div className="mt-1 line-clamp-1 max-w-[200px] text-[11px] italic text-amber-200/80">
                          {k.notlar}
                        </div>
                      )}
                    </td>

                    {/* Kilo */}
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-base font-black text-white">
                        {k.kilo} <span className="text-xs text-sky-300">KG</span>
                      </div>
                    </td>

                    {/* Hizmet Seçimleri Rozetleri */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.kirma && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                            Kırma
                          </span>
                        )}
                        {k.kavurma && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                            Kavurma
                          </span>
                        )}
                        {k.paketleme && (
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/20">
                            Vakumlu Paket
                          </span>
                        )}
                      </div>
                      {k.paketTipi && (
                        <div className="mt-1 font-mono text-[10px] font-extrabold text-sky-200">
                          📦 {k.paketAdedi ? `${k.paketAdedi}× ` : ""}{k.paketTipi.replace("_", " ")}
                        </div>
                      )}
                    </td>

                    {/* Tutar & Tahsilat Durumu */}
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-sm font-extrabold text-[#f5c518]">
                        {k.toplamTutar} ₺
                      </div>
                      <div className="mt-1 flex justify-end">
                        {k.odemeDurumu === "ODENDI" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                            <Check className="h-2.5 w-2.5" />
                            {k.odemeYontemi || "Ödendi"}
                          </span>
                        ) : k.odemeDurumu === "VERESIYE" ? (
                          <button
                            type="button"
                            onClick={() => handleTahsilatAc(k)}
                            className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                            title="Tahsilat gir"
                          >
                            Veresiye
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTahsilatAc(k)}
                            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-[#f5c518]/20 hover:text-[#f5c518]"
                            title="Tahsilat yap"
                          >
                            <Banknote className="h-2.5 w-2.5" />
                            Tahsil Et
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Durum Rozeti & Seçici */}
                    <td className="px-3 py-3">
                      <DurumSecici
                        durum={k.durum}
                        onChange={(yeniDurum) => handleDurumDegistir(k, yeniDurum)}
                      />
                    </td>

                    {/* SMS Durum Rozetleri */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Kayıt SMS */}
                        <button
                          type="button"
                          onClick={() => handleTekrarSms(k.id, "KAYIT")}
                          title={`Kayıt SMS&apos;i: ${
                            k.girisSmsGonderildi ? "Gönderildi" : "Gönderilmedi"
                          } (Tekrar göndermek için tıkla)`}
                          className={`rounded p-1 transition-colors ${
                            k.girisSmsGonderildi
                              ? "text-emerald-400 hover:bg-emerald-500/10"
                              : "text-sky-400 hover:text-white"
                          }`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>

                        {/* Tamamlandı SMS */}
                        <button
                          type="button"
                          onClick={() => handleTekrarSms(k.id, "TAMAMLANDI")}
                          title={`Tamamlandı SMS&apos;i: ${
                            k.tamamlandiSmsGonderildi
                              ? "Gönderildi"
                              : "Gönderilmedi"
                          } (Tekrar göndermek için tıkla)`}
                          className={`rounded p-1 transition-colors ${
                            k.tamamlandiSmsGonderildi
                              ? "text-sky-400 hover:bg-sky-500/10"
                              : "text-sky-400 hover:text-white"
                          }`}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </td>

                    {/* Hızlı Aksiyonlar */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* WhatsApp Hızlı Gönder */}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppGonder(k)}
                          title="Müşteriye WhatsApp ile bildirim aç"
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 hover:text-emerald-200"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>

                        {/* Etiket Yazdır */}
                        <Link
                          href={`/hizmet/${k.id}/etiket`}
                          title={`Termal Etiket Yazdır (Daha önce ${k.etiketBasildiSayisi} kez basıldı)`}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-sky-200 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Printer className="h-3.5 w-3.5 text-[#f5c518]" />
                          <span>Yazdır</span>
                        </Link>

                        {/* İptal */}
                        {k.durum !== "IPTAL" && (
                          <button
                            type="button"
                            onClick={() => handleIptal(k)}
                            title="İşlemi İptal Et"
                            className="rounded-lg p-1.5 text-sky-300 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Tamamlandı SMS Gönderilsin mi? Onay Modalı ─── */}
      <Dialog open={smsOnayModalAcik} onOpenChange={setSmsOnayModalAcik}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Siparişi Tamamla & Bildirim
            </DialogTitle>
            <DialogDescription className="text-sky-200">
              <span className="font-bold text-white">#{hedefKayit?.siraNo}</span> sıra numaralı{" "}
              <span className="font-bold text-[#f5c518]">{hedefKayit?.musteriAdi}</span> (
              {hedefKayit?.kilo} kg) fındığın işlemleri tamamlandı olarak işaretleniyor.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-3 text-xs text-sky-200">
            Müşterinin telefonuna (<b>{hedefKayit?.telefon}</b>) fındığının hazır olduğuna ve teslim
            alabileceğine dair <b>SMS gönderilsin mi?</b>
          </div>

          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleTamamlandiOnayla(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-white/5"
            >
              Hayır, Sadece Tamamla
            </button>

            <button
              type="button"
              onClick={() => {
                if (hedefKayit) {
                  handleWhatsAppGonder(hedefKayit);
                  handleTamamlandiOnayla(false);
                }
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              WhatsApp ile Bildir
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleTamamlandiOnayla(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-[#081226] shadow hover:bg-emerald-400"
            >
              <Send className="h-3.5 w-3.5" />
              Evet, SMS Gönder ve Tamamla
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Toplu SMS Onay Modalı ─── */}
      <Dialog open={topluSmsModalAcik} onOpenChange={setTopluSmsModalAcik}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
              <Send className="h-5 w-5 text-sky-400" />
              Toplu SMS Gönderimi
            </DialogTitle>
            <DialogDescription className="text-sky-200">
              Seçilen <span className="font-bold text-[#f5c518]">{seciliIds.length}</span> müşteriye
              fındıklarının hazır olduğuna dair hazır SMS bildirimi gönderilecektir.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setTopluSmsModalAcik(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-white/5"
            >
              Vazgeç
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleTopluSmsGonder}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-black text-white shadow hover:bg-sky-400"
            >
              <Send className="h-3.5 w-3.5" />
              SMS&apos;leri Şimdi Gönder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Tahsilat / Ödeme Alma Modalı ─── */}
      <Dialog open={tahsilatModalAcik} onOpenChange={setTahsilatModalAcik}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
              <Banknote className="h-5 w-5 text-[#f5c518]" />
              Hizmet Bedeli Tahsilatı
            </DialogTitle>
            <DialogDescription className="text-sky-200">
              #{tahsilatKayit?.siraNo} - {tahsilatKayit?.musteriAdi} ({tahsilatKayit?.kilo} kg)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tutar */}
            <div>
              <label className="mb-1 block text-xs font-bold text-sky-200">
                Tahsil Edilecek Tutar (TL)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={tahsilatTutarStr}
                onChange={(e) => setTahsilatTutarStr(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-xl font-bold text-[#f5c518] focus:border-[#f5c518] focus:outline-none"
              />
            </div>

            {/* Ödeme Yöntemi */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-sky-200">
                Ödeme Yöntemi
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { key: "NAKIT", etiket: "Nakit" },
                    { key: "POS", etiket: "Kredi Kartı" },
                    { key: "HAVALE", etiket: "Havale" },
                    { key: "VERESIYE", etiket: "Veresiye" },
                  ] as const
                ).map((y) => (
                  <button
                    key={y.key}
                    type="button"
                    onClick={() => setTahsilatYontem(y.key)}
                    className={`rounded-lg py-2 text-xs font-bold transition-all ${
                      tahsilatYontem === y.key
                        ? "bg-[#f5c518] text-[#081226]"
                        : "border border-white/10 bg-black/20 text-sky-200 hover:bg-white/5"
                    }`}
                  >
                    {y.etiket}
                  </button>
                ))}
              </div>
            </div>

            {/* Kasa Seçimi (Veresiye değilse) */}
            {tahsilatYontem !== "VERESIYE" && (
              <div>
                <label className="mb-1 block text-xs font-bold text-sky-200">
                  Hedef Kasa / Hesap
                </label>
                {kasalar.length > 0 ? (
                  <select
                    value={tahsilatKasaId}
                    onChange={(e) => setTahsilatKasaId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#081226] px-3.5 py-2 text-sm font-semibold text-white focus:border-[#f5c518] focus:outline-none"
                  >
                    {kasalar.map((kasa) => (
                      <option key={kasa.id} value={kasa.id}>
                        {kasa.ad} ({kasa.tip})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-300">
                    Tanımlı aktif kasa bulunamadı. Ayarlar &gt; Kasa/Banka bölümünden ekleyebilirsiniz.
                  </div>
                )}
              </div>
            )}

            {/* Teslim Et Checkbox */}
            {tahsilatKayit?.durum !== "TESLIM_EDILDI" && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-sky-200">
                <input
                  type="checkbox"
                  checked={tahsilatTeslimEt}
                  onChange={(e) => setTahsilatTeslimEt(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#f5c518]"
                />
                <span>Fındık müşteriye teslim edildi olarak işaretlensin</span>
              </label>
            )}
          </div>

          <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setTahsilatModalAcik(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-sky-200 hover:bg-white/5"
            >
              Vazgeç
            </button>

            <button
              type="button"
              disabled={isPending || (tahsilatYontem !== "VERESIYE" && !tahsilatKasaId)}
              onClick={handleTahsilatOnayla}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f5c518] px-4 py-2 text-xs font-black text-[#081226] shadow hover:bg-[#e5b508] disabled:opacity-50"
            >
              <Banknote className="h-3.5 w-3.5" />
              Tahsilatı Kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Durum Seçici Dropdown / Buton Bileşeni ────────────────────
function DurumSecici({
  durum,
  onChange,
}: {
  durum: HizmetSatir["durum"];
  onChange: (d: HizmetSatir["durum"]) => void;
}) {
  const renkler: Record<HizmetSatir["durum"], string> = {
    SIRAYA_ALINDI: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    HAZIRLANIYOR: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    TAMAMLANDI: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    TESLIM_EDILDI: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    IPTAL: "bg-red-500/15 text-red-400 border-red-500/30 line-through",
  };

  return (
    <select
      value={durum}
      onChange={(e) => onChange(e.target.value as HizmetSatir["durum"])}
      className={`rounded-lg border px-2 py-1 text-xs font-black focus:outline-none ${renkler[durum]}`}
    >
      <option value="SIRAYA_ALINDI" className="bg-[#081226] text-blue-300">
        Sıraya Alındı
      </option>
      <option value="HAZIRLANIYOR" className="bg-[#081226] text-amber-300">
        Hazırlanıyor
      </option>
      <option value="TAMAMLANDI" className="bg-[#081226] text-emerald-300">
        Tamamlandı
      </option>
      <option value="TESLIM_EDILDI" className="bg-[#081226] text-purple-300">
        Teslim Edildi
      </option>
      <option value="IPTAL" className="bg-[#081226] text-red-400">
        İptal
      </option>
    </select>
  );
}
