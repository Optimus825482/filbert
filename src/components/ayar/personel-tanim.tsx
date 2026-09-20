"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPersonel, updatePersonel, togglePersonelAktif } from "@/lib/actions/tanimlar";
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
import { HardHat } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface PersonelSatir {
  id: string;
  ad: string;
  telefon: string | null;
  gorev: string;
  tckn: string | null;
  aktif: boolean;
}

const GOREVLER = [
  { v: "SOFOR", e: "Şoför" },
  { v: "KANTAR", e: "Kantar" },
  { v: "HAMALI", e: "Hamalı" },
  { v: "DEPOCI", e: "Depocu" },
  { v: "SAHA", e: "Saha" },
];

const GOREV_ETIKET: Record<string, string> = Object.fromEntries(GOREVLER.map((g) => [g.v, g.e]));

export function PersonelTanim({ personel, olusturYetkisi, guncelleYetkisi }: { personel: PersonelSatir[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<PersonelSatir | null>(null);
  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gorev, setGorev] = useState("SAHA");
  const [tckn, setTckn] = useState("");

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setTelefon("");
    setGorev("SAHA");
    setTckn("");
    setAcik(true);
  }

  function duzenleAc(p: PersonelSatir) {
    setDuzenlenen(p);
    setAd(p.ad);
    setTelefon(p.telefon ?? "");
    setGorev(p.gorev);
    setTckn(p.tckn ?? "");
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const girdi = {
        ad: ad.trim(),
        telefon: telefon.trim() || undefined,
        gorev,
        tckn: tckn.trim() || undefined,
      };
      const sonuc = duzenlenen ? await updatePersonel(duzenlenen.id, girdi) : await createPersonel(girdi);
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Personel güncellendi" : "Personel eklendi", { description: ad.trim() });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(p: PersonelSatir) {
    startTransition(async () => {
      const sonuc = await togglePersonelAktif(p.id);
      if (sonuc.ok) {
        toast.success(p.aktif ? "Personel pasifleştirildi" : "Personel aktifleştirildi", { description: p.ad });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  const tcknGecerli = !tckn.trim() || /^\d{11}$/.test(tckn.trim());

  return (
    <div>
      <TanimBaslik ikon={HardHat} baslik="Personel" adet={personel.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {personel.length === 0 ? (
        <BosDurum mesaj="Henüz personel tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {personel.map((p) => (
            <TanimSatir key={p.id}>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--app-fg)]">{p.ad}</div>
                <div className="truncate text-xs text-sky-100">
                  {[GOREV_ETIKET[p.gorev] ?? p.gorev, p.telefon].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={p.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(p)} disabled={pending} /><AktifButon aktif={p.aktif} onClick={() => aktifToggle(p)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Personel Düzenle" : "Yeni Personel"}</DialogTitle>
            <DialogDescription>
              Kantar, hamaliye ve depo işlerinde görevlendirilecek saha personeli.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ad soyad</Label>
              <Input
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: Hasan Demir"
                className="saha-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefon (opsiyonel)</Label>
                <Input
                  inputMode="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="05__ ___ __ __"
                  className="saha-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Görev</Label>
                <Select value={gorev} onValueChange={setGorev}>
                  <SelectTrigger className="saha-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOREVLER.map((g) => (
                      <SelectItem key={g.v} value={g.v}>
                        {g.e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>TCKN (opsiyonel)</Label>
              <Input
                inputMode="numeric"
                maxLength={11}
                value={tckn}
                onChange={(e) => setTckn(e.target.value.replace(/\D/g, ""))}
                placeholder="11 haneli TC kimlik no"
                className="saha-input"
              />
              {!tcknGecerli && <p className="text-xs font-semibold text-red-400">TCKN 11 haneli olmalı</p>}
            </div>
            <button
              type="button"
              disabled={pending || !ad.trim() || !tcknGecerli}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Personel Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
