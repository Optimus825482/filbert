"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SMS_DURUM_ETIKETLERI,
  SMS_SAGLAYICI_ETIKETLERI,
  SMS_TIP_ETIKETLERI,
  type SmsKayitDurumu,
  type SmsKayitTipi,
  type SmsSaglayici,
} from "@/lib/sms/types";
import { smsKaydiYenidenGonder, smsTeslimDurumlariniYenile } from "@/lib/actions/sms";

export type SmsMerkeziSatiri = {
  id: string;
  telefon: string;
  musteriAdi: string | null;
  mesaj: string;
  tip: string;
  durum: string;
  saglayici: string;
  saglayiciIsId: string | null;
  hataKodu: string | null;
  hataAciklama: string | null;
  parcaSayisi: number;
  birimMaliyetKurus: number | null;
  teslimKodu: number | null;
  teslimAt: string | null;
  createdAt: string;
  siraNo: string | null;
};

export type SmsMerkeziSayaclari = {
  bugunGonderilen: number;
  bugunTeslimEdilen: number;
  bugunHatali: number;
  bugunParca: number;
  raporBekleyen: number;
  hataliToplam: number;
  teslimEdilenToplam: number;
  toplamKayit: number;
};

const DURUM_RENKLERI: Record<SmsKayitDurumu, string> = {
  KUYRUKTA: "border-sky-500/30 bg-sky-500/15 text-sky-200",
  GONDERILDI: "border-cyan-500/30 bg-cyan-500/15 text-cyan-200",
  TESLIM_EDILDI: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  HATA: "border-red-500/30 bg-red-500/15 text-red-300",
  SIMULASYON: "border-amber-500/30 bg-amber-500/15 text-amber-200",
};

function durumEtiketi(durum: string): string {
  return SMS_DURUM_ETIKETLERI[durum as SmsKayitDurumu] ?? durum;
}

function tipEtiketi(tip: string): string {
  return SMS_TIP_ETIKETLERI[tip as SmsKayitTipi] ?? tip;
}

function zamanYaz(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kurusYaz(kurus: number): string {
  return `${(kurus / 100).toFixed(2).replace(".", ",")} TL`;
}

export function SmsMerkezi({
  kayitlar,
  sayaclar,
  ayarlar,
  filtre,
  guncelleYetkisi,
}: {
  kayitlar: SmsMerkeziSatiri[];
  sayaclar: SmsMerkeziSayaclari;
  ayarlar: {
    aktif: boolean;
    saglayici: string;
    baslik: string;
    kodlama: string;
    birimMaliyetKurus: number | null;
  };
  filtre: { durum: string; tip: string; arama: string };
  guncelleYetkisi: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [durum, setDurum] = useState(filtre.durum);
  const [tip, setTip] = useState(filtre.tip);
  const [arama, setArama] = useState(filtre.arama);

  const csvSorgusu = searchParams.toString();

  function filtreyiUygula(yeniDurum = durum, yeniTip = tip, yeniArama = arama) {
    const parametreler = new URLSearchParams();
    if (yeniDurum && yeniDurum !== "HEPSI") parametreler.set("durum", yeniDurum);
    if (yeniTip && yeniTip !== "HEPSI") parametreler.set("tip", yeniTip);
    if (yeniArama.trim()) parametreler.set("q", yeniArama.trim());
    const sorgu = parametreler.toString();
    router.push(sorgu ? `/hizmet/sms?${sorgu}` : "/hizmet/sms");
  }

  function handleTeslimSorgula(kayitId?: string) {
    startTransition(async () => {
      const res = await smsTeslimDurumlariniYenile(kayitId);
      if (!res.ok) {
        toast.error(res.hata || "Teslim durumu sorgulanamadı");
        return;
      }
      toast.success(
        res.guncellenen > 0
          ? `${res.guncellenen} kaydın teslim durumu güncellendi.`
          : "Güncellenecek yeni teslim raporu yok (kayıtlar hâlâ operatörde)."
      );
      router.refresh();
    });
  }

  function handleYenidenGonder(kayitId: string) {
    startTransition(async () => {
      const res = await smsKaydiYenidenGonder(kayitId);
      if (!res.ok) {
        toast.error(res.hata || "SMS yeniden gönderilemedi");
        return;
      }
      toast.success(
        res.simulasyon ? "Simülasyon modunda yeniden denendi (kredi harcanmadı)." : "SMS yeniden gönderildi."
      );
      router.refresh();
    });
  }

  const kpiKartlari = [
    { etiket: "Bugün gönderilen", deger: sayaclar.bugunGonderilen, ikon: Send, renk: "#38bdf8" },
    { etiket: "Bugün teslim edilen", deger: sayaclar.bugunTeslimEdilen, ikon: CheckCircle2, renk: "#34d399" },
    { etiket: "Bugün hatalı", deger: sayaclar.bugunHatali, ikon: AlertTriangle, renk: "#f87171" },
    { etiket: "Rapor bekleyen", deger: sayaclar.raporBekleyen, ikon: Clock, renk: "#a78bfa" },
    { etiket: "Bugünkü kredi", deger: sayaclar.bugunParca, ikon: MessageSquare, renk: "#f5c518" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">SMS Merkezi</h1>
          <p className="mt-0.5 text-xs font-semibold text-sky-200">
            Müşteri bildirimlerinin gönderim ve teslim durumu — tümü FİLBERT içinden izlenir
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/hizmet"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Talep Kuyruğu
          </Link>
          <Link
            href="/hizmet/ayarlar"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" /> İşleme Ayarları
          </Link>
          <a
            href={`/api/hizmet/sms/csv${csvSorgusu ? `?${csvSorgusu}` : ""}`}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> CSV indir
          </a>
        </div>
      </div>

      {/* KPI şerit */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpiKartlari.map((kpi) => (
          <div
            key={kpi.etiket}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sky-300">
                {kpi.etiket}
              </span>
              <kpi.ikon className="h-4 w-4" style={{ color: kpi.renk }} />
            </div>
            <div className="mt-1 text-2xl font-black text-white">{kpi.deger}</div>
          </div>
        ))}
      </div>

      {/* Sağlayıcı şeridi */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-xs text-sky-200">
        <span className="flex items-center gap-1.5 font-bold text-white">
          <MessageSquare className="h-3.5 w-3.5 text-[#f5c518]" />
          {SMS_SAGLAYICI_ETIKETLERI[ayarlar.saglayici as SmsSaglayici] ?? ayarlar.saglayici}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
            ayarlar.aktif ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-sky-200"
          )}
        >
          {ayarlar.aktif ? "Servis aktif" : "Servis pasif (simülasyon)"}
        </span>
        <span>Başlık: {ayarlar.baslik || "tanımsız"}</span>
        <span>Kodlama: {ayarlar.kodlama}</span>
        <span>
          Birim maliyet:{" "}
          {ayarlar.birimMaliyetKurus === null ? "tanımsız" : kurusYaz(ayarlar.birimMaliyetKurus)}
        </span>
        <span className="text-sky-300">
          Toplam {sayaclar.toplamKayit} kayıt · {sayaclar.teslimEdilenToplam} teslim ·{" "}
          {sayaclar.hataliToplam} hata
        </span>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-sky-300">Durum</span>
          <select
            value={durum}
            onChange={(e) => {
              setDurum(e.target.value);
              filtreyiUygula(e.target.value, tip, arama);
            }}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white focus:border-[#f5c518] focus:outline-none"
          >
            <option value="HEPSI">Tümü</option>
            {Object.entries(SMS_DURUM_ETIKETLERI).map(([kod, etiket]) => (
              <option key={kod} value={kod}>
                {etiket}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-sky-300">Mesaj tipi</span>
          <select
            value={tip}
            onChange={(e) => {
              setTip(e.target.value);
              filtreyiUygula(durum, e.target.value, arama);
            }}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white focus:border-[#f5c518] focus:outline-none"
          >
            <option value="HEPSI">Tümü</option>
            {Object.entries(SMS_TIP_ETIKETLERI).map(([kod, etiket]) => (
              <option key={kod} value={kod}>
                {etiket}
              </option>
            ))}
          </select>
        </label>

        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            filtreyiUygula();
          }}
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-bold text-sky-300">Ara (müşteri, telefon, mesaj)</span>
            <input
              type="search"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Örn: Ahmet veya 532"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-[#f5c518] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl border border-sky-500/30 bg-sky-500/20 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/30"
          >
            Filtrele
          </button>
        </form>

        {guncelleYetkisi && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleTeslimSorgula()}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            title="Gönderilmiş mesajların teslim raporunu sağlayıcıdan çeker (Netgsm: dakikada 10 sorgu)"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
            Teslim durumlarını sorgula
          </button>
        )}
      </div>

      {/* Kayıt listesi */}
      {kayitlar.length === 0 ? (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-sky-500" />
          <p className="mt-2 text-sm font-bold text-white">Kayıt bulunamadı</p>
          <p className="mt-1 text-xs text-sky-200">
            Seçili filtrelere uyan SMS gönderimi yok. Talep oluşturduğunuzda veya test SMS
            gönderdiğinizde kayıtlar burada listelenir.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
          <table className="hidden w-full md:table">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-sky-300">
                <th className="px-3 py-2 font-bold">Zaman</th>
                <th className="px-3 py-2 font-bold">Alıcı</th>
                <th className="px-3 py-2 font-bold">Tip</th>
                <th className="px-3 py-2 font-bold">Durum</th>
                <th className="px-3 py-2 text-right font-bold">Kredi</th>
                <th className="px-3 py-2 text-right font-bold">Maliyet</th>
                <th className="px-3 py-2 font-bold">Mesaj / Not</th>
                <th className="px-3 py-2 text-right font-bold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((kayit) => (
                <tr key={kayit.id} className="border-b border-white/5 align-top last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-sky-100">
                    {zamanYaz(kayit.createdAt)}
                    {kayit.siraNo && (
                      <span className="mt-0.5 block font-mono text-[10px] text-sky-400">
                        #{kayit.siraNo}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-white">
                    <span className="font-bold">{kayit.musteriAdi ?? "—"}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-sky-300">
                      {kayit.telefon}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-sky-100">{tipEtiketi(kayit.tip)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        DURUM_RENKLERI[kayit.durum as SmsKayitDurumu] ??
                          "border-white/10 bg-white/5 text-sky-200"
                      )}
                    >
                      {durumEtiketi(kayit.durum)}
                    </span>
                    {kayit.teslimAt && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300/80">
                        {zamanYaz(kayit.teslimAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-sky-100">
                    {kayit.parcaSayisi}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-sky-100">
                    {kayit.birimMaliyetKurus === null
                      ? "—"
                      : kurusYaz(kayit.birimMaliyetKurus * kayit.parcaSayisi)}
                  </td>
                  <td className="max-w-md px-3 py-2 text-xs text-sky-200">
                    <span className="line-clamp-2">{kayit.mesaj}</span>
                    {(kayit.hataAciklama || kayit.hataKodu) && (
                      <span className="mt-0.5 block text-[11px] text-red-300">
                        {kayit.hataKodu ? `[${kayit.hataKodu}] ` : ""}
                        {kayit.hataAciklama}
                      </span>
                    )}
                    {kayit.saglayiciIsId && (
                      <span className="mt-0.5 block font-mono text-[10px] text-sky-400">
                        {kayit.saglayiciIsId}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {guncelleYetkisi && (
                      <div className="flex flex-col items-end gap-1">
                        {(kayit.durum === "HATA" || kayit.durum === "SIMULASYON") && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleYenidenGonder(kayit.id)}
                            className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Yeniden gönder
                          </button>
                        )}
                        {kayit.durum === "GONDERILDI" && kayit.saglayiciIsId && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleTeslimSorgula(kayit.id)}
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-white/10 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" /> Durum sorgula
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobil kart listesi */}
          <div className="divide-y divide-white/5 md:hidden">
            {kayitlar.map((kayit) => (
              <div key={kayit.id} className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {kayit.musteriAdi ?? "—"}
                      {kayit.siraNo && (
                        <span className="ml-1.5 font-mono text-[11px] text-sky-400">
                          #{kayit.siraNo}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-sky-300">{kayit.telefon}</div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      DURUM_RENKLERI[kayit.durum as SmsKayitDurumu] ??
                        "border-white/10 bg-white/5 text-sky-200"
                    )}
                  >
                    {durumEtiketi(kayit.durum)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-[11px] text-sky-300">
                  <span>{zamanYaz(kayit.createdAt)}</span>
                  <span>{tipEtiketi(kayit.tip)}</span>
                  <span>{kayit.parcaSayisi} kredi</span>
                  {kayit.birimMaliyetKurus !== null && (
                    <span>{kurusYaz(kayit.birimMaliyetKurus * kayit.parcaSayisi)}</span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-sky-200">{kayit.mesaj}</p>
                {(kayit.hataAciklama || kayit.hataKodu) && (
                  <p className="text-[11px] text-red-300">
                    {kayit.hataKodu ? `[${kayit.hataKodu}] ` : ""}
                    {kayit.hataAciklama}
                  </p>
                )}
                {guncelleYetkisi && (kayit.durum === "HATA" || kayit.durum === "SIMULASYON") && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleYenidenGonder(kayit.id)}
                    className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-200 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Yeniden gönder
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}