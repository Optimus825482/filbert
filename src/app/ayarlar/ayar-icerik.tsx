"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Users, ShieldAlert, Database, Palette, Sun, Moon, FolderCog, Pencil, MapPin, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { RenkSecici } from "@/components/ayar/renk-secici";
import { StilSecici } from "@/components/ayar/stil-secici";
import { FontAyar } from "@/components/ayar/font-ayar";
import { TanimlarSekme } from "@/components/ayar/tanimlar-sekme";
import type { DepoSatir, SubeSecenek } from "@/components/ayar/depo-tanim";
import type { HesapSatir } from "@/components/ayar/hesap-tanim";
import type { AracSatir } from "@/components/ayar/arac-tanim";
import type { PersonelSatir } from "@/components/ayar/personel-tanim";
import type { SezonSatir } from "@/components/ayar/sezon-tanim";
import type { MasrafTuruSatir } from "@/components/ayar/masraf-turu-tanim";
import { updateFirma } from "@/lib/actions/tanimlar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ─── PROPS ─────────────────────────────────────── */

interface FirmaBilgi { unvan: string; vergiNo: string; vergiDairesi: string; adres: string; telefon: string }
interface SezonBilgi { ad: string; baslangic: string; bitis: string }
interface KullaniciOzet { id: string; ad: string; telefon: string; rol: string; aktif: boolean }

interface Props {
  ayarGoruntuleYetkisi: boolean;
  firmaGuncelleYetkisi: boolean;
  tanimOlusturYetkisi: boolean;
  tanimGuncelleYetkisi: boolean;
  tanimGoruntuleYetkisi: boolean;
  kullaniciYonetYetkisi: boolean;
  sistemGoruntuleYetkisi: boolean;
  firma: FirmaBilgi | null;
  sezon: SezonBilgi | null;
  kullanicilar: KullaniciOzet[];
  kullaniciSayisi: number;
  cariSayisi: number;
  hesap: number;
  depo: number;
  depolar: DepoSatir[];
  hesaplarTumu: HesapSatir[];
  araclar: AracSatir[];
  personel: PersonelSatir[];
  sezonlar: SezonSatir[];
  subeler: SubeSecenek[];
  masrafTurleri: MasrafTuruSatir[];
  roller: { id: string; ad: string }[];
}

type Sekme = "gorunum" | "firma" | "tanimlar" | "kullanicilar" | "sistem";

const SEKME_BILGI: { key: Sekme; etiket: string; ikon: LucideIcon }[] = [
  { key: "gorunum", etiket: "Görünüm", ikon: Palette },
  { key: "firma", etiket: "Firma", ikon: Building2 },
  { key: "tanimlar", etiket: "Tanımlar", ikon: FolderCog },
  { key: "kullanicilar", etiket: "Kullanıcılar", ikon: Users },
  { key: "sistem", etiket: "Sistem", ikon: Database },
];

/* ─── BİLEŞEN ───────────────────────────────────── */

export function AyarIcerik(props: Props) {
  const gorunenSekmeler = SEKME_BILGI.filter((sekme) =>
    ((sekme.key !== "gorunum" && sekme.key !== "firma") || props.ayarGoruntuleYetkisi)
    && (sekme.key !== "tanimlar" || props.tanimGoruntuleYetkisi)
    && (sekme.key !== "kullanicilar" || props.kullaniciYonetYetkisi)
    && (sekme.key !== "sistem" || props.sistemGoruntuleYetkisi),
  );
  const [secilen, setSecilen] = useState<Sekme>(gorunenSekmeler[0]?.key ?? "gorunum");

  return (
    <div className="mt-3 md:flex md:gap-6">
      {/* Sekme nav — mobil: kaydırmalı chip bar; desktop: dikey */}
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:mb-0 md:w-44 md:shrink-0 md:flex-col md:gap-1 md:overflow-visible">
        {gorunenSekmeler.map((s) => {
          const aktif = secilen === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSecilen(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors md:w-full",
                aktif
                  ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                  : "text-sky-100 hover:bg-[var(--surface)] hover:text-sky-100"
              )}
            >
              <s.ikon className="h-4 w-4" />
              <span className="whitespace-nowrap">{s.etiket}</span>
            </button>
          );
        })}
      </nav>

      {/* İçerik alanı */}
      <div className="min-w-0 flex-1 space-y-6">
        {secilen === "gorunum" && props.ayarGoruntuleYetkisi && <GorunumSekme />}
        {secilen === "firma" && props.ayarGoruntuleYetkisi && <FirmaSekme firma={props.firma} sezon={props.sezon} guncelleYetkisi={props.firmaGuncelleYetkisi} />}
        {secilen === "tanimlar" && props.tanimGoruntuleYetkisi && (
          <TanimlarSekme
            olusturYetkisi={props.tanimOlusturYetkisi}
            guncelleYetkisi={props.tanimGuncelleYetkisi}
            kullaniciYonetYetkisi={props.kullaniciYonetYetkisi}
            veri={{
              depolar: props.depolar,
              subeler: props.subeler,
              hesaplar: props.hesaplarTumu,
              kullanicilar: props.kullanicilar,
              araclar: props.araclar,
              personel: props.personel,
              sezonlar: props.sezonlar,
              masrafTurleri: props.masrafTurleri,
              roller: props.roller,
            }}
          />
        )}
        {secilen === "kullanicilar" && props.kullaniciYonetYetkisi && (
          <KullaniciSekme kullanicilar={props.kullanicilar} kullaniciSayisi={props.kullaniciSayisi} />
        )}
        {secilen === "sistem" && props.sistemGoruntuleYetkisi && <SistemSekme {...props} />}
      </div>
    </div>
  );
}

/* ─── GÖRÜNÜM SEKMESİ ───────────────────────────── */

function GorunumSekme() {
  return (
    <>
      <div className="md:hidden">
        <h2 className="mb-1 text-lg font-extrabold text-white">Görünüm</h2>
        <p className="mb-4 text-sm text-sky-100">Tema, stil ve yazı tipi ayarları</p>
      </div>
      <TemaToggle />
      <RenkSecici />
      <StilSecici />
      <FontAyar />
    </>
  );
}

/* ─── LIGHT/DARK TOGGLE ──────────────────────────── */

function TemaToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme !== "light";

  return (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sky-100">
        Tema Modu
      </h3>
      <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3">
          <Sun className={cn("h-5 w-5", isDark ? "text-sky-500" : "text-[var(--primary)]")} />
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              isDark ? "bg-slate-600" : "bg-[var(--primary)]"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                isDark ? "left-0.5" : "left-[22px]"
              )}
            />
          </button>
          <Moon className={cn("h-5 w-5", isDark ? "text-[var(--primary)]" : "text-sky-500")} />
        </div>
        <div className="text-sm font-bold text-sky-100">
          {isDark ? "Karanlık Mod" : "Aydınlık Mod"}
        </div>
      </div>
    </div>
  );
}

/* ─── FİRMA SEKMESİ ──────────────────────────────── */

function FirmaSekme({ firma, sezon, guncelleYetkisi }: { firma: FirmaBilgi | null; sezon: SezonBilgi | null; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [unvan, setUnvan] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [adres, setAdres] = useState("");
  const [telefon, setTelefon] = useState("");

  function duzenleAc() {
    setUnvan(firma?.unvan ?? "");
    setVergiNo(firma?.vergiNo ?? "");
    setVergiDairesi(firma?.vergiDairesi ?? "");
    setAdres(firma?.adres ?? "");
    setTelefon(firma?.telefon ?? "");
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const sonuc = await updateFirma({
        unvan: unvan.trim(),
        vergiNo: vergiNo.trim() || undefined,
        vergiDairesi: vergiDairesi.trim() || undefined,
        adres: adres.trim(),
        telefon: telefon.trim(),
      });
      if (sonuc.ok) {
        toast.success("Firma bilgileri güncellendi");
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Güncellenemedi", { description: sonuc.hata });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--primary)]" />
          <span className="text-sm font-bold text-sky-100">Firma Bilgileri</span>
        </div>
        {guncelleYetkisi && <button
          type="button"
          onClick={duzenleAc}
          disabled={!firma}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-4 text-sm font-semibold text-sky-100 transition active:scale-[0.97] disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" /> Düzenle
        </button>}
      </div>

      <Satir ikon={Building2} baslik="Firma Ünvanı" deger={firma?.unvan ?? "—"} />
      <Satir ikon={MapPin} baslik="Adres" deger={firma?.adres || "—"} />
      <Satir ikon={Phone} baslik="Telefon" deger={firma?.telefon || "—"} />
      <Satir ikon={Building2} baslik="Vergi No" deger={firma?.vergiNo || "—"} />
      <Satir ikon={Building2} baslik="Vergi Dairesi" deger={firma?.vergiDairesi || "—"} />
      <Satir
        ikon={Database}
        baslik="Aktif Sezon"
        deger={sezon?.ad ?? "—"}
        alt={sezon ? `${tarihFormat(sezon.baslangic)} → ${tarihFormat(sezon.bitis)}` : ""}
      />

      {guncelleYetkisi && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firma Bilgilerini Düzenle</DialogTitle>
            <DialogDescription>Fiş, rapor ve yazıcı çıktılarında görünecek firma kimlik bilgileri.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Firma ünvanı</Label>
              <Input
                value={unvan}
                onChange={(e) => setUnvan(e.target.value)}
                placeholder="ör: Filbert Fındık San. Tic. Ltd. Şti."
                className="saha-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vergi no (opsiyonel)</Label>
                <Input
                  inputMode="numeric"
                  value={vergiNo}
                  onChange={(e) => setVergiNo(e.target.value)}
                  placeholder="__________"
                  className="saha-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vergi dairesi (opsiyonel)</Label>
                <Input
                  value={vergiDairesi}
                  onChange={(e) => setVergiDairesi(e.target.value)}
                  placeholder="ör: Giresun"
                  className="saha-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Adres</Label>
              <Input
                value={adres}
                onChange={(e) => setAdres(e.target.value)}
                placeholder="Firma açık adresi"
                className="saha-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input
                inputMode="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                placeholder="0 (5__) ___ __ __"
                className="saha-input"
              />
            </div>
            <button
              type="button"
              disabled={pending || !unvan.trim() || !adres.trim() || !telefon.trim()}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}

/* ─── KULLANICI SEKMESİ ──────────────────────────── */

function KullaniciSekme({ kullanicilar, kullaniciSayisi }: { kullanicilar: KullaniciOzet[]; kullaniciSayisi: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--primary)]" />
        <span className="text-sm font-bold text-sky-100">Toplam {kullaniciSayisi} kullanıcı</span>
      </div>
      <div className="space-y-1.5">
        {kullanicilar.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-[var(--surface)] p-3"
          >
            <div>
              <div className="font-bold text-sky-100">{k.ad}</div>
              <div className="text-xs text-sky-100">{k.telefon || "—"}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {!k.aktif && (
                <span className="rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-extrabold text-sky-100">
                  Pasif
                </span>
              )}
              <span className="rounded-full bg-[var(--primary)]/20 px-2.5 py-0.5 text-xs font-extrabold text-[var(--primary)]">
                {k.rol}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SİSTEM SEKMESİ ─────────────────────────────── */

function SistemSekme(props: Props) {
  return (
    <div className="space-y-1.5">
      <Satir ikon={Users} baslik="Cari Kartı" deger={String(props.cariSayisi)} alt="üretici / tüccar / fabrika" />
      <Satir ikon={ShieldAlert} baslik="Kasa / Banka Hesabı" deger={String(props.hesap)} alt="aktif hesap sayısı" />
      <Satir ikon={Database} baslik="Depo" deger={String(props.depo)} alt="aktif depo sayısı" />
    </div>
  );
}

/* ─── SATIR YARDIMCISI ───────────────────────────── */

function Satir({
  ikon: Ikon,
  baslik,
  deger,
  alt,
}: {
  ikon: LucideIcon;
  baslik: string;
  deger: string;
  alt?: string;
}) {
  return (
    <div className="ozet-kart flex items-center gap-3">
      <Ikon className="h-5 w-5 shrink-0 text-[var(--primary)]" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-sky-100">{baslik}</div>
        <div className="truncate font-extrabold tabular-nums text-sky-100">{deger}</div>
        {alt && <div className="text-[11px] text-sky-100">{alt}</div>}
      </div>
    </div>
  );
}

/* ─── FORMAT ─────────────────────────────────────── */

function tarihFormat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
}
