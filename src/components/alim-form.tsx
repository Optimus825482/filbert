"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAlimFisi } from "@/lib/actions/alim";
import { cariOlustur } from "@/lib/actions/cari";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { tutarHesapla } from "@/lib/hesap";
import { paraTL, sayiCevir } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickNumberStepper } from "@/components/ui/quick-number-stepper";
import { Save, Scale, UserPlus, CheckCircle2, RotateCcw, Search } from "lucide-react";

export interface UreticiSecenek {
  id: string;
  ad: string;
  bolge: string | null;
}

export interface AvansSecenek {
  id: string;
  cariId: string;
  kalanTl: number;
  tur: string;
}

export interface DepoSecenek {
  id: string;
  ad: string;
}

const HIZLI_KAYIT_DEGERI = "__HIZLI_KAYIT__";

export function AlimForm({
  ureticiler,
  acikAvanslar,
  depolar,
}: {
  ureticiler: UreticiSecenek[];
  acikAvanslar: AvansSecenek[];
  depolar: DepoSecenek[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kayitPending, kayitStartTransition] = useTransition();

  const [kayitliUreticiler, setKayitliUreticiler] = useState(ureticiler);
  const [ureticiArama, setUreticiArama] = useState("");
  const [cariId, setCariId] = useState("");
  const [hizliKayitAd, setHizliKayitAd] = useState("");
  const [depoId, setDepoId] = useState(depolar[0]?.id ?? "");
  const [mulkiyet, setMulkiyet] = useState<"KENDI" | "EMANET">("KENDI");
  const [netKg, setNetKg] = useState("");
  const [randiman, setRandiman] = useState("");
  const [manuelFiyat, setManuelFiyat] = useState("");
  const [mahsupSecili, setMahsupSecili] = useState(false);
  const [mahsupAvansId, setMahsupAvansId] = useState("");

  const kgDegeri = sayiCevir(netKg);
  const randimanPuan = sayiCevir(randiman);
  const randimanGecerli = randiman.trim() !== "" && randimanPuan > 0 && randimanPuan <= 100;

  const birimFiyat = mulkiyet === "KENDI" ? sayiCevir(manuelFiyat) : 0;
  const tutar = mulkiyet === "KENDI" ? tutarHesapla(kgDegeri, birimFiyat) : 0;

  const cariAvanslari = acikAvanslar.filter((a) => a.cariId === cariId);
  const seciliAvans = cariAvanslari.find((a) => a.id === mahsupAvansId);
  const mahsupTutar = mahsupSecili && seciliAvans ? Math.min(seciliAvans.kalanTl, tutar) : 0;
  const odenecek = tutar - mahsupTutar;

  const filtrelenmisUreticiler = ureticiArama.trim()
    ? kayitliUreticiler.filter((u) =>
        u.ad.toLocaleLowerCase("tr-TR").includes(ureticiArama.trim().toLocaleLowerCase("tr-TR")) ||
        (u.bolge && u.bolge.toLocaleLowerCase("tr-TR").includes(ureticiArama.trim().toLocaleLowerCase("tr-TR")))
      )
    : kayitliUreticiler;

  const seciliUretici = kayitliUreticiler.find((u) => u.id === cariId);
  const seciliDepo = depolar.find((d) => d.id === depoId);

  function hizliKaydet() {
    const ad = hizliKayitAd.trim();
    if (ad.length < 2) {
      toast.error("Eksik bilgi", { description: "Müstahsil adı en az iki karakter olmalı" });
      return;
    }
    kayitStartTransition(async () => {
      const sonuc = await sunucuIslemi(() => cariOlustur({ ad, tur: "URETICI" }));
      if (!sonuc) return;
      if (sonuc.ok && sonuc.cariId) {
        const yeni = { id: sonuc.cariId!, ad, bolge: null };
        setKayitliUreticiler((onceki) => [...onceki, yeni]);
        setCariId(sonuc.cariId);
        setHizliKayitAd("");
        toast.success("Müstahsil kaydedildi", { description: ad });
      } else {
        toast.error("Kayıt başarısız", { description: sonuc.hata });
      }
    });
  }

  function gonder(durum: "ONAYLI" | "TASLAK") {
    if (!cariId || cariId === HIZLI_KAYIT_DEGERI) {
      toast.error("Eksik bilgi", { description: "Müstahsil seçilmedi" });
      return;
    }
    if (!depoId) {
      toast.error("Eksik bilgi", { description: "Alımın gireceği depo seçilmedi" });
      return;
    }
    if (kgDegeri <= 0) {
      toast.error("Eksik bilgi", { description: "Geçerli bir kg girilmeli" });
      return;
    }
    if (randiman.trim() !== "" && !randimanGecerli) {
      toast.error("Geçersiz randıman", { description: "Randıman 0-100 arasında bir rakam olmalı" });
      return;
    }
    if (mulkiyet === "KENDI" && birimFiyat <= 0) {
      toast.error("Eksik bilgi", { description: "Peşin alım için birim fiyat girilmeli" });
      return;
    }
    startTransition(async () => {
      const sonuc = await sunucuIslemi(() => createAlimFisi({
        cariId,
        depoId,
        kg: kgDegeri,
        randimanPuan: randimanGecerli ? randimanPuan : undefined,
        mulkiyet,
        bolge: seciliUretici?.bolge ?? undefined,
        birimFiyatManuel: mulkiyet === "KENDI" ? birimFiyat : undefined,
        avansMahsupId: mahsupSecili && seciliAvans ? seciliAvans.id : undefined,
        avansMahsupTutar: mahsupTutar > 0 ? mahsupTutar : undefined,
        durum,
      }));
      if (!sonuc) return;
      if (sonuc.ok) {
        toast.success(`Fiş kaydedildi: ${sonuc.fisNo}`, {
          description: mulkiyet === "KENDI"
            ? `${kgDegeri.toLocaleString("tr-TR")} kg × ${birimFiyat.toLocaleString("tr-TR")} TL = ${paraTL(tutar)}`
            : `${kgDegeri.toLocaleString("tr-TR")} kg emanet`,
        });
        router.push("/alim");
      } else {
        toast.error("Kayıt başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* ─── SOL KOLON: Form Girişleri (lg:col-span-7) ─── */}
      <div className="space-y-4 lg:col-span-7">
        {/* Müstahsil Seçimi */}
        <div className="ozet-kart space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="alim-uretici" className="text-base font-bold text-[var(--app-fg)]">
              Müstahsil <span className="text-red-400">*</span>
            </Label>
            {seciliUretici && (
              <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Seçildi
              </span>
            )}
          </div>

          {/* Müstahsil Hızlı Filtreleme Arama Alanı */}
          {kayitliUreticiler.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={ureticiArama}
                onChange={(e) => setUreticiArama(e.target.value)}
                placeholder="Müstahsil adıyla filtrele..."
                className="flex h-10 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-secondary)] pl-9 pr-3 text-sm text-[var(--app-fg)] placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
          )}

          <Select
            value={cariId}
            onValueChange={(v) => {
              setCariId(v === HIZLI_KAYIT_DEGERI ? "" : v);
              if (v === HIZLI_KAYIT_DEGERI) setHizliKayitAd("");
              setMahsupSecili(false);
              setMahsupAvansId("");
            }}
          >
            <SelectTrigger id="alim-uretici" className="saha-input">
              <SelectValue placeholder="Müstahsil seçin..." />
            </SelectTrigger>
            <SelectContent>
              {filtrelenmisUreticiler.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-base">
                  {u.ad} {u.bolge ? <span className="text-muted-foreground">· {u.bolge}</span> : null}
                </SelectItem>
              ))}
              <SelectItem value={HIZLI_KAYIT_DEGERI} className="text-base font-bold text-[var(--primary)]">
                + Listede yok mu? Hızlı yeni kayıt...
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Seçili Müstahsil Açık Avans Bilgisi */}
          {cariId && cariAvanslari.length > 0 && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs">
              <span className="font-bold text-violet-300">Açık Avans Bilgisi: </span>
              {cariAvanslari.map((a, i) => (
                <span key={a.id} className="font-semibold text-violet-200">
                  {i > 0 ? ", " : ""}{paraTL(a.kalanTl)} ({a.tur})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hızlı müstahsil kaydı */}
        {cariId === "" && (
          <div className="ozet-kart space-y-2 border-[var(--primary)]/40 bg-[var(--primary)]/5">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
              <UserPlus className="h-4 w-4" /> HIZLI MÜSTAHSİL EKLE
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                inputMode="text"
                value={hizliKayitAd}
                onChange={(e) => setHizliKayitAd(e.target.value)}
                placeholder="Müstahsil adı ve soyadı"
                className="saha-input flex-1"
              />
              <button
                type="button"
                disabled={kayitPending || hizliKayitAd.trim().length < 2}
                onClick={hizliKaydet}
                className="saha-btn bg-[var(--primary)] text-white shrink-0 px-5"
              >
                {kayitPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        )}

        {/* Depo ve Alım Şekli */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Giriş deposu */}
          <div className="space-y-1.5">
            <Label htmlFor="alim-depo" className="text-sm font-bold text-[var(--app-fg)]">
              Giriş Deposu <span className="text-red-400">*</span>
            </Label>
            <Select value={depoId} onValueChange={setDepoId}>
              <SelectTrigger id="alim-depo" className="saha-input">
                <SelectValue placeholder="Depo seçin..." />
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
              <p className="text-xs font-semibold text-destructive">Alımdan önce aktif bir depo tanımlanmalı.</p>
            ) : null}
          </div>

          {/* Alım şekli (mülkiyet) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-[var(--app-fg)]">Alım Şekli</Label>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
              {(["KENDI", "EMANET"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMulkiyet(m)}
                  className={`min-h-11 text-xs md:text-sm font-bold transition-colors ${
                    mulkiyet === m ? "bg-[var(--primary)] text-white shadow-xs" : "text-muted-foreground hover:text-[var(--app-fg)]"
                  }`}
                >
                  {m === "KENDI" ? "Peşin / Bozdur" : "Emanet"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tartı (Kg) */}
        <div className="ozet-kart space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)]">
              <Scale className="h-4 w-4 text-[var(--primary)]" /> TARTI (NET KG) <span className="text-red-400">*</span>
            </div>
            {kgDegeri > 0 && (
              <button
                type="button"
                onClick={() => setNetKg("")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3 w-3" /> Temizle
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Input
              id="alim-kg"
              inputMode="decimal"
              value={netKg}
              onChange={(e) => setNetKg(e.target.value)}
              placeholder="0 kg"
              className="saha-input text-2xl font-extrabold tracking-tight"
            />
          </div>

          {/* Hızlı Kg Ekleme Butonları */}
          <QuickNumberStepper
            label="Hızlı Miktar Ekle:"
            values={[100, 250, 500, 1000, 2000, 5000]}
            unit="kg"
            mode="add"
            onSelect={(eklenecek) => {
              const suanki = sayiCevir(netKg);
              setNetKg(String(suanki + eklenecek));
            }}
          />
        </div>

        {/* Randıman — opsiyonel tek rakam */}
        <div className="ozet-kart space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-fg)]">
              <Save className="h-4 w-4 text-amber-500" /> RANDIMAN (OPSİYONEL)
            </div>
            {randiman && (
              <button
                type="button"
                onClick={() => setRandiman("")}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Temizle
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Input
              id="alim-randiman"
              inputMode="decimal"
              value={randiman}
              onChange={(e) => setRandiman(e.target.value)}
              placeholder="Randıman puanı (boş ise sonra girilir)"
              className="saha-input text-xl font-bold"
            />
          </div>

          {/* Hızlı Randıman Seçimi */}
          <QuickNumberStepper
            label="Sık Kullanılan Randıman:"
            values={[48, 50, 51, 52, 53, 54, 55]}
            mode="set"
            onSelect={(puan) => setRandiman(String(puan))}
          />

          {randiman.trim() !== "" && !randimanGecerli && (
            <p className="text-sm font-semibold text-destructive">Randıman 0-100 arasında bir rakam olmalı.</p>
          )}
          {randiman.trim() === "" && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Boş bırakılırsa fiş &quot;Randıman Bekliyor&quot; olarak kaydedilir.
            </p>
          )}
        </div>

        {/* Fiyat — yalnız peşin alımda */}
        {mulkiyet === "KENDI" ? (
          <div className="ozet-kart space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--app-fg)]">BİRİM FİYAT (TL/KG) <span className="text-red-400">*</span></span>
              {manuelFiyat && (
                <button
                  type="button"
                  onClick={() => setManuelFiyat("")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Input
                id="alim-manuel-fiyat"
                inputMode="decimal"
                value={manuelFiyat}
                onChange={(e) => setManuelFiyat(e.target.value)}
                placeholder="0,00 TL"
                className="saha-input text-2xl font-extrabold"
              />
            </div>
            <QuickNumberStepper
              label="Hızlı Fiyat Seçimi:"
              values={[120, 130, 135, 140, 145, 150]}
              unit="TL"
              mode="set"
              onSelect={(fiyat) => setManuelFiyat(String(fiyat))}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3.5 text-xs text-orange-200">
            Emanet alımda fiyat girilmez — fiyat, bozdurma (hesap gör) anında cari piyasa veya uzlaşılan fiyatla belirlenir.
          </div>
        )}

        {/* Avans mahsubu */}
        {cariId && cariAvanslari.length > 0 && (
          <div className="ozet-kart space-y-3 border-violet-500/40 bg-violet-500/10">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mahsupSecili}
                onChange={(e) => {
                  setMahsupSecili(e.target.checked);
                  if (e.target.checked && cariAvanslari.length === 1) setMahsupAvansId(cariAvanslari[0].id);
                }}
                className="h-5 w-5 rounded-md accent-violet-600"
              />
              <span className="text-sm font-bold text-violet-200">Açık avanstan mahsup et</span>
            </label>
            {mahsupSecili && (
              <div className="space-y-2 pt-1">
                <Select value={mahsupAvansId} onValueChange={setMahsupAvansId}>
                  <SelectTrigger className="saha-input">
                    <SelectValue placeholder="Avans seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cariAvanslari.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {paraTL(a.kalanTl)} kalan · {a.tur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {seciliAvans && (
                  <div className="flex justify-between rounded-xl bg-violet-950/50 px-4 py-2.5 text-sm font-bold text-violet-200">
                    <span>Mahsup Edilecek</span>
                    <span className="tabular-nums">{paraTL(mahsupTutar)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── SAĞ KOLON: Canlı Fiş Özeti ve Kaydetme (lg:col-span-5) ─── */}
      <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-20">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">FİŞ ÖNİZLEMESİ</span>
            <span className="rounded-full bg-[var(--primary)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
              {mulkiyet === "KENDI" ? "Peşin Alım" : "Emanet Girişi"}
            </span>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Müstahsil:</span>
              <span className="font-bold text-[var(--app-fg)]">{seciliUretici?.ad ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giriş Deposu:</span>
              <span className="font-bold text-[var(--app-fg)]">{seciliDepo?.ad ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Ağırlık:</span>
              <span className="font-extrabold tabular-nums text-[var(--app-fg)]">
                {kgDegeri > 0 ? `${kgDegeri.toLocaleString("tr-TR")} kg` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Randıman:</span>
              <span className="font-bold tabular-nums text-[var(--app-fg)]">
                {randimanGecerli ? `${randimanPuan} P` : "Bekliyor"}
              </span>
            </div>
            {mulkiyet === "KENDI" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Birim Fiyat:</span>
                  <span className="font-bold tabular-nums text-[var(--app-fg)]">
                    {birimFiyat > 0 ? paraTL(birimFiyat) : "—"}
                  </span>
                </div>
                {mahsupTutar > 0 && (
                  <div className="flex justify-between text-violet-400">
                    <span>Avans Mahsubu:</span>
                    <span className="font-bold tabular-nums">-{paraTL(mahsupTutar)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tutar Kartı */}
          <div className="rounded-xl bg-filbert-950 p-4 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold tracking-wider text-filbert-300">
                {mulkiyet === "KENDI" ? (mahsupTutar > 0 ? "NET ÖDENECEK" : "FİŞ TUTARI") : "EMANET MİKTAR"}
              </span>
              <span className="text-2xl md:text-3xl font-black tabular-nums tracking-tight text-white">
                {mulkiyet === "KENDI" ? paraTL(odenecek) : `${kgDegeri.toLocaleString("tr-TR")} kg`}
              </span>
            </div>
            {mulkiyet === "KENDI" && mahsupTutar > 0 && (
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-xs text-filbert-300">
                <span>Brüt Tutar:</span>
                <span className="font-semibold tabular-nums">{paraTL(tutar)}</span>
              </div>
            )}
          </div>

          {/* Aksiyon Butonları */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={pending || !cariId || !depoId || kgDegeri <= 0}
              onClick={() => gonder("TASLAK")}
              className="saha-btn border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--app-fg)] hover:border-[var(--primary)]"
            >
              Taslak Kaydet
            </button>
            <button
              type="button"
              disabled={pending || !cariId || !depoId || kgDegeri <= 0 || (mulkiyet === "KENDI" && birimFiyat <= 0)}
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
