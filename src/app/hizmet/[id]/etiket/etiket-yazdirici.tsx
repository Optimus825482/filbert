"use client";

import { useState, useEffect } from "react";
import { Printer, Copy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { etiketYazdirildi } from "@/lib/actions/hizmet";

interface Props {
  hizmetId: string;
  siraNo: string;
  musteriAdi: string;
  telefon: string;
  kilo: string;
  islemler: string[];
  paketTipi?: string | null;
  paketAdedi?: number | null;
  odemeDurumu?: string | null;
  notlar?: string | null;
  tarihSaatStr: string;
  firmaAdi: string;
  toplamTutar: string;
}

export function HizmetEtiketYazdirici({
  hizmetId,
  siraNo,
  musteriAdi,
  telefon,
  kilo,
  islemler,
  paketTipi,
  paketAdedi,
  odemeDurumu,
  notlar,
  tarihSaatStr,
  firmaAdi,
  toplamTutar,
}: Props) {
  const [kopyaSayisi, setKopyaSayisi] = useState<number>(1);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    // Termal etikette hızlı okutma için QR Kod üretimi
    QRCode.toDataURL(`FILBERT-HIZMET:${siraNo}`, {
      margin: 1,
      width: 100,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code Error:", err));
  }, [siraNo]);

  function handleYazdir() {
    etiketYazdirildi(hizmetId);
    window.print();
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 text-white print:min-h-0 print:bg-white print:p-0 print:text-black">
      {/* ─── Kontrol Barı (Yazdırmada Gizlenir) ─── */}
      <div className="no-print mx-auto mb-6 flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/hizmet"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sky-200 transition-colors hover:bg-slate-700 hover:text-white"
            title="Listeye Dön"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-black text-white">Termal Etiket Yazdır</h1>
            <p className="text-xs text-sky-300">
              Sıra No: <b className="text-[#f5c518]">#{siraNo}</b> · {musteriAdi}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Kopya Sayısı Seçimi */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
            <Copy className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-semibold text-sky-200">Kopya:</span>
            <select
              value={kopyaSayisi}
              onChange={(e) => setKopyaSayisi(Number(e.target.value))}
              className="rounded bg-slate-800 px-2 py-1 font-bold text-white focus:outline-none"
            >
              <option value={1}>1 Adet</option>
              <option value={2}>2 Adet</option>
              <option value={3}>3 Adet</option>
              <option value={4}>4 Adet</option>
              <option value={5}>5 Adet</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleYazdir}
            className="flex items-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2 text-sm font-extrabold text-[#081226] shadow-lg shadow-[#f5c518]/20 transition-all hover:bg-[#e5b508] active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Yazdır {kopyaSayisi > 1 && `(${kopyaSayisi})`}
          </button>
        </div>
      </div>

      {/* ─── Termal Etiket(ler) Önizleme & Baskı Alanı ─── */}
      <div className="space-y-6 print:space-y-0">
        {Array.from({ length: kopyaSayisi }).map((_, index) => (
          <div
            key={index}
            className="etiket-sayfa mx-auto flex flex-col justify-between border-2 border-dashed border-slate-400 bg-white p-3 text-black shadow-2xl print:m-0 print:border-none print:p-2 print:shadow-none"
            style={{
              width: "80mm",
              minHeight: "70mm",
              pageBreakAfter: index < kopyaSayisi - 1 ? "always" : "auto",
            }}
          >
            {/* Üst Bilgi: Firma & Sıra No & QR */}
            <div className="border-b-2 border-black pb-2 text-center">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
                {firmaAdi}
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-neutral-600">
                Fındık Kırma & Paketleme Hizmeti
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-3">
                {qrDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrDataUrl}
                    alt={`QR #${siraNo}`}
                    className="h-14 w-14 border border-black p-0.5"
                  />
                )}
                <div className="text-left">
                  <div className="font-mono text-4xl font-black leading-none text-black">
                    #{siraNo}
                  </div>
                  {kopyaSayisi > 1 && (
                    <div className="mt-1 text-[9px] font-bold text-neutral-600">
                      Kopya {index + 1} / {kopyaSayisi}
                    </div>
                  )}
                  {odemeDurumu === "ODENDI" ? (
                    <span className="mt-0.5 inline-block rounded border border-black bg-black px-1 text-[9px] font-black text-white">
                      TAHSİL EDİLDİ
                    </span>
                  ) : odemeDurumu === "VERESIYE" ? (
                    <span className="mt-0.5 inline-block rounded border border-black px-1 text-[9px] font-black text-black">
                      VERESİYE
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Müşteri ve Miktar Bilgisi */}
            <div className="my-2 space-y-1 text-sm font-bold leading-tight">
              <div className="flex justify-between border-b border-neutral-200 py-0.5">
                <span className="text-[11px] uppercase text-neutral-600">MÜŞTERİ:</span>
                <span className="text-right font-black text-black">{musteriAdi}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 py-0.5">
                <span className="text-[11px] uppercase text-neutral-600">TELEFON:</span>
                <span className="text-right font-mono">{telefon}</span>
              </div>
              <div className="flex items-center justify-between border-b-2 border-black py-1">
                <span className="text-[11px] font-black uppercase text-black">FINDIK MİKTARI:</span>
                <span className="font-mono text-xl font-black text-black">{kilo} KG</span>
              </div>
            </div>

            {/* Yapılacak Hizmetler */}
            <div className="my-1 rounded border border-black p-1.5">
              <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-neutral-700">
                YAPILACAK İŞLEMLER:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Kırma", "Kavurma", "Vakumlu Paketleme"].map((hizmet) => {
                  const secili = islemler.some(
                    (i) => i.toLowerCase().includes(hizmet.toLowerCase().slice(0, 4))
                  );
                  return (
                    <div
                      key={hizmet}
                      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-black ${
                        secili
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 bg-neutral-50 text-neutral-400 line-through"
                      }`}
                    >
                      <span>{secili ? "☑" : "☐"}</span>
                      <span>{hizmet}</span>
                    </div>
                  );
                })}
              </div>

              {/* Paketleme Detayı */}
              {paketTipi && (
                <div className="mt-1.5 border-t border-dashed border-neutral-300 pt-1 text-[11px] font-black text-black">
                  Paketleme: {paketAdedi ? `${paketAdedi} Adet × ` : ""}{paketTipi.replace("_", " ")}
                </div>
              )}
            </div>

            {/* Müşteri Notu Varsa */}
            {notlar && (
              <div className="my-1 rounded bg-neutral-100 p-1 text-[11px] leading-tight">
                <span className="font-black text-black">NOT: </span>
                <span className="font-medium text-neutral-800">{notlar}</span>
              </div>
            )}

            {/* Alt Bilgi: Tarih ve Tutar */}
            <div className="mt-2 border-t border-slate-300 pt-1 text-[10px] font-bold text-neutral-600">
              <div className="flex justify-between">
                <span>Tarih: {tarihSaatStr}</span>
                <span className="text-black">Tutar: {toplamTutar} TL</span>
              </div>
              <div className="mt-1 text-center font-mono text-[9px] tracking-widest text-neutral-500">
                * BU ETİKETİ TESLİMATTA İBRAZ EDİNİZ *
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
