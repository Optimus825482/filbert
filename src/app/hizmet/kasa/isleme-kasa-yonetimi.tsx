"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Banknote, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "@/components/ayar/tanim-ortak";
import { paraBirim } from "@/lib/format";
import {
  islemeKasasiAktifToggle,
  islemeKasasiGuncelle,
  islemeKasasiOlustur,
  islemeKasaHareketiKaydet,
} from "@/lib/actions/isleme-kasa";

export interface IslemeKasaSatir {
  id: string;
  ad: string;
  tip: string; // KASA | BANKA
  bakiyeTuru: string; // TL | USD | EUR | XAU
  bankaAdi: string | null;
  iban: string | null;
  aktif: boolean;
  bakiye: { tur: string; tutar: number } | null;
}

const TIPLER = [
  { v: "KASA", e: "Kasa (nakit)" },
  { v: "BANKA", e: "Banka" },
];

const BAKIYELER = [
  { v: "TL", e: "TL (₺)" },
  { v: "USD", e: "USD ($)" },
  { v: "EUR", e: "EUR (€)" },
  { v: "XAU", e: "Altın (gram)" },
];

/** Fındık İşleme Modülü'nün kasa tanımları ve kasa hareketleri. */
export function IslemeKasaYonetimi({
  hesaplar,
  olusturYetkisi,
  guncelleYetkisi,
}: {
  hesaplar: IslemeKasaSatir[];
  olusturYetkisi: boolean;
  guncelleYetkisi: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [hesapFormuAcik, setHesapFormuAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<IslemeKasaSatir | null>(null);
  const [ad, setAd] = useState("");
  const [tip, setTip] = useState("KASA");
  const [bakiyeTuru, setBakiyeTuru] = useState("TL");
  const [bankaAdi, setBankaAdi] = useState("");
  const [iban, setIban] = useState("");

  const [hareketAcik, setHareketAcik] = useState(false);
  const [hareketHesapId, setHareketHesapId] = useState("");
  const [hareketTipi, setHareketTipi] = useState("TAHSILAT");
  const [hareketTutar, setHareketTutar] = useState("");
  const [hareketAciklama, setHareketAciklama] = useState("");

  const aktifHesaplar = hesaplar.filter((hesap) => hesap.aktif);

  function formuAc(hesap?: IslemeKasaSatir) {
    setDuzenlenen(hesap ?? null);
    setAd(hesap?.ad ?? "");
    setTip(hesap?.tip ?? "KASA");
    setBakiyeTuru(hesap?.bakiyeTuru ?? "TL");
    setBankaAdi(hesap?.bankaAdi ?? "");
    setIban(hesap?.iban ?? "");
    setHesapFormuAcik(true);
  }

  function hareketFormuAc(hesapId?: string) {
    setHareketHesapId(hesapId ?? aktifHesaplar[0]?.id ?? "");
    setHareketTipi("TAHSILAT");
    setHareketTutar("");
    setHareketAciklama("");
    setHareketAcik(true);
  }

  const hesabiKaydet = () => startTransition(async () => {
    const girdi = { ad, tip: tip as "KASA" | "BANKA", bakiyeTuru, bankaAdi, iban };
    const sonuc = duzenlenen
      ? await islemeKasasiGuncelle(duzenlenen.id, girdi)
      : await islemeKasasiOlustur(girdi);
    if (sonuc.ok) {
      toast.success(duzenlenen ? "Kasa güncellendi" : "Kasa eklendi");
      setHesapFormuAcik(false);
      setDuzenlenen(null);
      router.refresh();
    } else {
      toast.error(sonuc.hata ?? "Kaydedilemedi");
    }
  });

  const hareketiKaydet = () => startTransition(async () => {
    const sonuc = await islemeKasaHareketiKaydet({
      hesapId: hareketHesapId,
      tip: hareketTipi as "TAHSILAT" | "ODEME",
      tutar: Number(hareketTutar.replace(",", ".")),
      aciklama: hareketAciklama,
    });
    if (sonuc.ok) {
      toast.success(hareketTipi === "TAHSILAT" ? "Tahsilat kasaya işlendi" : "Ödeme kasadan işlendi");
      setHareketAcik(false);
      router.refresh();
    } else {
      toast.error(sonuc.hata ?? "Hareket kaydedilemedi");
    }
  });

  const aktiflikDegistir = (hesap: IslemeKasaSatir) => startTransition(async () => {
    const sonuc = await islemeKasasiAktifToggle(hesap.id);
    if (sonuc.ok) {
      toast.success(hesap.aktif ? "Kasa pasifleştirildi" : "Kasa aktifleştirildi", { description: hesap.ad });
      router.refresh();
    } else {
      toast.error(sonuc.hata ?? "İşlem başarısız");
    }
  });

  return (
    <div>
      <TanimBaslik
        ikon={Wallet}
        baslik="Kasa Hesapları"
        adet={hesaplar.length}
        onYeni={olusturYetkisi ? () => formuAc() : undefined}
      />

      {olusturYetkisi && aktifHesaplar.length > 0 && (
        <button
          type="button"
          onClick={() => hareketFormuAc()}
          className="mb-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 transition active:scale-[0.99]"
        >
          <ArrowDownLeft className="h-4 w-4" /> Kasa Hareketi Ekle (Tahsilat / Ödeme)
        </button>
      )}

      {hesaplar.length === 0 ? (
        <BosDurum mesaj="Henüz kasa hesabı tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {hesaplar.map((hesap) => {
            const Ikon = hesap.tip === "BANKA" ? Banknote : Wallet;
            const bakiye = hesap.bakiye;
            return (
              <TanimSatir key={hesap.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5c518]/15 text-[#f5c518]">
                    <Ikon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-[var(--app-fg)]">{hesap.ad}</div>
                    <div className="truncate text-xs text-sky-100">
                      {hesap.tip === "BANKA" ? hesap.bankaAdi ?? "Banka" : "Kasa"} · {hesap.bakiyeTuru}
                      {hesap.tip === "BANKA" && hesap.iban ? ` · ${hesap.iban}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="truncate text-sm font-extrabold text-emerald-300">
                    {bakiye ? paraBirim(bakiye.tutar, bakiye.tur) : "—"}
                  </span>
                  <AktifRozet aktif={hesap.aktif} />
                  {guncelleYetkisi && (
                    <>
                      <DuzenleButon onClick={() => formuAc(hesap)} disabled={pending} />
                      <AktifButon aktif={hesap.aktif} onClick={() => aktiflikDegistir(hesap)} disabled={pending} />
                    </>
                  )}
                </div>
              </TanimSatir>
            );
          })}
        </div>
      )}

      <Dialog open={hesapFormuAcik} onOpenChange={setHesapFormuAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Kasayı Düzenle" : "Yeni Kasa"}</DialogTitle>
            <DialogDescription>
              Yalnızca işleme modülünde görünür. İşleme taleplerinin tahsilatı bu kasaya işlenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Kasa adı</Label>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: Kasa / Kırma Kasa"
                className="saha-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tip</Label>
                <Select value={tip} onValueChange={setTip}>
                  <SelectTrigger className="saha-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPLER.map((t) => (
                      <SelectItem key={t.v} value={t.v}>{t.e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bakiye türü</Label>
                <Select value={bakiyeTuru} onValueChange={setBakiyeTuru}>
                  <SelectTrigger className="saha-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAKIYELER.map((b) => (
                      <SelectItem key={b.v} value={b.v}>{b.e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {tip === "BANKA" && (
              <>
                <div className="space-y-1.5">
                  <Label>Banka adı</Label>
                  <Input value={bankaAdi} onChange={(e) => setBankaAdi(e.target.value)} placeholder="ör: Ziraat Bankası" className="saha-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>IBAN (opsiyonel)</Label>
                  <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR__ ____ ____ ____ ____ ____ __" className="saha-input" />
                </div>
              </>
            )}
            <button
              type="button"
              disabled={pending || !ad.trim() || (tip === "BANKA" && !bankaAdi.trim())}
              onClick={hesabiKaydet}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Kasayı Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hareketAcik} onOpenChange={setHareketAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kasa Hareketi</DialogTitle>
            <DialogDescription>
              Tahsilat kasaya giriş, ödeme kasadan çıkış olarak işlenir ve bakiye anında güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Kasa</Label>
              <Select value={hareketHesapId} onValueChange={setHareketHesapId}>
                <SelectTrigger className="saha-input w-full">
                  <SelectValue placeholder="Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  {aktifHesaplar.map((hesap) => (
                    <SelectItem key={hesap.id} value={hesap.id}>{hesap.ad} · {hesap.bakiyeTuru}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hareket</Label>
                <Select value={hareketTipi} onValueChange={setHareketTipi}>
                  <SelectTrigger className="saha-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAHSILAT">Tahsilat (giriş)</SelectItem>
                    <SelectItem value="ODEME">Ödeme (çıkış)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tutar</Label>
                <Input
                  value={hareketTutar}
                  onChange={(e) => setHareketTutar(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="saha-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama (opsiyonel)</Label>
              <Input
                value={hareketAciklama}
                onChange={(e) => setHareketAciklama(e.target.value)}
                placeholder="ör: 0004 numaralı talep tahsilatı"
                className="saha-input"
              />
            </div>
            <button
              type="button"
              disabled={pending || !hareketHesapId || !(Number(hareketTutar.replace(",", ".")) > 0)}
              onClick={hareketiKaydet}
              className="saha-btn inline-flex w-full items-center justify-center gap-2 bg-[var(--primary)] text-white"
            >
              {hareketTipi === "TAHSILAT" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              {pending ? "Kaydediliyor..." : "Hareketi Kaydet"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}