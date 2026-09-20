"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSatis } from "@/lib/actions/satis";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { Save, CheckCircle2, RotateCcw, Search } from "lucide-react";

export interface MusteriSecenek {
  id: string;
  ad: string;
  bolge: string | null;
}

export interface DepoSecenek {
  id: string;
  ad: string;
}

export function SatisForm({
  musteriler,
  depolar,
}: {
  musteriler: MusteriSecenek[];
  depolar: DepoSecenek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [musteriArama, setMusteriArama] = useState("");
  const [cariId, setCariId] = useState("");
  const [depoId, setDepoId] = useState(depolar[0]?.id ?? "");
  const [kgGirdi, setKgGirdi] = useState("");
  const [birimFiyat, setBirimFiyat] = useState("");
  const [aciklama, setAciklama] = useState("");

  const kgDeger = sayiCevir(kgGirdi);
  const fiyatDeger = sayiCevir(birimFiyat);
  const tutar = kgDeger * fiyatDeger;

  const filtrelenmisMusteriler = musteriArama.trim()
    ? musteriler.filter((m) =>
        m.ad.toLocaleLowerCase("tr-TR").includes(musteriArama.trim().toLocaleLowerCase("tr-TR")) ||
        (m.bolge && m.bolge.toLocaleLowerCase("tr-TR").includes(musteriArama.trim().toLocaleLowerCase("tr-TR")))
      )
    : musteriler;

  const seciliMusteri = musteriler.find((m) => m.id === cariId);
  const seciliDepo = depolar.find((d) => d.id === depoId);

  function gonder(durum: "ONAYLI" | "TASLAK") {
    if (!cariId) {
      toast.error("Eksik bilgi", { description: "Müşteri seçilmedi" });
      return;
    }
    if (!depoId) {
      toast.error("Eksik bilgi", { description: "Satış yapılacak depo seçilmedi" });
      return;
    }
    if (kgDeger <= 0) {
      toast.error("Eksik bilgi", { description: "Kg sıfır veya negatif" });
      return;
    }
    if (fiyatDeger <= 0) {
      toast.error("Eksik bilgi", { description: "Birim fiyat girilmedi" });
      return;
    }

    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createSatis({
        cariId,
        depoId,
        kg: kgDeger,
        birimFiyat: fiyatDeger,
        aciklama: aciklama || undefined,
        durum,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(`Satış kaydedildi: ${sonuc.fisNo}`, {
          description: `${kgDeger.toLocaleString("tr-TR")} kg × ${paraTL(fiyatDeger)} = ${paraTL(tutar)}`,
        });
        router.push("/satis");
      } else {
        toast.error("Kayıt başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* ─── SOL KOLON: Form Girişleri (lg:col-span-7) ─── */}
      <div className="space-y-4 lg:col-span-7">
        {/* Müşteri Seçimi */}
        <div className="ozet-kart space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="satis-musteri" className="text-base font-bold text-[var(--app-fg)]">
              Müşteri (Tüccar / Fabrika) <span className="text-red-400">*</span>
            </Label>
            {seciliMusteri && (
              <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Seçildi
              </span>
            )}
          </div>

          {musteriler.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={musteriArama}
                onChange={(e) => setMusteriArama(e.target.value)}
                placeholder="Müşteri adıyla filtrele..."
                className="flex h-10 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)] pl-9 pr-3 text-sm text-[var(--app-fg)] placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
          )}

          <Select value={cariId} onValueChange={setCariId}>
            <SelectTrigger id="satis-musteri" className="saha-input">
              <SelectValue placeholder="Müşteri seçin..." />
            </SelectTrigger>
            <SelectContent>
              {filtrelenmisMusteriler.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-base">
                  {m.ad} {m.bolge ? <span className="text-muted-foreground">· {m.bolge}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Çıkış Deposu */}
        <div className="space-y-1.5">
          <Label htmlFor="satis-depo" className="text-sm font-bold text-[var(--app-fg)]">
            Çıkış deposu <span className="text-red-400">*</span>
          </Label>
          <Select value={depoId} onValueChange={setDepoId}>
            <SelectTrigger id="satis-depo" className="saha-input">
              <SelectValue placeholder="Stok çıkışı yapılacak depoyu seçin..." />
            </SelectTrigger>
            <SelectContent>
              {depolar.map((depo) => (
                <SelectItem key={depo.id} value={depo.id} className="text-base">
                  {depo.ad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {depolar.length === 0 ? (
            <p className="text-xs font-semibold text-destructive">Satıştan önce aktif bir depo tanımlanmalı.</p>
          ) : null}
        </div>

        {/* Miktar ve Fiyat */}
        <div className="ozet-kart space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="satis-kg" className="text-sm font-bold text-[var(--app-fg)]">
                Satış Miktarı (Net Kg) <span className="text-red-400">*</span>
              </Label>
              {kgDeger > 0 && (
                <button
                  type="button"
                  onClick={() => setKgGirdi("")}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="h-3 w-3" /> Temizle
                </button>
              )}
            </div>
            <Input
              id="satis-kg"
              inputMode="decimal"
              value={kgGirdi}
              onChange={(e) => setKgGirdi(e.target.value)}
              placeholder="0 kg"
              className="saha-input text-2xl font-extrabold"
            />
            <QuickNumberStepper
              label="Hızlı Miktar Ekle:"
              values={[1000, 2500, 5000, 10000, 25000]}
              unit="kg"
              mode="add"
              onSelect={(ekle) => {
                const cur = sayiCevir(kgGirdi);
                setKgGirdi(String(cur + ekle));
              }}
            />
          </div>

          <div className="space-y-3 border-t border-[var(--surface-border)] pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="satis-birim-fiyat" className="text-sm font-bold text-[var(--app-fg)]">
                Birim Satış Fiyatı (TL/kg) <span className="text-red-400">*</span>
              </Label>
              {fiyatDeger > 0 && (
                <button
                  type="button"
                  onClick={() => setBirimFiyat("")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Temizle
                </button>
              )}
            </div>
            <Input
              id="satis-birim-fiyat"
              inputMode="decimal"
              value={birimFiyat}
              onChange={(e) => setBirimFiyat(e.target.value)}
              placeholder="0,00 TL"
              className="saha-input text-2xl font-extrabold"
            />
            <QuickNumberStepper
              label="Hızlı Fiyat Seçimi:"
              values={[130, 135, 140, 145, 150, 155]}
              unit="TL"
              mode="set"
              onSelect={(fiyat) => setBirimFiyat(String(fiyat))}
            />
          </div>
        </div>

        {/* Açıklama */}
        <div className="space-y-1.5">
          <Label htmlFor="satis-aciklama" className="text-sm font-bold text-[var(--app-fg)]">
            Açıklama (Opsiyonel)
          </Label>
          <Input
            id="satis-aciklama"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="İrsaliye no, fabrika şartı vb. notlar..."
            className="saha-input"
          />
        </div>
      </div>

      {/* ─── SAĞ KOLON: Canlı Satış Özeti (lg:col-span-5) ─── */}
      <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-20">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">SATIŞ ÖNİZLEMESİ</span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              Fındık Satışı
            </span>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Müşteri:</span>
              <span className="font-bold text-[var(--app-fg)]">{seciliMusteri?.ad ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Çıkış Deposu:</span>
              <span className="font-bold text-[var(--app-fg)]">{seciliDepo?.ad ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Satış Miktarı:</span>
              <span className="font-extrabold tabular-nums text-[var(--app-fg)]">
                {kgDeger > 0 ? `${kgDeger.toLocaleString("tr-TR")} kg` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Birim Fiyat:</span>
              <span className="font-bold tabular-nums text-[var(--app-fg)]">
                {fiyatDeger > 0 ? paraTL(fiyatDeger) : "—"}
              </span>
            </div>
          </div>

          {/* Toplam Satış Tutarı */}
          <div className="rounded-xl bg-filbert-950 p-4 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold tracking-wider text-filbert-300">TOPLAM SATIŞ TUTARI</span>
              <span className="text-2xl md:text-3xl font-black tabular-nums tracking-tight text-white">
                {paraTL(tutar)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs text-filbert-300">
              <span>Birim: {fiyatDeger > 0 ? paraTL(fiyatDeger) : "0 TL"} / kg</span>
              <span>{kgDeger.toLocaleString("tr-TR")} kg</span>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={pending || !cariId || !depoId || kgDeger <= 0}
              onClick={() => gonder("TASLAK")}
              className="saha-btn border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--app-fg)] hover:border-[var(--primary)]"
            >
              Taslak Kaydet
            </button>
            <button
              type="button"
              disabled={pending || !cariId || !depoId || kgDeger <= 0 || fiyatDeger <= 0}
              onClick={() => gonder("ONAYLI")}
              className="saha-btn bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30 hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {pending ? "Kaydediliyor..." : "Onayla & Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
