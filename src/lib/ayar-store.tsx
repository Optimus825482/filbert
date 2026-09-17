"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* ─── TİPLER ─────────────────────────────────────── */

export type RenkTemasi = "yesil" | "altin" | "mavi" | "mor";
export type WindowsStili = "win11" | "vista" | "xp";
export type FontOlcek = "sm" | "md" | "lg" | "xl";

export interface AyarTercihleri {
  renkTemasi: RenkTemasi;
  windowsStili: WindowsStili;
  fontOlcek: FontOlcek;
}

const VARSAYILAN: AyarTercihleri = {
  renkTemasi: "yesil",
  windowsStili: "win11",
  fontOlcek: "md",
};

/* ─── localStorage ────────────────────────────────── */

const STORAGE_KEY = "filbert-ayarlar";

function okuTercihler(): AyarTercihleri {
  if (typeof window === "undefined") return VARSAYILAN;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return VARSAYILAN;
    const parsed = JSON.parse(raw);
    return { ...VARSAYILAN, ...parsed };
  } catch {
    return VARSAYILAN;
  }
}

function yazTercihler(t: AyarTercihleri) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* quota aşımı sessizce geç */
  }
}

/* ─── DOM SENKRONİZASYONU ────────────────────────── */

function applyToDOM(t: AyarTercihleri) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;

  // Renk teması
  html.setAttribute("data-theme", t.renkTemasi);

  // Windows stili
  html.setAttribute("data-windows", t.windowsStili);

  // Font ölçeği — mevcut font sınıfını temizle, yenisini ekle
  html.classList.remove("font-sm", "font-md", "font-lg", "font-xl");
  html.classList.add(`font-${t.fontOlcek}`);
}

/* ─── CONTEXT ─────────────────────────────────────── */

interface AyarContextValue {
  ayar: AyarTercihleri;
  setRenkTemasi: (v: RenkTemasi) => void;
  setWindowsStili: (v: WindowsStili) => void;
  setFontOlcek: (v: FontOlcek) => void;
  sifirla: () => void;
}

const AyarContext = createContext<AyarContextValue | null>(null);

export function AyarProvider({ children }: { children: ReactNode }) {
  const [ayar, setAyar] = useState<AyarTercihleri>(VARSAYILAN);

  // localStorage değeri hydration sonrasında hem duruma hem DOM'a uygulanır.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const t = okuTercihler();
      setAyar(t);
      applyToDOM(t);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const guncelle = useCallback((guncel: AyarTercihleri) => {
    setAyar(guncel);
    yazTercihler(guncel);
    applyToDOM(guncel);
    try { window.parent?.postMessage({ type: "filbert-ayarlar-changed" }, "*"); } catch {}
  }, []);

  const setRenkTemasi = useCallback(
    (v: RenkTemasi) => guncelle({ ...ayar, renkTemasi: v }),
    [ayar, guncelle],
  );
  const setWindowsStili = useCallback(
    (v: WindowsStili) => guncelle({ ...ayar, windowsStili: v }),
    [ayar, guncelle],
  );
  const setFontOlcek = useCallback(
    (v: FontOlcek) => guncelle({ ...ayar, fontOlcek: v }),
    [ayar, guncelle],
  );
  const sifirla = useCallback(() => guncelle(VARSAYILAN), [guncelle]);

  return (
    <AyarContext.Provider value={{ ayar, setRenkTemasi, setWindowsStili, setFontOlcek, sifirla }}>
      {children}
    </AyarContext.Provider>
  );
}

export function useAyar() {
  const ctx = useContext(AyarContext);
  if (!ctx) throw new Error("useAyar must be used within AyarProvider");
  return ctx;
}

/* ─── YARDIMCI: sunucu-safe tema değerleri ───────── */

export const TEMA_BILGI: Record<RenkTemasi, { etiket: string; renk: string; aciklama: string }> = {
  yesil: { etiket: "Filbert Yeşil", renk: "#15803d", aciklama: "Zümrüt yeşili — marka kimliği" },
  altin: { etiket: "Fındık Altın", renk: "#f5c518", aciklama: "Sıcak altın — fındık tonu" },
  mavi: { etiket: "Okyanus Mavi", renk: "#2563eb", aciklama: "Derin mavi — profesyonel" },
  mor: { etiket: "Gece Moru", renk: "#7c3aed", aciklama: "Koyu mor — modern" },
};

export const STIL_BILGI: Record<WindowsStili, { etiket: string; icon: string; aciklama: string }> = {
  win11: { etiket: "Windows 11", icon: "⊞", aciklama: "Fluent tasarım — yumuşak, modern" },
  vista: { etiket: "Windows Vista", icon: "🪟", aciklama: "Aero cam efekti — parlak, glossy" },
  xp: { etiket: "Windows XP", icon: "🖥️", aciklama: "Luna tarzı — klasik, belirgin" },
};

export const FONT_OLCEK_BILGI: Record<FontOlcek, { etiket: string; oran: string }> = {
  sm: { etiket: "Küçük", oran: "%90" },
  md: { etiket: "Normal", oran: "%100" },
  lg: { etiket: "Büyük", oran: "%112" },
  xl: { etiket: "Çok Büyük", oran: "%125" },
};
