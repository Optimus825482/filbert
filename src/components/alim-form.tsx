"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAlimFisi } from "@/lib/actions/alim";
import { cariOlustur } from "@/lib/actions/cari";
import { sunucuIslemi } from "@/lib/istemci-guvenli";
import { tutarHesapla } from "@/lib/hesap";
import { paraTL, sayiCevir, CINS_ETIKET } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Scale, UserPlus } from "lucide-react";

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

const CINSLER = ["LEVANT", "GIRESUN", "ORDU", "DIGER"];
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
  const [cariId, setCariId] = useState("");
  const [hizliKayitAd, setHizliKayitAd] = useState("");
  const [depoId, setDepoId] = useState("");
  const [cins, setCins] = useState("LEVANT");
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
        setKayitliUreticiler((onceki) => [...onceki, { id: sonuc.cariId!, ad, bolge: null }]);
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
        cins: cins as "LEVANT",
        kg: kgDegeri,
        randimanPuan: randimanGecerli ? randimanPuan : undefined,
        mulkiyet,
        bolge: kayitliUreticiler.find((u) => u.id === cariId)?.bolge ?? undefined,
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
    <div className="space-y-4">
      {/* Müstahsil */}
      <div className="space-y-1.5">
        <Label htmlFor="alim-uretici" className="text-base font-bold">Müstahsil</Label>
        <Select
          value={cariId}
          onValueChange={(v) => {
            setCariId(v === HIZLI_KAYIT_DEGERI ? "" : v);
            if (v === HIZLI_KAYIT_DEGERI) setHizliKayitAd("");
            setMahsupSecili(false);
            setMahsupAvansId("");
          }}
        >
          <SelectTrigger id="alim-uretici" className="saha-input bg-slate-800">
            <SelectValue placeholder="Müstahsil seçin..." />
          </SelectTrigger>
          <SelectContent>
            {kayitliUreticiler.map((u) => (
              <SelectItem key={u.id} value={u.id} className="text-base">
                {u.ad} {u.bolge ? <span className="text-sky-100">· {u.bolge}</span> : null}
              </SelectItem>
            ))}
            <SelectItem value={HIZLI_KAYIT_DEGERI} className="text-base font-bold text-filbert-300">
              + Listede yok mu? Hızlı kayıt...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hızlı müstahsil kaydı */}
      {cariId === "" && (
        <div className="ozet-kart space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
            <UserPlus className="h-4 w-4" /> HIZLI MÜSTAHSİL KAYDI
          </div>
          <div className="flex gap-2">
            <Input
              inputMode="text"
              value={hizliKayitAd}
              onChange={(e) => setHizliKayitAd(e.target.value)}
              placeholder="Müstahsil adı"
              className="saha-input"
            />
            <button
              type="button"
              disabled={kayitPending || hizliKayitAd.trim().length < 2}
              onClick={hizliKaydet}
              className="saha-btn bg-filbert-600 text-white"
            >
              {kayitPending ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="alim-depo" className="text-base font-bold">Giriş deposu</Label>
        <Select value={depoId} onValueChange={setDepoId}>
          <SelectTrigger id="alim-depo" className="saha-input bg-slate-800"><SelectValue placeholder="Alımın gireceği depoyu seçin..." /></SelectTrigger>
          <SelectContent>
            {depolar.map((depo) => <SelectItem key={depo.id} value={depo.id} className="text-base">{depo.ad}</SelectItem>)}
          </SelectContent>
        </Select>
        {depolar.length === 0 ? <p className="text-sm font-semibold text-red-300">Alımdan önce aktif bir depo tanımlanmalı.</p> : null}
      </div>

      {/* Cins + Mülkiyet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="alim-cins" className="text-base font-bold">Cins</Label>
          <Select value={cins} onValueChange={setCins}>
            <SelectTrigger id="alim-cins" className="saha-input bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CINSLER.map((c) => (
                <SelectItem key={c} value={c} className="text-base">
                  {CINS_ETIKET[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-base font-bold">Alım Şekli</Label>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-slate-800">
            {(["KENDI", "EMANET"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMulkiyet(m)}
                className={`min-h-14 text-sm font-bold transition-colors ${
                  mulkiyet === m ? "bg-filbert-600 text-white" : "text-sky-100"
                }`}
              >
                {m === "KENDI" ? "Peşin / Bozdur" : "Emanet"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tartı */}
      <div className="ozet-kart space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
          <Scale className="h-4 w-4" /> TARTI
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alim-kg">Net (kg)</Label>
          <Input id="alim-kg" inputMode="decimal" value={netKg} onChange={(e) => setNetKg(e.target.value)} placeholder="0" className="saha-input" />
        </div>
      </div>

      {/* Randıman — opsiyonel tek rakam */}
      <div className="ozet-kart space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-100">
          <Save className="h-4 w-4" /> RANDIMAN (OPSİYONEL)
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alim-randiman">Randıman puanı (0-100)</Label>
          <Input id="alim-randiman" inputMode="decimal" value={randiman} onChange={(e) => setRandiman(e.target.value)} placeholder="Boş bırakılırsa sonra girilir" className="saha-input" />
        </div>
        {randiman.trim() !== "" && !randimanGecerli && (
          <p className="text-sm font-semibold text-red-300">Randıman 0-100 arasında bir rakam olmalı.</p>
        )}
        {randiman.trim() === "" && (
          <p className="rounded-xl bg-amber-900/30 px-4 py-3 text-sm text-amber-200">
            Boş bırakılırsa fiş &quot;Randıman Bekliyor&quot; olarak işaretlenir; sonra Randıman sayfasından girilir.
          </p>
        )}
      </div>

      {/* Fiyat — yalnız peşin alımda */}
      {mulkiyet === "KENDI" ? (
        <div className="ozet-kart space-y-3">
          <span className="text-sm font-bold text-sky-100">FİYAT</span>
          <div className="space-y-1.5">
            <Label htmlFor="alim-manuel-fiyat">Birim fiyat (TL/kg)</Label>
            <Input id="alim-manuel-fiyat" inputMode="decimal" value={manuelFiyat} onChange={(e) => setManuelFiyat(e.target.value)} placeholder="0,00" className="saha-input" />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-filbert-600 px-4 py-3 text-white">
            <span className="text-sm font-bold">Birim Fiyat</span>
            <span className="text-2xl font-extrabold tabular-nums">{birimFiyat > 0 ? paraTL(birimFiyat) : "—"}</span>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-orange-900/30 px-4 py-3 text-sm text-orange-200">
          Emanet alımda fiyat girilmez — fiyat, bozdurma (hesap gör) anında belirlenir.
        </p>
      )}

      {/* Avans mahsubu */}
      {cariId && cariAvanslari.length > 0 && (
        <div className="ozet-kart space-y-2 border-violet-700 bg-violet-900/30">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={mahsupSecili}
              onChange={(e) => {
                setMahsupSecili(e.target.checked);
                if (e.target.checked && cariAvanslari.length === 1) setMahsupAvansId(cariAvanslari[0].id);
              }}
              className="h-5 w-5 accent-violet-600"
            />
            <span className="text-sm font-bold text-violet-200">Açık avanstan mahsup et</span>
          </label>
          {mahsupSecili && (
            <>
              <Select value={mahsupAvansId} onValueChange={setMahsupAvansId}>
                <SelectTrigger className="saha-input bg-slate-800">
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
                <div className="flex justify-between rounded-xl bg-violet-900/50 px-4 py-2.5 text-sm font-bold text-violet-200">
                  <span>Mahsup</span>
                  <span className="tabular-nums">{paraTL(mahsupTutar)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {mahsupTutar > 0 && <p className="text-xs font-semibold text-amber-200">Avans mahsubu, yalnız “Onayla & Kaydet” ile doğrudan onaylanan fişte uygulanır.</p>}

      {/* Toplam — yalnız peşin alımda */}
      {mulkiyet === "KENDI" && (
        <div className="rounded-2xl bg-filbert-950 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-filbert-300">FİŞ TUTARI</span>
            <span className="text-3xl font-extrabold tabular-nums tracking-tight">{paraTL(tutar)}</span>
          </div>
          {mahsupTutar > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-[var(--surface-border)] pt-2 text-sm">
              <span className="text-filbert-300">Avans mahsubu sonrası ödenecek</span>
              <span className="font-bold tabular-nums">{paraTL(odenecek)}</span>
            </div>
          )}
        </div>
      )}

      {/* Kaydet */}
      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          type="button"
          disabled={pending || !cariId || !depoId || kgDegeri <= 0}
          onClick={() => gonder("TASLAK")}
          className="saha-btn border-2 border-filbert-600 bg-slate-800 text-[#f5c518]"
        >
          Taslak Kaydet
        </button>
        <button
          type="button"
          disabled={pending || !cariId || !depoId || kgDegeri <= 0 || (mulkiyet === "KENDI" && birimFiyat <= 0)}
          onClick={() => gonder("ONAYLI")}
          className="saha-btn bg-filbert-600 text-white shadow-lg shadow-filbert-600/30"
        >
          <Save className="h-5 w-5" />
          {pending ? "Kaydediliyor..." : "Onayla & Kaydet"}
        </button>
      </div>
    </div>
  );
}
