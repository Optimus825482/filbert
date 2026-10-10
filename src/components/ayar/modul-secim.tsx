"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Lock, LogIn, Package, ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULLER, type ModulId } from "@/lib/modul";
import { aktifModuluDegistir, varsayilanModuluGuncelle } from "@/lib/actions/modul";

const IKONLAR: Record<ModulId, typeof Package> = {
  alim: ShoppingBasket,
  islem: Package,
};

const ACIKLAMALAR: Record<ModulId, string> = {
  alim: "Alım fişi, randıman, emanet, virman, sevk, finans, cari ve raporlar.",
  islem: "Talep kaydı, kırım → kavurma → paketleme takibi, teslim, tahsilat, kasa ve etiket.",
};

/**
 * Modül seçimi: hem ekranın hemen değiştirilmesini hem de giriş sonrası
 * açılacak modülün kullanıcı kaydına yazılmasını sağlar. Mobil kullanıcılar
 * bu ekrana alt menüdeki Ayarlar butonundan ulaşır.
 */
export function ModulSecim({
  aktifModul,
  varsayilanModul,
  yetkiliModuller,
}: {
  aktifModul: ModulId;
  varsayilanModul: ModulId;
  yetkiliModuller: ModulId[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [girisModulu, setGirisModulu] = useState<ModulId>(varsayilanModul);

  const gec = (modul: ModulId) => startTransition(async () => {
    const sonuc = await aktifModuluDegistir(modul);
    if (sonuc.ok) {
      toast.success(`${MODULLER[modul].ad} açılıyor`);
      router.push(MODULLER[modul].anaRota);
    } else {
      toast.error(sonuc.hata ?? "Modül değiştirilemedi");
    }
  });

  const varsayilaniKaydet = () => startTransition(async () => {
    const sonuc = await varsayilanModuluGuncelle(girisModulu);
    if (sonuc.ok) {
      toast.success("Girişte açılacak modül kaydedildi", { description: MODULLER[girisModulu].ad });
      router.refresh();
    } else {
      toast.error(sonuc.hata ?? "Kaydedilemedi");
    }
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-extrabold text-[var(--app-fg)]">Modül Seçimi</h2>
        <p className="mt-0.5 text-xs text-sky-100">
          Uygulama iki modüle ayrılır. Her modül yalnızca kendi menülerini ve işlevlerini gösterir; buradan geçiş yapabilirsiniz.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["alim", "islem"] as ModulId[]).map((modul) => {
          const Ikon = IKONLAR[modul];
          const yetkili = yetkiliModuller.includes(modul);
          const secili = aktifModul === modul;
          return (
            <div
              key={modul}
              className={cn(
                "rounded-2xl border p-4",
                secili ? "border-[#f5c518]/50 bg-[#f5c518]/10" : "border-[var(--surface-border)] bg-[var(--surface)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    secili ? "bg-[#f5c518]/20 text-[#f5c518]" : "bg-white/5 text-sky-100"
                  )}
                >
                  <Ikon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold text-[var(--app-fg)]">{MODULLER[modul].ad}</div>
                  {secili && (
                    <span className="text-[11px] font-extrabold text-[#f5c518]">Şu an açık</span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-sky-100">{ACIKLAMALAR[modul]}</p>
              {!yetkili ? (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-sky-500">
                  <Lock className="h-3.5 w-3.5" /> Bu modüle erişim yetkiniz yok
                </p>
              ) : secili ? (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Bu modüldesiniz
                </p>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => gec(modul)}
                  className="saha-btn mt-3 inline-flex w-full items-center justify-center gap-2 bg-[#f5c518] font-extrabold text-[#0b1b3a] disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  {MODULLER[modul].gecEtiketi}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="text-sm font-extrabold text-[var(--app-fg)]">Giriş yaptığımda açılsın</h3>
        </div>
        <p className="mt-1 text-xs text-sky-100">
          Seçim kullanıcı kaydınıza yazılır; bir sonraki girişinizde doğrudan bu modülün ekranı açılır.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["alim", "islem"] as ModulId[]).map((modul) => {
            const yetkili = yetkiliModuller.includes(modul);
            return (
              <button
                key={modul}
                type="button"
                disabled={pending || !yetkili}
                onClick={() => setGirisModulu(modul)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition disabled:opacity-40",
                  girisModulu === modul
                    ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "border-[var(--surface-border)] text-sky-100 hover:text-white"
                )}
              >
                {girisModulu === modul && <Check className="h-3.5 w-3.5" />}
                {MODULLER[modul].ad}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={pending || girisModulu === varsayilanModul}
          onClick={varsayilaniKaydet}
          className="saha-btn mt-3 w-full bg-[var(--primary)] text-white disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Giriş modülünü kaydet"}
        </button>
        <p className="mt-2 text-[11px] text-sky-100">
          Şu an kayıtlı: <b className="text-[var(--app-fg)]">{MODULLER[varsayilanModul].ad}</b>
        </p>
      </div>
    </section>
  );
}