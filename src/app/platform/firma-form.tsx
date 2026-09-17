"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { firmaKur } from "@/lib/actions/platform";
import { mevcutFirmaGetir, firmaVerileriniSifirla } from "@/lib/actions/reset-firma";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface MevcutFirma {
  id: string;
  unvan: string;
  adres: string;
  telefon: string;
  vergiNo: string;
  sahip: { ad: string; eposta: string } | null;
}

const FIELDS = [
  ["unvan", "Firma unvanı", "text"],
  ["adres", "Açık adres", "text"],
  ["telefon", "Telefon", "tel"],
  ["vergiNo", "Vergi numarası", "text"],
  ["sahipAd", "Firma sahibi adı", "text"],
  ["sahipEposta", "Firma sahibi e-posta", "email"],
  ["sahipSifre", "Firma sahibi parolası (en az 6 karakter, harf ve rakam)", "password"],
] as const;

export function FirmaForm() {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [mevcut, setMevcut] = useState<MevcutFirma | null>(null);
  const [resetDialogAcik, setResetDialogAcik] = useState(false);
  const [ikinciOnayAcik, setIkinciOnayAcik] = useState(false);
  const [resetliyor, startResetTransition] = useTransition();

  useEffect(() => {
    mevcutFirmaGetir().then((f) => {
      if (f) setMevcut(f as MevcutFirma);
    }).catch(() => {});
  }, []);

  async function submit(data: FormData) {
    setBusy(true);
    const sonuc = await firmaKur(data);
    setBusy(false);
    if (sonuc.ok && sonuc.firmaId) { router.replace(`/platform/${sonuc.firmaId}/tanimlar`); return; }
    setMesaj(sonuc.hata);
  }

  async function sifirla() {
    if (!mevcut) return;
    startResetTransition(async () => {
      // Yalnız görüntülenen firma sıfırlanır; platformdaki diğer kiracılar korunur.
      const sonuc = await firmaVerileriniSifirla(mevcut.id);
      if (sonuc.ok) {
        setMevcut(null);
        setResetDialogAcik(false);
        setIkinciOnayAcik(false);
        router.refresh();
      } else {
        setMesaj(sonuc.hata ?? "Silme başarısız");
      }
    });
  }

  // Mevcut firma varsa inputlara pre-fill değerleri hazırla
  const defaults = mevcut ? {
    unvan: mevcut.unvan,
    adres: mevcut.adres,
    telefon: mevcut.telefon,
    vergiNo: mevcut.vergiNo,
    sahipAd: mevcut.sahip?.ad ?? "",
    sahipEposta: mevcut.sahip?.eposta ?? "",
    sahipSifre: "",
  } : {};

  return (
    <>
      {/* İlk onay: Firma zaten var */}
      <ConfirmDialog
        open={!!mevcut && !resetDialogAcik && !ikinciOnayAcik}
        onOpenChange={() => {}}
        title="Firma kaydı bulundu"
        description={mevcut ? mevcut.unvan + " firması sisteme daha önce tanımlanmış. Baştan sıfırdan kurmak ister misiniz? Hayır derseniz mevcut bilgilerle devam edebilirsiniz." : ""}
        confirmLabel="Evet, Sıfırdan Kur"
        cancelLabel="Hayır, Devam Et"
        destructive
        onConfirm={() => setResetDialogAcik(true)}
      />

      {/* Reset dialog (ilk onaydan sonra) */}
      <ConfirmDialog
        open={resetDialogAcik}
        onOpenChange={(o) => !o && setResetDialogAcik(false)}
        title="⚠️ BU FIRMA SİLİNECEK"
        description={"Bu işlem geri alınamaz! " + (mevcut?.unvan ?? "") + " firmasına ait tüm cari hesaplar, alım/satış fişleri, stok hareketleri ve kullanıcı verileri kalıcı olarak silinecek. Platformdaki diğer firmalar etkilenmez. Emin misiniz?"}
        confirmLabel="EVET, HER ŞEYİ SİL"
        cancelLabel="Vazgeç"
        destructive
        onConfirm={() => { setResetDialogAcik(false); setIkinciOnayAcik(true); }}
      />

      {/* İkinci onay (final) */}
      <ConfirmDialog
        open={ikinciOnayAcik}
        onOpenChange={(o) => !o && setIkinciOnayAcik(false)}
        title="SON UYARI — Geri dönüş yok!"
        description="Bu işlem tüm firma, cari, stok, finans ve kullanıcı verilerini kalıcı olarak siler. Devam etmek istediğinizden emin misiniz?"
        confirmLabel={resetliyor ? "Siliniyor…" : "EVET, SİL VE BAŞTAN KUR"}
        cancelLabel="İptal"
        destructive
        onConfirm={sifirla}
      />

      {/* Form */}
      <form action={submit} className="mt-7 grid gap-3">
        {FIELDS.map(([name, label, type]) => (
          <input
            key={name}
            name={name}
            type={type}
            required
            minLength={name === "sahipSifre" ? 6 : undefined}
            className="rounded-lg border p-3"
            placeholder={label}
            defaultValue={defaults[name as keyof typeof defaults] ?? ""}
          />
        ))}
        {mesaj && <p className="text-sm text-red-600">{mesaj}</p>}

        {mevcut ? (
          /* "Devam" butonu — mevcut firmayla sisteme giriş */
          <button
            type="button"
            onClick={() => router.push("/")}
            disabled={busy || resetliyor}
            className="rounded-lg bg-emerald-700 p-3 font-bold text-white"
          >
            Mevcut Firmayla Devam Et →
          </button>
        ) : (
          /* Normal kurulum butonu */
          <button disabled={busy || resetliyor} className="rounded-lg bg-filbert-600 p-3 font-bold text-white">
            {busy ? "Kuruluyor…" : "Firmayı kur"}
          </button>
        )}
      </form>
    </>
  );
}