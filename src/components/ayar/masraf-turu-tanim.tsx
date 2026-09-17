"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMasrafTuru, updateMasrafTuru, toggleMasrafTuruAktif } from "@/lib/actions/tanimlar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt } from "lucide-react";
import { AktifButon, AktifRozet, BosDurum, DuzenleButon, TanimBaslik, TanimSatir } from "./tanim-ortak";

export interface MasrafTuruSatir {
  id: string;
  ad: string;
  aktif: boolean;
}

export function MasrafTuruTanim({ turler, olusturYetkisi, guncelleYetkisi }: { turler: MasrafTuruSatir[]; olusturYetkisi: boolean; guncelleYetkisi: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<MasrafTuruSatir | null>(null);
  const [ad, setAd] = useState("");

  function yeniAc() {
    setDuzenlenen(null);
    setAd("");
    setAcik(true);
  }

  function duzenleAc(t: MasrafTuruSatir) {
    setDuzenlenen(t);
    setAd(t.ad);
    setAcik(true);
  }

  function gonder() {
    startTransition(async () => {
      const sonuc = duzenlenen ? await updateMasrafTuru(duzenlenen.id, { ad: ad.trim() }) : await createMasrafTuru({ ad: ad.trim() });
      if (sonuc.ok) {
        toast.success(duzenlenen ? "Masraf türü güncellendi" : "Masraf türü eklendi", { description: ad.trim() });
        setAcik(false);
        router.refresh();
      } else {
        toast.error("Kaydedilemedi", { description: sonuc.hata });
      }
    });
  }

  function aktifToggle(t: MasrafTuruSatir) {
    startTransition(async () => {
      const sonuc = await toggleMasrafTuruAktif(t.id);
      if (sonuc.ok) {
        toast.success(t.aktif ? "Masraf türü pasifleştirildi" : "Masraf türü aktifleştirildi", { description: t.ad });
        router.refresh();
      } else {
        toast.error("İşlem başarısız", { description: sonuc.hata });
      }
    });
  }

  return (
    <div>
      <TanimBaslik ikon={Receipt} baslik="Masraf Türleri" adet={turler.length} onYeni={olusturYetkisi ? yeniAc : undefined} />

      {turler.length === 0 ? (
        <BosDurum mesaj="Henüz masraf türü tanımlı değil — sağ üstten ekleyin" />
      ) : (
        <div className="space-y-1.5">
          {turler.map((t) => (
            <TanimSatir key={t.id}>
              <div className="min-w-0">
                <div className="truncate font-bold text-[var(--app-fg)]">{t.ad}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AktifRozet aktif={t.aktif} />
                {guncelleYetkisi && <><DuzenleButon onClick={() => duzenleAc(t)} disabled={pending} /><AktifButon aktif={t.aktif} onClick={() => aktifToggle(t)} disabled={pending} /></>}
              </div>
            </TanimSatir>
          ))}
        </div>
      )}

      {(olusturYetkisi || guncelleYetkisi) && <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{duzenlenen ? "Masraf Türü Düzenle" : "Yeni Masraf Türü"}</DialogTitle>
            <DialogDescription>
              Masraf kaydı girerken seçilecek türler (ör: Nakliye, Kantar, Hamaliye...). Tür adı güncellenirse geçmiş masraf kayıtlarındaki görünen ad da güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="masraf-turu-ad">Masraf türü adı</Label>
              <Input
                id="masraf-turu-ad"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                placeholder="ör: Nakliye"
                className="saha-input"
              />
            </div>
            <button
              type="button"
              disabled={pending || !ad.trim()}
              onClick={gonder}
              className="saha-btn w-full bg-[var(--primary)] text-white"
            >
              {pending ? "Kaydediliyor..." : duzenlenen ? "Güncelle" : "Masraf Türü Ekle"}
            </button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
